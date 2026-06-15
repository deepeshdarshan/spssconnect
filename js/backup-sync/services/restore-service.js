/**
 * @fileoverview Orchestrates Google Sheet → Firestore restore operations.
 * @module backup-sync/services/restore-service
 */

import { RESTORE_OPERATION, RESTORE_STATUS, RESTORE_TYPE, BACKUP_SYNC, RESTORE_CONFIG } from '../backup-sync-constants.js';
import { mapSheetRecordToMemberDoc } from '../mappers/sheet-to-member-mapper.js';
import {
  analyzeRestore,
  buildRestorePreview,
  validateAfterRestore,
} from './restore-analysis-service.js';
import {
  beginRestoreLock,
  endRestoreLock,
  checkRestoreInProgress,
  saveRestoreValidationResult,
} from './restore-metadata-service.js';
import { appendRestoreHistory } from './restore-history-service.js';
import { logRestoreFailure } from './restore-failures-service.js';
import { createPreRestoreSnapshot, rollbackFromSnapshot } from './snapshot-service.js';
import { fetchAllSheetRecords } from './google-sheet-service.js';
import {
  createHouseholdWithId,
  updateHouseholdPreservingMeta,
  deleteHousehold,
} from './restore-write-service.js';
import * as Logger from '../../utils/logger.js';

/**
 * @typedef {Object} RestoreProgress
 * @property {number} processed
 * @property {number} total
 * @property {number} createdCount
 * @property {number} updatedCount
 * @property {number} deletedCount
 * @property {number} failedCount
 * @property {string} currentOperation
 * @property {number} [estimatedRemainingMs]
 */

/**
 * @typedef {Object} RestoreExecuteOptions
 * @property {import('./restore-analysis-service.js').RestoreAnalysisResult} analysis
 * @property {string} mode - RESTORE_MODE value.
 * @property {boolean} [deleteOrphans=false]
 * @property {string} triggeredBy
 * @property {function(RestoreProgress): void} [onProgress]
 * @property {string} [destinationId]
 */

/**
 * Generates a unique restore job ID.
 * @returns {string}
 */
