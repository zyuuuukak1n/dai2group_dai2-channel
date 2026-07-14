import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { signIn } from '../lib/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.message) {
      setMessage(location.state.message);
    }
  }, [location]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setMessage('');
      await signIn({ username: email, password });
      navigate('/mypage');
    } catch (err: any) {
      setError(err.message || 'ログインに失敗しました');
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="card">
        <h2 className="text-xl font-bold mb-4">ログイン</h2>
        {message && <div className="p-3 bg-green-100 text-green-800 rounded-md mb-4 text-sm">{message}</div>}
        {error && <div className="p-3 bg-red-100 text-red-700 rounded-md mb-4 text-sm">{error}</div>}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">メールアドレス</label>
            <input
              type="email"
              required
              className="input"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">パスワード</label>
            <input
              type="password"
              required
              className="input"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <div className="flex justify-between items-center text-sm">
            <Link to="/forgot-password" className="text-primary hover:underline">パスワードを忘れた場合</Link>
          </div>
          <button type="submit" className="btn btn-primary w-full">ログイン</button>
          
          <div className="mt-4 pt-4 border-t border-border text-center text-sm">
            アカウントをお持ちでないですか？ <Link to="/signup" className="text-primary hover:underline">新規登録</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
