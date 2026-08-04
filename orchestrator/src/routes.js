// routes.js - Express route definitions for the orchestrator API.

import { Router } from 'express';
import { getFlagged, removeById, addFlagged } from './store.js';
import { banUser, fetchLatestComments, markAsSpam } from './youtube.js';
import { pollAndAnalyze } from './cron.js';
import { analyzeComment } from './analyzer.js';
import { startSession, stopSession, getSessions } from './livechat.js';

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
  // youtube.com/watch?v=ID  or  /shorts/ID  or  /embed/ID
  const longMatch = s.match(/(?:v=|\/shorts\/|\/embed\/|\/v\/)([A-Za-z0-9_-]{11})/);
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
    const result = await banUser(commentId);
    removeById(commentId);
    return res.json({ ...result, commentId });
  } catch (err) {
    console.error('[Routes] /ban-user error:', err.message);
    return res.status(500).json({ error: 'Failed to ban user', details: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /trigger-poll  (debug / demo)
// ---------------------------------------------------------------------------

router.post('/trigger-poll', async (_req, res) => {
  console.log('[Routes] Manual poll triggered via /trigger-poll');
  // Run in background so the request returns immediately
  pollAndAnalyze().catch((err) => console.error('[Routes] Poll error:', err));
  res.json({ message: 'Poll started in background.' });
});

// ---------------------------------------------------------------------------
// POST /seed  (debug — inject realistic mock data for dashboard development)
// ---------------------------------------------------------------------------

router.post('/seed', (_req, res) => {
  const mockComments = [
    {
      id: 'mock_001',
      videoId: 'dQw4w9WgXcQ',
      authorName: 'MrBеast',                          // Cyrillic 'е'
      commentText: 'I give away $10,000 every week! DM me on telegram t.me/mrbeast_giveaway',
      normalizedText: 'I give away $10,000 every week! DM me on telegram t.me/mrbeast_giveaway',
      riskScore: 97,
      isImpersonator: true,
      flags: ['Impersonation Risk', 'Obfuscated Author Name', 'Obfuscated Link Detected'],
      detectedAt: new Date().toISOString(),
    },
    {
      id: 'mock_002',
      videoId: 'dQw4w9WgXcQ',
      authorName: 'MrB3ast',
      commentText: 'click below for free crypto — double your bitcoin! Send 0.1 BTC to get 0.2 back',
      normalizedText: 'click below for free crypto — double your bitcoin! Send 0.1 BTC to get 0.2 back',
      riskScore: 88,
      isImpersonator: true,
      flags: ['Impersonation Risk', 'Obfuscated Link Detected'],
      detectedAt: new Date(Date.now() - 120_000).toISOString(),
    },
    {
      id: 'mock_003',
      videoId: 'dQw4w9WgXcQ',
      authorName: 'MrBeast_Official',
      commentText: 'Great video bro! Check my channel for similar content :-)',
      normalizedText: 'Great video bro! Check my channel for similar content :-)',
      riskScore: 61,
      isImpersonator: false,
      flags: ['Impersonation Risk'],
      detectedAt: new Date(Date.now() - 300_000).toISOString(),
    },
    {
      id: 'mock_004',
      videoId: 'dQw4w9WgXcQ',
      authorName: 'crypto_wizard99',
      commentText: 'I was scammed but got my money back through this site: recovery(dot)xyz',
      normalizedText: 'I was scammed but got my money back through this site: recovery(dot)xyz',
      riskScore: 55,
      isImpersonator: false,
      flags: ['Obfuscated Link Detected'],
      detectedAt: new Date(Date.now() - 600_000).toISOString(),
    },
  ];

  mockComments.forEach(addFlagged);
  res.json({ message: `Seeded ${mockComments.length} mock flagged comments.` });
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
