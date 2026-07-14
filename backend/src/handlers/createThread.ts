import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { validateThreadCreation, ValidationError } from '../core/validation';
import { generateDailyId, hashIp, generateTrip, hashDeleteKey } from '../core/crypto';
import { calculateMomentum } from '../core/momentum';
import { sanitizeHtml } from '../core/sanitize';
import { createThreadWithFirstPost, ThreadMetadata } from '../repositories/threadRepository';
import { config } from '../config';

const sqsClient = new SQSClient({});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    validateThreadCreation(body);

    const now = new Date().toISOString();
    const threadId = `thread#${Date.now()}`;
    const postId = `POST#0001`;

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
    const sanitizedTitle = sanitizeHtml(body.title);

    const metadata: ThreadMetadata = {
      threadId,
      title: sanitizedTitle,
      resCount: 1,
      momentumScore: calculateMomentum(1, now),
      createdAt: now,
      lastUpdatedAt: now,
    };

    const postItem = {
      PK: threadId,
      SK: postId,
      Number: 1,
      AuthorName: authorName,
      ...(trip ? { Trip: trip } : {}),
      DailyID: dailyId,
      Body: sanitizedBody,
      CreatedAt: now,
      IsDeleted: false,
      IPHash: ipHash,
      ...(deleteKeyHash ? { DeleteKeyHash: deleteKeyHash } : {}),
    };

    await createThreadWithFirstPost(metadata, postItem);

    // Send SQS Message
    if (config.queueUrl) {
      await sqsClient.send(new SendMessageCommand({
        QueueUrl: config.queueUrl,
        MessageBody: JSON.stringify({ type: 'NEW_THREAD', threadId, title: sanitizedTitle }),
      }));
    }

    return {
      statusCode: 201,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ threadId, postId, message: 'スレッドを作成しました。' }),
    };

  } catch (error) {
    console.error('Error in createThread:', error);
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
