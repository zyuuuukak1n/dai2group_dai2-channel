import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPostWithSecrets, markPostAsDeleted } from '../repositories/postRepository';
import { compareDeleteKey } from '../core/crypto';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const threadId = event.pathParameters?.threadId;
    const postId = event.pathParameters?.postId;
    if (!threadId || !postId) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: { code: 'INVALID_PARAMETER', message: 'Thread ID and Post ID are required' } }),
      };
    }

    const body = JSON.parse(event.body || '{}');
    const password = body.password;
    if (!password) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: { code: 'INVALID_PARAMETER', message: 'パスワードは必須です' } }),
      };
    }

    const post = await getPostWithSecrets(threadId, postId);
    if (!post) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'レスが見つかりません' } }),
      };
    }

    if (!post.DeleteKeyHash) {
      return {
        statusCode: 403,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: { code: 'FORBIDDEN', message: 'パスワードが一致しません。' } }),
      };
    }

    const isMatch = await compareDeleteKey(password, post.DeleteKeyHash);
    if (!isMatch) {
      return {
        statusCode: 403,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: { code: 'FORBIDDEN', message: 'パスワードが一致しません。' } }),
      };
    }

    await markPostAsDeleted(threadId, postId);

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'レスを削除しました。' }),
    };

  } catch (error) {
    console.error('Error in deletePost:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' } }),
    };
  }
};
