import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import useSWR from 'swr';
import { fetcher, API_BASE_URL } from '../lib/api';
import { checkIsAdmin } from '../lib/auth';

export default function ThreadEditPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const { data: isAdmin } = useSWR('isAdmin', checkIsAdmin);
  const { data: threadData } = useSWR(`/threads/${encodeURIComponent(threadId || '')}`, fetcher);
  const { data: tagsData } = useSWR('/tags', fetcher);

  const [title, setTitle] = useState('');
  const [tagId, setTagId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (threadData?.thread) {
      setTitle(threadData.thread.title || '');
      setTagId(threadData.thread.tagId || '');
    }
  }, [threadData]);

  if (!isAdmin && !token) {
    return <div className="container error-text">権限がありません。</div>;
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      let headers: any = { 'Content-Type': 'application/json' };
      
      // If using admin token, fetch it
      if (isAdmin && !token) {
        const { fetchAuthSession } = await import('aws-amplify/auth');
        const session = await fetchAuthSession();
        headers['Authorization'] = `Bearer ${session.tokens?.idToken?.toString()}`;
      }

      const res = await fetch(`${API_BASE_URL}/admin/threads/${encodeURIComponent(threadId || '')}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ title, tagId, editToken: token })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || '更新に失敗しました');
      }

      alert('スレッドを更新しました');
      navigate(`/threads/${threadId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('スレッドを本当に削除しますか？この操作は取り消せません。')) return;
    setIsSubmitting(true);
    setError('');

    try {
      let headers: any = { 'Content-Type': 'application/json' };
      
      if (isAdmin && !token) {
        const { fetchAuthSession } = await import('aws-amplify/auth');
        const session = await fetchAuthSession();
        headers['Authorization'] = `Bearer ${session.tokens?.idToken?.toString()}`;
      }

      const res = await fetch(`${API_BASE_URL}/admin/threads/${encodeURIComponent(threadId || '')}`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ editToken: token })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || '削除に失敗しました');
      }

      alert('スレッドを削除しました');
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!threadData) return <div className="container"><div className="spinner" /></div>;

  return (
    <div className="glass-panel max-w-2xl mx-auto">
      <h2 className="mb-4">⚙️ スレッドの編集</h2>
      <form onSubmit={handleUpdate} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-bold mb-1">タイトル</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={60}
            className="w-full"
            style={{ padding: '8px', border: '1px solid #ccc' }}
          />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1">タグ</label>
          <select value={tagId} onChange={e => setTagId(e.target.value)} className="w-full p-2" style={{ padding: '8px', border: '1px solid #ccc' }}>
            <option value="">(タグなし)</option>
            {(tagsData?.tags || []).map((t: any) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        {error && <div className="error-text">{error}</div>}
        <div className="flex gap-4 mt-4">
          <button type="submit" className="btn" disabled={isSubmitting}>
            {isSubmitting ? '処理中...' : '更新する'}
          </button>
          <button type="button" onClick={handleDelete} className="btn" style={{ backgroundColor: '#cc0000', color: 'white', borderColor: '#cc0000' }} disabled={isSubmitting}>
            スレッドを削除する
          </button>
        </div>
      </form>
    </div>
  );
}
