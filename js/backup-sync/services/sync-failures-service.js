/**
 * @fileoverview Firestore CRUD for sync_failures documents.
 * @module backup-sync/services/sync-failures-service
 */

import { COLLECTIONS } from '../../constants/constants.js';
import {
  addDocument,
  getCollection,
  setDocument,
  getServerTimestamp,
} from '../../services/firestore-service.js';
import { BACKUP_SYNC } from '../backup-sync-constants.js';

/**
 * Logs a sync failure for a member record.
 * @param {string} memberId
 * @param {string} errorMessage
 * @param {string} [destinationId]
 * @returns {Promise<string>} New failure document ID.
 */
export async function logSyncFailure(memberId, errorMessage, destinationId = BACKUP_SYNC.DEFAULT_DESTINATION_ID) {
  return addDocument(COLLECTIONS.SYNC_FAILURES, {
    memberId,
    destinationId,
    errorMessage: String(errorMessage || 'Unknown error'),
    timestamp: getServerTimestamp(),
    resolved: false,
    retryCount: 0,
  });
}

/**
 * Returns unresolved failure documents for a destination.
 * @param {string} [destinationId]
 * @returns {Promise<Array<Object>>}
 */
export async function fetchUnresolvedFailures(destinationId = BACKUP_SYNC.DEFAULT_DESTINATION_ID) {
  const all = await getCollection(COLLECTIONS.SYNC_FAILURES);
  return all.filter((f) => f.destinationId === destinationId && !f.resolved);
}

/**
 * Returns count of unresolved failures for a destination.
 * @param {string} [destinationId]
 * @returns {Promise<number>}
 */
export async function countUnresolvedFailures(destinationId = BACKUP_SYNC.DEFAULT_DESTINATION_ID) {
  const failures = await fetchUnresolvedFailures(destinationId);
  return failures.length;
}

/**
 * Marks a failure document as resolved.
 * @param {string} failureId
 * @returns {Promise<void>}
 */
export async function resolveSyncFailure(failureId) {
  await setDocument(COLLECTIONS.SYNC_FAILURES, failureId, { resolved: true });
}

/**
 * Increments retry count on a failure document.
 * @param {string} failureId
 * @param {number} currentCount
 * @returns {Promise<void>}
 */
export async function incrementFailureRetryCount(failureId, currentCount) {
  await setDocument(COLLECTIONS.SYNC_FAILURES, failureId, {
    retryCount: (currentCount || 0) + 1,
  });
}

/**
 * Fetches failures for specific member IDs (unresolved only).
 * @param {string[]} memberIds
 * @param {string} [destinationId]
 * @returns {Promise<Array<Object>>}
 */
export async function fetchFailuresForMembers(memberIds, destinationId = BACKUP_SYNC.DEFAULT_DESTINATION_ID) {
  const idSet = new Set(memberIds);
  const unresolved = await fetchUnresolvedFailures(destinationId);
  return unresolved.filter((f) => idSet.has(f.memberId));
}
