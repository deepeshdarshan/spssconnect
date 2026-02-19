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
import { showToast, showLoader, hideLoader, showConfirmDialog, formatLabel, escapeHtml, formatDate } from './ui-service.js';
import { PRADESHIKA_SABHA_OPTIONS } from './constants.js';

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

  await loadAllRecords();
  if (isAdmin) {
    bindAdminActions();
  }
}

/**
 * Loads all records from Firestore and triggers the initial render.
 */
async function loadAllRecords() {
  showLoader('Loading records...');
  try {
    allRecords = await getAllMembers();
    processAndRender();
  } catch (err) {
    console.error('Failed to load records:', err);
    showToast('Failed to load records.', 'error');
    renderEmptyState('Error loading records.');
  } finally {
    hideLoader();
  }
}

/**
 * Applies current search + sort + pagination and renders the table.
 */
function processAndRender() {
  const query = document.getElementById('searchInput')?.value || '';
  const sortField = document.getElementById('sortField')?.value || 'name';
  const sortDir = document.getElementById('sortDirection')?.value || 'asc';

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
 * Renders the data table body with the given records.
 * @param {Array<Object>} records
 * @param {number} startIndex - Global index offset for row numbering.
 */
function renderTable(records, startIndex) {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map((rec, i) => {
    const pd = rec.personalDetails || {};
    const memberCount = (rec.members || []).length;
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
          ${escapeHtml(pd.pradeshikaSabha || '—')}
          <div class="text-muted small">${escapeHtml((pd.address && pd.address.place) || '')}</div>
        </td>
        <td>${escapeHtml(pd.phone || '—')}</td>
        <td>${memberCount}</td>
        <td class="small">${escapeHtml(formatDate((rec.metadata || {}).updatedAt))}</td>
        <td class="admin-only">
          <div class="d-flex gap-1">
            <a href="view?id=${rec.id}" class="btn btn-outline-primary btn-sm" title="View">
              <i class="bi bi-eye"></i>
            </a>
            <a href="view?id=${rec.id}&edit=1" class="btn btn-outline-secondary btn-sm" title="Edit">
              <i class="bi bi-pencil"></i>
            </a>
            <button class="btn btn-outline-danger btn-sm btn-delete" data-id="${rec.id}" title="Delete">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  bindDeleteButtons();
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
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">${escapeHtml(message)}</td></tr>`;
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
    }, 300);
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
      const confirmed = await showConfirmDialog('Are you sure you want to delete this record?');
      if (!confirmed) return;

      try {
        await deleteMember(id);
        allRecords = allRecords.filter((r) => r.id !== id);
        processAndRender();
        showToast('Record deleted.', 'success');
      } catch (err) {
        console.error('Delete failed:', err);
        showToast('Failed to delete record.', 'error');
      }
    });
  });
}

/** Binds admin-only actions (PDF export triggers, JSON import). */
function bindAdminActions() {
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
      showToast('Please select a Pradeshika Sabha.', 'warning');
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
