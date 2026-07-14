import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getThreads, getThreadsLatest } from '../repositories/threadRepository';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const sort = event.queryStringParameters?.sort === 'latest' ? 'latest' : 'momentum';
    const limit = Math.min(parseInt(event.queryStringParameters?.limit || '50', 10) || 50, 100);
    const cursor = event.queryStringParameters?.cursor;

    let result;
    if (sort === 'latest') {
      result = await getThreadsLatest(limit, cursor);
    } else {
      result = await getThreads('momentum', limit, cursor);
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        threads: result.threads,
        nextCursor: result.nextCursor,
      }),
    };
  } catch (error) {
    console.error('Error in getThreads:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' } }),
    };
  }
};
