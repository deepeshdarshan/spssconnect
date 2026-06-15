/**
 * @fileoverview Orchestrates incremental Firestore-to-destination backup sync.
 * @module backup-sync/services/member-backup-sync-service
 */

import { Timestamp } from 'firebase/firestore';
import { getDestination } from '../backup-destination-registry.js';
import { BACKUP_SYNC, SYNC_STATUS, SYNC_TYPE } from '../backup-sync-constants.js';
import {
  fetchSyncMetadata,
  beginSyncLock,
  endSyncLock,
  checkSyncInProgress,
  saveValidationResult,
  patchSyncMetadata,
} from './sync-metadata-service.js';
import {
  logSyncFailure,
  resolveSyncFailure,
  countUnresolvedFailures,
  fetchUnresolvedFailures,
} from './sync-failures-service.js';
import { appendSyncHistory } from './sync-history-service.js';
import {
  countAllMembers,
  countMembersUpdatedSince,
  resolveSyncWatermark,
  fetchMembersPageForSync,
  fetchMembersByIds,
  findLatestUpdatedAt,
} from './member-sync-query-service.js';
import * as Logger from '../../utils/logger.js';

/**
 * @typedef {Object} DashboardMetrics
 * @property {number} firestoreCount
 * @property {number|null} remoteCount
 * @property {number} syncedCount
 * @property {number} pendingCount
 * @property {number} failedCount
 * @property {string} lastSyncAt
 * @property {string} lastSyncBy
 * @property {string} syncStatus
 * @property {Object|null} lastValidation
 */

/**
 * @typedef {Object} SyncProgress
 * @property {number} processed
 * @property {number} total
 * @property {number} successCount
 * @property {number} failedCount
 */

/**
 * @typedef {Object} SyncSummary
 * @property {number} totalRecords
 * @property {number} successCount
 * @property {number} failedCount
 * @property {number} durationMs
 * @property {Object} validation
 */

/**
 * Formats a Firestore timestamp for display.
 * @param {*} ts
 * @returns {string}
 */
