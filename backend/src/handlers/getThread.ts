import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getThreadById } from '../repositories/threadRepository';
import { getPostsByThreadId } from '../repositories/postRepository';

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

    const limit = Math.min(parseInt(event.queryStringParameters?.limit || '500', 10) || 500, 500);
    const cursor = event.queryStringParameters?.cursor;

    const thread = await getThreadById(threadId);
    if (!thread) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'スレッドが見つかりません' } }),
      };
    }

    const result = await getPostsByThreadId(threadId, limit, cursor);

    // Remove internal secrets from response
    const sanitizedPosts = result.posts.map(post => {
      // The repository already excludes IPHash and DeleteKeyHash, but let's be double sure
      const { IPHash, DeleteKeyHash, ...safePost } = post as any;
      return safePost;
    });

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        thread,
        posts: sanitizedPosts,
        nextCursor: result.nextCursor,
      }),
    };
  } catch (error) {
    console.error('Error in getThread:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' } }),
    };
  }
};
