/**
 * analyzer.js — HTTP client for the Python Threat Engine.
 *
 * Sends comment data to POST /analyze and returns the risk assessment.
 */

import axios from 'axios';

const THREAT_ENGINE_URL = process.env.THREAT_ENGINE_URL ?? 'http://localhost:8000';
const CREATOR_NAME = process.env.CREATOR_NAME ?? 'ChannelOwner';

/**
 * Analyze a single comment against the Python Threat Engine.
 *
 * @param {{ id: string, videoId: string, authorName: string, commentText: string }} comment
 * @returns {Promise<{
 *   id: string,
 *   videoId: string,
 *   authorName: string,
 *   commentText: string,
 *   normalizedText: string,
 *   riskScore: number,
 *   isImpersonator: boolean,
 *   flags: string[],
 *   detectedAt: string,
 * } | null>} — null if the request to the engine failed
 */
export async function analyzeComment(comment) {
  // Live chat messages use `displayMessage`; VOD comments use `commentText`.
  // Normalize to one field so the threat engine always gets real text.
  const resolvedText = comment.commentText ?? comment.displayMessage ?? '';

  try {
    const { data } = await axios.post(`${THREAT_ENGINE_URL}/analyze`, {
      comment_text: resolvedText,
      author_name: comment.authorName,
      creator_name: CREATOR_NAME,
    });

    return {
      id: comment.id,
      videoId: comment.videoId,
      authorName: comment.authorName,
      commentText: resolvedText,   // always a real string now
      normalizedText: data.normalized_text,
      riskScore: data.risk_score,
      isImpersonator: data.is_impersonator,
      flags: data.flags,
      llmReasoning: data.llm_reasoning ?? null,
      source: comment.source || 'vod',
      detectedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[Analyzer] Failed to analyze comment ${comment.id}:`, err.message);
    return null;
  }
}
