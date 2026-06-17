/**
 * @fileoverview Dashboard orchestration — loads records, wires search/sort/pagination, renders household cards.
 * @module dashboard-service
 */

import { getAllMembers, deleteMember, scopeMemberDetailsForCurrentUser } from '../services/member-service.js';
import { searchMembers, filterMembersBySabha, filterMembersByWelfare } from '../services/search-service.js';
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
import { showToast, setLoaderMessage, showConfirmDialog, escapeHtml, formatLabel } from '../ui/ui-service.js';
import { buildHouseholdCardHtml } from '../ui/household-card-ui.js';
import { PRADESHIKA_SABHA_OPTIONS, RATION_CARD_OPTIONS, DASHBOARD_DEFAULTS, MESSAGES, VIEW_REFERRER, HOUSEHOLD_DIRECTORY } from '../constants/constants.js';
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
  bindSabhaFilter();
  bindWelfareFilters();
  bindSortControls();
  populateSabhaFilter();
  populateWelfareFilters();
  populatePageSizeSelect();
  bindPageSizeSelect();
  populateSabhaModal();
  bindExportActions();
  bindHouseholdCardActions();

  await loadAllRecords();
  if (isAdmin) {
    bindAdminActions();
  }
}

/**
 * If URL has ?sabha=KnownSabha, pre-selects the sabha filter, sorts by Pradeshika Sabha, and resets pagination.
 */
function applySabhaDeepLinkFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('sabha');
  if (!raw) return;

  const trimmed = raw.trim();
  const keys = Object.keys(PRADESHIKA_SABHA_OPTIONS);
  const match = keys.find((k) => k.toLowerCase() === trimmed.toLowerCase());
  if (!match) return;

  const sabhaFilter = document.getElementById('sabhaFilter');
  const sortField = document.getElementById('sortField');
  if (sabhaFilter) sabhaFilter.value = match;
  if (sortField) sortField.value = 'pradeshikaSabha';
  resetPage();
}

/**
 * Loads all records from Firestore and triggers the initial render.
 * Updates the bootstrap loader message; dismiss is owned by {@link ../app-init.js app-init}.
 */
async function loadAllRecords() {
  setLoaderMessage(MESSAGES.LOADING_RECORDS);
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
  }
}

/**
 * Applies current search + sort + pagination and renders household cards.
 */
function processAndRender() {
  const query = document.getElementById('searchInput')?.value || '';
  const sabha = document.getElementById('sabhaFilter')?.value || '';
  const welfare = {
    healthInsurance: document.getElementById('healthInsuranceFilter')?.value || '',
    rationCardType: document.getElementById('rationCardFilter')?.value || '',
  };
  const sortField = document.getElementById('sortField')?.value || DASHBOARD_DEFAULTS.SORT_FIELD;
  const sortDir = DASHBOARD_DEFAULTS.SORT_DIRECTION;

  let filtered = searchMembers(allRecords, query);
  filtered = filterMembersBySabha(filtered, sabha);
  filtered = filterMembersByWelfare(filtered, welfare);
  filtered = sortMembers(filtered, sortField, sortDir);
  processedRecords = filtered;

  const { currentPage } = getPaginationState();
  const totalPages = getTotalPages(filtered.length);
  const page = Math.min(currentPage, totalPages);
  setPaginationState({ currentPage: page });

  const pageRecords = paginate(filtered, page);
  renderHouseholdCards(pageRecords, (page - 1) * getPaginationState().pageSize);
  renderPagination(totalPages, page);
  updateRecordCount(filtered.length);
}

/* ================================================================== */
/*  Card Rendering                                                     */
/* ================================================================== */

/**
 * Renders household directory cards for the current page.
 *
 * @param {Array<Object>} records
 * @param {number} startIndex - Global index offset for PDF `data-index`.
 */
