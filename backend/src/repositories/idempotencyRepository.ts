import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from './dbClient';

export async function checkAndLockIdempotencyKey(key: string): Promise<boolean> {
  if (!process.env.IDEMPOTENCY_TABLE_NAME) {
    console.warn('IDEMPOTENCY_TABLE_NAME not set');
    return true; // Skip if table is not configured
  }

  try {
    const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours TTL
    const command = new PutCommand({
      TableName: process.env.IDEMPOTENCY_TABLE_NAME,
      Item: {
        IdempotencyKey: key,
        ExpiresAt: expiresAt,
      },
      ConditionExpression: 'attribute_not_exists(IdempotencyKey)',
    });

    await docClient.send(command);
    return true; // Successfully locked
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      return false; // Key already exists
    }
    throw error;
  }
}
