import { useState } from 'react';
import useSWR from 'swr';
import { Link } from 'react-router-dom';
import { fetcher, createThread } from '../lib/api';
import MediaUpload from '../components/MediaUpload';

export default function ThreadListPage() {
  const [sort, setSort] = useState<'momentum' | 'latest'>('momentum');
  const [selectedTag, setSelectedTag] = useState<string>('');
  
  const queryUrl = selectedTag ? `/threads?sort=${sort}&tagId=${selectedTag}` : `/threads?sort=${sort}`;
  const { data, error, mutate } = useSWR(queryUrl, fetcher);
  
  const [title, setTitle] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [mail, setMail] = useState('');
  const [body, setBody] = useState('');
  const [tagId, setTagId] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const { data: tagsData } = useSWR('/tags', fetcher);

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const res = await createThread({ title, authorName, mail, body, tagId, mediaUrl });
      if (res && res.editToken) {
        const tokens = JSON.parse(localStorage.getItem('dai2_edit_tokens') || '{}');
        const id = res.threadId.replace('thread#', '');
        tokens[id] = res.editToken;
        localStorage.setItem('dai2_edit_tokens', JSON.stringify(tokens));
      }
      setTitle('');
      setAuthorName('');
      setMail('');
      setBody('');
      setMediaUrl('');
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
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="スレッドタイトル"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={60}
              style={{ width: '400px', display: 'block' }}
            />
            <select value={tagId} onChange={e => setTagId(e.target.value)} style={{ padding: '2px' }}>
              <option value="">(タグなし)</option>
              {(tagsData?.tags || []).map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
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
          <div>
            <button type="submit" className="btn" disabled={isSubmitting}>
              {isSubmitting ? '処理中...' : '新規スレッド作成'}
            </button>
          </div>
        </form>
      </div>

      {/* Thread List */}
      <div className="glass-panel">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <h2>■ スレッド一覧</h2>
            <select 
              value={selectedTag} 
              onChange={e => setSelectedTag(e.target.value)}
              style={{ padding: '2px', fontSize: '14px' }}
            >
              <option value="">すべて</option>
              {(tagsData?.tags || []).map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button 
              className="btn"
              style={{ fontWeight: sort === 'momentum' ? 'bold' : 'normal' }}
              onClick={() => setSort('momentum')}
            >
              勢い順
            </button>
            <button 
              className="btn"
              style={{ fontWeight: sort === 'latest' ? 'bold' : 'normal' }}
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
                style={{ textDecoration: 'none', color: '#000' }}
              >
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#0000EE', textDecoration: 'underline' }}>
                    {index + 1}: {thread.title} ({thread.resCount})
                  </span>
                  {thread.tagId && <span style={{ marginLeft: '5px', fontSize: '12px', backgroundColor: '#eee', padding: '2px 5px', border: '1px solid #ccc' }}>{(tagsData?.tags || []).find((t:any) => t.id === thread.tagId)?.name || thread.tagId}</span>}
                  <span className="text-xs text-muted" style={{ marginLeft: '10px' }}>
                    [勢い: {thread.momentumScore} / {new Date(thread.lastUpdatedAt).toLocaleString('ja-JP')}]
                  </span>
                </div>
              </Link>
            ))}
            {data.threads.length === 0 && <div className="text-muted text-center py-8">スレッドがありません。</div>}
          </div>
        )}
      </div>

      {/* Footer Links */}
      <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px' }}>
        <Link to="/terms" style={{ marginRight: '15px' }}>利用規約</Link>
        <Link to="/contact">お問い合わせ</Link>
      </div>
    </div>
  );
}
