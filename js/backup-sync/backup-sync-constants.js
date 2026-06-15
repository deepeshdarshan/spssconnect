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

/** Restore status values stored in `restore_metadata.lastRestoreStatus`. */
export const RESTORE_STATUS = Object.freeze({
  IDLE: 'idle',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

/** Restore modes for executeRestore — matches `restore_history.restoreMode`. */
export const RESTORE_MODE = Object.freeze({
  MISSING_ONLY: 'missing_only',
  FULL: 'full',
});

/** Operation types stored in `restore_failures.operationType`. */
export const RESTORE_OPERATION = Object.freeze({
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
});

/** Restore history entry types stored in `restore_history.restoreType`. */
export const RESTORE_TYPE = Object.freeze({
  RESTORE: 'restore',
  ROLLBACK: 'rollback',
  ANALYZE: 'analyze',
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
  GOOGLE_SHEETS_API_URL: 'https://script.google.com/macros/s/AKfycbweBqoEjDoLazvgXBZ4TT_wmqkO5el6kFiio4r0UTg3-JPzi6Z3Pctpi1SC_FglCxw-/exec',
  /** Optional shared secret sent with API requests (must match Apps Script). */
  API_TOKEN: '',
  DEFAULT_DESTINATION_ID: DESTINATION_IDS.GOOGLE_SHEETS,
  BATCH_SIZE: 25,
  SYNC_LOCK_TIMEOUT_MS: 30 * 60 * 1000,
  HISTORY_LIMIT: 10,
  METADATA_DOC_FIELD: 'metadata.updatedAt',
});

/** Restore runtime configuration for the Restore Center. */
export const RESTORE_CONFIG = Object.freeze({
  /** Households processed per restore batch (matches backup BATCH_SIZE). */
  BATCH_SIZE: 25,
  /** Stale restore lock timeout — same window as sync lock. */
  LOCK_TIMEOUT_MS: 30 * 60 * 1000,
  /** Rows shown in restore history table. */
  HISTORY_LIMIT: 10,
  /** Days a pre-restore snapshot remains eligible for rollback. */
  SNAPSHOT_RETENTION_DAYS: 30,
  /** Max Record IDs listed in restore preview expanders. */
  PREVIEW_LIST_LIMIT: 50,
});
