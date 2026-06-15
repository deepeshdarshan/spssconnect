/**
 * @fileoverview Sync history table renderer for Backup & Sync Center.
 * @module backup-sync/components/backup-sync-history-table
 */

import { escapeHtml } from '../../ui/ui-service.js';

const TABLE_BODY_ID = 'backupSyncHistoryBody';

/**
 * Formats a timestamp field for table display.
 * @param {*} ts
 * @returns {string}
 */
function formatTs(ts) {
  if (!ts?.toDate) return '—';
  return ts.toDate().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Formats duration in milliseconds.
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  if (!ms && ms !== 0) return '—';
  if (ms < 1000) return `${ms} ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

/**
 * Renders sync history rows into the table body.
 * @param {Array<Object>} history
 */
export function renderSyncHistoryTable(history) {
  const tbody = document.getElementById(TABLE_BODY_ID);
  if (!tbody) return;

  if (!history?.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">No sync history yet.</td></tr>';
    return;
  }

  tbody.innerHTML = history.map((row, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(formatTs(row.startedAt))}</td>
      <td>${escapeHtml(formatDuration(row.durationMs))}</td>
      <td>${row.totalRecords ?? 0}</td>
      <td class="text-success">${row.successCount ?? 0}</td>
      <td class="text-danger">${row.failedCount ?? 0}</td>
      <td>${escapeHtml(row.triggeredBy || '—')}</td>
    </tr>
  `).join('');
}
