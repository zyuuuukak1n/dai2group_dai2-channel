import { UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, getTableName } from './dbClient';

const tableName = getTableName();

export type StatType = 'PAGEVIEW' | 'THREAD' | 'POST';

function getTodayString() {
  const d = new Date();
  // Adjust for JST (+9) to align with Japanese dates for stats
  d.setHours(d.getHours() + 9);
  return d.toISOString().split('T')[0];
}

export async function incrementStat(type: StatType, count: number = 1) {
  const date = getTodayString();
  await docClient.send(new UpdateCommand({
    TableName: tableName,
    Key: {
      PK: `STAT#${date}`,
      SK: `METRIC#${type}`,
    },
    UpdateExpression: 'ADD #c :val',
    ExpressionAttributeNames: {
      '#c': 'Count'
    },
    ExpressionAttributeValues: {
      ':val': count
    }
  }));
}

export async function getStats(days: number = 30) {
  // To get stats for the last N days, we could query them one by one or scan. 
  // Since we only query 30 items max, Promise.all is fine.
  const dates = [];
  const d = new Date();
  d.setHours(d.getHours() + 9);
  for (let i = 0; i < days; i++) {
    const past = new Date(d);
    past.setDate(past.getDate() - i);
    dates.push(past.toISOString().split('T')[0]);
  }

  const results = await Promise.all(dates.map(date => 
    docClient.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `STAT#${date}`,
        ':sk': 'METRIC#',
      },
    }))
  ));

  const stats = dates.map((date, idx) => {
    const items = results[idx].Items || [];
    return {
      date,
      pageviews: items.find(i => i.SK === 'METRIC#PAGEVIEW')?.Count || 0,
      threads: items.find(i => i.SK === 'METRIC#THREAD')?.Count || 0,
      posts: items.find(i => i.SK === 'METRIC#POST')?.Count || 0,
    };
  });

  return stats.reverse(); // oldest first for charts
}
