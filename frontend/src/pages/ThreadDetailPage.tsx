import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useSWR from 'swr';
import { fetcher, createPost } from '../lib/api';

export default function ThreadDetailPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const { data, error, mutate } = useSWR(`/threads/thread%23${threadId}`, fetcher, {
    refreshInterval: 10000, // 10秒間隔のポーリング
  });

  const [authorName, setAuthorName] = useState('');
  const [mail, setMail] = useState('');
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body) return;

    setIsSubmitting(true);
    setSubmitError('');

    // Optimistic UI Data
    const optimisticPost = {
      postId: `optimistic-${Date.now()}`,
      number: (data?.thread?.resCount || 0) + 1,
      authorName: authorName || '名無し',
      dailyId: '...', // Dummy
      body: body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'), // Simple optimistic sanitize
      createdAt: new Date().toISOString(),
      isDeleted: false,
    };

    // Optimistically update the UI cache
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
      false // do not revalidate immediately
    );

    try {
      await createPost(`thread#${threadId}`, { authorName, mail, body });
      setAuthorName('');
      setMail('');
      setBody('');
      // Revalidate to get real server data
      mutate();
    } catch (err: any) {
      setSubmitError(err.message);
      // Revert optimistic update
      mutate(previousData, false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderBody = (text: string) => {
    return text.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line}
        <br />
      </React.Fragment>
    ));
  };

  if (error) return <div className="container error-text">スレッドが見つかりません。</div>;
  if (!data) return <div className="container"><div className="spinner" /></div>;

  const { thread, posts } = data;

  return (
    <div className="flex flex-col gap-8">
      <div className="mb-4">
        <Link to="/" style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>
          ← スレッド一覧に戻る
        </Link>
      </div>

      {/* Thread Header */}
      <div className="glass-panel" style={{ borderLeft: '4px solid var(--primary-color)' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{thread.title}</h2>
        <div className="flex gap-4 text-sm text-muted">
          <span>レス数: {thread.resCount}</span>
          <span>勢い: {thread.momentumScore}</span>
        </div>
      </div>

      {/* Posts */}
      <div className="flex flex-col gap-4">
        {posts.map((post: any) => (
          <div key={post.postId} className="glass-panel" style={{ padding: '16px' }}>
            <div className="flex gap-2 items-center text-sm mb-2 pb-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <span style={{ fontWeight: 'bold' }}>{post.number}</span>
              <span style={{ color: 'var(--success-color)' }}>{post.authorName}</span>
              {post.trip && <span style={{ color: 'var(--accent-color)' }}>{post.trip}</span>}
              <span className="text-muted">{new Date(post.createdAt).toLocaleString('ja-JP')}</span>
              <span style={{ color: 'var(--secondary-color)', fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                ID:{post.dailyId}
              </span>
            </div>
            <div style={{ wordBreak: 'break-word', color: post.isDeleted ? 'var(--text-muted)' : 'var(--text-main)' }}>
              {renderBody(post.body)}
            </div>
          </div>
        ))}
      </div>

      {/* Post Form */}
      <div className="glass-panel mt-4">
        <h3 className="mb-4">💬 書き込む</h3>
        <form onSubmit={handlePost} className="flex flex-col gap-4">
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="名前 (任意)"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              maxLength={30}
            />
            <input
              type="text"
              placeholder="メール (任意, sage等)"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
              maxLength={30}
            />
          </div>
          <textarea
            placeholder="本文 (必須, 2000文字以内)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            maxLength={2000}
          />
          {submitError && <div className="error-text">{submitError}</div>}
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? <div className="spinner" /> : '書き込む'}
          </button>
        </form>
      </div>
    </div>
  );
}
