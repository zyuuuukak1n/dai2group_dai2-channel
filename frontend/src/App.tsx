import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import ThreadListPage from './pages/ThreadListPage';
import ThreadDetailPage from './pages/ThreadDetailPage';
import ThreadEditPage from './pages/ThreadEditPage';
import TermsPage from './pages/TermsPage';
import ContactPage from './pages/ContactPage';
import TicketDetailPage from './pages/TicketDetailPage';
import AdminLayout from './pages/admin/AdminLayout';
import NotFoundPage from './pages/NotFoundPage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import MyPage from './pages/MyPage';
import HelpPage from './pages/HelpPage';
import NGSettingsPage from './pages/NGSettingsPage';
import { configureAmplify, checkIsAdmin } from './lib/auth';
import { apiFetch } from './lib/api';
import useSWR from 'swr';
import GlobalPushNotification from './components/GlobalPushNotification';

configureAmplify();

function PageTracker() {
  const location = useLocation();
  useEffect(() => {
    // Only track actual page views on the front end, exclude admin
    if (!location.pathname.startsWith('/admin')) {
      apiFetch('/stats/pageview', { method: 'POST' }).catch(console.error);
    }
  }, [location]);
  return null;
}

function App() {
  const { data: isAdmin } = useSWR('isAdmin', checkIsAdmin);

  return (
    <div className="container animate-fade-in">
      <header className="mb-8">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              <a href="/" className="hover:text-primary transition-colors">だいにちゃんねる</a>
            </h1>
            <p className="text-muted">完全匿名・独立・爆速のファンコミュニティ掲示板</p>
          </div>
          <nav className="flex items-center text-sm font-bold header-nav">
            {isAdmin && <a href="/admin" className="text-red-600 hover:text-red-800">⚙️ 管理画面</a>}
            <a href="/help" className="hover:text-primary">使い方</a>
            <a href="/mypage" className="hover:text-primary">マイページ</a>
          </nav>
        </div>
      </header>

      <GlobalPushNotification />
      
      <BrowserRouter>
        <PageTracker />
        <Routes>
          <Route path="/" element={<ThreadListPage />} />
          <Route path="/threads/:threadId" element={<ThreadDetailPage />} />
          <Route path="/threads/:threadId/edit" element={<ThreadEditPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/support/ticket/:ticketId" element={<TicketDetailPage />} />
          <Route path="/admin/*" element={<AdminLayout />} />
          <Route path="/ng-settings" element={<NGSettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
