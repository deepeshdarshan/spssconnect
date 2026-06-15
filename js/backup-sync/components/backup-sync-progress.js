/**
 * @fileoverview Progress bar UI for Backup & Sync operations.
 * @module backup-sync/components/backup-sync-progress
 */

const PANEL_ID = 'backupSyncProgressPanel';
const BAR_ID = 'backupSyncProgressBar';
const LABEL_ID = 'backupSyncProgressLabel';
const PCT_ID = 'backupSyncProgressPct';

/**
 * Shows the progress panel.
 */
export function showProgressPanel() {
  const panel = document.getElementById(PANEL_ID);
  if (panel) panel.classList.remove('d-none');
}

/**
 * Hides the progress panel.
 */
export function hideProgressPanel() {
  const panel = document.getElementById(PANEL_ID);
  if (panel) panel.classList.add('d-none');
}

/**
 * Resets progress to zero.
 */
export function resetProgress() {
  updateProgress({ processed: 0, total: 0, successCount: 0, failedCount: 0 });
}

/**
 * Updates the progress bar and label.
 * @param {import('../services/member-backup-sync-service.js').SyncProgress} progress
 */
export function updateProgress(progress) {
  const { processed, total, successCount, failedCount } = progress;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  const bar = document.getElementById(BAR_ID);
  if (bar) {
    bar.style.width = `${pct}%`;
    bar.setAttribute('aria-valuenow', String(pct));
    bar.textContent = `${pct}%`;
  }

  const label = document.getElementById(LABEL_ID);
  if (label) {
    label.textContent = `${processed} / ${total} Homes Synced (${successCount} succeeded, ${failedCount} failed)`;
  }

  const pctEl = document.getElementById(PCT_ID);
  if (pctEl) pctEl.textContent = `${pct}% completed`;
}
