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
      return { badgeClass: 'bg-primary', label: 'In progress' };
    case SYNC_STATUS.COMPLETED:
    case RESTORE_STATUS.COMPLETED:
      return { badgeClass: 'bg-success', label: 'Completed' };
    case SYNC_STATUS.FAILED:
    case RESTORE_STATUS.FAILED:
      return { badgeClass: 'bg-danger', label: 'Failed' };
    default:
      return { badgeClass: 'bg-secondary', label: 'Idle' };
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
      <a href="backup-sync" class="center-tile-card text-decoration-none">
        <div class="center-tile-icon" aria-hidden="true"><i class="bi bi-cloud-arrow-up-fill"></i></div>
        <div class="center-tile-body">
          <h2 class="center-tile-title">Backup &amp; Sync</h2>
          <p class="center-tile-desc">Firestore → Google Sheet</p>
          <div class="center-tile-meta">
            <span class="small text-muted">Last run: ${formatTimestamp(backup.lastSyncAt)}</span>
            <span class="badge ${backupStatus.badgeClass}">${backupStatus.label}</span>
          </div>
        </div>
      </a>
    </div>
    <div class="col-md-6">
      <a href="restore-center" class="center-tile-card text-decoration-none">
        <div class="center-tile-icon center-tile-icon-restore" aria-hidden="true"><i class="bi bi-cloud-arrow-down-fill"></i></div>
        <div class="center-tile-body">
          <h2 class="center-tile-title">Restore</h2>
          <p class="center-tile-desc">Google Sheet → Firestore</p>
          <div class="center-tile-meta">
            <span class="small text-muted">Last run: ${formatTimestamp(restore.lastRestoreAt)}</span>
            <span class="badge ${restoreStatus.badgeClass}">${restoreStatus.label}</span>
          </div>
        </div>
      </a>
    </div>
  `;
}
