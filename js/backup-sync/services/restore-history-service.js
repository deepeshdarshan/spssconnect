/**
 * @fileoverview Firestore CRUD for restore_history audit records.
 * @module backup-sync/services/restore-history-service
 */

import { COLLECTIONS } from '../../constants/constants.js';
import {
  addDocument,
  getCollection,
  getServerTimestamp,
} from '../../services/firestore-service.js';
import { BACKUP_SYNC, RESTORE_CONFIG } from '../backup-sync-constants.js';

/**
 * Appends a restore history entry.
 * @param {Object} entry
 * @returns {Promise<string>} New history document ID.
 */
export async function appendRestoreHistory(entry) {
  return addDocument(COLLECTIONS.RESTORE_HISTORY, {
    destinationId: entry.destinationId || BACKUP_SYNC.DEFAULT_DESTINATION_ID,
    restoreJobId: entry.restoreJobId || null,
    snapshotId: entry.snapshotId || entry.restoreJobId || null,
    startedAt: entry.startedAt,
    completedAt: getServerTimestamp(),
    duration: entry.durationMs,
    durationMs: entry.durationMs,
    totalProcessed: entry.totalProcessed,
    createdCount: entry.createdCount,
    updatedCount: entry.updatedCount,
    deletedCount: entry.deletedCount,
    failedCount: entry.failedCount,
    restoreMode: entry.restoreMode,
    deleteOrphansEnabled: entry.deleteOrphansEnabled || false,
    triggeredBy: entry.triggeredBy,
    sourceSheetId: entry.sourceSheetId || null,
    status: entry.status || 'completed',
    errorSummary: entry.errorSummary || null,
    restoreType: entry.restoreType || 'restore',
  });
}

/**
 * Returns the latest restore history entries.
 * @param {string} [destinationId]
 * @param {number} [limit]
 * @returns {Promise<Array<Object>>}
 */
export async function fetchRecentRestoreHistory(
  destinationId = BACKUP_SYNC.DEFAULT_DESTINATION_ID,
  limit = RESTORE_CONFIG.HISTORY_LIMIT,
) {
  const all = await getCollection(COLLECTIONS.RESTORE_HISTORY);
  return all
    .filter((h) => h.destinationId === destinationId)
    .sort((a, b) => {
      const ta = a.startedAt?.toDate?.()?.getTime() ?? 0;
      const tb = b.startedAt?.toDate?.()?.getTime() ?? 0;
      return tb - ta;
    })
    .slice(0, limit);
}
