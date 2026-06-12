/**
 * @fileoverview Dashboard orchestration — loads records, wires search/sort/pagination, renders table.
 * @module dashboard-service
 */

import { getAllMembers, deleteMember, scopeMemberDetailsForCurrentUser } from '../services/member-service.js';
import { deleteFromSpreadsheet } from '../services/sheets-backup-service.js';
import { searchMembers } from '../services/search-service.js';
import { sortMembers } from '../services/sort-service.js';
import {
  paginate,
  getTotalPages,
  getPaginationState,
  setPaginationState,
  resetPage,
} from '../services/pagination-service.js';
import {
  bindPaginationNav,
  populatePageSizeSelectFromDefaults,
  bindPageSizeSelectChange,
} from '../ui/pagination-nav-ui.js';
import { showToast, showLoader, hideLoader, showConfirmDialog, escapeHtml, formatDOB, calcAgeYears } from '../ui/ui-service.js';
import { PRADESHIKA_SABHA_OPTIONS, DASHBOARD_DEFAULTS, MESSAGES, VIEW_PAGE_FROM_PARAM, VIEW_REFERRER } from '../constants/constants.js';
import { isSuperAdmin } from '../services/auth-service.js';
import * as Logger from '../utils/logger.js';

/** @type {Array<Object>} All records loaded from Firestore */
let allRecords = [];

/** @type {Array<Object>} Records after search + sort */
let processedRecords = [];

/** @type {boolean} */
let isAdmin = false;

/**
 * Initializes the dashboard — loads data, binds events, renders initial view.
 * @param {boolean} admin - Whether the current user is an admin.
 */
export async function initDashboard(admin) {
  isAdmin = admin;
  bindSearchInput();
  bindSortControls();
  populatePageSizeSelect();
  bindPageSizeSelect();
  populateSabhaModal();
  bindExportActions();

  await loadAllRecords();
  if (isAdmin) {
    bindAdminActions();
  }
}

/**
 * If URL has ?sabha=KnownSabha, pre-fills search with that sabha, sorts by Pradeshika Sabha, and resets pagination.
 */
function applySabhaDeepLinkFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('sabha');
  if (!raw) return;

  const trimmed = raw.trim();
  const keys = Object.keys(PRADESHIKA_SABHA_OPTIONS);
  const match = keys.find((k) => k.toLowerCase() === trimmed.toLowerCase());
  if (!match) return;

  const searchInput = document.getElementById('searchInput');
  const sortField = document.getElementById('sortField');
  if (searchInput) searchInput.value = match;
  if (sortField) sortField.value = 'pradeshikaSabha';
  resetPage();
}

/**
 * Loads all records from Firestore and triggers the initial render.
 */
async function loadAllRecords() {
  showLoader(MESSAGES.LOADING_RECORDS);
  try {
    let records = await getAllMembers();
    records = scopeMemberDetailsForCurrentUser(records);

    allRecords = records;
    applySabhaDeepLinkFromUrl();
    processAndRender();
  } catch (err) {
    Logger.error('Failed to load records:', err);
    showToast(MESSAGES.LOAD_ERROR, 'error');
    renderEmptyState(MESSAGES.LOAD_ERROR_STATE);
  } finally {
    hideLoader();
  }
}

/**
 * Applies current search + sort + pagination and renders the table.
 */
function processAndRender() {
  const query = document.getElementById('searchInput')?.value || '';
  const sortField = document.getElementById('sortField')?.value || DASHBOARD_DEFAULTS.SORT_FIELD;
  const sortDir = document.getElementById('sortDirection')?.value || DASHBOARD_DEFAULTS.SORT_DIRECTION;

  let filtered = searchMembers(allRecords, query);
  filtered = sortMembers(filtered, sortField, sortDir);
  processedRecords = filtered;

  const { currentPage } = getPaginationState();
  const totalPages = getTotalPages(filtered.length);
  const page = Math.min(currentPage, totalPages);
  setPaginationState({ currentPage: page });

  const pageRecords = paginate(filtered, page);
  renderTable(pageRecords, (page - 1) * getPaginationState().pageSize);
  renderPagination(totalPages, page);
  updateRecordCount(filtered.length);
}

/* ================================================================== */
/*  Table Rendering                                                    */
/* ================================================================== */

/**
 * Action buttons cell for one member row (view, edit, PDF, share, delete).
 *
 * @param {Object} rec
 * @param {number} pdfDataIndex - `data-index` for the per-row PDF button (global list index).
 * @returns {string}
 */
