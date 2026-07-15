import { QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from './dbClient';

export async function getConnectionsByThreadId(threadId: string) {
  const tableName = process.env.CONNECTIONS_TABLE_NAME;
  if (!tableName) return [];

  // GSI on ThreadId to query all connectionIds for a given thread
  // Alternatively, if it's not a GSI, we could structure the table: PK: ThreadId, SK: ConnectionId
  // Since we only query by ThreadId and delete by ConnectionId, let's use PK=ConnectionId for wsDisconnect,
  // and GSI1PK=ThreadId for querying.
  // Wait, if PK=ConnectionId, we can't easily query by ThreadId without a GSI.
  // We'll assume GSI1 is set up for ThreadId -> ConnectionId.
  const command = new QueryCommand({
    TableName: tableName,
    IndexName: 'GSI1',
    KeyConditionExpression: 'ThreadId = :threadId',
    ExpressionAttributeValues: {
      ':threadId': threadId,
    },
  });

  const response = await docClient.send(command);
  return response.Items?.map(i => i.ConnectionId) || [];
}

export async function removeConnection(connectionId: string) {
  const tableName = process.env.CONNECTIONS_TABLE_NAME;
  if (!tableName) return;

  await docClient.send(new DeleteCommand({
    TableName: tableName,
    Key: { ConnectionId: connectionId }
  }));
}
