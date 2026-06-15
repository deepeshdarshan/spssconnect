/**
 * @fileoverview Restore Center page controller — event wiring only.
 * @module pages/restore-center-page
 */

import { ROUTES } from '../constants/constants.js';
import { auth } from '../services/firebase-config.js';
import { isSuperAdmin } from '../services/auth-service.js';
import { showToast, setButtonLoading } from '../ui/ui-service.js';
import { isGoogleSheetsConfigured } from '../backup-sync/services/google-sheet-service.js';
import {
  analyzeRestore,
  buildRestorePreview,
  executeRestore,
  executeRollback,
  RESTORE_MODE,
} from '../backup-sync/services/restore-service.js';
import { fetchRecentRestoreHistory } from '../backup-sync/services/restore-history-service.js';
import { renderAnalysisSummary, renderRestoreValidation, hideRestoreValidation } from '../backup-sync/components/restore-validation.js';
import { renderRestorePreview, hideRestorePreview } from '../backup-sync/components/restore-preview.js';
import {
  showRestoreProgressPanel,
  hideRestoreProgressPanel,
  resetRestoreProgress,
  updateRestoreProgress,
} from '../backup-sync/components/restore-progress.js';
import { renderRestoreHistoryTable } from '../backup-sync/components/restore-history.js';
import {
  confirmRestoreExecution,
  confirmRollbackExecution,
} from '../backup-sync/components/restore-confirm-ui.js';
import * as Logger from '../utils/logger.js';

/** @type {boolean} */
let restoreRunning = false;

/** @type {import('../backup-sync/services/restore-analysis-service.js').RestoreAnalysisResult|null} */
let currentAnalysis = null;

/**
 * Returns audit user string for restore history.
 * @returns {string}
 */
function getTriggeredBy() {
  return auth.currentUser?.email || auth.currentUser?.uid || 'unknown';
}

/**
 * Gets selected restore mode from radio inputs.
 * @returns {string}
 */
function getSelectedMode() {
  const full = document.getElementById('restoreModeFull');
  return full?.checked ? RESTORE_MODE.FULL : RESTORE_MODE.MISSING_ONLY;
}

/**
 * Whether delete orphans checkbox is checked.
 * @returns {boolean}
 */
function isDeleteOrphansEnabled() {
  return Boolean(document.getElementById('restoreDeleteOrphans')?.checked);
}

/**
 * Updates action button enabled state.
 */
function updateButtonStates() {
  const analyzeBtn = document.getElementById('restoreAnalyzeBtn');
  const executeBtn = document.getElementById('restoreExecuteBtn');
  const configured = isGoogleSheetsConfigured();
  const hasAnalysis = Boolean(currentAnalysis);

  if (analyzeBtn) analyzeBtn.disabled = restoreRunning || !configured;
  if (executeBtn) executeBtn.disabled = restoreRunning || !configured || !hasAnalysis;

  document.getElementById('restoreConfigWarning')?.classList.toggle('d-none', configured);

  const deleteOrphansWrap = document.getElementById('restoreDeleteOrphansWrap');
  if (deleteOrphansWrap) {
    deleteOrphansWrap.classList.toggle('d-none', getSelectedMode() !== RESTORE_MODE.FULL);
  }
}

/**
 * Refreshes preview based on current analysis and mode.
 */
function refreshPreview() {
  if (!currentAnalysis) {
    hideRestorePreview();
    return;
  }
  const preview = buildRestorePreview(
    currentAnalysis,
    getSelectedMode(),
    isDeleteOrphansEnabled(),
  );
  renderRestorePreview(preview);
}

/**
 * Reloads restore history table.
 * @returns {Promise<void>}
 */
async function refreshHistory() {
  const history = await fetchRecentRestoreHistory();
  renderRestoreHistoryTable(history);
}

/**
 * Re-runs analysis and updates UI panels.
 * @returns {Promise<void>}
 */
async function refreshAnalysisPanels() {
  currentAnalysis = await analyzeRestore();
  renderAnalysisSummary(currentAnalysis);
  refreshPreview();
}

/**
 * Handles analyze restore button.
 * @returns {Promise<void>}
 */
