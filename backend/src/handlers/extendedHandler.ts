import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { getTags, createTag, deleteTag, getAllTickets, getTicketWithMessages, addTicketMessage, updateTicketStatus, deleteThread, deletePost, saveGlobalPushSubscription, saveThreadPushSubscription, removeThreadPushSubscription } from '../repositories/extendedRepository';
import { incrementStat } from '../repositories/statsRepository';

const ssm = new SSMClient({});
let publicKeyCache: string | null = null;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const path = event.path;
    const method = event.httpMethod;
    const headers = { 'Access-Control-Allow-Origin': '*' };

    // --- CLIENT TAGS ---
    if (path === '/tags' && method === 'GET') {
      const tags = await getTags();
      return { statusCode: 200, headers, body: JSON.stringify({ tags }) };
    }

    // --- CLIENT STATS ---
    if (path === '/stats/pageview' && method === 'POST') {
      await incrementStat('PAGEVIEW');
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // --- CLIENT TICKETS ---
    if (path === '/tickets' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const ticketId = Math.random().toString(36).substring(2, 10) + '-' + Math.random().toString(36).substring(2, 10);
      await createTicket(ticketId, body.title || 'お問い合わせ', body.body || '', body.userId, body.mediaUrl);
      return { statusCode: 201, headers, body: JSON.stringify({ ticketId }) };
    }
    if (path === '/tickets/my' && method === 'GET') {
      const userId = event.queryStringParameters?.userId;
      if (!userId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing userId parameter' }) };
      const { getTicketsByUser } = await import('../repositories/extendedRepository.js');
      const tickets = await getTicketsByUser(userId);
      return { statusCode: 200, headers, body: JSON.stringify({ tickets }) };
    }
    if (path.startsWith('/tickets/') && method === 'GET') {
      const id = path.split('/')[2];
      const ticket = await getTicketWithMessages(id);
      if (!ticket) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
      return { statusCode: 200, headers, body: JSON.stringify({ ticket }) };
    }
    if (path.startsWith('/tickets/') && path.endsWith('/reply') && method === 'POST') {
      const id = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      await addTicketMessage(id, body.body || '', false, body.mediaUrl);
      return { statusCode: 201, headers, body: JSON.stringify({ success: true }) };
    }

    // --- PUSH NOTIFICATIONS ---
    if (path === '/push/public-key' && method === 'GET') {
      if (!publicKeyCache) {
        const pub = await ssm.send(new GetParameterCommand({ Name: '/dai2channel/vapid/publicKey' }));
        publicKeyCache = pub.Parameter?.Value || '';
      }
      return { statusCode: 200, headers, body: JSON.stringify({ publicKey: publicKeyCache }) };
    }
    if (path === '/push/subscribe-global' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { deviceId, subscription } = body;
      if (!deviceId || !subscription) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing parameters' }) };
      }
      await saveGlobalPushSubscription(deviceId, subscription);
      return { statusCode: 201, headers, body: JSON.stringify({ success: true }) };
    }
    
    if (path === '/push/subscribe-thread' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { threadId, deviceId, subscribe } = body;
      if (!threadId || !deviceId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing parameters' }) };
      }
      if (subscribe) {
        await saveThreadPushSubscription(threadId, deviceId);
      } else {
        await removeThreadPushSubscription(threadId, deviceId);
      }
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Internal Error' }) };
  }
};
