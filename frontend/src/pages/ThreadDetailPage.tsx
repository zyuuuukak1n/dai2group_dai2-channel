import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import useSWR from 'swr';
import { fetcher, createPost, apiFetch, API_BASE_URL, WS_BASE_URL } from '../lib/api';
import MediaUpload from '../components/MediaUpload';
import { checkIsAdmin } from '../lib/auth';
import { useNGFilter } from '../features/moderation/useNGFilter';


export default function ThreadDetailPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);

  const { data, error, mutate } = useSWR(`/threads/${encodeURIComponent(threadId || '')}`, fetcher, {
    refreshInterval: 10000,
  });
  const { data: tagsData } = useSWR('/tags', fetcher);
  const [editToken, setEditToken] = useState<string | null>(null);

  const [isLiked, setIsLiked] = useState(false);
  const { data: isAdmin } = useSWR('isAdmin', checkIsAdmin);

  const [authorName, setAuthorName] = useState('');
  const [mail, setMail] = useState('');
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const { isHidden } = useNGFilter();

  useEffect(() => {
    if (!threadId) return;

    let ws: WebSocket;
    const connectWs = () => {
      const url = new URL(WS_BASE_URL);
      url.searchParams.append('threadId', threadId);
      ws = new WebSocket(url.toString());

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'NEW_POST') {
            mutate((currentData: any) => {
              if (!currentData) return currentData;
              // Check if post already exists
              if (currentData.posts.some((p: any) => p.postId === payload.post.postId)) {
                return currentData;
              }
              return {
                ...currentData,
                thread: {
                  ...currentData.thread,
                  resCount: Math.max(currentData.thread.resCount, payload.post.number)
                },
                posts: [...currentData.posts, payload.post]
              };
            }, false);
          }
        } catch (e) {
          console.error('WS message error', e);
        }
      };

      ws.onclose = () => {
        // Auto-reconnect after 3s
        setTimeout(connectWs, 3000);
      };
    };

    connectWs();

    return () => {
      if (ws) {
        ws.onclose = null; // Prevent reconnect loop
        ws.close();
      }
    };
  }, [threadId, mutate]);

  useEffect(() => {
    if (data && threadId) {
      const history = JSON.parse(localStorage.getItem('dai2_history') || '[]');
      if (!history.find((h: any) => (typeof h === 'string' ? h : h.id) === threadId)) {
        history.push({ id: threadId, title: data.thread.title });
        localStorage.setItem('dai2_history', JSON.stringify(history));
      }

      const tokens = JSON.parse(localStorage.getItem('dai2_edit_tokens') || '{}');
      if (tokens[threadId]) {
        setEditToken(tokens[threadId]);
      }

      const likedThreads = JSON.parse(localStorage.getItem('dai2_liked') || '[]');
      if (likedThreads.includes(threadId)) {
        setIsLiked(true);
      }
    }
  }, [data, threadId]);

  useEffect(() => {
    if (isLiked && threadId) {
      const likedThreads = JSON.parse(localStorage.getItem('dai2_liked') || '[]');
      if (!likedThreads.includes(threadId)) {
        likedThreads.push(threadId);
        localStorage.setItem('dai2_liked', JSON.stringify(likedThreads));
      }
    }
  }, [isLiked, threadId]);

  const toggleBookmark = () => {
    if (!threadId || !data) return;
    const bookmarks = JSON.parse(localStorage.getItem('dai2_bookmarks') || '[]');
    const isBookmarked = bookmarks.some((b: any) => (typeof b === 'string' ? b : b.id) === threadId);
    if (isBookmarked) {
      const newB = bookmarks.filter((b: any) => (typeof b === 'string' ? b : b.id) !== threadId);
      localStorage.setItem('dai2_bookmarks', JSON.stringify(newB));
      alert('ブックマークから削除しました');
    } else {
      bookmarks.push({ id: threadId, title: data.thread.title });
      localStorage.setItem('dai2_bookmarks', JSON.stringify(bookmarks));
      alert('ブックマークに追加しました');
    }
  };

  const handleLike = async () => {
    if (isLiked) return;
    try {
      setIsLiked(true);
      await apiFetch(`/threads/${encodeURIComponent(threadId || '')}/like`, { method: 'POST' });
      mutate();
    } catch (e: any) {
      if (e.code === 'ALREADY_LIKED' || e.message.includes('ALREADY_LIKED') || e.message.includes('already liked')) {
        setIsLiked(true);
      } else {
        setIsLiked(false);
        alert('「いいね！」に失敗しました: ' + e.message);
      }
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body) return;

    setIsSubmitting(true);
    setSubmitError('');

    const optimisticPost = {
      postId: `optimistic-${Date.now()}`,
      number: (data?.thread?.resCount || 0) + 1,
      authorName: authorName || '名無し',
      dailyId: '...', 
      body: body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
      mediaUrl, 
      createdAt: new Date().toISOString(),
      isDeleted: false,
    };

    const previousData = data;
    mutate(
      {
        ...previousData,
        thread: {
          ...previousData.thread,
          resCount: previousData.thread.resCount + 1,
        },
        posts: [...(previousData.posts || []), optimisticPost],
      },
      false
    );

    try {
      await createPost(threadId || '', { authorName, mail, body, mediaUrl });
      setAuthorName('');
      setMail('');
      setBody('');
      setMediaUrl('');
      mutate();
    } catch (err: any) {
      setSubmitError(err.message);
      mutate(previousData, false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isThreadSubscribed = () => {
    const subs = JSON.parse(localStorage.getItem('dai2_thread_subs') || '[]');
    return subs.includes(threadId);
  };

  const toggleThreadSubscription = async () => {
    try {
      const subs = JSON.parse(localStorage.getItem('dai2_thread_subs') || '[]');
      const currentlySubscribed = subs.includes(threadId);
      const newStatus = !currentlySubscribed;

      const { getDeviceId } = await import('../utils/deviceId');
      const deviceId = getDeviceId();

      await apiFetch('/push/subscribe-thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: threadId?.replace('thread#', ''),
          deviceId,
          subscribe: newStatus
        })
      });

      if (newStatus) {
        subs.push(threadId);
        alert('このスレッドの新着レスをすべてプッシュ通知で受け取ります。');
      } else {
        const idx = subs.indexOf(threadId);
        if (idx > -1) subs.splice(idx, 1);
        alert('このスレッドの全件通知をオフにしました。');
      }
      localStorage.setItem('dai2_thread_subs', JSON.stringify(subs));
      // Force re-render
      mutate();
    } catch (e) {
      alert('通知設定の変更に失敗しました。');
      console.error(e);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('本当に削除しますか？')) return;
    try {
      const { fetchAuthSession } = await import('aws-amplify/auth');
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      await fetch(`${API_BASE_URL}/admin/threads/${encodeURIComponent(threadId || '')}/posts/${postId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      mutate();
    } catch (e) {
      alert('削除に失敗しました');
    }
  };

  const handleDeleteThread = async () => {
    if (!confirm('スレッドを本当に削除しますか？')) return;
    try {
      const { fetchAuthSession } = await import('aws-amplify/auth');
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      await fetch(`${API_BASE_URL}/admin/threads/${encodeURIComponent(threadId || '')}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      window.location.href = '/';
    } catch (e) {
      alert('削除に失敗しました');
    }
  };

  const renderBody = (text: string) => {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/(>>\d+)/g);
      return (
        <span key={i}>
          {parts.map((part, j) => {
            if (part.match(/^>>\d+$/)) {
              const num = part.substring(2);
              return <a key={j} href={`#post-${num}`} style={{ color: '#0000EE', textDecoration: 'underline' }}>{part}</a>;
            }
            return part;
          })}
          <br />
        </span>
      );
    });
  };

  if (error) return <div className="container error-text">スレッドが見つかりません。</div>;
  if (!data) return <div className="container"><div className="spinner" /></div>;

  const { thread, posts } = data;
  
  const visiblePosts = posts.map((post: any) => {
    if (isHidden(post)) {
      return { ...post, body: 'あぼーん', isDeleted: true, isNG: true, mediaUrl: undefined };
    }
    return post;
  });

  const isBookmarked = () => {
    const bookmarks = JSON.parse(localStorage.getItem('dai2_bookmarks') || '[]');
    return bookmarks.some((b: any) => (typeof b === 'string' ? b : b.id) === threadId);
  };

  return (
    <>
      <div className="flex flex-col gap-8">
        <div>
          <h2 style={{ fontSize: '20px', color: '#CC0000', margin: '15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {thread.title}
            {thread.tagId && <span style={{ fontSize: '14px', backgroundColor: '#eee', padding: '2px 6px', border: '1px solid #ccc', color: '#333', fontWeight: 'normal' }}>{(tagsData?.tags || []).find((t:any) => t.id === thread.tagId)?.name || thread.tagId}</span>}
          </h2>
          <div className="flex gap-4 mt-2 mb-4 text-sm text-muted items-center">
            <span>レス数: {thread.resCount}</span>
            <span>作成日時: {new Date(thread.createdAt).toLocaleString('ja-JP')}</span>
            <button 
              onClick={handleLike} 
              className={`btn flex items-center gap-1 ${isLiked ? 'text-red-600 border-red-600 font-bold' : ''}`}
            >
              <span className="text-xl">♥</span> {thread.likeCount || 0}
            </button>
            <button 
              onClick={toggleBookmark}
              className={`px-2 py-1 rounded text-sm border ${isBookmarked() ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200'}`}
            >
              {isBookmarked() ? '★ ブックマーク中' : '☆ ブックマークする'}
            </button>
            <button 
              onClick={toggleThreadSubscription}
              className={`px-2 py-1 rounded text-sm border ${isThreadSubscribed() ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200'}`}
              title="このスレッドのすべての新着メッセージをプッシュ通知で受け取ります"
            >
              {isThreadSubscribed() ? '🔔 全件通知オン' : '🔕 全件通知オフ'}
            </button>
            {isAdmin && (
              <button onClick={handleDeleteThread} className="px-2 py-1 bg-red-600 text-white hover:bg-red-700 rounded text-sm font-bold ml-4">🗑️ 削除 (Admin)</button>
            )}
            {(editToken || isAdmin) && (
              <Link to={`/threads/${threadId}/edit${editToken ? `?token=${editToken}` : ''}`} className="px-2 py-1 bg-gray-600 text-white hover:bg-gray-700 rounded text-sm font-bold ml-auto">⚙️ スレッドを編集・削除</Link>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {visiblePosts.map((post: any) => (
            <div key={post.postId} id={`post-${post.number}`} style={{ marginBottom: '15px' }}>
              <div className="text-sm mb-2">
                <span style={{ fontWeight: 'normal' }}>{post.number} ：</span>
                <span style={{ color: 'green', fontWeight: 'bold' }}>{post.authorName}</span>
                {post.trip && <span style={{ color: 'green' }}>{post.trip}</span>}
                <span className="text-muted"> ：{new Date(post.createdAt).toLocaleString('ja-JP')} </span>
                <span style={{ color: '#666', fontSize: '12px', marginRight: '10px' }}>
                  ID:{post.dailyId}
                </span>
                {isAdmin && !post.isDeleted && (
                  <button 
                    onClick={() => handleDeletePost(post.postId)}
                    style={{ fontSize: '10px', padding: '2px 5px', cursor: 'pointer', marginLeft: '10px', color: 'red' }}
                  >
                    🗑️ 削除 (Admin)
                  </button>
                )}
              </div>
              <div style={{ wordBreak: 'break-word', color: post.isDeleted ? '#999' : '#000', marginLeft: '30px' }}>
                {renderBody(post.body)}
                {post.mediaUrl && !post.isDeleted && (
                  <div className="mt-2">
                    {post.mediaUrl.includes('.mp4') || post.mediaUrl.includes('.webm') ? (
                      <video src={post.mediaUrl} controls className="media-preview cursor-pointer" onClick={() => setSelectedMedia(post.mediaUrl)} />
                    ) : (
                      <img src={post.mediaUrl} alt="添付" className="media-preview cursor-pointer" onClick={() => setSelectedMedia(post.mediaUrl)} />
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4" style={{ borderTop: '1px solid #ccc', paddingTop: '15px' }}>
          <form onSubmit={handlePost} className="flex flex-col gap-2">
            <div className="flex gap-2 text-sm items-center">
              名前：
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                maxLength={30}
                style={{ width: '120px' }}
              />
              E-mail (省略可)：
              <input
                type="text"
                value={mail}
                onChange={(e) => setMail(e.target.value)}
                maxLength={30}
                style={{ width: '120px' }}
              />
              <button type="submit" className="btn" disabled={isSubmitting}>
                {isSubmitting ? '書き込み中...' : '書き込む'}
              </button>
            </div>
            <div className="flex gap-4 items-start">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                maxLength={2000}
                style={{ width: '400px', height: '100px', minHeight: '100px' }}
              />
              <div>
                <MediaUpload 
                  onUploadSuccess={url => setMediaUrl(url)} 
                  onClear={() => setMediaUrl('')} 
                />
              </div>
            </div>
            {submitError && <div className="error-text">{submitError}</div>}
          </form>
          <div className="flex justify-between items-center mt-4">
            <Link to="/">■掲示板に戻る■</Link>
          </div>
        </div>
      </div>

      {selectedMedia && (
        <div 
          className="media-modal-overlay"
          onClick={() => setSelectedMedia(null)}
        >
          {selectedMedia.includes('.mp4') || selectedMedia.includes('.webm') ? (
            <video src={selectedMedia} controls className="media-modal-content" onClick={e => e.stopPropagation()} />
          ) : (
            <img src={selectedMedia} alt="拡大プレビュー" className="media-modal-content" onClick={e => e.stopPropagation()} />
          )}
          <button className="media-modal-close">&times;</button>
        </div>
      )}
    </>
  );
}
