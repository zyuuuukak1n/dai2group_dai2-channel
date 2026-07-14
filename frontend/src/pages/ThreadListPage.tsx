import React, { useState } from 'react';
import useSWR from 'swr';
import { Link } from 'react-router-dom';
import { fetcher, createThread } from '../lib/api';

export default function ThreadListPage() {
  const [sort, setSort] = useState<'momentum' | 'latest'>('momentum');
  const { data, error, mutate } = useSWR(`/threads?sort=${sort}`, fetcher);
  
  const [title, setTitle] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [mail, setMail] = useState('');
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await createThread({ title, authorName, mail, body });
      setTitle('');
      setAuthorName('');
      setMail('');
      setBody('');
      mutate(); // Re-fetch threads
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Thread Creation Form */}
      <div className="glass-panel">
        <h2 className="mb-4">🔥 新規スレッド作成</h2>
        <form onSubmit={handleCreateThread} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="スレッドタイトル (必須, 60文字以内)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={60}
          />
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
            {isSubmitting ? <div className="spinner" /> : 'スレッドを立てる'}
          </button>
        </form>
      </div>

      {/* Thread List */}
      <div className="glass-panel">
        <div className="flex justify-between items-center mb-4">
          <h2>スレッド一覧</h2>
          <div className="flex gap-2">
            <button 
              className={`btn ${sort === 'momentum' ? 'btn-primary' : ''}`}
              style={{ padding: '6px 12px', opacity: sort === 'momentum' ? 1 : 0.6 }}
              onClick={() => setSort('momentum')}
            >
              勢い順
            </button>
            <button 
              className={`btn ${sort === 'latest' ? 'btn-primary' : ''}`}
              style={{ padding: '6px 12px', opacity: sort === 'latest' ? 1 : 0.6 }}
              onClick={() => setSort('latest')}
            >
              新着順
            </button>
          </div>
        </div>

        {error && <div className="error-text">スレッドの読み込みに失敗しました。</div>}
        {!data && !error && <div className="spinner" style={{ margin: '20px auto' }} />}
        
        {data?.threads && (
          <div className="flex flex-col gap-4">
            {data.threads.map((thread: any, index: number) => (
              <Link 
                to={`/threads/${thread.threadId.replace('thread#', '')}`} 
                key={thread.threadId}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', transition: 'all 0.2s ease' }}
                     onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                     onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.2)'}>
                  <h3 style={{ marginBottom: '8px', color: 'var(--primary-color)' }}>
                    {index + 1}: {thread.title} ({thread.resCount})
                  </h3>
                  <div className="flex gap-4 text-xs text-muted">
                    <span>勢い: {thread.momentumScore}</span>
                    <span>最終更新: {new Date(thread.lastUpdatedAt).toLocaleString('ja-JP')}</span>
                  </div>
                </div>
              </Link>
            ))}
            {data.threads.length === 0 && <div className="text-muted text-center py-8">スレッドがありません。</div>}
          </div>
        )}
      </div>
    </div>
  );
}
