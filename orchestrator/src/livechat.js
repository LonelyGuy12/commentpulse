// livechat.js - Live chat session manager.
// Manages one polling loop per video using the YouTube liveChatMessages.list
// stateful pagination model (nextPageToken + pollingIntervalMillis).

import { getLiveChatId, fetchLiveChatPage } from './youtube.js';
import { analyzeComment } from './analyzer.js';
import { addFlagged } from './store.js';
import fs from 'fs';
import path from 'path';

const RISK_THRESHOLD = parseInt(process.env.RISK_THRESHOLD ?? '50', 10);

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

/**
 * @typedef {{
 *   videoId: string,
 *   liveChatId: string,
 *   status: 'starting'|'active'|'stopped'|'error',
 *   startedAt: string,
 *   messagesScanned: number,
 *   threatsFlagged: number,
 *   lastPollAt: string|null,
 *   errorMessage: string|null,
 *   _stopFlag: { value: boolean },
 * }} Session
 */

/** @type {Map<string, Session>} */
const sessions = new Map();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start monitoring the live chat of a video.
 * Resolves once the session is initialised (liveChatId confirmed).
 * The polling loop runs in the background.
 *
 * @param {string} videoId
 * @returns {Promise<{ success: boolean, message: string, liveChatId?: string }>}
 */
export async function startSession(videoId) {
  if (sessions.has(videoId)) {
    const s = sessions.get(videoId);
    if (s.status === 'active' || s.status === 'starting') {
      return { success: false, message: `Already monitoring video ${videoId}.` };
    }
    // Clean up a previous errored/stopped session
    sessions.delete(videoId);
  }

  console.log(`[LiveChat] Resolving liveChatId for video ${videoId}…`);
  const liveChatId = await getLiveChatId(videoId);

  if (!liveChatId) {
    return {
      success: false,
      message: `No active live chat found for video ${videoId}. The stream may not be live yet.`,
    };
  }

  const stopFlag = { value: false };

  /** @type {Session} */
  const session = {
    videoId,
    liveChatId,
    status: 'active',
    startedAt: new Date().toISOString(),
    messagesScanned: 0,
    threatsFlagged: 0,
    lastPollAt: null,
    errorMessage: null,
    _stopFlag: stopFlag,
  };

  sessions.set(videoId, session);
  console.log(`[LiveChat] Session started for ${videoId} (liveChatId=${liveChatId})`);

  // Kick off the polling loop without awaiting
  _pollLoop(session).catch(err => {
    console.error(`[LiveChat] Poll loop crashed for ${videoId}:`, err.message);
    session.status = 'error';
    session.errorMessage = err.message;
  });

  return { success: true, message: `Live chat monitoring started.`, liveChatId };
}

/**
 * Stop an active monitoring session.
 * @param {string} videoId
 */
export function stopSession(videoId) {
  const session = sessions.get(videoId);
  if (!session) return { success: false, message: `No session found for video ${videoId}.` };

  session._stopFlag.value = true;
  session.status = 'stopped';
  console.log(`[LiveChat] Session stop requested for ${videoId}.`);
  return { success: true, message: `Monitoring stopped for ${videoId}.` };
}

/**
 * Get all sessions (serialisable — no internal flags).
 * @returns {object[]}
 */
export function getSessions() {
  return [...sessions.values()].map(({ _stopFlag, ...rest }) => rest);
}

// ---------------------------------------------------------------------------
// Internal polling loop
// ---------------------------------------------------------------------------

async function _pollLoop(session) {
  let pageToken = undefined;

  while (!session._stopFlag.value) {
    try {
      const { messages, nextPageToken, pollIntervalMs } = await fetchLiveChatPage(
        session.liveChatId,
        pageToken,
      );

      session.lastPollAt = new Date().toISOString();

      if (messages.length > 0) {
        console.log(`[LiveChat] ${session.videoId}: ${messages.length} new messages`);
        session.messagesScanned += messages.length;

        // Analyze each message through the threat engine
        for (const msg of messages) {
          if (session._stopFlag.value) break;

          const enriched = {
            ...msg,
            videoId: session.videoId,
          };

          const result = await analyzeComment(enriched);
          if (result && result.riskScore >= RISK_THRESHOLD) {
            addFlagged(result);
            session.threatsFlagged++;
            console.log(
              `[LiveChat] 🚨 Threat in live chat: "${result.authorName}" ` +
              `score=${result.riskScore} flags=[${result.flags.join(', ')}]`
            );
            
            // Explicitly log abusive messages to a dedicated file
            if (result.flags.includes('Abusive Language')) {
              const logFile = path.join(process.cwd(), 'abuse.log');
              const logLine = `[${new Date().toISOString()}] LIVE CHAT ABUSE | Video: ${session.videoId} | Author: ${result.authorName} | Msg: ${result.commentText}\n`;
              fs.appendFileSync(logFile, logLine);
            }
          }
        }
      }

      // nextPageToken may be null if stream ended
      if (!nextPageToken) {
        console.log(`[LiveChat] Stream ended or no more pages for ${session.videoId}.`);
        session.status = 'stopped';
        break;
      }

      pageToken = nextPageToken;

      // Respect the API's required polling interval
      await _sleep(pollIntervalMs);
    } catch (err) {
      console.error(`[LiveChat] Poll error for ${session.videoId}:`, err.message);
      session.status = 'error';
      session.errorMessage = err.message;
      break;
    }
  }

  console.log(`[LiveChat] Poll loop exited for ${session.videoId} (status=${session.status}).`);
}

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
