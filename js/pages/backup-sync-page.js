/**
 * @fileoverview Backup & Sync page controller.
 * @module pages/backup-sync-page
 */

import { ROUTES } from '../constants/constants.js';
import { auth } from '../services/firebase-config.js';
import { isSuperAdmin } from '../services/auth-service.js';
import { showToast, setButtonLoading } from '../ui/ui-service.js';
import { isGoogleSheetsConfigured } from '../backup-sync/services/google-sheets-destination.js';
import {
  loadDashboardMetrics,
  runIncrementalSync,
  runRetryFailedSync,
  refreshPendingCount,
} from '../backup-sync/services/member-backup-sync-service.js';
import { fetchRecentSyncHistory } from '../backup-sync/services/sync-history-service.js';
import { renderDashboardMetrics } from '../backup-sync/components/backup-sync-dashboard.js';
import {
  showProgressPanel,
  hideProgressPanel,
  resetProgress,
  updateProgress,
} from '../backup-sync/components/backup-sync-progress.js';
import { renderSyncHistoryTable } from '../backup-sync/components/backup-sync-history-table.js';
import { renderValidation, hideValidation } from '../backup-sync/components/backup-sync-validation.js';
import * as Logger from '../utils/logger.js';

/** @type {boolean} */
let syncRunning = false;

/**
 * Returns the current user's display name for audit fields.
 * @returns {string}
 */
function getTriggeredBy() {
  return auth.currentUser?.email || auth.currentUser?.uid || 'unknown';
}

/**
 * Updates sync/retry button enabled state.
 */
function updateButtonStates() {
  const syncBtn = document.getElementById('backupSyncBtn');
  const retryBtn = document.getElementById('backupRetryBtn');
  const configured = isGoogleSheetsConfigured();

  if (syncBtn) syncBtn.disabled = syncRunning || !configured;
  if (retryBtn) retryBtn.disabled = syncRunning || !configured;

  const warning = document.getElementById('backupSyncConfigWarning');
  if (warning) warning.classList.toggle('d-none', configured);
}

/**
 * Reloads dashboard metrics and history table.
 * @returns {Promise<void>}
 */
async function refreshDashboard() {
  await refreshPendingCount();
  const metrics = await loadDashboardMetrics();
  renderDashboardMetrics(metrics);

  if (metrics.lastValidation) {
    renderValidation({
      firestoreCount: metrics.lastValidation.firestoreCount,
      remoteCount: metrics.lastValidation.remoteCount,
      matched: metrics.lastValidation.matched,
    });
  }

  const history = await fetchRecentSyncHistory();
  renderSyncHistoryTable(history);
}

/**
 * Handles incremental sync button click.
 * @returns {Promise<void>}
 */
async function handleSyncClick() {
  if (syncRunning) return;

  const syncBtn = document.getElementById('backupSyncBtn');
  syncRunning = true;
  updateButtonStates();
  hideValidation();
  showProgressPanel();
  resetProgress();
  setButtonLoading(syncBtn, true);

  try {
    const summary = await runIncrementalSync({
      triggeredBy: getTriggeredBy(),
      onProgress: updateProgress,
    });

    renderValidation(summary.validation);
    showToast(
      `Sync complete: ${summary.successCount} succeeded, ${summary.failedCount} failed.`,
      summary.failedCount > 0 ? 'warning' : 'success',
    );
    await refreshDashboard();
  } catch (err) {
    Logger.error('Sync failed:', err);
    showToast(err.message || 'Sync failed.', 'error');
    await refreshDashboard();
  } finally {
    syncRunning = false;
    setButtonLoading(syncBtn, false);
    updateButtonStates();
    hideProgressPanel();
  }
}

/**
 * Handles retry failed records button click.
 * @returns {Promise<void>}
 */
async function handleRetryClick() {
  if (syncRunning) return;

  const retryBtn = document.getElementById('backupRetryBtn');
  syncRunning = true;
  updateButtonStates();
  hideValidation();
  showProgressPanel();
  resetProgress();
  setButtonLoading(retryBtn, true);

  try {
    const summary = await runRetryFailedSync({
      triggeredBy: getTriggeredBy(),
      onProgress: updateProgress,
    });

    if (summary.totalRecords === 0) {
      showToast('No failed records to retry.', 'info');
    } else {
      renderValidation(summary.validation);
      showToast(
        `Retry complete: ${summary.successCount} succeeded, ${summary.failedCount} failed.`,
        summary.failedCount > 0 ? 'warning' : 'success',
      );
    }
    await refreshDashboard();
  } catch (err) {
    Logger.error('Retry failed:', err);
    showToast(err.message || 'Retry failed.', 'error');
    await refreshDashboard();
  } finally {
    syncRunning = false;
    setButtonLoading(retryBtn, false);
    updateButtonStates();
    hideProgressPanel();
  }
}

/**
 * Binds page event listeners.
 */
function bindEvents() {
  document.getElementById('backupSyncBtn')?.addEventListener('click', () => {
    void handleSyncClick();
  });
  document.getElementById('backupRetryBtn')?.addEventListener('click', () => {
    void handleRetryClick();
  });
}

/**
 * Initializes the Backup & Sync page.
 * @returns {Promise<void>}
 */
export async function initBackupSyncPage() {
  if (!isSuperAdmin()) {
    window.location.href = ROUTES.ADMIN_DASHBOARD;
    return;
  }

  bindEvents();
  updateButtonStates();

  try {
    await refreshDashboard();
  } catch (err) {
    Logger.error('Failed to load backup sync dashboard:', err);
    showToast('Failed to load backup sync data.', 'error');
  }
}

/** @deprecated Use initBackupSyncPage */
export const initBackupSyncCenterPage = initBackupSyncPage;
