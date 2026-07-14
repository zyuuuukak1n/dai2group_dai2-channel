import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="glass-panel text-center py-16">
      <h1 style={{ fontSize: '4rem', marginBottom: '1rem' }}>404</h1>
      <p className="text-muted mb-8 text-lg">お探しのページは見つかりませんでした。</p>
      <Link to="/" className="btn btn-primary" style={{ textDecoration: 'none' }}>
        トップページへ戻る
      </Link>
    </div>
  );
}
