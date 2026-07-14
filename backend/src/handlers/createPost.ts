import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { validatePostCreation, ValidationError } from '../core/validation';
import { generateDailyId, hashIp, generateTrip, hashDeleteKey } from '../core/crypto';
import { calculateMomentum } from '../core/momentum';
import { sanitizeHtml } from '../core/sanitize';
import { getThreadById } from '../repositories/threadRepository';
import { createPost } from '../repositories/postRepository';
import { getGlobalPushSubscription, getThreadSubscribers } from '../repositories/extendedRepository';
import { incrementStat } from '../repositories/statsRepository';
import { config } from '../config';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import * as webpush from 'web-push';

const ssm = new SSMClient({});
let pushKeysCache: { publicKey: string, privateKey: string } | null = null;

async function getPushKeys() {
  if (pushKeysCache) return pushKeysCache;
  const [pub, priv] = await Promise.all([
    ssm.send(new GetParameterCommand({ Name: '/dai2channel/vapid/publicKey' })),
    ssm.send(new GetParameterCommand({ Name: '/dai2channel/vapid/privateKey', WithDecryption: true }))
  ]);
  pushKeysCache = { publicKey: pub.Parameter?.Value || '', privateKey: priv.Parameter?.Value || '' };
  return pushKeysCache;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const rawThreadId = event.pathParameters?.threadId;
    if (!rawThreadId) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: { code: 'INVALID_PARAMETER', message: 'Thread ID is required' } }),
      };
    }
    
    // API Gatewayから来たIDに thread# が付いていない場合は付与する
    const threadId = rawThreadId.startsWith('thread#') ? rawThreadId : `thread#${rawThreadId.replace(/^thread%23/, '')}`;

    const body = JSON.parse(event.body || '{}');
    validatePostCreation(body);

    const thread = await getThreadById(threadId);
    if (!thread) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'スレッドが見つかりません' } }),
      };
    }

    const now = new Date().toISOString();
    const newResCount = thread.resCount + 1;
    const postId = `POST#${String(newResCount).padStart(4, '0')}`;

    const clientIp = event.requestContext.identity.sourceIp || '127.0.0.1';
    
    // Core Logic
    const dailyId = generateDailyId(clientIp, config.dailyIdSalt);
    const ipHash = hashIp(clientIp, config.ipHashSalt);
    
    let trip;
    let authorName = body.authorName ? sanitizeHtml(body.authorName) : '名無し';
    
    if (authorName.includes('#')) {
      const parts = authorName.split('#');
      authorName = parts[0] || '名無し';
      const tripPassword = parts.slice(1).join('#');
      if (tripPassword) {
        trip = generateTrip(tripPassword, config.tripSalt);
      }
    }

    let deleteKeyHash;
    if (body.password) {
      deleteKeyHash = await hashDeleteKey(body.password);
    }

    const sanitizedBody = sanitizeHtml(body.body);
    const isSage = body.mail && body.mail.toLowerCase() === 'sage';

    const newMomentum = isSage 
      ? thread.momentumScore 
      : calculateMomentum(newResCount, thread.createdAt);

    const postItem = {
      PK: threadId,
      SK: postId,
      Number: newResCount,
      AuthorName: authorName,
      ...(trip ? { Trip: trip } : {}),
      DailyID: dailyId,
      Body: sanitizedBody,
      CreatedAt: now,
      IsDeleted: false,
      IPHash: ipHash,
      ...(deleteKeyHash ? { DeleteKeyHash: deleteKeyHash } : {}),
      ...(body.mediaUrl ? { MediaUrl: body.mediaUrl } : {}),
      ...(body.deviceId ? { DeviceId: body.deviceId } : {}),
    };

    const updatedMetadata = {
      ...thread,
      resCount: newResCount,
      momentumScore: newMomentum,
      lastUpdatedAt: isSage ? thread.lastUpdatedAt : now,
    };

    await createPost(updatedMetadata, postItem, isSage);
    await incrementStat('POST');

    // --- PUSH NOTIFICATION LOGIC ---
    // 1. Thread level subscriptions
    const threadSubscribers = await getThreadSubscribers(threadId);
    
    // Extract mentions like >>1, >>2
    const mentions = new Set<number>();
    const anchorRegex = />>(\d+)/g;
    let match;
    while ((match = anchorRegex.exec(body.body)) !== null) {
      mentions.add(parseInt(match[1], 10));
    }

    // Combine target deviceIds
    const targetDeviceIds = new Set<string>();
    
    // Add thread subscribers (except the author's own device)
    for (const devId of threadSubscribers) {
      if (devId !== body.deviceId) {
        targetDeviceIds.add(devId);
      }
    }

    // Add anchor mention authors
    if (mentions.size > 0) {
      const { getPostByNumber } = await import('../repositories/postRepository');
      for (const mention of mentions) {
        const targetPost = await getPostByNumber(threadId, mention);
        if (targetPost && targetPost.DeviceId && targetPost.DeviceId !== body.deviceId) {
          targetDeviceIds.add(targetPost.DeviceId);
        }
      }
    }

    if (targetDeviceIds.size > 0) {
      const keys = await getPushKeys();
      webpush.setVapidDetails('mailto:admin@dai2channel.local', keys.publicKey, keys.privateKey);

      for (const devId of targetDeviceIds) {
        const sub = await getGlobalPushSubscription(devId);
        if (sub) {
          try {
            await webpush.sendNotification(sub, JSON.stringify({
              title: thread.title,
              body: `${newResCount} ：${authorName}\n${sanitizedBody.substring(0, 50)}${sanitizedBody.length > 50 ? '...' : ''}`,
              url: `/threads/${threadId.replace('thread#', '')}#post-${newResCount}`
            }));
          } catch (e) {
            console.error('Push notification failed for devId:', devId, e);
          }
        }
      }
    }

    return {
      statusCode: 201,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ postId, number: newResCount, message: '書き込みました。' }),
    };

  } catch (error) {
    console.error('Error in createPost:', error);
    if (error instanceof ValidationError) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: { code: 'INVALID_PARAMETER', message: error.message } }),
      };
    }
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' } }),
    };
  }
};
