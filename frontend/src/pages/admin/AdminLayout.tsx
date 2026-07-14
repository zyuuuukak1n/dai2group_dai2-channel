import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { API_BASE_URL } from '../../lib/api';
import { fetchAuthSession, checkIsAdmin } from '../../lib/auth';
import MediaUpload from '../../components/MediaUpload';

const fetcherWithAuth = (url: string, token: string) => fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json());

export default function AdminLayout() {
  const [token, setToken] = useState('');
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'tags' | 'tickets' | 'threads' | 'stats'>('tags');

  useEffect(() => {
    async function checkAuth() {
      const admin = await checkIsAdmin();
      setIsAdmin(admin);
      if (admin) {
        const session = await fetchAuthSession();
        setToken(session.tokens?.idToken?.toString() || '');
      }
    }
    checkAuth();
  }, []);

  if (isAdmin === null) return <div className="container p-8">確認中...</div>;
  if (!isAdmin || !token) {
    return (
      <div className="container p-8 text-center">
        <h2>アクセス権限がありません</h2>
        <p>管理者アカウントでログインしてください。</p>
        <Link to="/mypage" className="btn mt-4 inline-block">マイページへ</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', backgroundColor: '#f9f9f9', minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #333', paddingBottom: '10px', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>⚙️ Cockpit (Admin)</h1>
        <div>
          <Link to="/" style={{ marginRight: '20px' }}>表の掲示板に戻る</Link>
        </div>
      </header>

      <div style={{ display: 'flex', gap: '20px' }}>
        <nav style={{ width: '200px' }}>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li style={{ marginBottom: '10px' }}>
              <button 
                onClick={() => setActiveTab('tags')} 
                style={{ width: '100%', textAlign: 'left', padding: '10px', fontWeight: activeTab === 'tags' ? 'bold' : 'normal', backgroundColor: activeTab === 'tags' ? '#ddd' : '#eee', border: '1px solid #ccc' }}
              >🏷️ タグ管理</button>
            </li>
            <li style={{ marginBottom: '10px' }}>
              <button 
                onClick={() => setActiveTab('tickets')} 
                style={{ width: '100%', textAlign: 'left', padding: '10px', fontWeight: activeTab === 'tickets' ? 'bold' : 'normal', backgroundColor: activeTab === 'tickets' ? '#ddd' : '#eee', border: '1px solid #ccc' }}
              >🎫 チケット管理</button>
            </li>
            <li style={{ marginBottom: '10px' }}>
              <button 
                onClick={() => setActiveTab('threads')} 
                style={{ width: '100%', textAlign: 'left', padding: '10px', fontWeight: activeTab === 'threads' ? 'bold' : 'normal', backgroundColor: activeTab === 'threads' ? '#ddd' : '#eee', border: '1px solid #ccc' }}
              >🗑️ スレッド管理</button>
            </li>
            <li>
              <button 
                onClick={() => setActiveTab('stats')} 
                style={{ width: '100%', textAlign: 'left', padding: '10px', fontWeight: activeTab === 'stats' ? 'bold' : 'normal', backgroundColor: activeTab === 'stats' ? '#ddd' : '#eee', border: '1px solid #ccc' }}
              >📊 スタッツ</button>
            </li>
          </ul>
        </nav>
        <main style={{ flex: 1, backgroundColor: '#fff', padding: '20px', border: '1px solid #ccc' }}>
          {activeTab === 'tags' && <AdminTags token={token} />}
          {activeTab === 'tickets' && <AdminTickets token={token} />}
          {activeTab === 'threads' && <AdminThreads token={token} />}
          {activeTab === 'stats' && <AdminStats token={token} />}
        </main>
      </div>
    </div>
  );
}

// --- Admin Tags Component ---
function AdminTags({ token }: { token: string }) {
  const { data, mutate } = useSWR([`${API_BASE_URL}/admin/tags`, token], ([url, t]) => fetcherWithAuth(url, t));
  const [newTagId, setNewTagId] = useState('');
  const [newTagName, setNewTagName] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API_BASE_URL}/admin/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: newTagId, name: newTagName })
    });
    setNewTagId('');
    setNewTagName('');
    mutate();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('削除しますか？')) return;
    await fetch(`${API_BASE_URL}/admin/tags/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    mutate();
  };

  return (
    <div>
      <h2>🏷️ タグ管理</h2>
      <form onSubmit={handleAdd} style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <input placeholder="タグID (例: news)" value={newTagId} onChange={e => setNewTagId(e.target.value)} required />
        <input placeholder="表示名 (例: ニュース)" value={newTagName} onChange={e => setNewTagName(e.target.value)} required />
        <button type="submit" className="btn">追加</button>
      </form>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#eee' }}>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>ID</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>表示名</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {(data?.tags || []).map((tag: any) => (
            <tr key={tag.id}>
              <td style={{ border: '1px solid #ccc', padding: '8px' }}>{tag.id}</td>
              <td style={{ border: '1px solid #ccc', padding: '8px' }}>{tag.name}</td>
              <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                <button onClick={() => handleDelete(tag.id)}>削除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Admin Tickets Component ---
function AdminTickets({ token }: { token: string }) {
  const { data, mutate } = useSWR([`${API_BASE_URL}/admin/tickets`, token], ([url, t]) => fetcherWithAuth(url, t), { refreshInterval: 10000 });
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  if (selectedTicket) {
    return (
      <AdminTicketDetail 
        ticketId={selectedTicket} 
        token={token} 
        onBack={() => setSelectedTicket(null)} 
        onStatusChange={(newStatus) => {
          mutate((currentData: any) => {
            if (!currentData) return currentData;
            return {
              ...currentData,
              tickets: currentData.tickets.map((t: any) => 
                t.id === selectedTicket ? { ...t, status: newStatus } : t
              )
            };
          }, { revalidate: false });
        }} 
      />
    );
  }

  const filteredTickets = (data?.tickets || []).filter((t: any) => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'UNANSWERED' && (!t.status || t.status === 'UNANSWERED')) return true;
    return t.status === filterStatus;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h2>🎫 チケット管理</h2>
        <div>
          ステータス絞り込み:
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ marginLeft: '10px', padding: '5px' }}>
            <option value="ALL">すべて</option>
            <option value="UNANSWERED">未対応</option>
            <option value="IN_PROGRESS">対応中</option>
            <option value="RESOLVED">対応済み</option>
          </select>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#eee' }}>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>ID</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>件名</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>ステータス</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>最終更新</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {filteredTickets.map((t: any) => (
            <tr key={t.id}>
              <td style={{ border: '1px solid #ccc', padding: '8px' }}>{t.id}</td>
              <td style={{ border: '1px solid #ccc', padding: '8px' }}>{t.title}</td>
              <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                {t.status === 'RESOLVED' ? '✅ 対応済み' : t.status === 'IN_PROGRESS' ? '⏳ 対応中' : '⚠️ 未対応'}
              </td>
              <td style={{ border: '1px solid #ccc', padding: '8px' }}>{new Date(t.lastUpdatedAt).toLocaleString('ja-JP')}</td>
              <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                <button onClick={() => setSelectedTicket(t.id)}>詳細・返信</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminTicketDetail({ ticketId, token, onBack, onStatusChange }: { ticketId: string, token: string, onBack: () => void, onStatusChange?: (newStatus: string) => void }) {
  const { data, mutate } = useSWR([`${API_BASE_URL}/admin/tickets/${ticketId}`, token], ([url, t]) => fetcherWithAuth(url, t), { refreshInterval: 5000 });
  const [body, setBody] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body) return;
    setLoading(true);
    await fetch(`${API_BASE_URL}/admin/tickets/${ticketId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ body, mediaUrl })
    });
    setBody('');
    setMediaUrl('');
    setLoading(false);
    mutate();
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    // 先に親のリストに新しいステータスをオプティミスティック反映
    if (onStatusChange) onStatusChange(newStatus);
    
    await fetch(`${API_BASE_URL}/admin/tickets/${ticketId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: newStatus })
    });
    mutate();
  };

  if (!data) return <div>Loading...</div>;

  const t = data.ticket;

  return (
    <div>
      <button onClick={onBack} style={{ marginBottom: '20px' }}>← 戻る</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{t.title}</h2>
        <div>
          ステータス: 
          <select value={t.status || 'UNANSWERED'} onChange={handleStatusChange} style={{ marginLeft: '10px', padding: '5px' }}>
            <option value="UNANSWERED">未対応</option>
            <option value="IN_PROGRESS">対応中</option>
            <option value="RESOLVED">対応済み</option>
          </select>
        </div>
      </div>
      
      <div className="flex flex-col gap-4 mb-4" style={{ backgroundColor: '#f0f0f0', padding: '20px', height: '400px', overflowY: 'auto', border: '1px solid #ccc' }}>
        {t.messages.map((msg: any, idx: number) => (
          <div key={idx} style={{ 
            backgroundColor: msg.isAdmin ? '#e8f4f8' : '#fff', 
            padding: '10px', 
            border: '1px solid #ccc',
            marginLeft: msg.isAdmin ? '20px' : '0',
            marginRight: msg.isAdmin ? '0' : '20px'
          }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
              {msg.isAdmin ? '👑 あなた (Admin)' : '👤 ユーザー'} - {new Date(msg.createdAt).toLocaleString('ja-JP')}
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

      <form onSubmit={handleReply} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <textarea 
          value={body} onChange={e => setBody(e.target.value)} 
          style={{ flex: 1, height: '80px' }} 
          placeholder="返信を入力..." 
          required 
        />
        <MediaUpload 
          onUploadSuccess={url => setMediaUrl(url)} 
          onClear={() => setMediaUrl('')} 
        />
        <button type="submit" className="btn" disabled={loading}>送信</button>
      </form>

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

// --- Admin Threads Component ---
function AdminThreads({ token }: { token: string }) {
  const { data } = useSWR([`${API_BASE_URL}/admin/threads`, token], ([url, t]) => fetcherWithAuth(url, t));

  return (
    <div>
      <h2>🗑️ スレッド管理</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#eee' }}>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>タイトル</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>レス数</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>作成日時</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {(data?.threads || []).map((t: any) => (
            <tr key={t.id}>
              <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                <Link to={`/threads/${encodeURIComponent(t.id)}`} target="_blank">{t.title}</Link>
              </td>
              <td style={{ border: '1px solid #ccc', padding: '8px' }}>{t.resCount}</td>
              <td style={{ border: '1px solid #ccc', padding: '8px' }}>{new Date(t.createdAt).toLocaleString('ja-JP')}</td>
              <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                <Link to={`/threads/${encodeURIComponent(t.id)}/edit`} style={{ color: '#0000EE' }}>⚙️ 編集・削除</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Admin Stats Component ---
function AdminStats({ token }: { token: string }) {
  const [days, setDays] = useState(30);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const { data } = useSWR([`${API_BASE_URL}/admin/stats?days=${days}`, token], ([url, t]) => fetcherWithAuth(url, t));

  if (!data) return <div>Loading...</div>;

  const stats = data.stats || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>📊 スタッツ (過去 {days} 日間)</h2>
        <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ padding: '5px' }}>
          <option value={7}>過去 7 日間</option>
          <option value={30}>過去 30 日間</option>
          <option value={90}>過去 90 日間</option>
        </select>
      </div>

      <div style={{ height: '400px', width: '100%', marginBottom: '60px' }}>
        <h3 style={{ textAlign: 'center', marginBottom: '10px' }}>ページビュー推移</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={stats}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Line type="monotone" dataKey="pageviews" name="ページビュー数" stroke="#8884d8" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ height: '400px', width: '100%', marginBottom: '80px' }}>
        <h3 style={{ textAlign: 'center', marginBottom: '10px' }}>スレッド・レス作成数推移</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={stats}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Line type="monotone" dataKey="threads" name="新規スレッド数" stroke="#82ca9d" strokeWidth={2} />
            <Line type="monotone" dataKey="posts" name="新規レス数" stroke="#ffc658" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
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
