/**
 * @fileoverview Restore preview panel (create / update / delete counts).
 * @module backup-sync/components/restore-preview
 */

import { RESTORE_CONFIG } from '../backup-sync-constants.js';
import { escapeHtml } from '../../ui/ui-service.js';

const PANEL_ID = 'restorePreviewPanel';
const CONTENT_ID = 'restorePreviewContent';

/**
 * Renders a collapsible ID list.
 * @param {string} title
 * @param {string[]} ids
 * @param {string} listId
 * @returns {string}
 */
function renderIdList(title, ids, listId) {
  const limit = RESTORE_CONFIG.PREVIEW_LIST_LIMIT;
  const shown = ids.slice(0, limit);
  const more = ids.length > limit ? ids.length - limit : 0;

  return `
    <div class="restore-preview-section mb-3">
      <div class="d-flex justify-content-between align-items-center">
        <h6 class="mb-0">${title}</h6>
        <span class="badge bg-secondary">${ids.length}</span>
      </div>
      ${ids.length > 0 ? `
        <button class="btn btn-link btn-sm p-0 mt-1" type="button" data-bs-toggle="collapse" data-bs-target="#${listId}">
          Show record IDs
        </button>
        <div class="collapse mt-1" id="${listId}">
          <ul class="small mb-0 restore-preview-id-list">
            ${shown.map((id) => `<li><code>${escapeHtml(id)}</code></li>`).join('')}
            ${more > 0 ? `<li class="text-muted">…and ${more} more</li>` : ''}
          </ul>
        </div>
      ` : '<p class="small text-muted mb-0 mt-1">None</p>'}
    </div>
  `;
}

/**
 * Hides the preview panel.
 */
export function hideRestorePreview() {
  const panel = document.getElementById(PANEL_ID);
  if (panel) panel.classList.add('d-none');
}

/**
 * Renders restore preview counts and record ID lists.
 * @param {{ toCreate: string[], toUpdate: string[], toDelete: string[] }} preview
 */
export function renderRestorePreview(preview) {
  const panel = document.getElementById(PANEL_ID);
  const content = document.getElementById(CONTENT_ID);
  if (!panel || !content) return;

  panel.classList.remove('d-none');
  content.innerHTML = `
    ${renderIdList('Records To Create', preview.toCreate, 'restorePreviewCreate')}
    ${renderIdList('Records To Update', preview.toUpdate, 'restorePreviewUpdate')}
    ${renderIdList('Records To Delete', preview.toDelete, 'restorePreviewDelete')}
  `;
}
