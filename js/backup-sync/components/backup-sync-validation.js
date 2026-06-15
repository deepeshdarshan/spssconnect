/**
 * @fileoverview Post-sync validation result display.
 * @module backup-sync/components/backup-sync-validation
 */

const PANEL_ID = 'backupSyncValidationPanel';
const CONTENT_ID = 'backupSyncValidationContent';

/**
 * Hides the validation panel.
 */
export function hideValidation() {
  const panel = document.getElementById(PANEL_ID);
  if (panel) panel.classList.add('d-none');
}

/**
 * Renders validation comparison result.
 * @param {Object|null} validation
 * @param {number} validation.firestoreCount
 * @param {number} validation.remoteCount
 * @param {boolean} validation.matched
 */
export function renderValidation(validation) {
  const panel = document.getElementById(PANEL_ID);
  const content = document.getElementById(CONTENT_ID);
  if (!panel || !content) return;

  if (!validation) {
    hideValidation();
    return;
  }

  panel.classList.remove('d-none');
  const matched = validation.matched;
  const alertClass = matched ? 'alert-success' : 'alert-warning';
  const icon = matched ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';
  const message = matched ? 'Backup Validation Successful' : 'Backup Validation Mismatch — counts differ';

  content.innerHTML = `
    <div class="alert ${alertClass} mb-0" role="status">
      <div class="d-flex align-items-start gap-2">
        <i class="bi ${icon} fs-5" aria-hidden="true"></i>
        <div>
          <p class="mb-1 fw-semibold">${message}</p>
          <p class="mb-0 small">Firestore: <strong>${validation.firestoreCount}</strong> &nbsp;|&nbsp; Google Sheet: <strong>${validation.remoteCount}</strong></p>
        </div>
      </div>
    </div>
  `;
}
