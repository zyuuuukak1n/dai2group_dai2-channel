import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useSWR from 'swr';
import { getCurrentUser, signOut, deleteUser } from '../lib/auth';
import { apiFetch, fetcher } from '../lib/api';

function ThreadLink({ item }: { item: any }) {
  const isString = typeof item === 'string';
  const id = isString ? item : item.id;
  const initialTitle = isString ? null : item.title;
  
  const { data } = useSWR(isString ? `/threads/${encodeURIComponent(id)}` : null, fetcher);
  const title = initialTitle || data?.thread?.title || id;

  return (
    <li key={id}>
      <Link to={`/threads/${id.replace('thread#', '')}`} className="text-primary hover:underline">
        {title}
      </Link>
    </li>
  );
}

export default function MyPage() {
  const [user, setUser] = useState<any>(null);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();
    loadLocalData();
  }, []);

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      loadTickets(currentUser.userId);
    } catch (err) {
      navigate('/login');
    }
  };

  const loadLocalData = () => {
    try {
      const storedBookmarks = JSON.parse(localStorage.getItem('dai2_bookmarks') || '[]');
      const storedHistory = JSON.parse(localStorage.getItem('dai2_history') || '[]');
      setBookmarks(storedBookmarks);
      setHistory(storedHistory);
    } catch (e) {
      // ignore
    }
  };

  const [tickets, setTickets] = useState<any[]>([]);

  const loadTickets = async (userId: string) => {
    try {
      const res = await apiFetch(`/tickets/my?userId=${encodeURIComponent(userId)}`);
      setTickets(res.tickets || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleDeleteAccount = async () => {
    if (!confirm('本当にアカウントを削除しますか？この操作は取り消せません。')) return;
    try {
      await deleteUser();
      alert('アカウントを削除しました。');
      navigate('/');
    } catch (e) {
      alert('アカウントの削除に失敗しました。');
      console.error(e);
    }
  };

  if (!user) return <div className="p-4">読み込み中...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">マイページ</h2>
        <div className="flex gap-2">
          <button onClick={handleSignOut} className="btn bg-gray-200 text-gray-800 hover:bg-gray-300">
            ログアウト
          </button>
          <button onClick={handleDeleteAccount} className="btn bg-red-100 text-red-700 hover:bg-red-200 border border-red-300">
            退会する
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card space-y-4">
          <h3 className="font-bold text-lg border-b border-border pb-2">お気に入り（ブックマーク）</h3>
          {bookmarks.length === 0 ? (
            <p className="text-muted text-sm">ブックマークされたスレッドはありません。</p>
          ) : (
            <ul className="space-y-2">
              {bookmarks.map((b: any) => (
                <ThreadLink key={typeof b === 'string' ? b : b.id} item={b} />
              ))}
            </ul>
          )}
        </div>

        <div className="card space-y-4">
          <h3 className="font-bold text-lg border-b border-border pb-2">閲覧・参加履歴</h3>
          {history.length === 0 ? (
            <p className="text-muted text-sm">履歴はありません。</p>
          ) : (
            <ul className="space-y-2">
              {history.map((h: any) => (
                <ThreadLink key={typeof h === 'string' ? h : h.id} item={h} />
              ))}
            </ul>
          )}
        </div>

        <div className="card space-y-4 md:col-span-2">
          <h3 className="font-bold text-lg border-b border-border pb-2">お問い合わせ履歴</h3>
          {tickets.length === 0 ? (
            <p className="text-muted text-sm">お問い合わせ履歴はありません。</p>
          ) : (
            <ul className="space-y-2">
              {tickets.map(ticket => (
                <li key={ticket.id} className="flex justify-between items-center border-b border-gray-200 pb-2">
                  <Link to={`/tickets/${ticket.id}`} className="text-primary hover:underline font-bold">
                    {ticket.title}
                  </Link>
                  <span className={`text-xs px-2 py-1 rounded-full ${ticket.status === 'UNANSWERED' ? 'bg-yellow-100 text-yellow-800' : ticket.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                    {ticket.status === 'UNANSWERED' ? '未対応' : ticket.status === 'IN_PROGRESS' ? '対応中' : '対応済み'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/contact" className="btn btn-primary inline-block">
            新しくお問い合わせをする
          </Link>
        </div>
      </div>
    </div>
  );
}