async function handleAnalyzeClick() {
  if (restoreRunning) return;

  const btn = document.getElementById('restoreAnalyzeBtn');
  setButtonLoading(btn, true);
  hideRestoreValidation();
  hideRestorePreview();

  try {
    await refreshAnalysisPanels();
    document.getElementById('restoreModePanel')?.classList.remove('d-none');
    updateButtonStates();
    showToast('Analysis complete. Review the summary before restoring.', 'success');
  } catch (err) {
    Logger.error('Restore analysis failed:', err);
    showToast(err.message || 'Analysis failed.', 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

/**
 * Handles execute restore button.
 * @returns {Promise<void>}
 */
async function handleExecuteClick() {
  if (restoreRunning || !currentAnalysis) return;

  const mode = getSelectedMode();
  const deleteOrphans = isDeleteOrphansEnabled();
  const confirmed = await confirmRestoreExecution(mode, deleteOrphans);
  if (!confirmed) return;

  const btn = document.getElementById('restoreExecuteBtn');
  restoreRunning = true;
  updateButtonStates();
  hideRestoreValidation();
  showRestoreProgressPanel();
  resetRestoreProgress();
  setButtonLoading(btn, true);

  try {
    const summary = await executeRestore({
      analysis: currentAnalysis,
      mode,
      deleteOrphans,
      triggeredBy: getTriggeredBy(),
      onProgress: updateRestoreProgress,
    });

    renderRestoreValidation(summary.validation);
    showToast(
      `Restore complete: ${summary.createdCount} created, ${summary.updatedCount} updated, ${summary.deletedCount} deleted, ${summary.failedCount} failed.`,
      summary.failedCount > 0 ? 'warning' : 'success',
    );

    await refreshAnalysisPanels();
    await refreshHistory();
  } catch (err) {
    Logger.error('Restore failed:', err);
    showToast(err.message || 'Restore failed.', 'error');
  } finally {
    restoreRunning = false;
    setButtonLoading(btn, false);
    updateButtonStates();
    hideRestoreProgressPanel();
  }
}

/**
 * Handles rollback from snapshot.
 * @param {string} restoreJobId
 * @returns {Promise<void>}
 */
async function handleRollbackClick(restoreJobId) {
  if (restoreRunning) return;

  const confirmed = await confirmRollbackExecution();
  if (!confirmed) return;

  restoreRunning = true;
  updateButtonStates();
  showRestoreProgressPanel();
  resetRestoreProgress();

  try {
    const result = await executeRollback({
      restoreJobId,
      triggeredBy: getTriggeredBy(),
      onProgress: updateRestoreProgress,
    });
    showToast(
      `Rollback complete: ${result.restored} restored, ${result.deleted} removed, ${result.failed} failed.`,
      result.failed > 0 ? 'warning' : 'success',
    );
    await refreshAnalysisPanels();
    await refreshHistory();
  } catch (err) {
    Logger.error('Rollback failed:', err);
    showToast(err.message || 'Rollback failed.', 'error');
  } finally {
    restoreRunning = false;
    updateButtonStates();
    hideRestoreProgressPanel();
  }
}

/**
 * Binds page events (no inline handlers in HTML).
 */
function bindEvents() {
  document.getElementById('restoreAnalyzeBtn')?.addEventListener('click', () => {
    void handleAnalyzeClick();
  });
  document.getElementById('restoreExecuteBtn')?.addEventListener('click', () => {
    void handleExecuteClick();
  });

  document.querySelectorAll('input[name="restoreMode"]').forEach((el) => {
    el.addEventListener('change', () => {
      updateButtonStates();
      refreshPreview();
    });
  });

  document.getElementById('restoreDeleteOrphans')?.addEventListener('change', refreshPreview);

  document.getElementById('restoreHistoryBody')?.addEventListener('click', (event) => {
    const btn = event.target.closest('.restore-rollback-btn');
    if (!btn) return;
    const jobId = btn.getAttribute('data-job-id');
    if (jobId) void handleRollbackClick(jobId);
  });
}

/**
 * Initializes the Restore Center page.
 * @returns {Promise<void>}
 */
export async function initRestoreCenterPage() {
  if (!isSuperAdmin()) {
    window.location.href = ROUTES.ADMIN_DASHBOARD;
    return;
  }

  bindEvents();
  updateButtonStates();

  try {
    await refreshHistory();
  } catch (err) {
    Logger.error('Failed to load restore center:', err);
    showToast('Failed to load restore data.', 'error');
  }
}
