import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signUp, confirmSignUp } from '../lib/auth';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'SIGNUP' | 'CONFIRM'>('SIGNUP');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
          },
        }
      });
      setStep('CONFIRM');
    } catch (err: any) {
      setError(err.message || '登録に失敗しました');
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      await confirmSignUp({
        username: email,
        confirmationCode: code
      });
      navigate('/login', { state: { message: '登録が完了しました。ログインしてください。' } });
    } catch (err: any) {
      setError(err.message || '確認に失敗しました');
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="card">
        <h2 className="text-xl font-bold mb-4">新規登録</h2>
        {error && <div className="p-3 bg-red-100 text-red-700 rounded-md mb-4 text-sm">{error}</div>}
        
        {step === 'SIGNUP' ? (
          <form onSubmit={handleSignUp} className="space-y-4">
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
            <button type="submit" className="btn btn-primary w-full">登録する</button>
            <p className="text-sm text-center mt-4">
              既にアカウントをお持ちですか？ <Link to="/login" className="text-primary hover:underline">ログイン</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleConfirm} className="space-y-4">
            <p className="text-sm text-muted">
              {email} 宛に確認コードを送信しました。
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">確認コード</label>
              <input
                type="text"
                required
                className="input"
                value={code}
                onChange={e => setCode(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary w-full">確認する</button>
          </form>
        )}
      </div>
    </div>
  );
}
