// Dashboard.jsx — Main threat monitoring interface

import { useState, useEffect, useCallback, useRef } from 'react';
import CommentCard from '../components/CommentCard.jsx';
import VideoScanner from '../components/VideoScanner.jsx';
import LiveSessions from '../components/LiveSessions.jsx';

const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL ?? 'http://localhost:3001';
const POLL_INTERVAL_MS = 15_000; // 15 seconds

/* ── Toast helpers ──────────────────────────────────────────────────── */

let toastIdSeq = 0;

function useToasts() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = ++toastIdSeq;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return { toasts, addToast };
}

/* ── Stats helpers ──────────────────────────────────────────────────── */

function computeStats(comments) {
  const total = comments.length;
  const critical = comments.filter((c) => c.riskScore >= 85).length;
  const impersonators = comments.filter((c) => c.isImpersonator).length;
  const obfLinks = comments.filter((c) => c.flags?.includes('Obfuscated Link Detected')).length;
  return { total, critical, impersonators, obfLinks };
}

/* ── Component ──────────────────────────────────────────────────────── */

export default function Dashboard({ isAuthenticated, onLogin }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);
  const [liveSessions, setLiveSessions] = useState([]);
  const { toasts, addToast } = useToasts();
  const intervalRef = useRef(null);
  const liveIntervalRef = useRef(null);

  /* ── Fetch flagged comments ── */
  const fetchFlagged = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${ORCHESTRATOR_URL}/flagged-comments`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setComments(data);
      setLastFetch(new Date());
    } catch (err) {
      console.error('[Dashboard] fetchFlagged failed:', err);
      if (!silent) addToast(`Failed to fetch comments: ${err.message}`, 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [addToast]);

  /* ── Fetch live sessions ── */
  const fetchLiveSessions = useCallback(async () => {
    try {
      const res = await fetch(`${ORCHESTRATOR_URL}/live-sessions`);
      if (res.ok) {
        const data = await res.json();
        setLiveSessions(data);
      }
    } catch (err) {
      console.error('[Dashboard] fetchLiveSessions failed:', err);
    }
  }, []);

  /* ── Remove a banned comment from local state ── */
  const handleBanned = useCallback((commentId) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    addToast('🚫 User banned and comment hidden.', 'success');
  }, [addToast]);

  /* ── Stop a live session ── */
  const handleStopLiveSession = useCallback(async (videoId) => {
    try {
      const res = await fetch(`${ORCHESTRATOR_URL}/stop-live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      addToast(`Stopped monitoring ${videoId}`, 'success');
      fetchLiveSessions();
    } catch (err) {
      addToast(`Failed to stop monitoring: ${err.message}`, 'error');
    }
  }, [addToast, fetchLiveSessions]);

  /* ── Auto-poll every 15s for flags, 5s for live sessions ── */
  useEffect(() => {
    fetchFlagged();
    fetchLiveSessions();
    
    intervalRef.current = setInterval(() => fetchFlagged(true), POLL_INTERVAL_MS);
    liveIntervalRef.current = setInterval(() => fetchLiveSessions(), 5000);
    
    return () => {
      clearInterval(intervalRef.current);
      clearInterval(liveIntervalRef.current);
    };
  }, [fetchFlagged, fetchLiveSessions]);

  const stats = computeStats(comments);

  /* ── Render ── */
  return (
    <div className="dashboard-page">
      <main className="main-content">
        {/* Page hero */}
        <div className="page-hero">
          <h1>🛡️ Threat Intelligence Feed</h1>
          <p>
            Scan any YouTube video for impersonators, homoglyph obfuscation, and scam patterns.
            {lastFetch && (
              <span style={{ color: 'var(--color-text-3)', marginLeft: 8 }}>
                Last updated {lastFetch.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>

        {/* Video URL scanner */}
        <VideoScanner onScanComplete={() => { fetchFlagged(); fetchLiveSessions(); }} />

        {/* Active live monitoring sessions */}
        <LiveSessions sessions={liveSessions} onStopSession={handleStopLiveSession} />

        {/* Stats bar */}
        <div className="stats-bar">
          <div className="stat-card">
            <div className="stat-card-value" style={{ color: 'var(--color-accent)' }}>{stats.total}</div>
            <div className="stat-card-label">Threats Flagged</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-value" style={{ color: 'var(--color-danger)' }}>{stats.critical}</div>
            <div className="stat-card-label">Critical Risk</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-value" style={{ color: 'var(--color-warn)' }}>{stats.impersonators}</div>
            <div className="stat-card-label">Impersonators</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-value" style={{ color: '#60a5fa' }}>{stats.obfLinks}</div>
            <div className="stat-card-label">Obfuscated Links</div>
          </div>
        </div>

        {/* Action bar */}
        <div className="action-bar">
          <div className="action-bar-left">
            {loading && <div className="spinner" />}
            {!loading && <span style={{ fontSize: '0.8rem', color: 'var(--color-text-3)' }}>
              {comments.length === 0 ? 'No threats detected' : `Showing ${comments.length} flagged comment${comments.length !== 1 ? 's' : ''}`}
            </span>}
          </div>
        </div>

        {/* Feed */}
        {!loading && comments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎉</div>
            <h2>No threats detected</h2>
            <p>
              The comment section appears clean. Paste a video URL or start a live session to begin monitoring.
            </p>
          </div>
        ) : (
          <div className="feed-grid">
            {comments.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                onBanned={handleBanned}
              />
            ))}
          </div>
        )}
      </main>

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
