/**
 * @fileoverview Post-restore validation result display.
 * @module backup-sync/components/restore-validation
 */

const PANEL_ID = 'restoreValidationPanel';
const CONTENT_ID = 'restoreValidationContent';

/**
 * Hides the validation panel.
 */
export function hideRestoreValidation() {
  const panel = document.getElementById(PANEL_ID);
  if (panel) panel.classList.add('d-none');
}

/**
 * Renders post-restore validation comparison.
 * @param {Object|null} validation
 * @param {number} validation.firestoreCount
 * @param {number} validation.sheetCount
 * @param {boolean} validation.matched
 * @param {number} [validation.missingCount]
 */
export function renderRestoreValidation(validation) {
  const panel = document.getElementById(PANEL_ID);
  const content = document.getElementById(CONTENT_ID);
  if (!panel || !content) return;

  if (!validation) {
    hideRestoreValidation();
    return;
  }

  panel.classList.remove('d-none');
  const matched = validation.matched;
  const alertClass = matched ? 'alert-success' : 'alert-warning';
  const icon = matched ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';
  const message = matched ? 'Validation Passed' : 'Validation Warning — counts or missing records differ';

  content.innerHTML = `
    <div class="alert ${alertClass} mb-0" role="status">
      <div class="d-flex align-items-start gap-2">
        <i class="bi ${icon} fs-5" aria-hidden="true"></i>
        <div>
          <p class="mb-1 fw-semibold">${message}</p>
          <p class="mb-0 small">
            Google Sheet households: <strong>${validation.sheetCount}</strong> &nbsp;|&nbsp;
            Firestore households: <strong>${validation.firestoreCount}</strong>
            ${validation.missingCount != null ? ` &nbsp;|&nbsp; Missing in Firestore: <strong>${validation.missingCount}</strong>` : ''}
          </p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders analysis summary (pre-restore comparison).
 * @param {Object|null} analysis
 */
export function renderAnalysisSummary(analysis) {
  const panel = document.getElementById('restoreAnalysisPanel');
  const content = document.getElementById('restoreAnalysisContent');
  if (!panel || !content) return;

  if (!analysis) {
    panel.classList.add('d-none');
    return;
  }

  panel.classList.remove('d-none');
  content.innerHTML = `
    <div class="row g-3">
      <div class="col-sm-6 col-md-4">
        <div class="restore-stat-box">
          <div class="restore-stat-label">Firestore Households</div>
          <div class="restore-stat-value">${analysis.firestoreCount}</div>
        </div>
      </div>
      <div class="col-sm-6 col-md-4">
        <div class="restore-stat-box">
          <div class="restore-stat-label">Google Sheet Households</div>
          <div class="restore-stat-value">${analysis.sheetCount}</div>
        </div>
      </div>
      <div class="col-sm-6 col-md-4">
        <div class="restore-stat-box">
          <div class="restore-stat-label">Missing In Firestore</div>
          <div class="restore-stat-value text-warning">${analysis.missingInFirestore?.length ?? 0}</div>
        </div>
      </div>
      <div class="col-sm-6 col-md-4">
        <div class="restore-stat-box">
          <div class="restore-stat-label">Modified Records</div>
          <div class="restore-stat-value text-info">${analysis.modified?.length ?? 0}</div>
        </div>
      </div>
      <div class="col-sm-6 col-md-4">
        <div class="restore-stat-box">
          <div class="restore-stat-label">Extra Firestore Records</div>
          <div class="restore-stat-value">${analysis.extraInFirestore?.length ?? 0}</div>
        </div>
      </div>
      <div class="col-sm-6 col-md-4">
        <div class="restore-stat-box">
          <div class="restore-stat-label">Invalid Sheet Records</div>
          <div class="restore-stat-value text-danger">${analysis.invalidSheetRecords?.length ?? 0}</div>
        </div>
      </div>
    </div>
  `;
}
