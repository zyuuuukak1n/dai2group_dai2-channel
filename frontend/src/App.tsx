import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ThreadListPage from './pages/ThreadListPage';
import ThreadDetailPage from './pages/ThreadDetailPage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <div className="container animate-fade-in">
      <header className="mb-8">
        <h1>だいにちゃんねる</h1>
        <p className="text-muted">完全匿名・独立・爆速のファンコミュニティ掲示板</p>
      </header>
      
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ThreadListPage />} />
          <Route path="/threads/:threadId" element={<ThreadDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
