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
 * Numbered page buttons at the start/end of the list (before/after `…`), plus {@link buildPaginationPageItems}
 * `siblingCount` around the current page. Used by household directory and advanced member search.
 *
 * @type {{ leadingPages: number, trailingPages: number, siblingCount: number }}
 */
export const PAGINATION_LIST_MEMBER_HUB_OPTS = Object.freeze({
  leadingPages: 3,
  trailingPages: 3,
  siblingCount: 1,
});

/**
 * Builds a compact page list with ellipses, e.g. `1 2 3 … 21 22 23` (fixed ends + current window).
 *
 * @param {number} totalPages
 * @param {number} currentPage - 1-based index.
 * @param {{ leadingPages?: number, trailingPages?: number, siblingCount?: number }} [opts] - Overrides
 *   {@link PAGINATION_LIST_MEMBER_HUB_OPTS} when provided.
 * @returns {Array<number|'ellipsis'>}
 */
export function buildPaginationPageItems(totalPages, currentPage, opts = {}) {
  const { leadingPages, trailingPages, siblingCount } = {
    ...PAGINATION_LIST_MEMBER_HUB_OPTS,
    ...opts,
  };

  if (totalPages <= 1) return [];

  if (totalPages <= leadingPages + trailingPages + 2) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pageSet = new Set();

  for (let p = 1; p <= leadingPages; p += 1) pageSet.add(p);
  for (let p = totalPages - trailingPages + 1; p <= totalPages; p += 1) pageSet.add(p);
  for (let p = currentPage - siblingCount; p <= currentPage + siblingCount; p += 1) {
    if (p >= 1 && p <= totalPages) pageSet.add(p);
  }

  const sorted = [...pageSet].sort((a, b) => a - b);
  /** @type {Array<number|'ellipsis'>} */
  const items = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) items.push('ellipsis');
    items.push(sorted[i]);
  }
  return items;
}

/**
 * Renders page controls into a `<ul.pagination>`: first, previous, numbered pages
 * (with ellipses), next, and last. Clears the list when `totalPages` is 1 or less.
 *
 * @param {HTMLUListElement|null} navEl - Container (`#paginationNav`).
 * @param {number} totalPages - Total pages (≥ 1).
 * @param {number} currentPage - Current 1-based page index.
 * @param {(page: number) => void} onSelectPage - Called with the new page number after a click.
 * @param {{ leadingPages?: number, trailingPages?: number, siblingCount?: number }} [pageItemOpts] - Passed to
 *   {@link buildPaginationPageItems}; defaults to {@link PAGINATION_LIST_MEMBER_HUB_OPTS} (household directory +
 *   advanced search).
 * @returns {void}
 */
export function bindPaginationNav(navEl, totalPages, currentPage, onSelectPage, pageItemOpts = {}) {
  if (!navEl) return;

  if (totalPages <= 1) {
    navEl.innerHTML = '';
    return;
  }

  const pageItems = buildPaginationPageItems(totalPages, currentPage, pageItemOpts);

  let html = `
    <li class="page-item ${currentPage <= 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="1" aria-label="First page"><span aria-hidden="true">|&laquo;</span></a>
    </li>
    <li class="page-item ${currentPage <= 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Previous page"><span aria-hidden="true">&laquo;&laquo;</span></a>
    </li>
  `;

  for (const item of pageItems) {
    if (item === 'ellipsis') {
      html += `
        <li class="page-item disabled pagination-spss__ellipsis" aria-hidden="true">
          <span class="page-link">…</span>
        </li>
      `;
      continue;
    }
    html += `
      <li class="page-item ${item === currentPage ? 'active' : ''}">
        <a class="page-link" href="#" data-page="${item}" ${item === currentPage ? 'aria-current="page"' : ''}>${item}</a>
      </li>
    `;
  }

  html += `
    <li class="page-item ${currentPage >= totalPages ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${currentPage + 1}" aria-label="Next page"><span aria-hidden="true">&raquo;&raquo;</span></a>
    </li>
    <li class="page-item ${currentPage >= totalPages ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${totalPages}" aria-label="Last page"><span aria-hidden="true">&raquo;|</span></a>
    </li>
  `;

  navEl.innerHTML = html;

  navEl.querySelectorAll('a.page-link[data-page]').forEach((link) => {
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
