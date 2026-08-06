// Header.jsx — sticky navigation bar with live status indicator

import { Link, useLocation } from 'react-router-dom';

const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL ?? 'http://localhost:3001';

export default function Header({ count, onClear, loading, isAuthenticated, onLogin }) {
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';

  return (
    <header className="header">
      <Link to="/" className="header-brand">
        <div className="header-logo">🛡️</div>
        <span className="header-title">CommentPulse</span>
      </Link>

      <div className="header-right">
        {!isDashboard && (
          <Link to="/dashboard" className="btn btn-ghost">
            Dashboard
          </Link>
        )}

        {isDashboard && (
          <>
            <div className="live-badge">
              <span className="live-dot" />
              Live
            </div>

            <span className="header-stat">
              <strong>{count}</strong> threats detected
            </span>

            <button className="btn btn-ghost" onClick={onClear} disabled={loading}>
              {loading ? '🗑️ Clearing…' : '🗑️ Clear Feed'}
            </button>
          </>
        )}

        {isAuthenticated ? (
          <span className="badge badge-success" style={{ marginLeft: '10px' }}>✓ Logged In</span>
        ) : (
          <button className="btn btn-primary" onClick={onLogin} style={{ marginLeft: '10px' }}>
            Login with YouTube
          </button>
        )}
      </div>
    </header>
  );
}
