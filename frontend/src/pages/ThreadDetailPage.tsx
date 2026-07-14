import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useSWR from 'swr';
import { fetcher, createPost } from '../lib/api';

export default function ThreadDetailPage() {
  const { threadId } = useParams<{ threadId: string }>();
  // 以前は thread%23 を付けていたが、バックエンド側で吸収するように変更したためそのまま送る
  const { data, error, mutate } = useSWR(`/threads/${threadId}`, fetcher, {
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
      await createPost(threadId || '', { authorName, mail, body });
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
        <Link to="/">
          ■掲示板に戻る■
        </Link>
      </div>

      {/* Thread Header */}
      <div>
        <h2 style={{ fontSize: '20px', color: '#CC0000', margin: '15px 0' }}>{thread.title}</h2>
      </div>

      {/* Posts */}
      <div className="flex flex-col gap-4">
        {posts.map((post: any) => (
          <div key={post.postId} style={{ marginBottom: '15px' }}>
            <div className="text-sm mb-2">
              <span style={{ fontWeight: 'normal' }}>{post.number} ：</span>
              <span style={{ color: 'green', fontWeight: 'bold' }}>{post.authorName}</span>
              {post.trip && <span style={{ color: 'green' }}>{post.trip}</span>}
              <span className="text-muted"> ：{new Date(post.createdAt).toLocaleString('ja-JP')} </span>
              <span style={{ color: '#666', fontSize: '12px' }}>
                ID:{post.dailyId}
              </span>
            </div>
            <div style={{ wordBreak: 'break-word', color: post.isDeleted ? '#999' : '#000', marginLeft: '30px' }}>
              {renderBody(post.body)}
            </div>
          </div>
        ))}
      </div>

      {/* Post Form */}
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
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            maxLength={2000}
            style={{ width: '400px', height: '100px', minHeight: '100px' }}
          />
          {submitError && <div className="error-text">{submitError}</div>}
        </form>
      </div>
    </div>
  );
}
