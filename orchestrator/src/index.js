/**
 * index.js — CommentPulse Orchestrator entry point.
 *
 * Startup sequence:
 *   1. Load env vars
 *   2. Boot Express
 *   3. Register routes
 *   4. Start the cron polling job
 *   5. Listen
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import routes from './routes.js';
import { startPollingJob } from './cron.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(cors({ origin: '*' }));
app.use(express.json());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use('/', routes);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`\n🚀 CommentPulse Orchestrator running on http://localhost:${PORT}`);
  console.log(`   YouTube API Key: ${process.env.YOUTUBE_API_KEY ? '✅ set' : '⚠️  NOT SET (read-only mock mode)'}`);
  console.log(`   Threat Engine:   ${process.env.THREAT_ENGINE_URL ?? 'http://localhost:8000'}`);
  console.log(`   Poll target:     video/${process.env.MOCK_VIDEO_ID ?? 'dQw4w9WgXcQ'}\n`);
  console.log('   📌 Tip: POST /seed to load mock flagged comments for dashboard dev');
  console.log('   📌 Tip: POST /trigger-poll to manually run a poll cycle\n');

  startPollingJob();
});

export default app;
