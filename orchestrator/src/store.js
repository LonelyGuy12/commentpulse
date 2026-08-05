/**
 * store.js — In-memory store for flagged comments.
 *
 * Each entry shape:
 * {
 *   id: string,               // YouTube comment ID
 *   videoId: string,
 *   authorName: string,
 *   commentText: string,      // original raw text
 *   normalizedText: string,
 *   riskScore: number,        // 0-100
 *   isImpersonator: boolean,
 *   flags: string[],          // e.g. ["Impersonation Risk", "Obfuscated Link Detected"]
 *   detectedAt: string,       // ISO timestamp
 * }
 */

/** @type {Map<string, object>} — keyed by comment ID for O(1) dedup & removal */
const flaggedStore = new Map();

/**
 * Add or update a flagged comment. Silently deduplicates by comment ID.
 * @param {object} comment
 */
export function addFlagged(comment) {
  flaggedStore.set(comment.id, comment);
}

/**
 * Return all flagged comments as an array, sorted by riskScore descending.
 * @returns {object[]}
 */
export function getFlagged() {
  return [...flaggedStore.values()].sort((a, b) => b.riskScore - a.riskScore);
}

/**
 * Remove a comment from the store (called after a ban action).
 * @param {string} commentId
 */
export function removeById(commentId) {
  flaggedStore.delete(commentId);
}

/**
 * How many flagged items are currently stored.
 * @returns {number}
 */
export function count() {
  return flaggedStore.size;
}

/**
 * Clear all comments from the store (used when starting a new session).
 */
export function clearStore() {
  flaggedStore.clear();
}
