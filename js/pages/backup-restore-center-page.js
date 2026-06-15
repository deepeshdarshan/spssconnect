/**
 * @fileoverview Backup & Restore Center landing page controller.
 * @module pages/backup-restore-center-page
 */

import { ROUTES } from '../constants/constants.js';
import { isSuperAdmin } from '../services/auth-service.js';
import { showToast } from '../ui/ui-service.js';
import { fetchSyncMetadata } from '../backup-sync/services/sync-metadata-service.js';
import { fetchRecentSyncHistory } from '../backup-sync/services/sync-history-service.js';
import { loadRestoreTileMetrics } from '../backup-sync/services/restore-metadata-service.js';
import { SYNC_STATUS } from '../backup-sync/backup-sync-constants.js';
import { renderCenterTiles } from '../backup-sync/components/center-tile-dashboard.js';
import * as Logger from '../utils/logger.js';

/**
 * Loads metrics for both landing tiles.
 * @returns {Promise<Object>}
 */
async function loadLandingMetrics() {
  const [syncMeta, restoreMeta, syncHistory] = await Promise.all([
    fetchSyncMetadata(),
    loadRestoreTileMetrics(),
    fetchRecentSyncHistory(),
  ]);

  const lastBackupRun = syncHistory[0]?.startedAt || null;

  return {
    backup: {
      lastSyncAt: lastBackupRun,
      status: syncMeta.currentSyncStatus || SYNC_STATUS.IDLE,
      lastSyncBy: syncMeta.lastSyncBy,
    },
    restore: restoreMeta,
  };
}

/**
 * Initializes the Backup & Restore Center landing page.
 * @returns {Promise<void>}
 */
export async function initBackupRestoreCenterPage() {
  if (!isSuperAdmin()) {
    window.location.href = ROUTES.ADMIN_DASHBOARD;
    return;
  }

  try {
    const metrics = await loadLandingMetrics();
    renderCenterTiles(metrics);
  } catch (err) {
    Logger.error('Failed to load backup/restore center landing:', err);
    showToast('Failed to load center dashboard.', 'error');
  }
}
