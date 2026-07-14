import { EventBridgeEvent } from 'aws-lambda';
import { getThreads } from '../repositories/threadRepository';
import { getPostsByThreadId } from '../repositories/postRepository';

// Dummy function to simulate posting to X (Twitter)
async function postToX(text: string) {
  console.log('Posting to X:', text);
}

export const handler = async (event: EventBridgeEvent<any, any>): Promise<void> => {
  try {
    // Get top 1 thread by momentum
    const result = await getThreads('momentum', 1);
    const topThread = result.threads[0];
    
    if (!topThread) return;

    // TODO: implement LastPostedToXAt check via DB or other mechanism to avoid duplicates within 12h
    
    // Fetch latest post text snippet
    const postsResult = await getPostsByThreadId(topThread.threadId, 100); // we could fetch just the last one by scanning descending if GSI supported it, but our query is ascending. So we take the last of fetched
    const latestPost = postsResult.posts[postsResult.posts.length - 1];
    
    const snippet = latestPost?.body ? latestPost.body.substring(0, 40) : '';

    const threadId = topThread.threadId.replace('thread#', '');

    const message = `🔥 今、だいにちゃんねるで勢いのあるスレッド 🔥\n\n『${topThread.title}』\n（現在 ${topThread.resCount}レス / 勢い ${topThread.momentumScore}）\n\n💬 最新の書き込み:\n「${snippet}」\n\n▼ 続きはこちら\nhttps://your-domain.com/threads/${threadId}\n\n#だいにぐるーぷ`;
    
    await postToX(message);
  } catch (e) {
    console.error('Failed to run momentum cron', e);
  }
};
