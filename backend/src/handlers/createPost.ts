import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { validatePostCreation, ValidationError } from '../core/validation';
import { generateDailyId, hashIp, generateTrip, hashDeleteKey } from '../core/crypto';
import { calculateMomentum } from '../core/momentum';
import { sanitizeHtml } from '../core/sanitize';
import { getThreadById } from '../repositories/threadRepository';
import { createPost } from '../repositories/postRepository';
import { config } from '../config';

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
    };

    const updatedMetadata = {
      ...thread,
      resCount: newResCount,
      momentumScore: newMomentum,
      lastUpdatedAt: isSage ? thread.lastUpdatedAt : now,
    };

    await createPost(updatedMetadata, postItem, isSage);

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
