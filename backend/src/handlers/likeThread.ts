import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { hashIp } from '../core/crypto';
import { getConfig } from '../config';
import { docClient, getTableName } from '../repositories/dbClient';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

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
    const threadId = rawThreadId.startsWith('thread#') ? rawThreadId : `thread#${rawThreadId.replace(/^thread%23/, '')}`;
    const clientIp = event.requestContext.identity.sourceIp || '127.0.0.1';
    const config = await getConfig();
    const ipHash = hashIp(clientIp, config.ipHashSalt);

    const tableName = getTableName();
    
    const command = new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: tableName,
            Item: {
              PK: `LIKE#${threadId}`,
              SK: ipHash,
              CreatedAt: new Date().toISOString(),
            },
            ConditionExpression: 'attribute_not_exists(PK)',
          },
        },
        {
          Update: {
            TableName: tableName,
            Key: {
              PK: threadId,
              SK: 'METADATA',
            },
            UpdateExpression: 'SET LikeCount = if_not_exists(LikeCount, :start) + :inc',
            ExpressionAttributeValues: {
              ':inc': 1,
              ':start': 0,
            },
            ConditionExpression: 'attribute_exists(PK)', // Ensure thread exists
          },
        },
      ],
    });

    await docClient.send(command);

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, message: 'Liked successfully' }),
    };
  } catch (error: any) {
    console.error('Error in likeThread:', error);
    if (error.name === 'TransactionCanceledException') {
      return {
        statusCode: 409,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: { code: 'ALREADY_LIKED', message: 'You have already liked this thread' } }),
      };
    }
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' } }),
    };
  }
};
