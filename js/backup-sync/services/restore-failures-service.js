/**
 * @fileoverview Firestore CRUD for restore_failures records.
 * @module backup-sync/services/restore-failures-service
 */

import { COLLECTIONS } from '../../constants/constants.js';
import {
  addDocument,
  getCollection,
  getServerTimestamp,
} from '../../services/firestore-service.js';
import { BACKUP_SYNC } from '../backup-sync-constants.js';

/**
 * Logs a restore failure for a household record.
 * @param {string} memberId - Record ID (household doc ID).
 * @param {string} operationType - CREATE | UPDATE | DELETE
 * @param {string} errorMessage
 * @param {string} restoreJobId
 * @returns {Promise<string>}
 */
export async function logRestoreFailure(memberId, operationType, errorMessage, restoreJobId) {
  return addDocument(COLLECTIONS.RESTORE_FAILURES, {
    memberId,
    operationType,
    errorMessage,
    timestamp: getServerTimestamp(),
    restoreJobId,
    destinationId: BACKUP_SYNC.DEFAULT_DESTINATION_ID,
  });
}

/**
 * Fetches failures for a specific restore job.
 * @param {string} restoreJobId
 * @returns {Promise<Array<Object>>}
 */
export async function fetchFailuresForJob(restoreJobId) {
  const all = await getCollection(COLLECTIONS.RESTORE_FAILURES);
  return all.filter((f) => f.restoreJobId === restoreJobId);
}
