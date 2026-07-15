interface Env {
  VITE_API_BASE_URL?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { params, next, env } = context;
  const threadId = params.threadId as string;

  // Fetch the static SPA HTML
  const response = await next();
  const resClone = new Response(response.body, response);

  try {
    const apiUrl = env.VITE_API_BASE_URL;
    if (!apiUrl) return resClone; // If no API URL, fallback to default HTML

    const apiRes = await fetch(`${apiUrl}/threads/thread%23${threadId}`);
    if (apiRes.ok) {
      const data: any = await apiRes.json();
      const title = data.title ? `${data.title} - だいにちゃんねる` : 'だいにちゃんねる';
      const description = data.resCount ? `レス数: ${data.resCount} | 勢い: ${data.momentumScore}` : '完全匿名・独立・爆速のファンコミュニティ掲示板';

      return new HTMLRewriter()
        .on('title', {
          element(element) {
            element.setInnerContent(title);
          }
        })
        .on('meta[property="og:title"]', {
          element(element) {
            element.setAttribute('content', title);
          }
        })
        .on('meta[name="description"]', {
          element(element) {
            element.setAttribute('content', description);
          }
        })
        .on('meta[property="og:description"]', {
          element(element) {
            element.setAttribute('content', description);
          }
        })
        .on('meta[name="twitter:title"]', {
          element(element) {
            element.setAttribute('content', title);
          }
        })
        .on('meta[name="twitter:description"]', {
          element(element) {
            element.setAttribute('content', description);
          }
        })
        .transform(resClone);
    }
  } catch (e) {
    // If API fetch fails, fallback to default HTML
  }

  return resClone;
};
