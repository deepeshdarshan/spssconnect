/**
 * @fileoverview Renders Backup & Sync dashboard metric cards.
 * @module backup-sync/components/backup-sync-dashboard
 */

import { SYNC_STATUS } from '../backup-sync-constants.js';

/** @type {Record<string, string>} */
const STATUS_LABELS = {
  [SYNC_STATUS.IDLE]: 'Idle',
  [SYNC_STATUS.IN_PROGRESS]: 'In Progress',
  [SYNC_STATUS.COMPLETED]: 'Completed',
  [SYNC_STATUS.FAILED]: 'Failed',
};

/**
 * Updates a single metric element by data-metric attribute.
 * @param {string} key
 * @param {string|number} value
 */
function setMetric(key, value) {
  const el = document.querySelector(`[data-metric="${key}"]`);
  if (el) el.textContent = value ?? '—';
}

/**
 * Renders dashboard metrics into Bootstrap cards.
 * @param {import('../services/member-backup-sync-service.js').DashboardMetrics} metrics
 */
export function renderDashboardMetrics(metrics) {
  setMetric('firestoreCount', metrics.firestoreCount);
  setMetric('remoteCount', metrics.remoteCount != null ? metrics.remoteCount : '—');
  setMetric('syncedCount', metrics.syncedCount);
  setMetric('pendingCount', metrics.pendingCount);
  setMetric('failedCount', metrics.failedCount);
  setMetric('lastSyncAt', metrics.lastSyncAt);
  setMetric('lastSyncBy', metrics.lastSyncBy);
  setMetric('syncStatus', STATUS_LABELS[metrics.syncStatus] || metrics.syncStatus);

  const statusEl = document.querySelector('[data-metric="syncStatus"]');
  if (statusEl) {
    statusEl.classList.remove('text-success', 'text-warning', 'text-danger', 'text-primary');
    if (metrics.syncStatus === SYNC_STATUS.IN_PROGRESS) statusEl.classList.add('text-primary');
    else if (metrics.syncStatus === SYNC_STATUS.COMPLETED) statusEl.classList.add('text-success');
    else if (metrics.syncStatus === SYNC_STATUS.FAILED) statusEl.classList.add('text-danger');
    else statusEl.classList.add('text-warning');
  }
}
