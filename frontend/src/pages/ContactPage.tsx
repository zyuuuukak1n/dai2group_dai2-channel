import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../lib/api';
import MediaUpload from '../components/MediaUpload';
import { getCurrentUser } from '../lib/auth';

export default function ContactPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getCurrentUser().then(user => setUserId(user?.userId)).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) return;
    setLoading(true);
    
    try {
      const res = await fetch(`${API_BASE_URL}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, mediaUrl, userId }),
      });
      const data = await res.json();
      if (data.ticketId) {
        navigate(`/support/ticket/${data.ticketId}`);
      }
    } catch (err) {
      alert('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '20px' }}>
      <div className="mb-4">
        <Link to="/">■掲示板に戻る■</Link>
      </div>
      <h2 style={{ fontSize: '20px', color: '#CC0000', margin: '15px 0' }}>お問い合わせ</h2>
      
      <div style={{ backgroundColor: '#fff', padding: '15px', border: '1px solid #ccc' }}>
        <p style={{ marginBottom: '15px', color: '#666' }}>
          お問い合わせ内容を送信すると、あなた専用のチケットURLが発行されます。そのURLにて、管理人からの返信を確認・やり取りすることができます。
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>件名：</label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{ width: '100%', maxWidth: '400px' }} 
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>内容：</label>
            <textarea 
              value={body}
              onChange={e => setBody(e.target.value)}
              style={{ width: '100%', maxWidth: '400px', height: '150px' }} 
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>添付ファイル（省略可）：</label>
            <MediaUpload 
              onUploadSuccess={url => setMediaUrl(url)} 
              onClear={() => setMediaUrl('')} 
            />
          </div>
          <div>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? '送信中...' : '送信する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
