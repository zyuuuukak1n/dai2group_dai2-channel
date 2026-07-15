import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../repositories/dbClient';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const connectionId = event.requestContext.connectionId;
  const threadId = event.queryStringParameters?.threadId;

  if (!connectionId) {
    return { statusCode: 400, body: 'Connection ID missing' };
  }
  if (!threadId) {
    return { statusCode: 400, body: 'Thread ID missing' };
  }

  // API Gatewayから来たIDに thread# が付いていない場合は付与する
  const formattedThreadId = threadId.startsWith('thread#') ? threadId : `thread#${threadId}`;

  const tableName = process.env.CONNECTIONS_TABLE_NAME;
  if (!tableName) throw new Error('CONNECTIONS_TABLE_NAME not set');

  try {
    const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24h TTL
    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: {
        ConnectionId: connectionId,
        ThreadId: formattedThreadId,
        ExpiresAt: expiresAt,
      }
    }));
    return { statusCode: 200, body: 'Connected.' };
  } catch (e) {
    console.error('wsConnect error:', e);
    return { statusCode: 500, body: 'Failed to connect.' };
  }
};
