/**
 * @fileoverview Restore confirmation dialogs (Bootstrap modal and shared confirm UI).
 * @module backup-sync/components/restore-confirm-ui
 */

import { showConfirmDialog } from '../../ui/ui-service.js';
import { RESTORE_MODE } from '../backup-sync-constants.js';

/**
 * Shows the orphan-delete confirmation modal for full restore.
 *
 * @returns {Promise<boolean>} True when the user confirms; false when cancelled.
 */
function confirmDeleteOrphansModal() {
  const modalEl = document.getElementById('restoreConfirmModal');
  if (!modalEl) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const checkbox = document.getElementById('restoreConfirmAck');
    const confirmBtn = document.getElementById('restoreConfirmBtn');
    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);

    if (checkbox) checkbox.checked = false;
    if (confirmBtn) confirmBtn.disabled = true;

    const onCheck = () => {
      if (confirmBtn) confirmBtn.disabled = !checkbox?.checked;
    };
    const onConfirm = () => {
      cleanup();
      modal.hide();
      resolve(true);
    };
    const onHide = () => {
      cleanup();
      resolve(false);
    };

    function cleanup() {
      checkbox?.removeEventListener('change', onCheck);
      confirmBtn?.removeEventListener('click', onConfirm);
      modalEl.removeEventListener('hidden.bs.modal', onHide);
    }

    checkbox?.addEventListener('change', onCheck);
    confirmBtn?.addEventListener('click', onConfirm);
    modalEl.addEventListener('hidden.bs.modal', onHide);
    modal.show();
  });
}

/**
 * Prompts the user to confirm restore execution based on mode and options.
 *
 * @param {string} mode - {@link RESTORE_MODE} value.
 * @param {boolean} deleteOrphans - Whether orphan deletion is enabled.
 * @returns {Promise<boolean>} True when confirmed.
 */
export async function confirmRestoreExecution(mode, deleteOrphans) {
  if (mode === RESTORE_MODE.FULL && deleteOrphans) {
    return confirmDeleteOrphansModal();
  }

  return showConfirmDialog(
    'Execute restore? This will write to Firestore. Firestore is the system of record — this is a manual recovery action.',
  );
}

/**
 * Prompts the user to confirm rollback from a restore snapshot.
 *
 * @returns {Promise<boolean>} True when confirmed.
 */
export async function confirmRollbackExecution() {
  return showConfirmDialog(
    'Roll back this restore? Firestore will be reverted to the pre-restore snapshot. Google Sheet will not be changed.',
  );
}
