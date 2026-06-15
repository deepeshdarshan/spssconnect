/**
 * @fileoverview Restore progress bar and status display.
 * @module backup-sync/components/restore-progress
 */

const PANEL_ID = 'restoreProgressPanel';
const BAR_ID = 'restoreProgressBar';
const PCT_ID = 'restoreProgressPct';
const LABEL_ID = 'restoreProgressLabel';
const OP_ID = 'restoreProgressOperation';
const ETA_ID = 'restoreProgressEta';

/**
 * Shows the restore progress panel.
 */
export function showRestoreProgressPanel() {
  const panel = document.getElementById(PANEL_ID);
  if (panel) panel.classList.remove('d-none');
}

/**
 * Hides the restore progress panel.
 */
export function hideRestoreProgressPanel() {
  const panel = document.getElementById(PANEL_ID);
  if (panel) panel.classList.add('d-none');
}

/**
 * Resets progress UI to zero.
 */
export function resetRestoreProgress() {
  updateRestoreProgress({
    processed: 0,
    total: 0,
    createdCount: 0,
    updatedCount: 0,
    deletedCount: 0,
    failedCount: 0,
    currentOperation: 'Preparing…',
    estimatedRemainingMs: 0,
  });
}

/**
 * Updates restore progress display.
 * @param {import('../services/restore-service.js').RestoreProgress} progress
 */
export function updateRestoreProgress(progress) {
  const {
    processed,
    total,
    createdCount,
    updatedCount,
    deletedCount,
    failedCount,
    currentOperation,
    estimatedRemainingMs,
  } = progress;

  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  const bar = document.getElementById(BAR_ID);
  const pctEl = document.getElementById(PCT_ID);
  const label = document.getElementById(LABEL_ID);
  const op = document.getElementById(OP_ID);
  const eta = document.getElementById(ETA_ID);
  const panel = document.getElementById(PANEL_ID);
  const progressBar = panel?.querySelector('.progress');

  if (bar) {
    bar.style.width = `${pct}%`;
    bar.textContent = `${pct}%`;
    bar.setAttribute('aria-valuenow', String(pct));
  }
  if (progressBar) {
    progressBar.setAttribute('aria-valuenow', String(pct));
  }
  if (pctEl) pctEl.textContent = `${pct}% completed`;
  if (label) {
    label.textContent = `${processed} / ${total} households restored (created: ${createdCount}, updated: ${updatedCount}, deleted: ${deletedCount}, failed: ${failedCount})`;
  }
  if (op) op.textContent = currentOperation || '';
  if (eta) {
    if (estimatedRemainingMs > 0) {
      const secs = Math.ceil(estimatedRemainingMs / 1000);
      eta.textContent = `Estimated remaining: ${secs < 60 ? `${secs}s` : `${Math.ceil(secs / 60)}m`}`;
    } else {
      eta.textContent = '';
    }
  }
}
