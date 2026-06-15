/**
 * @fileoverview Re-exports backup sync orchestrator (SRP alias).
 * @module backup-sync/services/backup-service
 */

export {
  loadDashboardMetrics,
  runIncrementalSync,
  runRetryFailedSync,
  refreshPendingCount,
} from './member-backup-sync-service.js';
