import { QueryCommand, TransactWriteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, getTableName } from './dbClient';

export interface ThreadMetadata {
  threadId: string;
  title: string;
  resCount: number;
  momentumScore: number;
  createdAt: string;
  lastUpdatedAt: string;
}

export async function createThreadWithFirstPost(
  metadata: ThreadMetadata,
  postItem: any
): Promise<void> {
  const tableName = getTableName();
  const gsi1sk = `MOMENTUM#${String(metadata.momentumScore).padStart(7, '0')}`;

  const metadataItem = {
    PK: metadata.threadId,
    SK: 'METADATA',
    GSI1PK: 'BOARD#MAIN',
    GSI1SK: gsi1sk,
    GSI2PK: 'BOARD#MAIN',
    GSI2SK: `LATEST#${metadata.lastUpdatedAt}`,
    Title: metadata.title,
    ResCount: metadata.resCount,
    MomentumScore: metadata.momentumScore,
    CreatedAt: metadata.createdAt,
    LastUpdatedAt: metadata.lastUpdatedAt,
  };

  const command = new TransactWriteCommand({
    TransactItems: [
      {
        Put: {
          TableName: tableName,
          Item: metadataItem,
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
      {
        Put: {
          TableName: tableName,
          Item: postItem,
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
    ],
  });

  await docClient.send(command);
}

export async function getThreads(sort: 'momentum' | 'latest', limit: number, cursor?: string) {
  const tableName = getTableName();
  
  let exclusiveStartKey: any = undefined;
  if (cursor) {
    try {
      exclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    } catch (e) {
      throw new Error('Invalid cursor');
    }
  }

  const isMomentum = sort === 'momentum';
  const command = new QueryCommand({
    TableName: tableName,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'BOARD#MAIN',
    },
    ScanIndexForward: false, // Descending
    Limit: limit,
    ExclusiveStartKey: exclusiveStartKey,
  });

  const response = await docClient.send(command);
  
  const threads = (response.Items || []).map(item => ({
    threadId: item.PK,
    title: item.Title,
    resCount: item.ResCount,
    momentumScore: item.MomentumScore,
    createdAt: item.CreatedAt,
    lastUpdatedAt: item.LastUpdatedAt,
  }));

  let nextCursor: string | null = null;
  if (response.LastEvaluatedKey) {
    nextCursor = Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64');
  }

  // If sort is 'latest', we need to re-sort locally because GSI1 is always ordered by momentumScore.
  // Wait, if sort is latest, GSI1 isn't sufficient unless we have another GSI or use LastUpdatedAt for SK.
  // Actually, we can use a different GSI for 'latest', or just sort in memory if not too large? 
  // Let's create GSI2 for latest sort.
  
  return { threads, nextCursor };
}

export async function getThreadsLatest(limit: number, cursor?: string) {
  const tableName = getTableName();
  
  let exclusiveStartKey: any = undefined;
  if (cursor) {
    try {
      exclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    } catch (e) {
      throw new Error('Invalid cursor');
    }
  }

  const command = new QueryCommand({
    TableName: tableName,
    IndexName: 'GSI2',
    KeyConditionExpression: 'GSI2PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'BOARD#MAIN',
    },
    ScanIndexForward: false, // Descending
    Limit: limit,
    ExclusiveStartKey: exclusiveStartKey,
  });

  const response = await docClient.send(command);
  
  const threads = (response.Items || []).map(item => ({
    threadId: item.PK,
    title: item.Title,
    resCount: item.ResCount,
    momentumScore: item.MomentumScore,
    createdAt: item.CreatedAt,
    lastUpdatedAt: item.LastUpdatedAt,
  }));

  let nextCursor: string | null = null;
  if (response.LastEvaluatedKey) {
    nextCursor = Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64');
  }
  
  return { threads, nextCursor };
}

export async function getThreadById(threadId: string) {
  const command = new GetCommand({
    TableName: getTableName(),
    Key: {
      PK: threadId,
      SK: 'METADATA',
    },
  });

  const response = await docClient.send(command);
  if (!response.Item) return null;

  return {
    threadId: response.Item.PK,
    title: response.Item.Title,
    resCount: response.Item.ResCount,
    momentumScore: response.Item.MomentumScore,
    createdAt: response.Item.CreatedAt,
    lastUpdatedAt: response.Item.LastUpdatedAt,
  };
}