function buildMemberMgmtActionsCellHtml(rec, pdfDataIndex) {
  return `<td class="auth-only">
          <div class="d-flex gap-1 flex-wrap">
            <a href="view?id=${rec.id}&${VIEW_PAGE_FROM_PARAM}=${VIEW_REFERRER.MEMBER_LIST}" class="btn btn-outline-primary btn-sm admin-only" title="View">
              <i class="bi bi-eye"></i>
            </a>
            <a href="view?id=${rec.id}&edit=1&${VIEW_PAGE_FROM_PARAM}=${VIEW_REFERRER.MEMBER_LIST}" class="btn btn-outline-secondary btn-sm admin-only" title="Edit">
              <i class="bi bi-pencil"></i>
            </a>
            <button class="btn btn-outline-info btn-sm btn-pdf" data-index="${pdfDataIndex}" title="Download PDF">
              <i class="bi bi-file-earmark-pdf"></i>
            </button>
            <button class="btn btn-outline-success btn-sm btn-share" data-id="${rec.id}" title="Copy Share Link">
              <i class="bi bi-share"></i>
            </button>
            <button class="btn btn-outline-danger btn-sm btn-delete admin-only" data-id="${rec.id}" title="Delete">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>`;
}

/**
 * Builds one `<tr>` of HTML for the member management table (name, sabha, counts, actions).
 *
 * @param {Object} rec - `member_details` document with `id` and nested fields.
 * @param {number} i - Zero-based index within the current page.
 * @param {number} startIndex - Global offset for row `#` and PDF button `data-index`.
 * @returns {string}
 */
function buildMemberMgmtTableRowHtml(rec, i, startIndex) {
  const pd = rec.personalDetails || {};
  const memberCount = (rec.members || []).length;
  const nonMemberCount = (rec.nonMembers || []).length;
  const ageStr = calcAgeYears(pd.dob);
  const ageLine = ageStr !== '—' ? `${ageStr} years` : '';
  return `
      <tr>
        <td>${startIndex + i + 1}</td>
        <td class="col-name">
          <a href="view?id=${rec.id}&${VIEW_PAGE_FROM_PARAM}=${VIEW_REFERRER.MEMBER_LIST}" class="text-decoration-none fw-medium member-mgmt-name-link">
            ${escapeHtml(pd.name || '—')}
          </a>
          <div class="text-muted small">${escapeHtml(pd.houseName || '')}</div>
        </td>
        <td>
          ${escapeHtml(pd.pradeshikaSabha || '—')}
          <div class="text-muted small">${escapeHtml((pd.address && pd.address.place) || '')}</div>
        </td>
        <td class="col-membership">
          ${memberCount} member${memberCount !== 1 ? 's' : ''}
          <div class="text-muted small">${nonMemberCount} non-member${nonMemberCount !== 1 ? 's' : ''}</div>
        </td>
        <td class="col-dob">
          ${escapeHtml(formatDOB(pd.dob))}
          <div class="text-muted small">${ageLine}</div>
        </td>
        <td>${escapeHtml(pd.phone || '—')}</td>
        ${buildMemberMgmtActionsCellHtml(rec, startIndex + i)}
      </tr>
    `;
}

/**
 * Renders the data table body with the given records.
 * @param {Array<Object>} records
 * @param {number} startIndex - Global index offset for row numbering.
 */
function renderTable(records, startIndex) {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${DASHBOARD_DEFAULTS.TABLE_COLSPAN}" class="text-center text-muted py-4">${MESSAGES.NO_RECORDS}</td></tr>`;
    return;
  }

  tbody.innerHTML = records
    .map((rec, i) => buildMemberMgmtTableRowHtml(rec, i, startIndex))
    .join('');

  bindDeleteButtons();
  bindPdfButtons();
  bindShareButtons();
}

/**
 * Renders pagination into `#paginationNav` using shared {@link bindPaginationNav}.
 *
 * @param {number} totalPages
 * @param {number} currentPage
 */
function renderPagination(totalPages, currentPage) {
  const nav = document.getElementById('paginationNav');
  bindPaginationNav(nav, totalPages, currentPage, (page) => {
    setPaginationState({ currentPage: page });
    processAndRender();
  });
}

/**
 * Updates the "Showing X records" counter text.
 * @param {number} total
 */
function updateRecordCount(total) {
  const el = document.getElementById('recordCount');
  if (el) el.textContent = `Showing ${total} record${total !== 1 ? 's' : ''}`;
}

/**
 * Renders an empty state message in the table body.
 * @param {string} message
 */
function renderEmptyState(message) {
  const tbody = document.getElementById('tableBody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="${DASHBOARD_DEFAULTS.TABLE_COLSPAN}" class="text-center text-muted py-4">${escapeHtml(message)}</td></tr>`;
  }
  updateRecordCount(0);
}

/* ================================================================== */
/*  Event Bindings                                                     */
/* ================================================================== */

