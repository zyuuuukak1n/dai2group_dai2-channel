import { SQSEvent } from 'aws-lambda';

// Dummy function to simulate posting to X (Twitter)
async function postToX(text: string) {
  console.log('Posting to X:', text);
  // Implementation for X API goes here.
  // Use `twitter-api-v2` or standard fetch with keys from Parameter Store
}

export const handler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body);
      if (body.type === 'NEW_THREAD') {
        const title = body.title;
        // Strip 'thread#' prefix for URL
        const threadId = body.threadId.replace('thread#', '');
        
        // Ensure whitespace lines as specified
        const message = `🆕 新しいスレッドが立ちました！\n\n『${title}』\n\n▼ 最初から読む\nhttps://your-domain.com/threads/${threadId}\n\n#だいにぐるーぷ`;
        
        await postToX(message);
      }
    } catch (e) {
      console.error('Failed to process SQS message', e);
    }
  }
};
