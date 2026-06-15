/**
 * @fileoverview Firestore CRUD for sync_metadata documents.
 * @module backup-sync/services/sync-metadata-service
 */

import { COLLECTIONS } from '../../constants/constants.js';
import {
  getDocument,
  setDocument,
  getServerTimestamp,
} from '../../services/firestore-service.js';
import { BACKUP_SYNC, SYNC_STATUS } from '../backup-sync-constants.js';
import { Timestamp } from 'firebase/firestore';

/**
 * Returns default metadata shape for a destination.
 * @param {string} destinationId
 * @returns {Object}
 */
function defaultMetadata(destinationId) {
  return {
    destinationId,
    lastSyncTimestamp: Timestamp.fromDate(new Date(0)),
    lastSyncBy: '—',
    totalSynced: 0,
    pendingRecords: 0,
    failedRecords: 0,
    syncInProgress: false,
    syncStartedAt: null,
    currentSyncStatus: SYNC_STATUS.IDLE,
    lastValidation: null,
  };
}

/**
 * Reads sync metadata for a destination, creating defaults if missing.
 * @param {string} [destinationId]
 * @returns {Promise<Object>}
 */
export async function fetchSyncMetadata(destinationId = BACKUP_SYNC.DEFAULT_DESTINATION_ID) {
  const existing = await getDocument(COLLECTIONS.SYNC_METADATA, destinationId);
  if (existing) return existing;
  const defaults = defaultMetadata(destinationId);
  await setDocument(COLLECTIONS.SYNC_METADATA, destinationId, defaults);
  return { id: destinationId, ...defaults };
}

/**
 * Updates sync metadata fields (merge).
 * @param {string} destinationId
 * @param {Object} patch
 * @returns {Promise<void>}
 */
export async function patchSyncMetadata(destinationId, patch) {
  await setDocument(COLLECTIONS.SYNC_METADATA, destinationId, patch);
}

/**
 * Marks sync as started and sets lock fields.
 * @param {string} destinationId
 * @param {string} triggeredBy
 * @returns {Promise<void>}
 */
export async function beginSyncLock(destinationId, triggeredBy) {
  await setDocument(COLLECTIONS.SYNC_METADATA, destinationId, {
    syncInProgress: true,
    syncStartedAt: getServerTimestamp(),
    currentSyncStatus: SYNC_STATUS.IN_PROGRESS,
    lastSyncBy: triggeredBy,
  });
}

/**
 * Clears sync lock and sets final status.
 * @param {string} destinationId
 * @param {string} status - One of SYNC_STATUS values.
 * @param {Object} [extra] - Additional fields to merge.
 * @returns {Promise<void>}
 */
export async function endSyncLock(destinationId, status, extra = {}) {
  await setDocument(COLLECTIONS.SYNC_METADATA, destinationId, {
    syncInProgress: false,
    syncStartedAt: null,
    currentSyncStatus: status,
    ...extra,
  });
}

/**
 * Clears a stale sync lock if syncStartedAt exceeds timeout.
 * @param {Object} metadata - Current sync metadata document.
 * @param {string} destinationId
 * @returns {Promise<boolean>} True if lock was cleared.
 */
export async function clearStaleSyncLock(metadata, destinationId) {
  if (!metadata?.syncInProgress || !metadata.syncStartedAt) return false;

  const started = metadata.syncStartedAt?.toDate?.() ?? null;
  if (!started) return false;

  const elapsed = Date.now() - started.getTime();
  if (elapsed < BACKUP_SYNC.SYNC_LOCK_TIMEOUT_MS) return false;

  await endSyncLock(destinationId, SYNC_STATUS.FAILED, {
    failedRecords: metadata.failedRecords || 0,
  });
  return true;
}

/**
 * Checks whether a sync is currently in progress (respecting stale lock cleanup).
 * @param {string} [destinationId]
 * @returns {Promise<{ inProgress: boolean, metadata: Object }>}
 */
export async function checkSyncInProgress(destinationId = BACKUP_SYNC.DEFAULT_DESTINATION_ID) {
  const metadata = await fetchSyncMetadata(destinationId);
  if (metadata.syncInProgress) {
    const cleared = await clearStaleSyncLock(metadata, destinationId);
    if (cleared) {
      const refreshed = await fetchSyncMetadata(destinationId);
      return { inProgress: false, metadata: refreshed };
    }
    return { inProgress: true, metadata };
  }
  return { inProgress: false, metadata };
}

/**
 * Updates validation result on metadata.
 * @param {string} destinationId
 * @param {number} firestoreCount
 * @param {number} remoteCount
 * @returns {Promise<void>}
 */
export async function saveValidationResult(destinationId, firestoreCount, remoteCount) {
  await setDocument(COLLECTIONS.SYNC_METADATA, destinationId, {
    lastValidation: {
      firestoreCount,
      remoteCount,
      matched: firestoreCount === remoteCount,
      checkedAt: getServerTimestamp(),
    },
  });
}
