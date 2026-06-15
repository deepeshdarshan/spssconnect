/**
 * @fileoverview Firestore CRUD for sync_history audit records.
 * @module backup-sync/services/sync-history-service
 */

import { COLLECTIONS } from '../../constants/constants.js';
import {
  addDocument,
  getCollection,
  getServerTimestamp,
} from '../../services/firestore-service.js';
import { BACKUP_SYNC } from '../backup-sync-constants.js';

/**
 * Appends a sync history entry.
 * @param {Object} entry
 * @param {string} entry.destinationId
 * @param {import('firebase/firestore').Timestamp|Date} entry.startedAt
 * @param {number} entry.durationMs
 * @param {number} entry.totalRecords
 * @param {number} entry.successCount
 * @param {number} entry.failedCount
 * @param {string} entry.triggeredBy
 * @param {string} entry.syncType
 * @returns {Promise<string>} New history document ID.
 */
export async function appendSyncHistory(entry) {
  return addDocument(COLLECTIONS.SYNC_HISTORY, {
    destinationId: entry.destinationId || BACKUP_SYNC.DEFAULT_DESTINATION_ID,
    startedAt: entry.startedAt,
    completedAt: getServerTimestamp(),
    durationMs: entry.durationMs,
    totalRecords: entry.totalRecords,
    successCount: entry.successCount,
    failedCount: entry.failedCount,
    triggeredBy: entry.triggeredBy,
    syncType: entry.syncType,
  });
}

/**
 * Returns the latest sync history entries for a destination.
 * @param {string} [destinationId]
 * @param {number} [limit=10]
 * @returns {Promise<Array<Object>>}
 */
export async function fetchRecentSyncHistory(
  destinationId = BACKUP_SYNC.DEFAULT_DESTINATION_ID,
  limit = BACKUP_SYNC.HISTORY_LIMIT,
) {
  const all = await getCollection(COLLECTIONS.SYNC_HISTORY);
  return all
    .filter((h) => h.destinationId === destinationId)
    .sort((a, b) => {
      const ta = a.startedAt?.toDate?.()?.getTime() ?? 0;
      const tb = b.startedAt?.toDate?.()?.getTime() ?? 0;
      return tb - ta;
    })
    .slice(0, limit);
}
