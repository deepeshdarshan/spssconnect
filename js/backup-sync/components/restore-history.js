/**
 * @fileoverview Restore history table renderer.
 * @module backup-sync/components/restore-history
 */

import { escapeHtml } from '../../ui/ui-service.js';

/**
 * Formats a timestamp for table display.
 * @param {Object|null} ts - Firestore Timestamp.
 * @returns {string}
 */
function formatTime(ts) {
  if (!ts?.toDate) return '—';
  try {
    return ts.toDate().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

/**
 * Formats duration in ms to human-readable string.
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  if (!ms && ms !== 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

/**
 * Renders restore history rows. Rollback buttons use event delegation on the tbody.
 *
 * @param {Array<Object>} history - Restore history documents.
 */
export function renderRestoreHistoryTable(history) {
  const tbody = document.getElementById('restoreHistoryBody');
  if (!tbody) return;

  if (!history || history.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted py-3">No restore operations yet.</td></tr>';
    return;
  }

  tbody.innerHTML = history.map((entry, idx) => {
    const canRollback = entry.restoreType !== 'rollback' && entry.restoreJobId;
    const rollbackBtn = canRollback
      ? `<button type="button" class="btn btn-sm btn-outline-warning restore-rollback-btn" data-job-id="${escapeHtml(entry.restoreJobId)}">Rollback</button>`
      : '—';

    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(formatTime(entry.startedAt))}</td>
        <td>${escapeHtml(formatDuration(entry.durationMs || entry.duration))}</td>
        <td>${escapeHtml(entry.restoreMode || entry.restoreType || '—')}</td>
        <td>${entry.createdCount ?? 0}</td>
        <td>${entry.updatedCount ?? 0}</td>
        <td>${entry.deletedCount ?? 0}</td>
        <td class="${entry.failedCount > 0 ? 'text-danger' : ''}">${entry.failedCount ?? 0}</td>
        <td>${escapeHtml(entry.triggeredBy || '—')}</td>
        <td>${rollbackBtn}</td>
      </tr>
    `;
  }).join('');
}
