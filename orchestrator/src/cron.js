// cron.js - Polling job: fetches YouTube comments and analyzes them.
// Schedule: every 5 minutes
// Risk threshold: comments with riskScore >= 50 are stored.

import cron from 'node-cron';
import { fetchLatestComments } from './youtube.js';
import { analyzeComment } from './analyzer.js';
import { addFlagged, count } from './store.js';

const VIDEO_ID = process.env.MOCK_VIDEO_ID ?? 'dQw4w9WgXcQ';
const RISK_THRESHOLD = parseInt(process.env.RISK_THRESHOLD ?? '50', 10);

/**
 * Core poll function — exported so it can also be triggered manually via
 * the POST /trigger-poll debug endpoint.
 */
export async function pollAndAnalyze() {
  console.log(`[Cron] Polling video ${VIDEO_ID} at ${new Date().toISOString()}`);

  const comments = await fetchLatestComments(VIDEO_ID);
  console.log(`[Cron] Fetched ${comments.length} comments. Analyzing...`);

  let flaggedCount = 0;

  for (const comment of comments) {
    const result = await analyzeComment(comment);
    if (!result) continue;

    if (result.riskScore >= RISK_THRESHOLD) {
      addFlagged(result);
      flaggedCount++;
      console.log(
        `[Cron] 🚨 Flagged: "${result.authorName}" — score=${result.riskScore} flags=[${result.flags.join(', ')}]`
      );
    }
  }

  console.log(
    `[Cron] Done. ${flaggedCount} new flagged comments. Store total: ${count()}`
  );
}

/**
 * Register the cron job. Call once at server startup.
 */
export function startPollingJob() {
  console.log('[Cron] Registering poll job — every 5 minutes.');
  cron.schedule('*/5 * * * *', pollAndAnalyze);
}
