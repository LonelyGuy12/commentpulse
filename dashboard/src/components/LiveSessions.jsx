// LiveSessions.jsx - Displays active live chat monitoring sessions

export default function LiveSessions({ sessions, onStopSession }) {
  if (!sessions || sessions.length === 0) return null;

  return (
    <div className="live-sessions-container" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {sessions.map(session => (
        <div key={session.videoId} className="live-session-card" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(220, 38, 38, 0.05)',
          border: '1px solid rgba(220, 38, 38, 0.2)',
          padding: '10px 16px',
          borderRadius: '8px',
          fontSize: '0.9rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ 
              display: 'inline-block', 
              width: '10px', height: '10px', 
              background: 'var(--color-danger)', 
              borderRadius: '50%',
              boxShadow: '0 0 8px var(--color-danger)'
            }} className="pulse-anim" />
            <strong style={{ color: 'var(--color-danger)', letterSpacing: '0.05em' }}>LIVE</strong>
            <span style={{ color: 'var(--color-text-2)' }}>•</span>
            <code>{session.videoId}</code>
            <span style={{ color: 'var(--color-text-2)' }}>•</span>
            <span><strong>{session.messagesScanned}</strong> messages scanned</span>
            <span style={{ color: 'var(--color-text-2)' }}>•</span>
            <span style={{ color: session.threatsFlagged > 0 ? 'var(--color-danger)' : 'inherit' }}>
              <strong>{session.threatsFlagged}</strong> flagged
            </span>
          </div>

          <button 
            className="btn" 
            style={{ 
              padding: '4px 10px', 
              fontSize: '0.8rem', 
              background: 'transparent', 
              border: '1px solid var(--color-border)' 
            }}
            onClick={() => onStopSession(session.videoId)}
          >
            Stop
          </button>
        </div>
      ))}
    </div>
  );
}
