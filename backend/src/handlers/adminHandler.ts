import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { getTags, createTag, deleteTag, getAllTickets, getTicketWithMessages, addTicketMessage, updateTicketStatus, deleteThread, deletePost } from '../repositories/extendedRepository';
import { getStats } from '../repositories/statsRepository';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../repositories/dbClient';

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID!,
  tokenUse: 'id',
  clientId: process.env.USER_POOL_CLIENT_ID!,
});

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'yukiyakiyu854@icloud.com';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const path = event.path;
    const method = event.httpMethod;

    // CORS Headers
    const headers = { 'Access-Control-Allow-Origin': '*' };

    // --- AUTH MIDDLEWARE ---
    const authHeader = event.headers.Authorization || event.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    try {
      const payload = await verifier.verify(token);
      if (payload.email !== ADMIN_EMAIL) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden: Admins only' }) };
      }
    } catch (e) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    // --- ADMIN TAGS ---
    if (path === '/admin/tags' && method === 'GET') {
      const tags = await getTags();
      return { statusCode: 200, headers, body: JSON.stringify({ tags }) };
    }
    if (path === '/admin/tags' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (!body.id || !body.name) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing fields' }) };
      await createTag(body.id, body.name);
      return { statusCode: 201, headers, body: JSON.stringify({ success: true }) };
    }
    if (path.startsWith('/admin/tags/') && method === 'DELETE') {
      const id = path.split('/').pop() || '';
      await deleteTag(id);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // --- ADMIN TICKETS ---
    if (path === '/admin/tickets' && method === 'GET') {
      const tickets = await getAllTickets();
      return { statusCode: 200, headers, body: JSON.stringify({ tickets }) };
    }
    if (path.startsWith('/admin/tickets/') && method === 'GET') {
      const id = path.split('/')[3];
      const ticket = await getTicketWithMessages(id);
      if (!ticket) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
      return { statusCode: 200, headers, body: JSON.stringify({ ticket }) };
    }
    if (path.startsWith('/admin/tickets/') && path.endsWith('/reply') && method === 'POST') {
      const id = path.split('/')[3];
      const body = JSON.parse(event.body || '{}');
      await addTicketMessage(id, body.body || '', true, body.mediaUrl);
      return { statusCode: 201, headers, body: JSON.stringify({ success: true }) };
    }
    if (path.startsWith('/admin/tickets/') && path.endsWith('/status') && method === 'POST') {
      const id = path.split('/')[3];
      const body = JSON.parse(event.body || '{}');
      if (body.status) {
        await updateTicketStatus(id, body.status);
      }
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // --- ADMIN STATS ---
    if (path === '/admin/stats' && method === 'GET') {
      // Allow overriding days, default 30
      const days = parseInt(event.queryStringParameters?.days || '30');
      const stats = await getStats(days);
      return { statusCode: 200, headers, body: JSON.stringify({ stats }) };
    }

    // --- ADMIN THREADS ---
    if (path === '/admin/threads' && method === 'GET') {
      const command = new QueryCommand({
        TableName: process.env.TABLE_NAME,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: {
          ':pk': 'BOARD#MAIN',
        },
        ScanIndexForward: false,
      });
      const res = await docClient.send(command);
      const threads = (res.Items || []).map(i => ({
        id: i.PK.replace('thread#', ''),
        title: i.Title,
        resCount: i.ResCount || 0,
        createdAt: i.CreatedAt,
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ threads }) };
    }

    // --- THREAD DELETION ---
    if (path.startsWith('/admin/threads/') && path.includes('/posts/') && method === 'DELETE') {
      // /admin/threads/{threadId}/posts/{postId}
      const parts = path.split('/');
      const threadId = decodeURIComponent(parts[3]);
      const postId = parts[5];
      await deletePost(threadId, postId);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }
    
    if (path.startsWith('/admin/threads/') && !path.includes('/posts/') && method === 'DELETE') {
      // /admin/threads/{threadId}
      const parts = path.split('/');
      const threadId = decodeURIComponent(parts[3]);
      await deleteThread(threadId);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Internal Error' }) };
  }
};
