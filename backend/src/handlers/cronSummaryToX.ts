import { EventBridgeEvent } from 'aws-lambda';
import { getThreads } from '../repositories/threadRepository';

// Dummy function to simulate posting to X (Twitter)
async function postToX(text: string) {
  console.log('Posting to X:', text);
}

export const handler = async (event: EventBridgeEvent<any, any>): Promise<void> => {
  try {
    // A real implementation would scan today's newly created posts and aggregate them by thread.
    // For simplicity, we just take the top 3 threads by momentum, assuming they have the most activity today.
    // Alternatively, query GSI by Latest and sort in memory for today's activity if we tracked daily deltas.
    const result = await getThreads('momentum', 3);
    const topThreads = result.threads;
    
    if (topThreads.length === 0) return;

    let message = `📊 今日のだいにコミュニティまとめ 📊\n\n本日最も書き込みが多かったスレッドTOP3！\n\n`;

    topThreads.forEach((thread, index) => {
      const rank = index === 0 ? '1️⃣' : index === 1 ? '2️⃣' : '3️⃣';
      message += `${rank} ${thread.title} (${thread.resCount}レス)\n`;
    });

    message += `\n▼ だいにちゃんねるトップへ\nhttps://your-domain.com/\n\n#だいにぐるーぷ`;
    
    await postToX(message);
  } catch (e) {
    console.error('Failed to run summary cron', e);
  }
};