/** Binds the search input with debounce. */
function bindSearchInput() {
  const input = document.getElementById('searchInput');
  if (!input) return;

  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      resetPage();
      processAndRender();
    }, DASHBOARD_DEFAULTS.SEARCH_DEBOUNCE_MS);
  });
}

/** Binds the sort field and direction selects. */
function bindSortControls() {
  ['sortField', 'sortDirection'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', () => {
      resetPage();
      processAndRender();
    });
  });
}

/**
 * Fills the page size dropdown via {@link populatePageSizeSelectFromDefaults}.
 */
function populatePageSizeSelect() {
  populatePageSizeSelectFromDefaults(document.getElementById('pageSizeSelect'));
}

/** Binds the page size control — resets to page 1 and re-renders on change. */
function bindPageSizeSelect() {
  bindPageSizeSelectChange(document.getElementById('pageSizeSelect'), (n) => {
    setPaginationState({ pageSize: n, currentPage: 1 });
    processAndRender();
  });
}

/** Binds delete buttons in the table. */
function bindDeleteButtons() {
  document.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const confirmed = await showConfirmDialog(MESSAGES.DELETE_CONFIRM);
      if (!confirmed) return;

      const rec = allRecords.find((r) => r.id === id);
      const pradeshikaSabha = rec?.personalDetails?.pradeshikaSabha || '';

      try {
        await deleteMember(id);
        // Spreadsheet backup (background); response logged to console only.
        deleteFromSpreadsheet(id, pradeshikaSabha).catch(() => {});
        allRecords = allRecords.filter((r) => r.id !== id);
        processAndRender();
        showToast(MESSAGES.DELETE_SUCCESS, 'success');
      } catch (err) {
        Logger.error('Delete failed:', err);
        showToast(MESSAGES.DELETE_FAIL, 'error');
      }
    });
  });
}

/** Binds per-row PDF download buttons. */
function bindPdfButtons() {
  document.querySelectorAll('.btn-pdf').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const index = parseInt(btn.dataset.index, 10);
      const record = processedRecords[index];
      if (!record) return;
      const { generateMemberPDF } = await import('../services/pdf-service.js');
      generateMemberPDF(record);
    });
  });
}

/** Binds per-row share (copy link) buttons. */
function bindShareButtons() {
  document.querySelectorAll('.btn-share').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const shareUrl = `${window.location.origin}/view?id=${id}&edit=share`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast(MESSAGES.SHARE_COPIED, 'success');
      }).catch(() => {
        showToast(MESSAGES.SHARE_COPY_FAIL + shareUrl, 'error');
      });
    });
  });
}

/** Binds PDF export triggers (available to any role with export_pdf action). */
function bindExportActions() {
  // Simple button for non-super-admins — exports all visible (already filtered) records
  const simpleBtn = document.getElementById('exportMyPDF');
  if (simpleBtn) {
    if (isSuperAdmin()) {
      simpleBtn.classList.add('d-none');
    }
    simpleBtn.addEventListener('click', async () => {
      const { generateFullDatasetPDF } = await import('../services/pdf-service.js');
      generateFullDatasetPDF(allRecords);
    });
  }

  // Super-admin dropdown options
  document.getElementById('exportFullPDF')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const { generateFullDatasetPDF } = await import('../services/pdf-service.js');
    generateFullDatasetPDF(allRecords);
  });

  document.getElementById('exportSabhaPDF')?.addEventListener('click', (e) => {
    e.preventDefault();
    const modal = document.getElementById('sabhaModal');
    if (modal && window.bootstrap) {
      new window.bootstrap.Modal(modal).show();
    }
  });

  document.getElementById('confirmSabhaPDF')?.addEventListener('click', async () => {
    const sabha = document.getElementById('sabhaSelect')?.value;
    if (!sabha) {
      showToast(MESSAGES.SELECT_SABHA, 'warning');
      return;
    }
    const modal = document.getElementById('sabhaModal');
    if (modal && window.bootstrap) {
      window.bootstrap.Modal.getInstance(modal)?.hide();
    }
    const { generateSabhaWisePDF } = await import('../services/pdf-service.js');
    generateSabhaWisePDF(allRecords, sabha);
  });
}

/** Binds admin-only actions. */
function bindAdminActions() {
}

/** Populates the sabha select in the PDF modal. */
function populateSabhaModal() {
  const select = document.getElementById('sabhaSelect');
  if (!select) return;
  Object.keys(PRADESHIKA_SABHA_OPTIONS).forEach((key) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key;
    select.appendChild(opt);
  });
}

/**
 * Returns the household directory rows after the latest search and sort (same slice the table is built from,
 * before pagination). Updates whenever `processAndRender` runs.
 *
 * @returns {Array<Object>} Filtered + sorted `member_details` documents.
 */
export function getProcessedRecords() {
  return processedRecords;
}
