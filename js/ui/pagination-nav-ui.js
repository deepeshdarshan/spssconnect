/**
 * @fileoverview Shared Bootstrap pagination markup and page-size `<select>` wiring
 * for admin list pages (household directory, advanced search). Keeps DOM pagination DRY per
 * AGENT_GUIDELINES (Table Rendering — avoid repeating pagination logic).
 *
 * Consumers: {@link ../pages/dashboard-service.js}, {@link ../pages/member-advanced-search-page.js}.
 * @module pagination-nav-ui
 */

import { DASHBOARD_DEFAULTS } from '../constants/constants.js';
import {
  getPaginationState,
  setPaginationState,
} from '../services/pagination-service.js';

/**
 * Renders numbered page links into a `<ul.pagination>` and invokes the callback when
 * a valid page is chosen. Clears the list when `totalPages` is 1 or less.
 *
 * @param {HTMLUListElement|null} navEl - Container (`#paginationNav`).
 * @param {number} totalPages - Total pages (≥ 1).
 * @param {number} currentPage - Current 1-based page index.
 * @param {(page: number) => void} onSelectPage - Called with the new page number after a click.
 * @returns {void}
 */
export function bindPaginationNav(navEl, totalPages, currentPage, onSelectPage) {
  if (!navEl) return;

  if (totalPages <= 1) {
    navEl.innerHTML = '';
    return;
  }

  let html = `
    <li class="page-item ${currentPage <= 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${currentPage - 1}">&laquo;</a>
    </li>
  `;

  for (let p = 1; p <= totalPages; p += 1) {
    html += `
      <li class="page-item ${p === currentPage ? 'active' : ''}">
        <a class="page-link" href="#" data-page="${p}">${p}</a>
      </li>
    `;
  }

  html += `
    <li class="page-item ${currentPage >= totalPages ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${currentPage + 1}">&raquo;</a>
    </li>
  `;

  navEl.innerHTML = html;

  navEl.querySelectorAll('.page-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = parseInt(link.getAttribute('data-page') || '', 10);
      if (page >= 1 && page <= totalPages) {
        onSelectPage(page);
      }
    });
  });
}

/**
 * Populates a page-size `<select>` from {@link DASHBOARD_DEFAULTS.PAGE_SIZE_OPTIONS}
 * and aligns its value with {@link getPaginationState}. Corrects invalid stored sizes.
 *
 * @param {HTMLSelectElement|null} sel - The page size control.
 * @returns {void}
 */
export function populatePageSizeSelectFromDefaults(sel) {
  if (!sel) return;

  const { pageSize } = getPaginationState();
  sel.innerHTML = DASHBOARD_DEFAULTS.PAGE_SIZE_OPTIONS.map(
    (n) => `<option value="${n}">${n}</option>`,
  ).join('');

  const allowed = DASHBOARD_DEFAULTS.PAGE_SIZE_OPTIONS.includes(pageSize)
    ? pageSize
    : DASHBOARD_DEFAULTS.PAGE_SIZE;
  if (allowed !== pageSize) {
    setPaginationState({ pageSize: allowed });
  }
  sel.value = String(allowed);
}

/**
 * Binds change events on the page-size control (validates against allowed sizes).
 *
 * @param {HTMLSelectElement|null} sel
 * @param {(pageSize: number) => void} onChange - Invoked with the new size after validation.
 * @returns {void}
 */
export function bindPageSizeSelectChange(sel, onChange) {
  if (!sel) return;
  sel.addEventListener('change', () => {
    const n = parseInt(sel.value, 10);
    if (!DASHBOARD_DEFAULTS.PAGE_SIZE_OPTIONS.includes(n)) return;
    onChange(n);
  });
}