function formatTimestamp(ts) {
  if (!ts?.toDate) return '—';
  return ts.toDate().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Loads dashboard metrics for the Backup & Sync Center.
 * @param {string} [destinationId]
 * @returns {Promise<DashboardMetrics>}
 */
export async function loadDashboardMetrics(destinationId = BACKUP_SYNC.DEFAULT_DESTINATION_ID) {
  const destination = getDestination(destinationId);
  const metadata = await fetchSyncMetadata(destinationId);
  const watermark = resolveSyncWatermark(metadata.lastSyncTimestamp);

  const [firestoreCount, pendingCount, failedCount] = await Promise.all([
    countAllMembers(),
    countMembersUpdatedSince(watermark),
    countUnresolvedFailures(destinationId),
  ]);

  let remoteCount = null;
  if (destination.isConfigured?.()) {
    try {
      remoteCount = await destination.getRemoteRecordCount();
    } catch (err) {
      Logger.warn('Could not fetch remote record count:', err);
    }
  }

  return {
    firestoreCount,
    remoteCount,
    syncedCount: metadata.totalSynced || 0,
    pendingCount,
    failedCount,
    lastSyncAt: formatTimestamp(metadata.lastSyncTimestamp),
    lastSyncBy: metadata.lastSyncBy || '—',
    syncStatus: metadata.currentSyncStatus || SYNC_STATUS.IDLE,
    lastValidation: metadata.lastValidation || null,
  };
}

/**
 * Processes batch upsert results — logs failures and resolves prior failures on success.
 * @param {Object} batchResult
 * @param {Array<Object>} unresolvedFailures - Existing failure docs keyed by memberId.
 * @param {string} destinationId
 * @returns {Promise<{ successCount: number, failedCount: number }>}
 */
async function handleBatchResults(batchResult, unresolvedFailures, destinationId) {
  const failureByMember = new Map(unresolvedFailures.map((f) => [f.memberId, f]));
  let successCount = 0;
  let failedCount = 0;

  for (const memberId of batchResult.successIds) {
    successCount += 1;
    const existing = failureByMember.get(memberId);
    if (existing?.id) {
      await resolveSyncFailure(existing.id);
    }
  }

  for (const failure of batchResult.failures) {
    failedCount += 1;
    await logSyncFailure(failure.memberId, failure.errorMessage, destinationId);
  }

  return { successCount, failedCount };
}

/**
 * Runs incremental sync from Firestore to the configured destination.
 * @param {Object} options
 * @param {string} options.triggeredBy - User email or uid.
 * @param {function(SyncProgress): void} [options.onProgress]
 * @param {string} [options.destinationId]
 * @returns {Promise<SyncSummary>}
 */
export async function runIncrementalSync(options) {
  const { triggeredBy, onProgress, destinationId = BACKUP_SYNC.DEFAULT_DESTINATION_ID } = options;
  const destination = getDestination(destinationId);

  if (!destination.isConfigured?.()) {
    throw new Error('Google Sheets API URL is not configured. Set BACKUP_SYNC.GOOGLE_SHEETS_API_URL.');
  }

  const { inProgress } = await checkSyncInProgress(destinationId);
  if (inProgress) {
    throw new Error('A sync is already in progress. Please wait for it to complete.');
  }

  const startedAt = Date.now();
  const syncStartTimestamp = Timestamp.now();
  const metadata = await fetchSyncMetadata(destinationId);
  const watermark = resolveSyncWatermark(metadata.lastSyncTimestamp);

  const totalRecords = await countMembersUpdatedSince(watermark);
  await beginSyncLock(destinationId, triggeredBy);

  let processed = 0;
  let successCount = 0;
  let failedCount = 0;
  let lastDoc = null;
  let latestUpdatedAt = watermark;

  const notifyProgress = () => {
    onProgress?.({ processed, total: totalRecords, successCount, failedCount });
  };

  notifyProgress();

  try {
    const unresolvedFailures = await fetchUnresolvedFailures(destinationId);

    while (true) {
      const page = await fetchMembersPageForSync({
        sinceTimestamp: watermark,
        startAfterDoc: lastDoc,
        pageSize: BACKUP_SYNC.BATCH_SIZE,
      });

      if (page.docs.length === 0) break;

      const batchResult = await destination.upsertBatch(page.docs);
      const batchStats = await handleBatchResults(batchResult, unresolvedFailures, destinationId);

      successCount += batchStats.successCount;
      failedCount += batchStats.failedCount;
      processed += page.docs.length;

      const batchLatest = findLatestUpdatedAt(page.docs);
      if (batchLatest && batchLatest.toMillis() > latestUpdatedAt.toMillis()) {
        latestUpdatedAt = batchLatest;
      }

      lastDoc = page.lastDoc;
      notifyProgress();

      if (page.docs.length < BACKUP_SYNC.BATCH_SIZE) break;
    }

    const durationMs = Date.now() - startedAt;
    const firestoreCount = await countAllMembers();
    let remoteCount = 0;

    try {
      remoteCount = await destination.getRemoteRecordCount();
    } catch (err) {
      Logger.warn('Validation remote count failed:', err);
    }

    const newTotalSynced = (metadata.totalSynced || 0) + successCount;
    const unresolvedAfter = await countUnresolvedFailures(destinationId);
    const finalStatus = failedCount > 0 ? SYNC_STATUS.FAILED : SYNC_STATUS.COMPLETED;

    await endSyncLock(destinationId, finalStatus, {
      lastSyncTimestamp: successCount > 0 ? latestUpdatedAt : metadata.lastSyncTimestamp,
      totalSynced: newTotalSynced,
      pendingRecords: 0,
      failedRecords: unresolvedAfter,
    });

    await saveValidationResult(destinationId, firestoreCount, remoteCount);

    await appendSyncHistory({
      destinationId,
      startedAt: syncStartTimestamp,
      durationMs,
      totalRecords,
      successCount,
      failedCount,
      triggeredBy,
      syncType: SYNC_TYPE.INCREMENTAL,
    });

    return {
      totalRecords,
      successCount,
      failedCount,
      durationMs,
      validation: { firestoreCount, remoteCount, matched: firestoreCount === remoteCount },
    };
  } catch (err) {
    await endSyncLock(destinationId, SYNC_STATUS.FAILED);
    Logger.error('Incremental sync failed:', err);
    throw err;
  }
}

/**
 * Retries only unresolved failed records.
 * @param {Object} options
 * @param {string} options.triggeredBy
 * @param {function(SyncProgress): void} [options.onProgress]
 * @param {string} [options.destinationId]
 * @returns {Promise<SyncSummary>}
 */
export async function runRetryFailedSync(options) {
  const { triggeredBy, onProgress, destinationId = BACKUP_SYNC.DEFAULT_DESTINATION_ID } = options;
  const destination = getDestination(destinationId);

  if (!destination.isConfigured?.()) {
    throw new Error('Google Sheets API URL is not configured.');
  }

  const { inProgress } = await checkSyncInProgress(destinationId);
  if (inProgress) {
    throw new Error('A sync is already in progress.');
  }

  const failures = await fetchUnresolvedFailures(destinationId);
  if (failures.length === 0) {
    return {
      totalRecords: 0,
      successCount: 0,
      failedCount: 0,
      durationMs: 0,
      validation: null,
    };
  }

  const startedAt = Date.now();
  const syncStartTimestamp = Timestamp.now();
  const memberIds = failures.map((f) => f.memberId);
  const totalRecords = memberIds.length;

  await beginSyncLock(destinationId, triggeredBy);

  let processed = 0;
  let successCount = 0;
  let failedCount = 0;

  const notifyProgress = () => {
    onProgress?.({ processed, total: totalRecords, successCount, failedCount });
  };

  notifyProgress();

  try {
    for (let i = 0; i < memberIds.length; i += BACKUP_SYNC.BATCH_SIZE) {
      const batchIds = memberIds.slice(i, i + BACKUP_SYNC.BATCH_SIZE);
      const memberDocs = await fetchMembersByIds(batchIds);
      const batchResult = await destination.retryRecords(memberDocs);
      const batchStats = await handleBatchResults(batchResult, failures, destinationId);

      successCount += batchStats.successCount;
      failedCount += batchStats.failedCount;
      processed += batchIds.length;
      notifyProgress();
    }

    const durationMs = Date.now() - startedAt;
    const unresolvedAfter = await countUnresolvedFailures(destinationId);
    const finalStatus = failedCount > 0 ? SYNC_STATUS.FAILED : SYNC_STATUS.COMPLETED;

    await endSyncLock(destinationId, finalStatus, {
      failedRecords: unresolvedAfter,
    });

    const firestoreCount = await countAllMembers();
    let remoteCount = 0;
    try {
      remoteCount = await destination.getRemoteRecordCount();
    } catch {
      /* validation optional on retry */
    }
    await saveValidationResult(destinationId, firestoreCount, remoteCount);

    await appendSyncHistory({
      destinationId,
      startedAt: syncStartTimestamp,
      durationMs,
      totalRecords,
      successCount,
      failedCount,
      triggeredBy,
      syncType: SYNC_TYPE.RETRY,
    });

    return {
      totalRecords,
      successCount,
      failedCount,
      durationMs,
      validation: { firestoreCount, remoteCount, matched: firestoreCount === remoteCount },
    };
  } catch (err) {
    await endSyncLock(destinationId, SYNC_STATUS.FAILED);
    throw err;
  }
}

/**
 * Refreshes pending count on metadata after dashboard load.
 * @param {string} [destinationId]
 * @returns {Promise<void>}
 */
export async function refreshPendingCount(destinationId = BACKUP_SYNC.DEFAULT_DESTINATION_ID) {
  const metadata = await fetchSyncMetadata(destinationId);
  const watermark = resolveSyncWatermark(metadata.lastSyncTimestamp);
  const pending = await countMembersUpdatedSince(watermark);
  const failed = await countUnresolvedFailures(destinationId);
  await patchSyncMetadata(destinationId, { pendingRecords: pending, failedRecords: failed });
}
