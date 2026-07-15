import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../repositories/dbClient';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const connectionId = event.requestContext.connectionId;

  if (!connectionId) {
    return { statusCode: 400, body: 'Connection ID missing' };
  }

  const tableName = process.env.CONNECTIONS_TABLE_NAME;
  if (!tableName) throw new Error('CONNECTIONS_TABLE_NAME not set');

  try {
    await docClient.send(new DeleteCommand({
      TableName: tableName,
      Key: {
        ConnectionId: connectionId
      }
    }));
    return { statusCode: 200, body: 'Disconnected.' };
  } catch (e) {
    console.error('wsDisconnect error:', e);
    return { statusCode: 500, body: 'Failed to disconnect.' };
  }
};
