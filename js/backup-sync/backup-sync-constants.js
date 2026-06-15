/**
 * @fileoverview Configuration constants for the Backup & Sync Center.
 * @module backup-sync/backup-sync-constants
 */

/** Sync status values stored in sync_metadata.currentSyncStatus */
export const SYNC_STATUS = Object.freeze({
  IDLE: 'idle',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

/** Sync run types stored in sync_history.syncType */
export const SYNC_TYPE = Object.freeze({
  INCREMENTAL: 'incremental',
  RETRY: 'retry',
});

/** Registered backup destination identifiers */
export const DESTINATION_IDS = Object.freeze({
  GOOGLE_SHEETS: 'google_sheets',
});

/**
 * Backup & Sync runtime configuration.
 * Set GOOGLE_SHEETS_API_URL before running sync (Apps Script web app URL).
 */
export const BACKUP_SYNC = Object.freeze({
  GOOGLE_SHEETS_API_URL: '',
  /** Optional shared secret sent with API requests (must match Apps Script). */
  API_TOKEN: '',
  DEFAULT_DESTINATION_ID: DESTINATION_IDS.GOOGLE_SHEETS,
  BATCH_SIZE: 25,
  SYNC_LOCK_TIMEOUT_MS: 30 * 60 * 1000,
  HISTORY_LIMIT: 10,
  METADATA_DOC_FIELD: 'metadata.updatedAt',
});
