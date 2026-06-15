/**
 * @fileoverview Firestore CRUD for restore_metadata documents.
 * @module backup-sync/services/restore-metadata-service
 */

import { COLLECTIONS } from '../../constants/constants.js';
import {
  getDocument,
  setDocument,
  getServerTimestamp,
} from '../../services/firestore-service.js';
import { BACKUP_SYNC, RESTORE_CONFIG, RESTORE_STATUS } from '../backup-sync-constants.js';

/**
 * Returns default restore metadata shape.
 * @param {string} destinationId
 * @returns {Object}
 */
function defaultMetadata(destinationId) {
  return {
    destinationId,
    lastRestoreAt: null,
    lastRestoreBy: '—',
    lastRestoreStatus: RESTORE_STATUS.IDLE,
    restoreInProgress: false,
    restoreStartedAt: null,
    lastAnalysis: null,
    lastValidation: null,
  };
}

/**
 * Reads restore metadata for a destination, creating defaults if missing.
 * @param {string} [destinationId]
 * @returns {Promise<Object>}
 */
export async function fetchRestoreMetadata(destinationId = BACKUP_SYNC.DEFAULT_DESTINATION_ID) {
  const existing = await getDocument(COLLECTIONS.RESTORE_METADATA, destinationId);
  if (existing) return existing;
  const defaults = defaultMetadata(destinationId);
  await setDocument(COLLECTIONS.RESTORE_METADATA, destinationId, defaults);
  return { id: destinationId, ...defaults };
}

/**
 * Updates restore metadata fields (merge).
 * @param {string} destinationId
 * @param {Object} patch
 * @returns {Promise<void>}
 */
export async function patchRestoreMetadata(destinationId, patch) {
  await setDocument(COLLECTIONS.RESTORE_METADATA, destinationId, patch);
}

/**
 * Marks restore as started and sets lock fields.
 * @param {string} destinationId
 * @param {string} triggeredBy
 * @returns {Promise<void>}
 */
export async function beginRestoreLock(destinationId, triggeredBy) {
  await setDocument(COLLECTIONS.RESTORE_METADATA, destinationId, {
    restoreInProgress: true,
    restoreStartedAt: getServerTimestamp(),
    lastRestoreStatus: RESTORE_STATUS.IN_PROGRESS,
    lastRestoreBy: triggeredBy,
  });
}

/**
 * Clears restore lock and sets final status.
 * @param {string} destinationId
 * @param {string} status
 * @param {Object} [extra]
 * @returns {Promise<void>}
 */
export async function endRestoreLock(destinationId, status, extra = {}) {
  await setDocument(COLLECTIONS.RESTORE_METADATA, destinationId, {
    restoreInProgress: false,
    restoreStartedAt: null,
    lastRestoreStatus: status,
    lastRestoreAt: getServerTimestamp(),
    ...extra,
  });
}

/**
 * Clears a stale restore lock if restoreStartedAt exceeds timeout.
 * @param {Object} metadata
 * @param {string} destinationId
 * @returns {Promise<boolean>}
 */
export async function clearStaleRestoreLock(metadata, destinationId) {
  if (!metadata?.restoreInProgress || !metadata.restoreStartedAt) return false;

  const started = metadata.restoreStartedAt?.toDate?.() ?? null;
  if (!started) return false;

  const elapsed = Date.now() - started.getTime();
  if (elapsed < RESTORE_CONFIG.LOCK_TIMEOUT_MS) return false;

  await endRestoreLock(destinationId, RESTORE_STATUS.FAILED);
  return true;
}

/**
 * Checks whether a restore is currently in progress.
 * @param {string} [destinationId]
 * @returns {Promise<{ inProgress: boolean, metadata: Object }>}
 */
export async function checkRestoreInProgress(destinationId = BACKUP_SYNC.DEFAULT_DESTINATION_ID) {
  const metadata = await fetchRestoreMetadata(destinationId);
  if (metadata.restoreInProgress) {
    const cleared = await clearStaleRestoreLock(metadata, destinationId);
    if (cleared) {
      const refreshed = await fetchRestoreMetadata(destinationId);
      return { inProgress: false, metadata: refreshed };
    }
    return { inProgress: true, metadata };
  }
  return { inProgress: false, metadata };
}

/**
 * Saves last analysis summary on metadata.
 * @param {string} destinationId
 * @param {Object} analysisSummary
 * @returns {Promise<void>}
 */
export async function saveAnalysisResult(destinationId, analysisSummary) {
  await setDocument(COLLECTIONS.RESTORE_METADATA, destinationId, {
    lastAnalysis: {
      ...analysisSummary,
      analyzedAt: getServerTimestamp(),
    },
  });
}

/**
 * Saves post-restore validation result on metadata.
 * @param {string} destinationId
 * @param {number} firestoreCount
 * @param {number} sheetCount
 * @returns {Promise<void>}
 */
export async function saveRestoreValidationResult(destinationId, firestoreCount, sheetCount) {
  await setDocument(COLLECTIONS.RESTORE_METADATA, destinationId, {
    lastValidation: {
      firestoreCount,
      sheetCount,
      missingCount: Math.max(0, sheetCount - firestoreCount),
      matched: firestoreCount === sheetCount,
      checkedAt: getServerTimestamp(),
    },
  });
}

/**
 * Loads tile metrics for the landing page restore card.
 * @param {string} [destinationId]
 * @returns {Promise<{ lastRestoreAt: Object|null, status: string, lastRestoreBy: string }>}
 */
export async function loadRestoreTileMetrics(destinationId = BACKUP_SYNC.DEFAULT_DESTINATION_ID) {
  const metadata = await fetchRestoreMetadata(destinationId);
  return {
    lastRestoreAt: metadata.lastRestoreAt || null,
    status: metadata.lastRestoreStatus || RESTORE_STATUS.IDLE,
    lastRestoreBy: metadata.lastRestoreBy || '—',
  };
}
