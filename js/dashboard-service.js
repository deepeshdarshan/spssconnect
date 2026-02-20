/**
 * @fileoverview Dashboard orchestration — loads records, wires search/sort/pagination, renders table.
 * @module dashboard-service
 */

import { getAllMembers, deleteMember } from './member-service.js';
import { searchMembers } from './search-service.js';
import { sortMembers } from './sort-service.js';
import {
  paginate,
  getTotalPages,
  getPaginationState,
  setPaginationState,
  resetPage,
} from './pagination-service.js';
import { showToast, showLoader, hideLoader, showConfirmDialog, escapeHtml, formatDOB } from './ui-service.js';
import { PRADESHIKA_SABHA_OPTIONS, DASHBOARD_DEFAULTS, MESSAGES } from './constants.js';
import { isSuperAdmin, getUserPradeshikaSabha } from './auth-service.js';

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
  populateSabhaModal();
  bindExportActions();

  await loadAllRecords();
  if (isAdmin) {
    bindAdminActions();
  }
}

/**
 * Loads all records from Firestore and triggers the initial render.
 */
async function loadAllRecords() {
  showLoader(MESSAGES.LOADING_RECORDS);
  try {
    let records = await getAllMembers();

    // Non-super-admin users only see records from their Pradeshika Sabha
    if (!isSuperAdmin()) {
      const userSabha = getUserPradeshikaSabha();
      if (userSabha) {
        records = records.filter((r) => {
          const sabha = (r.personalDetails || {}).pradeshikaSabha;
          return sabha === userSabha;
        });
      }
    }

    allRecords = records;
    processAndRender();
  } catch (err) {
    console.error('Failed to load records:', err);
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
 * Calculates age from a date-of-birth string (YYYY-MM-DD).
 * @param {string} dob
 * @returns {string} Age in years, or '—' if DOB is missing/invalid.
 */
function calcAge(dob) {
  if (!dob) return '—';
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return '—';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? String(age) : '—';
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

  tbody.innerHTML = records.map((rec, i) => {
    const pd = rec.personalDetails || {};
    const memberCount = (rec.members || []).length;
    const nonMemberCount = (rec.nonMembers || []).length;
    return `
      <tr>
        <td>${startIndex + i + 1}</td>
        <td>
          <a href="view?id=${rec.id}" class="text-decoration-none fw-medium">
            ${escapeHtml(pd.name || '—')}
          </a>
          <div class="text-muted small">${escapeHtml(pd.houseName || '')}</div>
        </td>
        <td>
          ${escapeHtml(formatDOB(pd.dob))}
          <div class="text-muted small">${calcAge(pd.dob) !== '—' ? calcAge(pd.dob) + ' years' : ''}</div>
        </td>
        <td>
          ${escapeHtml(pd.pradeshikaSabha || '—')}
          <div class="text-muted small">${escapeHtml((pd.address && pd.address.place) || '')}</div>
        </td>
        <td>${escapeHtml(pd.phone || '—')}</td>
        <td>
          ${memberCount} member${memberCount !== 1 ? 's' : ''}
          <div class="text-muted small">${nonMemberCount} non-member${nonMemberCount !== 1 ? 's' : ''}</div>
        </td>
        <td class="auth-only">
          <div class="d-flex gap-1 flex-wrap">
            <a href="view?id=${rec.id}" class="btn btn-outline-primary btn-sm admin-only" title="View">
              <i class="bi bi-eye"></i>
            </a>
            <a href="view?id=${rec.id}&edit=1" class="btn btn-outline-secondary btn-sm admin-only" title="Edit">
              <i class="bi bi-pencil"></i>
            </a>
            <button class="btn btn-outline-info btn-sm btn-pdf" data-index="${startIndex + i}" title="Download PDF">
              <i class="bi bi-file-earmark-pdf"></i>
            </button>
            <button class="btn btn-outline-success btn-sm btn-share" data-id="${rec.id}" title="Copy Share Link">
              <i class="bi bi-share"></i>
            </button>
            <button class="btn btn-outline-danger btn-sm btn-delete admin-only" data-id="${rec.id}" title="Delete">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  bindDeleteButtons();
  bindPdfButtons();
  bindShareButtons();
}

/**
 * Renders the pagination navigation.
 * @param {number} totalPages
 * @param {number} currentPage
 */
function renderPagination(totalPages, currentPage) {
  const nav = document.getElementById('paginationNav');
  if (!nav) return;

  if (totalPages <= 1) {
    nav.innerHTML = '';
    return;
  }

  let html = `
    <li class="page-item ${currentPage <= 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${currentPage - 1}">&laquo;</a>
    </li>
  `;

  for (let p = 1; p <= totalPages; p++) {
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

  nav.innerHTML = html;

  nav.querySelectorAll('.page-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = parseInt(link.dataset.page, 10);
      if (page >= 1 && page <= totalPages) {
        setPaginationState({ currentPage: page });
        processAndRender();
      }
    });
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

/** Binds delete buttons in the table. */
function bindDeleteButtons() {
  document.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const confirmed = await showConfirmDialog(MESSAGES.DELETE_CONFIRM);
      if (!confirmed) return;

      try {
        await deleteMember(id);
        allRecords = allRecords.filter((r) => r.id !== id);
        processAndRender();
        showToast(MESSAGES.DELETE_SUCCESS, 'success');
      } catch (err) {
        console.error('Delete failed:', err);
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
      const { generateMemberPDF } = await import('./pdf-service.js');
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
  document.getElementById('exportFullPDF')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const { generateFullDatasetPDF } = await import('./pdf-service.js');
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
    const { generateSabhaWisePDF } = await import('./pdf-service.js');
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
 * Returns the current processed records (for external use, e.g. PDF).
 * @returns {Array<Object>}
 */
export function getProcessedRecords() {
  return processedRecords;
}