function renderHouseholdCards(records, startIndex) {
  const container = document.getElementById('householdDirectoryResults');
  if (!container) return;

  if (records.length === 0) {
    container.innerHTML = `<p class="text-muted py-4">${escapeHtml(MESSAGES.NO_RECORDS)}</p>`;
    return;
  }

  container.innerHTML = records
    .map((rec, i) => buildHouseholdCardHtml(rec, {
      pdfDataIndex: startIndex + i,
      viewReferrer: VIEW_REFERRER.MEMBER_LIST,
    }))
    .join('');
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
 * Updates the "Showing X Households" counter text.
 * @param {number} total
 */
function updateRecordCount(total) {
  const el = document.getElementById('recordCount');
  if (!el) return;
  const unit = total === 1
    ? HOUSEHOLD_DIRECTORY.RESULTS_UNIT
    : HOUSEHOLD_DIRECTORY.RESULTS_UNIT_PLURAL;
  el.textContent = `${HOUSEHOLD_DIRECTORY.RESULTS_COUNT_PREFIX} ${total} ${unit}`;
}

/**
 * Renders an empty state message in the card results container.
 * @param {string} message
 */
function renderEmptyState(message) {
  const container = document.getElementById('householdDirectoryResults');
  if (container) {
    container.innerHTML = `<p class="text-muted py-4">${escapeHtml(message)}</p>`;
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

/** Binds the sabha quick-filter dropdown. */
function bindSabhaFilter() {
  document.getElementById('sabhaFilter')?.addEventListener('change', () => {
    resetPage();
    processAndRender();
  });
}

/** Binds family & welfare quick-filter dropdowns. */
function bindWelfareFilters() {
  ['healthInsuranceFilter', 'rationCardFilter'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', () => {
      resetPage();
      processAndRender();
    });
  });
}

/** Binds the sort field select. */
function bindSortControls() {
  document.getElementById('sortField')?.addEventListener('change', () => {
    resetPage();
    processAndRender();
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

/**
 * Delegated click handlers for delete, PDF, and share actions on household cards.
 * Bound once at init so re-renders do not stack listeners.
 */
function bindHouseholdCardActions() {
  const container = document.getElementById('householdDirectoryResults');
  if (!container) return;

  container.addEventListener('click', async (ev) => {
    const deleteBtn = ev.target.closest('.btn-delete');
    if (deleteBtn) {
      ev.preventDefault();
      const id = deleteBtn.dataset.id;
      const confirmed = await showConfirmDialog(MESSAGES.DELETE_CONFIRM);
      if (!confirmed) return;

      try {
        await deleteMember(id);
        allRecords = allRecords.filter((r) => r.id !== id);
        processAndRender();
        showToast(MESSAGES.DELETE_SUCCESS, 'success');
      } catch (err) {
        Logger.error('Delete failed:', err);
        showToast(MESSAGES.DELETE_FAIL, 'error');
      }
      return;
    }

    const pdfBtn = ev.target.closest('.btn-pdf');
    if (pdfBtn) {
      ev.preventDefault();
      const index = parseInt(pdfBtn.dataset.index, 10);
      const record = processedRecords[index];
      if (!record) return;
      const { generateMemberPDF } = await import('../services/pdf-service.js');
      generateMemberPDF(record);
      return;
    }

    const shareBtn = ev.target.closest('.btn-share');
    if (shareBtn) {
      ev.preventDefault();
      const id = shareBtn.dataset.id;
      const shareUrl = `${window.location.origin}/view?id=${id}&edit=share`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast(MESSAGES.SHARE_COPIED, 'success');
      }).catch(() => {
        showToast(MESSAGES.SHARE_COPY_FAIL + shareUrl, 'error');
      });
    }
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

/** Populates the sabha quick-filter and PDF modal selects. */
function populateSabhaFilter() {
  const filter = document.getElementById('sabhaFilter');
  if (filter) {
    Object.keys(PRADESHIKA_SABHA_OPTIONS).forEach((key) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = key;
      filter.appendChild(opt);
    });
  }
}

/** Populates ration card options in the welfare quick-filter. */
function populateWelfareFilters() {
  const rationSelect = document.getElementById('rationCardFilter');
  if (!rationSelect) return;

  Object.keys(RATION_CARD_OPTIONS).forEach((key) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = formatLabel(key);
    rationSelect.appendChild(opt);
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
 * Returns the household directory rows after the latest search and sort (same slice the cards are built from,
 * before pagination). Updates whenever `processAndRender` runs.
 *
 * @returns {Array<Object>} Filtered + sorted `member_details` documents.
 */
export function getProcessedRecords() {
  return processedRecords;
}
