// CommentCard.jsx — displays a single flagged comment with ban action

import { useState } from 'react';

const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');

/* ── Helpers ──────────────────────────────────────────────────────────── */

function getRiskClass(score) {
  if (score >= 85) return 'score-critical';
  if (score >= 65) return 'score-high';
  if (score >= 40) return 'score-medium';
  return 'score-low';
}

function getRiskLabel(score) {
  if (score >= 85) return 'CRITICAL';
  if (score >= 65) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

function getFlagBadgeClass(flag) {
  if (flag === 'Impersonation Risk')      return 'impersonation';
  if (flag === 'Obfuscated Author Name')  return 'obfuscated-name';
  if (flag === 'Obfuscated Link Detected') return 'obfuscated-link';
  return 'default';
}

function formatTime(iso) {
  try {
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.round((new Date(iso) - Date.now()) / 60000),
      'minutes'
    );
  } catch {
    return iso;
  }
}

function getInitials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/* ── Component ────────────────────────────────────────────────────────── */

export default function CommentCard({ comment, onBanned }) {
  const [banning, setBanning] = useState(false);
  const [banned, setBanned] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  const { id, authorName, commentText, normalizedText, riskScore, isImpersonator, flags, detectedAt, llmReasoning, source } = comment;

  const isObfuscated =
    normalizedText && normalizedText !== commentText;

  async function handleBan() {
    if (banning || banned) return;
    setBanning(true);
    try {
      const res = await fetch(`${ORCHESTRATOR_URL}/ban-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId: id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBanned(true);
      setTimeout(() => onBanned(id), 600); // allow "banned" flash before removing
    } catch (err) {
      console.error('[Ban]', err);
      alert(`Ban failed: ${err.message}`);
    } finally {
      setBanning(false);
    }
  }

  async function handleReport() {
    if (reporting || reported) return;
    setReporting(true);
    try {
      const res = await fetch(`${ORCHESTRATOR_URL}/report-abuse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId: id, source }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReported(true);
    } catch (err) {
      console.error('[Report]', err);
      alert(`Report failed: ${err.message}`);
    } finally {
      setReporting(false);
    }
  }

  return (
    <div className={`comment-card ${riskScore >= 65 ? 'high-risk' : ''} ${banned ? 'opacity-40 pointer-events-none' : ''}`}>
      {/* ── Card header: avatar + author + risk score ── */}
      <div className="card-header">
        <div className="card-author">
          <div className={`avatar ${isImpersonator ? 'danger-avatar' : ''}`}>
            {getInitials(authorName) || '?'}
          </div>
          <div className="author-info">
            <h3>{authorName}</h3>
            <span>{isImpersonator ? '⚠️ Suspected Impersonator' : 'Suspicious User'}</span>
          </div>
        </div>

        <div className="risk-ring">
          <span className={`risk-score ${getRiskClass(riskScore)}`}>{riskScore}</span>
          <span className="risk-label">{getRiskLabel(riskScore)}</span>
        </div>
      </div>

      {/* ── Flag badges ── */}
      {flags?.length > 0 && (
        <div className="flag-list">
          {flags.map((flag) => (
            <span key={flag} className={`flag-badge ${getFlagBadgeClass(flag)}`}>
              {flag}
            </span>
          ))}
        </div>
      )}

      {/* ── Comment body ── */}
      <div className="card-body">
        <div className="card-body-label">Original Comment</div>
        <p>{commentText}</p>

        {isObfuscated && (
          <div className="normalized-text">
            <div className="card-body-label">Normalized (after stripping obfuscation)</div>
            <p style={{ color: 'var(--color-warn)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
              {normalizedText}
            </p>
          </div>
        )}
      </div>

      {/* LLM reasoning */}
      {llmReasoning && (
        <div style={{
          background: 'rgba(99,102,241,0.07)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: '8px',
          padding: '0.6rem 0.9rem',
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>🤖</span>
          <div>
            <div style={{ fontSize: '0.63rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-3)', marginBottom: '3px' }}>
              LLM Analysis (Groq / llama-3.3-70b)
            </div>
            <p style={{ fontSize: '0.8rem', color: '#a5b4fc', fontStyle: 'italic', lineHeight: 1.5 }}>
              "{llmReasoning}"
            </p>
          </div>
        </div>
      )}

      {/* ── Card footer ── */}
      <div className="card-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' }}>
        <span className="timestamp">{formatTime(detectedAt)}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn"
            style={{ 
              background: reported ? 'rgba(234,179,8,.1)' : 'transparent',
              color: reported ? '#fde047' : 'var(--color-text-2)',
              border: `1px solid ${reported ? 'rgba(234,179,8,.3)' : 'var(--color-border)'}`,
              padding: '6px 12px',
              fontSize: '0.8rem'
            }}
            onClick={handleReport}
            disabled={reporting || reported}
          >
            {reported ? '✅ Reported' : reporting ? '⏳ Reporting…' : '⚠️ Report Abuse'}
          </button>
          
          <button
            className={`btn-ban ${banning ? 'banning' : ''}`}
            onClick={handleBan}
            disabled={banning || banned}
          >
            {banned ? '✅ Banned' : banning ? '⏳ Banning…' : '🚫 Ban User & Hide'}
          </button>
        </div>
      </div>
    </div>
  );
}
