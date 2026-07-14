import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useSWR from 'swr';
import { fetcher, API_BASE_URL } from '../lib/api';
import MediaUpload from '../components/MediaUpload';

export default function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { data, error, mutate } = useSWR(`/tickets/${ticketId}`, fetcher, {
    refreshInterval: 10000,
  });
  const [body, setBody] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body) return;
    setLoading(true);
    try {
      await fetch(`${API_BASE_URL}/tickets/${ticketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, mediaUrl }),
      });
      setBody('');
      setMediaUrl('');
      mutate();
    } catch (err) {
      alert('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  if (error) return <div className="container error-text">チケットが見つかりません。</div>;
  if (!data) return <div className="container"><div className="spinner" /></div>;

  const { ticket } = data;

  return (
    <div className="container" style={{ padding: '20px' }}>
      <div className="mb-4">
        <Link to="/">■掲示板に戻る■</Link>
      </div>

      <div style={{ backgroundColor: '#ffffee', padding: '15px', border: '1px solid #ccc', marginBottom: '20px' }}>
        <div className="flex justify-between items-center mb-2">
          <h2 style={{ fontSize: '18px', margin: 0 }}>サポートチケット: {ticket.title}</h2>
          <span className={`px-2 py-1 text-xs font-bold rounded ${
            ticket.status === 'RESOLVED' ? 'bg-green-100 text-green-800' :
            ticket.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {ticket.status === 'RESOLVED' ? '対応済み' :
             ticket.status === 'IN_PROGRESS' ? '対応中' : '未対応'}
          </span>
        </div>
        <p style={{ color: '#CC0000', fontSize: '14px', margin: 0 }}>
          <strong>重要：</strong>このページのURLはあなた専用の秘密のURLです。後で返信を確認するために、このページをブックマーク（お気に入り登録）しておいてください。<br/>
          <code>{window.location.href}</code>
        </p>
      </div>

      <div className="flex flex-col gap-4 mb-4">
        {ticket.messages.map((msg: any, idx: number) => (
          <div key={idx} style={{ 
            backgroundColor: msg.isAdmin ? '#e8f4f8' : '#f0f0f0', 
            padding: '10px', 
            border: '1px solid #ccc',
            marginLeft: msg.isAdmin ? '0' : '20px',
            marginRight: msg.isAdmin ? '20px' : '0'
          }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
              {msg.isAdmin ? '👑 管理人' : '👤 あなた'} - {new Date(msg.createdAt).toLocaleString('ja-JP')}
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.body}</div>
            {msg.mediaUrl && (
              <div className="mt-2">
                {msg.mediaUrl.includes('.mp4') || msg.mediaUrl.includes('.webm') ? (
                  <video src={msg.mediaUrl} controls className="media-preview cursor-pointer" onClick={() => setSelectedMedia(msg.mediaUrl)} />
                ) : (
                  <img src={msg.mediaUrl} alt="添付" className="media-preview cursor-pointer" onClick={() => setSelectedMedia(msg.mediaUrl)} />
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid #ccc', paddingTop: '15px' }}>
        <form onSubmit={handleReply} className="flex flex-col gap-2">
          <div className="flex gap-4 items-start">
            <textarea 
              value={body}
              onChange={e => setBody(e.target.value)}
              style={{ width: '100%', maxWidth: '500px', height: '100px' }} 
              placeholder="返信を入力..."
              required
            />
            <MediaUpload 
              onUploadSuccess={url => setMediaUrl(url)} 
              onClear={() => setMediaUrl('')} 
            />
          </div>
          <div>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? '送信中...' : '返信する'}
            </button>
          </div>
        </form>
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
    </div>
  );
}
