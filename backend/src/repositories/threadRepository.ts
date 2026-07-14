import { QueryCommand, TransactWriteCommand, GetCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, getTableName } from './dbClient';

export interface ThreadMetadata {
  threadId: string;
  title: string;
  resCount: number;
  momentumScore: number;
  createdAt: string;
  lastUpdatedAt: string;
  tagId?: string;
  editToken?: string;
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
    ...(metadata.tagId ? { TagId: metadata.tagId, GSI3PK: `TAG#${metadata.tagId}`, GSI3SK: `LATEST#${metadata.lastUpdatedAt}` } : {}),
    ...(metadata.editToken ? { EditToken: metadata.editToken } : {})
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

export async function getThreads(sort: 'momentum' | 'latest', limit: number, cursor?: string, tagId?: string) {
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
  let indexName = 'GSI1';
  let keyCondition = 'GSI1PK = :pk';
  let expressionValues: any = { ':pk': 'BOARD#MAIN' };

  if (tagId) {
    indexName = 'GSI3';
    keyCondition = 'GSI3PK = :pk';
    expressionValues = { ':pk': `TAG#${tagId}` };
  }

  const command = new QueryCommand({
    TableName: tableName,
    IndexName: indexName,
    KeyConditionExpression: keyCondition,
    ExpressionAttributeValues: expressionValues,
    ScanIndexForward: false, // Descending
    Limit: limit,
    ExclusiveStartKey: exclusiveStartKey,
  });

  const response = await docClient.send(command);
  const items = response.Items || [];

  // BatchGet to fetch missing fields (TagId) for GSI1/GSI2 if not available
  const fullItemsMap = new Map();
  if (items.length > 0) {
    const chunks = [];
    for (let i = 0; i < items.length; i += 100) {
      chunks.push(items.slice(i, i + 100));
    }
    for (const chunk of chunks) {
      const keys = chunk.map(i => ({ PK: i.PK, SK: 'METADATA' }));
      const batchRes = await docClient.send(new BatchGetCommand({
        RequestItems: {
          [tableName]: { Keys: keys }
        }
      }));
      const fetchedItems = batchRes.Responses?.[tableName] || [];
      for (const item of fetchedItems) {
        fullItemsMap.set(item.PK, item);
      }
    }
  }
  
  const threads = items.map(item => {
    const fullItem = fullItemsMap.get(item.PK) || item;
    return {
      threadId: item.PK,
      title: item.Title,
      resCount: item.ResCount,
      momentumScore: item.MomentumScore,
      createdAt: item.CreatedAt,
      lastUpdatedAt: item.LastUpdatedAt,
      tagId: fullItem.TagId,
      likeCount: item.LikeCount || 0,
    };
  });

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

export async function getThreadsLatest(limit: number, cursor?: string, tagId?: string) {
  const tableName = getTableName();
  
  let exclusiveStartKey: any = undefined;
  if (cursor) {
    try {
      exclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    } catch (e) {
      throw new Error('Invalid cursor');
    }
  }

  let indexName = 'GSI2';
  let keyCondition = 'GSI2PK = :pk';
  let expressionValues: any = { ':pk': 'BOARD#MAIN' };

  if (tagId) {
    indexName = 'GSI3';
    keyCondition = 'GSI3PK = :pk';
    expressionValues = { ':pk': `TAG#${tagId}` };
  }

  const command = new QueryCommand({
    TableName: tableName,
    IndexName: indexName,
    KeyConditionExpression: keyCondition,
    ExpressionAttributeValues: expressionValues,
    ScanIndexForward: false, // Descending
    Limit: limit,
    ExclusiveStartKey: exclusiveStartKey,
  });

  const response = await docClient.send(command);
  const items = response.Items || [];

  const fullItemsMap = new Map();
  if (items.length > 0) {
    const chunks = [];
    for (let i = 0; i < items.length; i += 100) {
      chunks.push(items.slice(i, i + 100));
    }
    for (const chunk of chunks) {
      const keys = chunk.map(i => ({ PK: i.PK, SK: 'METADATA' }));
      const batchRes = await docClient.send(new BatchGetCommand({
        RequestItems: {
          [tableName]: { Keys: keys }
        }
      }));
      const fetchedItems = batchRes.Responses?.[tableName] || [];
      for (const item of fetchedItems) {
        fullItemsMap.set(item.PK, item);
      }
    }
  }
  
  const threads = items.map(item => {
    const fullItem = fullItemsMap.get(item.PK) || item;
    return {
      threadId: item.PK,
      title: item.Title,
      resCount: item.ResCount,
      momentumScore: item.MomentumScore,
      createdAt: item.CreatedAt,
      lastUpdatedAt: item.LastUpdatedAt,
      tagId: fullItem.TagId,
      likeCount: item.LikeCount || 0,
    };
  });

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
    tagId: response.Item.TagId,
    likeCount: response.Item.LikeCount || 0,
  };
}
