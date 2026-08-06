// VideoScanner.jsx - Input bar to scan any YouTube video on demand

import { useState } from 'react';

const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');

export default function VideoScanner({ onScanComplete }) {
  const [url, setUrl]         = useState('');
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError]     = useState(null);

  async function handleScan(e) {
    e.preventDefault();
    if (!url.trim() || scanning) return;

    setScanning(true);
    setError(null);
    setLastResult(null);

    try {
      const res = await fetch(`${ORCHESTRATOR_URL}/scan-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setLastResult(data);
      onScanComplete(); // refresh the feed
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="scanner-bar">
      <form className="scanner-form" onSubmit={handleScan}>
        <div className="scanner-icon">🔍</div>
        <input
          id="video-url-input"
          className="scanner-input"
          type="text"
          placeholder="Paste a YouTube URL or video ID  (e.g. https://youtube.com/watch?v=dQw4w9WgXcQ)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={scanning}
          spellCheck={false}
          autoComplete="off"
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            id="scan-btn"
            className="btn btn-primary scanner-btn"
            type="submit"
            disabled={scanning || !url.trim()}
          >
            {scanning ? (
              <><span className="scanner-spinner" /> Scanning…</>
            ) : (
              'Scan Video'
            )}
          </button>
          
          <button
            id="monitor-btn"
            className="btn scanner-btn"
            type="button"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-1)' }}
            disabled={scanning || !url.trim()}
            onClick={async () => {
              if (!url.trim() || scanning) return;
              setScanning(true);
              setError(null);
              setLastResult(null);
              try {
                const res = await fetch(`${ORCHESTRATOR_URL}/monitor-live`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ videoUrl: url.trim() }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
                // Clear the input on success so they see it in the active sessions below
                setUrl('');
                onScanComplete(); // trigger a refresh of the sessions
              } catch (err) {
                setError(err.message);
              } finally {
                setScanning(false);
              }
            }}
          >
            Monitor Live Chat
          </button>
        </div>
      </form>

      {/* Result pill */}
      {lastResult && !error && (
        <div className={`scanner-result ${lastResult.flagged > 0 ? 'result-danger' : 'result-clean'}`}>
          {lastResult.flagged > 0 ? '🚨' : '✅'}
          &nbsp;
          Scanned <strong>{lastResult.scanned}</strong> comments on{' '}
          <code>{lastResult.videoId}</code> —{' '}
          {lastResult.flagged > 0
            ? <><strong style={{ color: 'var(--color-danger)' }}>{lastResult.flagged} threats</strong> flagged and added to feed</>
            : <strong style={{ color: 'var(--color-success)' }}>no threats detected</strong>
          }
        </div>
      )}

      {error && (
        <div className="scanner-result result-danger">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
