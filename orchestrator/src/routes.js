// routes.js - Express route definitions for the orchestrator API.

import { Router } from 'express';
import { getFlagged, removeById, addFlagged, clearStore, getById } from './store.js';
import { banUser, fetchLatestComments, markAsSpam } from './youtube.js';
import { analyzeComment } from './analyzer.js';
import { startSession, stopSession, getSessions, decrementSessionThreats } from './livechat.js';
import { getAuthUrl, oauth2Client, setTokens, getTokens } from './auth.js';

// ---------------------------------------------------------------------------
// Helper: extract a YouTube video ID from a URL or bare ID string
// Handles: https://youtube.com/watch?v=ID, https://youtu.be/ID, bare IDs
// ---------------------------------------------------------------------------
function extractVideoId(input) {
  if (!input) return null;
  const s = input.trim();
  // youtu.be/ID
  const shortMatch = s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  // youtube.com/watch?v=ID  or  /shorts/ID  or  /embed/ID  or /live/ID
  const longMatch = s.match(/(?:v=|\/shorts\/|\/embed\/|\/v\/|\/live\/)([A-Za-z0-9_-]{11})/);
  if (longMatch) return longMatch[1];
  // bare 11-char ID
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  return null;
}

const router = Router();

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'orchestrator', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// GET /flagged-comments
// ---------------------------------------------------------------------------

router.get('/flagged-comments', (_req, res) => {
  res.json(getFlagged());
});

// ---------------------------------------------------------------------------
// POST /ban-user
// ---------------------------------------------------------------------------

/**
 * Body: { "commentId": "..." }
 */
router.post('/ban-user', async (req, res) => {
  const { commentId } = req.body;

  if (!commentId) {
    return res.status(400).json({ error: 'Missing required field: commentId' });
  }

  try {
    const comment = getById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found in local store' });
    }
    const result = await banUser(comment);
    removeById(commentId);
    
    if (comment.videoId) {
      decrementSessionThreats(comment.videoId);
    }
    
    return res.json({ ...result, commentId });
  } catch (err) {
    console.error('[Routes] /ban-user error:', err.message);
    return res.status(500).json({ error: 'Failed to ban user', details: err.message });
  }
});


// ---------------------------------------------------------------------------
// GET /auth/url
// ---------------------------------------------------------------------------
router.get('/auth/url', (_req, res) => {
  res.json({ url: getAuthUrl() });
});

// ---------------------------------------------------------------------------
// POST /auth/exchange
// ---------------------------------------------------------------------------
router.post('/auth/exchange', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Missing code' });
  try {
    const { tokens } = await oauth2Client.getToken(code);
    setTokens(tokens);
    res.json({ message: 'Tokens stored successfully' });
  } catch (err) {
    console.error('[Routes] OAuth exchange error:', err.message);
    res.status(500).json({ error: 'Token exchange failed', details: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /auth/status
// ---------------------------------------------------------------------------
router.get('/auth/status', (_req, res) => {
  res.json({ isAuthenticated: !!getTokens() });
});

// ---------------------------------------------------------------------------
// POST /scan-video  — on-demand scan of any YouTube video
// ---------------------------------------------------------------------------
// Body: { "videoUrl": "https://youtube.com/watch?v=..." }
//    or { "videoUrl": "dQw4w9WgXcQ" }   (bare video ID also accepted)

router.post('/scan-video', async (req, res) => {
  const { videoUrl } = req.body;
  const videoId = extractVideoId(videoUrl);

  if (!videoId) {
    return res.status(400).json({
      error: 'Invalid or missing videoUrl. Provide a full YouTube URL or an 11-character video ID.',
    });
  }

  console.log(`[Routes] /scan-video triggered for videoId=${videoId}`);

  try {
    const comments = await fetchLatestComments(videoId, Infinity);

    if (comments.length === 0) {
      return res.json({
        videoId,
        scanned: 0,
        flagged: 0,
        results: [],
        message: 'No comments found. The video may have comments disabled or the API key lacks access.',
      });
    }

    const RISK_THRESHOLD = parseInt(process.env.RISK_THRESHOLD ?? '50', 10);
    const results = [];

    for (const comment of comments) {
      const result = await analyzeComment(comment);
      if (!result) continue;
      if (result.riskScore >= RISK_THRESHOLD) {
        addFlagged(result);
        results.push(result);
      }
    }

    console.log(`[Routes] /scan-video done: scanned=${comments.length}, flagged=${results.length}`);

    return res.json({
      videoId,
      scanned: comments.length,
      flagged: results.length,
      results,
    });
  } catch (err) {
    console.error('[Routes] /scan-video error:', err.message);
    return res.status(500).json({ error: 'Scan failed', details: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /monitor-live  — start live chat monitoring for a video
// ---------------------------------------------------------------------------
// Body: { "videoUrl": "https://youtube.com/watch?v=..." }

router.post('/monitor-live', async (req, res) => {
  const { videoUrl } = req.body;
  const videoId = extractVideoId(videoUrl);

  if (!videoId) {
    return res.status(400).json({
      error: 'Invalid or missing videoUrl.',
    });
  }

  const result = await startSession(videoId);
  if (result.success) {
    clearStore();
  }
  return res.status(result.success ? 200 : 400).json({ videoId, ...result });
});

// ---------------------------------------------------------------------------
// GET /live-sessions  — list active monitoring sessions
// ---------------------------------------------------------------------------

router.get('/live-sessions', (_req, res) => {
  res.json(getSessions());
});

// ---------------------------------------------------------------------------
// POST /stop-live  — stop a live chat monitoring session
// ---------------------------------------------------------------------------
// Body: { "videoId": "..." }

router.post('/stop-live', (req, res) => {
  const { videoId } = req.body;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId.' });
  const result = stopSession(videoId);
  return res.status(result.success ? 200 : 404).json(result);
});

// ---------------------------------------------------------------------------
// POST /report-abuse  — mark a comment as spam or delete a live chat message
// ---------------------------------------------------------------------------
// Body: { "commentId": "...", "source": "vod" | "live" }

router.post('/report-abuse', async (req, res) => {
  const { commentId, source } = req.body;

  if (!commentId) {
    return res.status(400).json({ error: 'Missing required field: commentId' });
  }

  try {
    let result;
    if (source === 'live') {
      const { deleteLiveChatMessage } = await import('./youtube.js');
      result = await deleteLiveChatMessage(commentId);
    } else {
      const { markAsSpam } = await import('./youtube.js');
      result = await markAsSpam(commentId);
    }
    return res.json({ ...result, commentId, source });
  } catch (err) {
    console.error('[Routes] /report-abuse error:', err.message);
    return res.status(500).json({ error: 'Failed to report abuse', details: err.message });
  }
});

export default router;
