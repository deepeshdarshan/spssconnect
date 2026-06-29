/**
 * @fileoverview Landing page tile dashboard for Backup & Restore Center.
 * @module backup-sync/components/center-tile-dashboard
 */

import { SYNC_STATUS, RESTORE_STATUS } from '../backup-sync-constants.js';

/**
 * Formats a Firestore timestamp for display.
 * @param {Object|null} ts
 * @returns {string}
 */
function formatTimestamp(ts) {
  if (!ts?.toDate) return 'Never';
  try {
    return ts.toDate().toLocaleString();
  } catch {
    return '—';
  }
}

/**
 * Maps sync/restore status to a Bootstrap badge class and label.
 * @param {string} status
 * @returns {{ badgeClass: string, label: string }}
 */
function statusBadge(status) {
  switch (status) {
    case SYNC_STATUS.IN_PROGRESS:
    case RESTORE_STATUS.IN_PROGRESS:
      return { badgeClass: 'center-tile-status--progress', label: 'In progress' };
    case SYNC_STATUS.COMPLETED:
    case RESTORE_STATUS.COMPLETED:
      return { badgeClass: 'center-tile-status--completed', label: 'Completed' };
    case SYNC_STATUS.FAILED:
    case RESTORE_STATUS.FAILED:
      return { badgeClass: 'center-tile-status--failed', label: 'Failed' };
    default:
      return { badgeClass: 'center-tile-status--idle', label: 'Idle' };
  }
}

/**
 * Renders backup and restore tiles on the landing page.
 * @param {Object} metrics
 * @param {Object} metrics.backup
 * @param {Object} metrics.restore
 */
export function renderCenterTiles(metrics) {
  const container = document.getElementById('centerTileDashboard');
  if (!container) return;

  const backup = metrics.backup || {};
  const restore = metrics.restore || {};
  const backupStatus = statusBadge(backup.status || SYNC_STATUS.IDLE);
  const restoreStatus = statusBadge(restore.status || RESTORE_STATUS.IDLE);

  container.innerHTML = `
    <div class="col-md-6">
      <a href="backup-sync" class="form-box dashboard-hub-tile-bg--backup text-decoration-none">
        <i class="bi bi-cloud-arrow-up-fill" aria-hidden="true"></i>
        <h5>Backup &amp; Sync</h5>
        <p>Firestore → Google Sheet</p>
        <div class="center-tile-meta">
          <span>Last run: ${formatTimestamp(backup.lastSyncAt)}</span>
          <span class="center-tile-status ${backupStatus.badgeClass}">${backupStatus.label}</span>
        </div>
      </a>
    </div>
    <div class="col-md-6">
      <a href="restore-center" class="form-box dashboard-hub-tile-bg--restore text-decoration-none">
        <i class="bi bi-cloud-arrow-down-fill" aria-hidden="true"></i>
        <h5>Restore</h5>
        <p>Google Sheet → Firestore</p>
        <div class="center-tile-meta">
          <span>Last run: ${formatTimestamp(restore.lastRestoreAt)}</span>
          <span class="center-tile-status ${restoreStatus.badgeClass}">${restoreStatus.label}</span>
        </div>
      </a>
    </div>
  `;
}
