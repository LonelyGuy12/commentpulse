// youtube.js - YouTube Data API v3 integration.
// API key  → read operations (comments, live chat messages, video metadata)
// OAuth2   → write operations (ban, markAsSpam, delete) — stubbed for MVP

import { google } from 'googleapis';
import { oauth2Client, getTokens } from './auth.js';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

// ---------------------------------------------------------------------------
// VOD Comments (paginated)
// ---------------------------------------------------------------------------

export async function fetchLatestComments(videoId, totalLimit = 500) {
  const all = [];
  let pageToken = undefined;
  const pageSize = 100;

  try {
    do {
      const response = await youtube.commentThreads.list({
        part: ['snippet'],
        videoId,
        order: 'time',
        maxResults: pageSize,
        textFormat: 'plainText',
        ...(pageToken ? { pageToken } : {}),
      });

      const items = response.data.items ?? [];
      for (const item of items) {
        const topComment = item.snippet.topLevelComment.snippet;
        all.push({
          id: item.snippet.topLevelComment.id,
          videoId,
          authorName: topComment.authorDisplayName,
          commentText: topComment.textDisplay,
          source: 'vod',
        });
        if (all.length >= totalLimit) break;
      }

      pageToken = response.data.nextPageToken ?? null;
      console.log(`[YouTube] VOD page fetched — total: ${all.length}, hasMore: ${!!pageToken}`);
    } while (pageToken && all.length < totalLimit);

    return all;
  } catch (err) {
    console.error(`[YouTube] fetchLatestComments failed for ${videoId}:`, err.message);
    return all;
  }
}

// ---------------------------------------------------------------------------
// Live Chat — get liveChatId from a video
// ---------------------------------------------------------------------------

/**
 * Resolve the active live chat ID for a video.
 * Returns null if the video is not a live stream or has no active chat.
 * @param {string} videoId
 * @returns {Promise<string|null>}
 */
export async function getLiveChatId(videoId) {
  try {
    const response = await youtube.videos.list({
      part: ['liveStreamingDetails', 'snippet'],
      id: [videoId],
    });

    const video = response.data.items?.[0];
    if (!video) return null;

    const liveChatId = video.liveStreamingDetails?.activeLiveChatId ?? null;
    if (!liveChatId) {
      console.log(`[YouTube] Video ${videoId} has no active live chat (may be VOD or scheduled).`);
    }
    return liveChatId;
  } catch (err) {
    console.error(`[YouTube] getLiveChatId failed for ${videoId}:`, err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Live Chat — fetch one page of messages
// ---------------------------------------------------------------------------

/**
 * Fetch a single page of live chat messages.
 *
 * @param {string} liveChatId
 * @param {string|undefined} pageToken - omit for first page
 * @returns {Promise<{
 *   messages: Array<{ id, authorName, commentText, publishedAt, source }>,
 *   nextPageToken: string|null,
 *   pollIntervalMs: number,
 * }>}
 */
export async function fetchLiveChatPage(liveChatId, pageToken = undefined) {
  try {
    const response = await youtube.liveChatMessages.list({
      liveChatId,
      part: ['snippet', 'authorDetails'],
      maxResults: 2000,
      ...(pageToken ? { pageToken } : {}),
    });

    const data = response.data;
    console.log(`[LiveChat][API] totalResults=${data.pageInfo?.totalResults} | itemsRaw=${data.items?.length ?? 0} | nextPageToken=${!!data.nextPageToken} | pollingMs=${data.pollingIntervalMillis}`);
    const messages = (data.items ?? [])
      .filter(item => item.snippet.type === 'textMessageEvent') // only text messages
      .map(item => ({
        id: item.id,
        authorName: item.authorDetails.displayName,
        authorChannelId: item.authorDetails.channelId,
        liveChatId,
        commentText: item.snippet.displayMessage,
        publishedAt: item.snippet.publishedAt,
        source: 'live',
      }));

    return {
      messages,
      nextPageToken: data.nextPageToken ?? null,
      pollIntervalMs: data.pollingIntervalMillis ?? 5000,
    };
  } catch (err) {
    console.error(`[YouTube] fetchLiveChatPage failed:`, err.message);
    return { messages: [], nextPageToken: null, pollIntervalMs: 10000 };
  }
}

// ---------------------------------------------------------------------------
// Moderation — OAuth2 required (stubbed)
// ---------------------------------------------------------------------------


export async function banUser(comment) {
  if (!comment.liveChatId || !comment.authorChannelId) {
    return { success: false, message: 'Cannot ban: missing liveChatId or authorChannelId.' };
  }
  
  if (!getTokens()) {
    return { success: false, message: 'OAuth tokens missing. Please login via the dashboard.' };
  }

  const oauthYoutube = google.youtube({
    version: 'v3',
    auth: oauth2Client
  });

  try {
    await oauthYoutube.liveChatBans.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          liveChatId: comment.liveChatId,
          type: 'permanent',
          bannedUserDetails: {
            channelId: comment.authorChannelId
          }
        }
      }
    });
    
    // Also delete the offending message so it disappears from the screen
    try {
      await oauthYoutube.liveChatMessages.delete({
        id: comment.id
      });
      console.log(`[YouTube] Deleted offending message ${comment.id}`);
    } catch (delErr) {
      console.warn(`[YouTube] Could not delete message ${comment.id}:`, delErr.message);
    }
    
    console.log(`[YouTube] Banned user ${comment.authorName} (${comment.authorChannelId}) from chat ${comment.liveChatId}`);
    return { success: true, message: `Banned ${comment.authorName}.` };
  } catch (err) {
    console.error('[YouTube] Failed to ban user:', err.message);
    return { success: false, message: err.message };
  }
}

export async function markAsSpam(commentId) {
  console.log(`[YouTube] [STUB] comments.markAsSpam(id=${commentId})`);
  // Real: await youtube.comments.markAsSpam({ id: commentId });
  return { success: true, message: `[STUB] Comment ${commentId} reported as spam.` };
}

export async function deleteLiveChatMessage(liveChatMessageId) {
  console.log(`[YouTube] [STUB] liveChatMessages.delete(id=${liveChatMessageId})`);
  // Real: await youtube.liveChatMessages.delete({ id: liveChatMessageId });
  return { success: true, message: `[STUB] Live chat message ${liveChatMessageId} deleted.` };
}
