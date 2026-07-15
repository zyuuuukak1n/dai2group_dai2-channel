import { QueryCommand, TransactWriteCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, getTableName } from './dbClient';
import { ThreadMetadata } from './threadRepository';

export async function getPostsByThreadId(threadId: string, limit: number, cursor?: string) {
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
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': threadId,
      ':skPrefix': 'POST#',
    },
    ScanIndexForward: true, // Ascending by post number
    Limit: limit,
    ExclusiveStartKey: exclusiveStartKey,
  });

  const response = await docClient.send(command);

  const posts = (response.Items || []).map(item => ({
    postId: item.SK,
    number: item.Number,
    authorName: item.AuthorName,
    trip: item.Trip, // Can be undefined
    dailyId: item.DailyID,
    body: item.Body,
    mediaUrl: item.MediaUrl,
    createdAt: item.CreatedAt,
    isDeleted: item.IsDeleted,
  }));

  let nextCursor: string | null = null;
  if (response.LastEvaluatedKey) {
    nextCursor = Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64');
  }

  return { posts, nextCursor };
}

export async function createPost(
  metadata: ThreadMetadata,
  postItem: any,
  isSage: boolean
): Promise<void> {
  const tableName = getTableName();

  const updateExprParts = [
    'ResCount = :newResCount',
    'Version = :newVersion'
  ];
  const exprAttrValues: any = {
    ':newResCount': metadata.resCount,
    ':newVersion': metadata.version + 1,
    ':currentVersion': metadata.version
  };

  if (!isSage) {
    updateExprParts.push('MomentumScore = :newMomentum');
    updateExprParts.push('LastUpdatedAt = :newLastUpdated');
    updateExprParts.push('GSI1SK = :newGsi1sk');
    // GSI2 is for latest sort. Need to update its SK as well
    updateExprParts.push('GSI2SK = :newGsi2sk');

    exprAttrValues[':newMomentum'] = metadata.momentumScore;
    exprAttrValues[':newLastUpdated'] = metadata.lastUpdatedAt;
    exprAttrValues[':newGsi1sk'] = `MOMENTUM#${String(metadata.momentumScore).padStart(7, '0')}`;
    exprAttrValues[':newGsi2sk'] = `LATEST#${metadata.lastUpdatedAt}`;
  }

  const updateExpression = `SET ${updateExprParts.join(', ')}`;

  const command = new TransactWriteCommand({
    TransactItems: [
      {
        Put: {
          TableName: tableName,
          Item: postItem,
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
      {
        Update: {
          TableName: tableName,
          Key: {
            PK: metadata.threadId,
            SK: 'METADATA',
          },
          UpdateExpression: updateExpression,
          ExpressionAttributeValues: exprAttrValues,
          ConditionExpression: 'attribute_exists(PK) AND (attribute_not_exists(Version) OR Version = :currentVersion)', 
        },
      },
    ],
  });

  await docClient.send(command);
}

export async function getPostWithSecrets(threadId: string, postId: string) {
  const command = new GetCommand({
    TableName: getTableName(),
    Key: {
      PK: threadId,
      SK: postId,
    },
  });

  const response = await docClient.send(command);
  return response.Item;
}

export async function getPostByNumber(threadId: string, postNumber: number) {
  const tableName = getTableName();
  const command = new GetCommand({
    TableName: tableName,
    Key: {
      PK: threadId,
      SK: `POST#${String(postNumber).padStart(4, '0')}`,
    },
  });
  const res = await docClient.send(command);
  return res.Item;
}

export async function markPostAsDeleted(threadId: string, postId: string) {
  const command = new UpdateCommand({
    TableName: getTableName(),
    Key: {
      PK: threadId,
      SK: postId,
    },
    UpdateExpression: 'SET IsDeleted = :isDeleted, Body = :body',
    ExpressionAttributeValues: {
      ':isDeleted': true,
      ':body': 'このレスは削除されました。',
    },
  });

  await docClient.send(command);
}