function generateRestoreJobId() {
  return `restore_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Builds flat operation list from preview counts.
 * @param {{ toCreate: string[], toUpdate: string[], toDelete: string[] }} preview
 * @returns {Array<{ recordId: string, type: string }>}
 */
function buildRestoreOperations(preview) {
  return [
    ...preview.toCreate.map((id) => ({ recordId: id, type: RESTORE_OPERATION.CREATE })),
    ...preview.toUpdate.map((id) => ({ recordId: id, type: RESTORE_OPERATION.UPDATE })),
    ...preview.toDelete.map((id) => ({ recordId: id, type: RESTORE_OPERATION.DELETE })),
  ];
}

/**
 * Indexes sheet export records by Record ID.
 * @param {Array<Object>} records
 * @returns {Map<string, Object>}
 */
function indexSheetRecords(records) {
  const map = new Map();
  for (const rec of records) {
    map.set(rec.recordId, rec);
  }
  return map;
}

/**
 * Estimates remaining time from rolling batch averages.
 * @param {number[]} batchTimes - Milliseconds per batch (rolling window).
 * @param {number} processed
 * @param {number} total
 * @returns {number} Estimated remaining milliseconds.
 */
function estimateRemaining(batchTimes, processed, total) {
  if (batchTimes.length === 0 || processed >= total) return 0;
  const avg = batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length;
  const remaining = total - processed;
  const batchesLeft = Math.ceil(remaining / RESTORE_CONFIG.BATCH_SIZE);
  return Math.round(avg * batchesLeft);
}

/**
 * Executes restore operations for a single batch.
 *
 * @param {Object} params
 * @param {Array<{ recordId: string, type: string }>} params.operations
 * @param {Map<string, Object>} params.sheetRecordsById
 * @param {string} params.triggeredBy
 * @param {string} params.restoreJobId
 * @returns {Promise<{ created: number, updated: number, deleted: number, failed: number }>}
 */
async function processRestoreBatch(params) {
  const { operations, sheetRecordsById, triggeredBy, restoreJobId } = params;
  let created = 0;
  let updated = 0;
  let deleted = 0;
  let failed = 0;

  for (const op of operations) {
    const { recordId, type } = op;
    try {
      await applyRestoreOperation(op, sheetRecordsById, triggeredBy);
      if (type === RESTORE_OPERATION.CREATE) created += 1;
      else if (type === RESTORE_OPERATION.UPDATE) updated += 1;
      else if (type === RESTORE_OPERATION.DELETE) deleted += 1;
    } catch (err) {
      failed += 1;
      const message = err.message || String(err);
      Logger.error(`Restore ${type} failed for ${recordId}:`, err);
      await logRestoreFailure(recordId, type, message, restoreJobId);
    }
  }

  return { created, updated, deleted, failed };
}

/**
 * Applies a single CREATE, UPDATE, or DELETE restore operation.
 *
 * @param {{ recordId: string, type: string }} op
 * @param {Map<string, Object>} sheetRecordsById
 * @param {string} triggeredBy
 * @returns {Promise<void>}
 * @throws {Error} When the operation cannot be applied.
 */
async function applyRestoreOperation(op, sheetRecordsById, triggeredBy) {
  const { recordId, type } = op;

  if (type === RESTORE_OPERATION.DELETE) {
    await deleteHousehold(recordId);
    return;
  }

  const sheetRec = sheetRecordsById.get(recordId);
  if (!sheetRec) {
    throw new Error('Sheet record not found');
  }
  const memberData = mapSheetRecordToMemberDoc(sheetRec);
  if (!memberData) {
    throw new Error('Invalid sheet record data');
  }

  if (type === RESTORE_OPERATION.CREATE) {
    await createHouseholdWithId(recordId, memberData, triggeredBy);
    return;
  }

  await updateHouseholdPreservingMeta(recordId, memberData);
}

/**
 * Runs batched restore with progress callbacks.
 *
 * @param {Object} params
 * @returns {Promise<{ createdCount: number, updatedCount: number, deletedCount: number, failedCount: number, processed: number }>}
 */
async function runBatchedRestore(params) {
  const { allOps, sheetRecordsById, triggeredBy, restoreJobId, onProgress } = params;
  let createdCount = 0;
  let updatedCount = 0;
  let deletedCount = 0;
  let failedCount = 0;
  let processed = 0;
  const total = allOps.length;
  const batchTimes = [];

  for (let i = 0; i < allOps.length; i += RESTORE_CONFIG.BATCH_SIZE) {
    const batchStart = Date.now();
    const batch = allOps.slice(i, i + RESTORE_CONFIG.BATCH_SIZE);

    reportBatchProgress(batch, {
      processed,
      total,
      createdCount,
      updatedCount,
      deletedCount,
      failedCount,
      batchTimes,
      onProgress,
    });

    const result = await processRestoreBatch({
      operations: batch,
      sheetRecordsById,
      triggeredBy,
      restoreJobId,
    });

    createdCount += result.created;
    updatedCount += result.updated;
    deletedCount += result.deleted;
    failedCount += result.failed;
    processed += batch.length;
    batchTimes.push(Date.now() - batchStart);
    if (batchTimes.length > 5) batchTimes.shift();

    onProgress?.({
      processed,
      total,
      createdCount,
      updatedCount,
      deletedCount,
      failedCount,
      currentOperation: `Processed ${processed} / ${total} households`,
      estimatedRemainingMs: estimateRemaining(batchTimes, processed, total),
    });
  }

  return { createdCount, updatedCount, deletedCount, failedCount, processed };
}

/**
 * Reports per-record progress before a batch executes.
 * @param {Array<{ recordId: string, type: string }>} batch
 * @param {Object} state
 */
function reportBatchProgress(batch, state) {
  const { onProgress, processed, total, createdCount, updatedCount, deletedCount, failedCount, batchTimes } = state;
  for (const op of batch) {
    const verb = op.type === RESTORE_OPERATION.CREATE
      ? 'Creating'
      : op.type === RESTORE_OPERATION.UPDATE
        ? 'Updating'
        : 'Deleting';
    onProgress?.({
      processed,
      total,
      createdCount,
      updatedCount,
      deletedCount,
      failedCount,
      currentOperation: `${verb} household ${op.recordId}`,
      estimatedRemainingMs: estimateRemaining(batchTimes, processed, total),
    });
  }
}

/**
 * Runs a full restore job with snapshot, batching, and audit trail.
 *
 * @param {RestoreExecuteOptions} options
 * @returns {Promise<Object>} Summary with counts, validation, and restoreJobId.
 * @throws {Error} When a restore is already in progress or snapshot fails.
 */
export async function executeRestore(options) {
  const {
    analysis,
    mode,
    deleteOrphans = false,
    triggeredBy,
    onProgress,
    destinationId = BACKUP_SYNC.DEFAULT_DESTINATION_ID,
  } = options;

  const { inProgress } = await checkRestoreInProgress(destinationId);
  if (inProgress) {
    throw new Error('A restore is already in progress.');
  }

  const preview = buildRestorePreview(analysis, mode, deleteOrphans);
  const allOps = buildRestoreOperations(preview);

  if (allOps.length === 0) {
    return {
      totalProcessed: 0,
      createdCount: 0,
      updatedCount: 0,
      deletedCount: 0,
      failedCount: 0,
      validation: await validateAfterRestore(),
    };
  }

  const restoreJobId = generateRestoreJobId();
  const startedAt = new Date();

  await beginRestoreLock(destinationId, triggeredBy);

  try {
    await createPreRestoreSnapshot(restoreJobId, allOps.map((o) => o.recordId), triggeredBy, mode);
  } catch (err) {
    Logger.error('Pre-restore snapshot failed:', err);
    await endRestoreLock(destinationId, RESTORE_STATUS.FAILED);
    throw new Error('Snapshot failed. Restore cancelled.');
  }

  const sheetExport = await fetchAllSheetRecords();
  const sheetRecordsById = indexSheetRecords(sheetExport.records);

  const counts = await runBatchedRestore({
    allOps,
    sheetRecordsById,
    triggeredBy,
    restoreJobId,
    onProgress,
  });

  const durationMs = Date.now() - startedAt.getTime();
  const validation = await validateAfterRestore();
  await saveRestoreValidationResult(destinationId, validation.firestoreCount, validation.sheetCount);

  const status = counts.failedCount > 0 ? RESTORE_STATUS.FAILED : RESTORE_STATUS.COMPLETED;
  await endRestoreLock(destinationId, status);

  await appendRestoreHistory({
    restoreJobId,
    snapshotId: restoreJobId,
    destinationId,
    startedAt,
    durationMs,
    totalProcessed: counts.processed,
    createdCount: counts.createdCount,
    updatedCount: counts.updatedCount,
    deletedCount: counts.deletedCount,
    failedCount: counts.failedCount,
    restoreMode: mode,
    deleteOrphansEnabled: deleteOrphans,
    triggeredBy,
    sourceSheetId: analysis.sourceSheetId || sheetExport.spreadsheetId,
    status,
    restoreType: RESTORE_TYPE.RESTORE,
  });

  return {
    restoreJobId,
    totalProcessed: counts.processed,
    createdCount: counts.createdCount,
    updatedCount: counts.updatedCount,
    deletedCount: counts.deletedCount,
    failedCount: counts.failedCount,
    validation,
  };
}

/**
 * Rolls back a restore job and appends audit history.
 *
 * @param {Object} options
 * @param {string} options.restoreJobId - Snapshot / job ID to roll back.
 * @param {string} options.triggeredBy - Operator email or UID.
 * @param {function(RestoreProgress): void} [options.onProgress]
 * @returns {Promise<{ restored: number, deleted: number, failed: number }>}
 * @throws {Error} When snapshot is missing or expired.
 */
export async function executeRollback(options) {
  const { restoreJobId, triggeredBy, onProgress } = options;
  const startedAt = new Date();

  const result = await rollbackFromSnapshot(restoreJobId, onProgress);

  await appendRestoreHistory({
    restoreJobId: `rollback_${Date.now()}`,
    snapshotId: restoreJobId,
    startedAt,
    durationMs: Date.now() - startedAt.getTime(),
    totalProcessed: result.restored + result.deleted + result.failed,
    createdCount: 0,
    updatedCount: result.restored,
    deletedCount: result.deleted,
    failedCount: result.failed,
    restoreMode: 'rollback',
    triggeredBy,
    restoreType: RESTORE_TYPE.ROLLBACK,
  });

  return result;
}

export { analyzeRestore, buildRestorePreview, validateAfterRestore };
export { RESTORE_MODE } from '../backup-sync-constants.js';
