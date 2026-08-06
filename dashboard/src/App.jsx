// App.jsx — CommentPulse root with routing

import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Header from './components/Header.jsx';
import Home from './pages/Home.jsx';
import Dashboard from './pages/Dashboard.jsx';

const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');

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

/* ── Main App Component ──────────────────────────────────────────────── */

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { toasts, addToast } = useToasts();
  const location = useLocation();
  const navigate = useNavigate();

  /* ── Check Auth & Handle OAuth Callback ── */
  useEffect(() => {
    async function initAuth() {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code) {
        // Exchange code
        try {
          const res = await fetch(`${ORCHESTRATOR_URL}/auth/exchange`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
          });
          if (res.ok) {
            setIsAuthenticated(true);
            addToast('Successfully authenticated with YouTube!', 'success');
            navigate('/dashboard');
          } else {
            addToast('Failed to authenticate.', 'error');
          }
        } catch (err) {
          addToast('Auth error: ' + err.message, 'error');
        }
        
        // Clean URL
        window.history.replaceState({}, document.title, location.pathname);
      } else {
        // Check current status
        try {
          const res = await fetch(`${ORCHESTRATOR_URL}/auth/status`);
          const data = await res.json();
          setIsAuthenticated(data.isAuthenticated);
        } catch (err) {}
      }
    }
    initAuth();
  }, [addToast, navigate, location.pathname]);

  /* ── Fetch comment count for header ── */
  useEffect(() => {
    if (location.pathname === '/dashboard') {
      const fetchCount = async () => {
        try {
          const res = await fetch(`${ORCHESTRATOR_URL}/flagged-comments`);
          if (res.ok) {
            const data = await res.json();
            setCommentCount(data.length);
          }
        } catch (err) {
          console.error('Failed to fetch comment count:', err);
        }
      };
      fetchCount();
      const interval = setInterval(fetchCount, 15000);
      return () => clearInterval(interval);
    }
  }, [location.pathname]);

  const handleLogin = async () => {
    try {
      const res = await fetch(`${ORCHESTRATOR_URL}/auth/url`);
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      addToast('Failed to get login URL: ' + err.message, 'error');
    }
  };

  const handleClear = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${ORCHESTRATOR_URL}/clear-feed`, { method: 'POST' });
      if (res.ok) {
        setCommentCount(0);
        addToast('Feed cleared', 'success');
        window.dispatchEvent(new Event('feed-cleared'));
      }
    } catch (err) {
      addToast('Failed to clear feed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <Header
        count={commentCount}
        onClear={handleClear}
        loading={loading}
        isAuthenticated={isAuthenticated}
        onLogin={handleLogin}
      />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route 
          path="/dashboard" 
          element={
            <Dashboard 
              isAuthenticated={isAuthenticated}
              onLogin={handleLogin}
            />
          } 
        />
      </Routes>

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

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
