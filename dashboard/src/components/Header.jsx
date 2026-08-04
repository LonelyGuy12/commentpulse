// Header.jsx — sticky navigation bar with live status indicator

const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL ?? 'http://localhost:3001';

export default function Header({ count, onSeed, onRefresh, loading }) {
  return (
    <header className="header">
      <div className="header-brand">
        <div className="header-logo">🛡️</div>
        <span className="header-title">CommentPulse</span>
      </div>

      <div className="header-right">
        <div className="live-badge">
          <span className="live-dot" />
          Live
        </div>

        <span className="header-stat">
          <strong>{count}</strong> threats detected
        </span>

        <button className="btn btn-ghost" onClick={onRefresh} disabled={loading}>
          {loading ? '↻ Refreshing…' : '↻ Refresh'}
        </button>

        <button className="btn btn-primary" onClick={onSeed} title={`POST ${ORCHESTRATOR_URL}/seed`}>
          🧪 Load Mock Data
        </button>
      </div>
    </header>
  );
}
