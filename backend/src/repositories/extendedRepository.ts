import { PutCommand, QueryCommand, DeleteCommand, GetCommand, UpdateCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, getTableName } from './dbClient';

const tableName = getTableName();

// --- TAGS ---
export async function getTags() {
  const command = new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': 'CONFIG#TAGS',
      ':sk': 'TAG#',
    },
  });
  const res = await docClient.send(command);
  return (res.Items || []).map(item => ({ id: item.SK.replace('TAG#', ''), name: item.Name }));
}

export async function createTag(id: string, name: string) {
  const command = new PutCommand({
    TableName: tableName,
    Item: {
      PK: 'CONFIG#TAGS',
      SK: `TAG#${id}`,
      Name: name,
    },
  });
  await docClient.send(command);
}

export async function deleteTag(id: string) {
  const command = new DeleteCommand({
    TableName: tableName,
    Key: {
      PK: 'CONFIG#TAGS',
      SK: `TAG#${id}`,
    },
  });
  await docClient.send(command);
}

// --- TICKETS ---
export async function createTicket(ticketId: string, title: string, body: string, userId?: string, mediaUrl?: string) {
  const now = new Date().toISOString();
  await docClient.send(new PutCommand({
    TableName: tableName,
    Item: {
      PK: `TICKET#${ticketId}`,
      SK: 'METADATA',
      Title: title,
      Status: 'UNANSWERED',
      UserId: userId,
      CreatedAt: now,
      LastUpdatedAt: now,
      GSI1PK: 'CONFIG#TICKETS', // For listing tickets in admin
      GSI1SK: `TICKET#${now}`,
    },
  }));
  await addTicketMessage(ticketId, body, false, mediaUrl);
}

export async function addTicketMessage(ticketId: string, body: string, isAdmin: boolean, mediaUrl?: string) {
  const now = new Date().toISOString();
  await docClient.send(new PutCommand({
    TableName: tableName,
    Item: {
      PK: `TICKET#${ticketId}`,
      SK: `MSG#${now}`,
      Body: body,
      MediaUrl: mediaUrl,
      IsAdmin: isAdmin,
      CreatedAt: now,
    },
  }));
  await docClient.send(new UpdateCommand({
    TableName: tableName,
    Key: { PK: `TICKET#${ticketId}`, SK: 'METADATA' },
    UpdateExpression: 'SET LastUpdatedAt = :now',
    ExpressionAttributeValues: { ':now': now },
  }));
}

export async function updateTicketStatus(ticketId: string, status: string) {
  await docClient.send(new UpdateCommand({
    TableName: tableName,
    Key: { PK: `TICKET#${ticketId}`, SK: 'METADATA' },
    UpdateExpression: 'SET #st = :status, LastUpdatedAt = :now',
    ExpressionAttributeNames: { '#st': 'Status' },
    ExpressionAttributeValues: { ':status': status, ':now': new Date().toISOString() },
  }));
}

export async function getTicketWithMessages(ticketId: string) {
  const command = new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `TICKET#${ticketId}`,
    },
  });
  const res = await docClient.send(command);
  const items = res.Items || [];
  const metadata = items.find(i => i.SK === 'METADATA');
  const messages = items.filter(i => i.SK.startsWith('MSG#')).map(i => ({
    body: i.Body,
    mediaUrl: i.MediaUrl,
    isAdmin: i.IsAdmin,
    createdAt: i.CreatedAt,
  }));
  
  if (!metadata) return null;
  return { id: ticketId, title: metadata.Title, status: metadata.Status || 'UNANSWERED', userId: metadata.UserId, createdAt: metadata.CreatedAt, messages };
}

export async function getAllTickets() {
  const command = new QueryCommand({
    TableName: tableName,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': 'CONFIG#TICKETS',
      ':sk': 'TICKET#',
    },
    ScanIndexForward: false, // newest first
  });
  const res = await docClient.send(command);
  const items = res.Items || [];
  if (items.length === 0) return [];

  // BatchGet to get the missing Status field from the base table
  const chunks = [];
  for (let i = 0; i < items.length; i += 100) {
    chunks.push(items.slice(i, i + 100));
  }

  const fullItemsMap = new Map();
  for (const chunk of chunks) {
    const keys = chunk.map(i => ({ PK: i.PK, SK: i.SK }));
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

  return items.map(i => {
    const fullItem = fullItemsMap.get(i.PK) || i;
    return {
      id: i.PK.replace('TICKET#', ''),
      title: i.Title,
      status: fullItem.Status || 'UNANSWERED',
      userId: fullItem.UserId,
      createdAt: i.CreatedAt,
      lastUpdatedAt: i.LastUpdatedAt,
    };
  });
}

export async function getTicketsByUser(userId: string) {
  const allTickets = await getAllTickets();
  return allTickets.filter(t => t.userId === userId);
}

// --- PUSH SUBSCRIPTIONS (NEW DEVICE ID BASED) ---
export async function saveGlobalPushSubscription(deviceId: string, subscription: any) {
  const command = new PutCommand({
    TableName: tableName,
    Item: {
      PK: `DEVICE#${deviceId}`,
      SK: `PUSH_SUB`,
      Subscription: subscription,
      CreatedAt: new Date().toISOString(),
    },
  });
  await docClient.send(command);
}

export async function getGlobalPushSubscription(deviceId: string) {
  const command = new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'PK = :pk AND SK = :sk',
    ExpressionAttributeValues: {
      ':pk': `DEVICE#${deviceId}`,
      ':sk': `PUSH_SUB`,
    },
  });
  const res = await docClient.send(command);
  return res.Items && res.Items.length > 0 ? res.Items[0].Subscription : null;
}

export async function saveThreadPushSubscription(threadId: string, deviceId: string) {
  const command = new PutCommand({
    TableName: tableName,
    Item: {
      PK: `THREAD_SUB#${threadId}`,
      SK: `DEVICE#${deviceId}`,
      CreatedAt: new Date().toISOString(),
    },
  });
  await docClient.send(command);
}

export async function removeThreadPushSubscription(threadId: string, deviceId: string) {
  const command = new DeleteCommand({
    TableName: tableName,
    Key: {
      PK: `THREAD_SUB#${threadId}`,
      SK: `DEVICE#${deviceId}`,
    },
  });
  await docClient.send(command);
}

export async function getThreadSubscribers(threadId: string): Promise<string[]> {
  const command = new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `THREAD_SUB#${threadId}`,
      ':sk': 'DEVICE#',
    },
  });
  const res = await docClient.send(command);
  return (res.Items || []).map(i => i.SK.replace('DEVICE#', ''));
}

// --- ADMIN FEATURES ---
export async function deleteThread(threadId: string) {
  // Hard delete metadata so it doesn't show in list
  // Note: threadId is like 'thread#123', but sometimes it's passed without 'thread#', let's handle both
  const pk = threadId.startsWith('thread#') ? threadId : `thread#${threadId}`;
  await docClient.send(new DeleteCommand({
    TableName: tableName,
    Key: {
      PK: pk,
      SK: 'METADATA',
    },
  }));
}

export async function deletePost(threadId: string, postId: string) {
  const pk = threadId.startsWith('thread#') ? threadId : `thread#${threadId}`;
  await docClient.send(new UpdateCommand({
    TableName: tableName,
    Key: {
      PK: pk,
      SK: `POST#${postId}`,
    },
    UpdateExpression: 'SET IsDeleted = :del',
    ExpressionAttributeValues: {
      ':del': true,
    },
  }));
}
