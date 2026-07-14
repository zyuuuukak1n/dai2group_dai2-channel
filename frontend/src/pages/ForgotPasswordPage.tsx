import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { resetPassword, confirmResetPassword } from '../lib/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'REQUEST' | 'CONFIRM'>('REQUEST');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setMessage('');
      await resetPassword({ username: email });
      setStep('CONFIRM');
      setMessage('パスワードリセットの確認コードをメールで送信しました。');
    } catch (err: any) {
      setError(err.message || 'リクエストに失敗しました');
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      await confirmResetPassword({
        username: email,
        confirmationCode: code,
        newPassword: newPassword
      });
      navigate('/login', { state: { message: 'パスワードが再設定されました。新しいパスワードでログインしてください。' } });
    } catch (err: any) {
      setError(err.message || 'パスワードの再設定に失敗しました');
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="card">
        <h2 className="text-xl font-bold mb-4">パスワード再設定</h2>
        {message && <div className="p-3 bg-green-100 text-green-800 rounded-md mb-4 text-sm">{message}</div>}
        {error && <div className="p-3 bg-red-100 text-red-700 rounded-md mb-4 text-sm">{error}</div>}
        
        {step === 'REQUEST' ? (
          <form onSubmit={handleRequest} className="space-y-4">
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
            <button type="submit" className="btn btn-primary w-full">確認コードを送信</button>
            <div className="text-center mt-4 text-sm">
              <Link to="/login" className="text-primary hover:underline">ログインへ戻る</Link>
            </div>
          </form>
        ) : (
          <form onSubmit={handleConfirm} className="space-y-4">
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
            <div>
              <label className="block text-sm font-medium mb-1">新しいパスワード</label>
              <input
                type="password"
                required
                className="input"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary w-full">パスワードを再設定する</button>
          </form>
        )}
      </div>
    </div>
  );
}
