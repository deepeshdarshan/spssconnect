/**
 * @fileoverview Household directory page — orchestrates Firestore load, facet filters, cards, and export.
 * Filter math: {@link ../services/household-directory-filter-service.js}.
 * Shared facet DOM/HTML: {@link ../ui/advanced-search-facet-ui.js}.
 * Card markup: {@link ../ui/household-card-ui.js}.
 * @module dashboard-service
 */

import { getAllMembers, deleteMember, scopeMemberDetailsForCurrentUser, getMember } from '../services/member-service.js';
import { isSuperAdmin } from '../services/auth-service.js';
import {
  createEmptyHouseholdFilterState,
  applyHouseholdDirectoryFilters,
  householdFacetValueLabel,
  HOUSEHOLD_DIRECTORY_FACETS,
} from '../services/household-directory-filter-service.js';
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
import {
  buildFacetSectionHtml,
  buildFilterChipButtonHtml,
  buildFilterChipsRowHtml,
  syncFacetCheckboxesFromState,
  dismissFiltersOffcanvasOnMobile,
  bindDebouncedQuickSearchField,
} from '../ui/advanced-search-facet-ui.js';
import { showToast, setLoaderMessage, showConfirmDialog, escapeHtml, formatLabel } from '../ui/ui-service.js';
import { buildHouseholdCardHtml } from '../ui/household-card-ui.js';
import { buildResultsEmptyStateHtml } from '../ui/member-result-card-ui.js';
import {
  PRADESHIKA_SABHA_OPTIONS,
  RATION_CARD_OPTIONS,
  DASHBOARD_DEFAULTS,
  MESSAGES,
  VIEW_REFERRER,
  HOUSEHOLD_DIRECTORY,
} from '../constants/constants.js';
import * as Logger from '../utils/logger.js';

/** DOM ids for household directory filter/results chrome (`member-management.html`). */
const HOUSEHOLD_DIRECTORY_IDS = Object.freeze({
  filtersOffcanvas: 'householdDirectoryFiltersOffcanvas',
  filtersContainer: 'householdDirectoryFilters',
  filterChipsRow: 'householdDirectoryFilterChipsRow',
  clearChipsInline: 'householdDirectoryClearChipsInline',
  searchText: 'householdDirectorySearchText',
  searchTextClear: 'householdDirectorySearchTextClear',
  results: 'householdDirectoryResults',
});

/** @type {Array<Object>} All records loaded from Firestore */
let allRecords = [];

/** @type {Array<Object>} Records after search + filters + sort */
let processedRecords = [];

/** @type {boolean} */
let isAdmin = false;

/** @type {import('../services/household-directory-filter-service.js').HouseholdDirectoryFilterState} */
let filterState = createEmptyHouseholdFilterState();

const TITLES = HOUSEHOLD_DIRECTORY.FACET_SECTION_TITLES;

/** Bootstrap Icons class per household facet key. */
const FACET_ICONS = Object.freeze({
  sabha: 'bi-building',
  rationCard: 'bi-credit-card-2-front',
  healthInsurance: 'bi-heart-pulse',
  householdComposition: 'bi-people',
});

/**
 * Initializes the household directory — loads data, binds events, renders initial view.
 *
 * @param {boolean} admin - Whether the current user is an admin (enables admin-only card actions).
 * @returns {Promise<void>}
 */
export async function initDashboard(admin) {
  isAdmin = admin;
  initHouseholdDirectoryCopyAndHints();
  setPaginationState({ currentPage: 1, pageSize: DASHBOARD_DEFAULTS.PAGE_SIZE });
  filterState = createEmptyHouseholdFilterState();

  populateSortFieldSelect();
  populatePageSizeSelectFromDefaults(document.getElementById('pageSizeSelect'));
  renderFacetGroups();
  bindHouseholdDirectoryActions();

  await loadAllRecords();
  if (isAdmin) {
    bindAdminActions();
  }
}

/** Writes static copy from {@link HOUSEHOLD_DIRECTORY} into filter panel and header placeholders. */
function initHouseholdDirectoryCopyAndHints() {
  setLoaderMessage(HOUSEHOLD_DIRECTORY.LOADING_MESSAGE);

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setText('householdDirectoryPageSubtitle', HOUSEHOLD_DIRECTORY.PAGE_SUBTITLE);
  setText('householdDirectoryFilterPanelTitle', HOUSEHOLD_DIRECTORY.FILTER_PANEL_TITLE);
  setText('householdDirectoryFilterPanelSubtitle', HOUSEHOLD_DIRECTORY.FILTER_PANEL_SUBTITLE);
  setText('householdDirectoryFiltersOffcanvasLabel', HOUSEHOLD_DIRECTORY.FILTER_PANEL_TITLE);
  setText('householdDirectoryQuickSearchLabel', HOUSEHOLD_DIRECTORY.QUICK_SEARCH_LABEL);
  setText('householdDirectoryClearAllFiltersLabel', HOUSEHOLD_DIRECTORY.CLEAR_ALL_FILTERS_LABEL);
  setText('householdDirectoryOpenFiltersBtnLabel', HOUSEHOLD_DIRECTORY.FILTER_BUTTON_LABEL);
  setText('householdDirectorySortFieldLabel', HOUSEHOLD_DIRECTORY.SORT_FIELD_LABEL);

  const searchInput = document.getElementById(HOUSEHOLD_DIRECTORY_IDS.searchText);
  if (searchInput) searchInput.placeholder = HOUSEHOLD_DIRECTORY.QUICK_SEARCH_PLACEHOLDER;

  const openFiltersBtn = document.getElementById('householdDirectoryOpenFiltersBtn');
  const mobileFiltersHint = document.getElementById('householdDirectoryMobileFiltersHint');
  if (openFiltersBtn) {
    openFiltersBtn.setAttribute('aria-label', HOUSEHOLD_DIRECTORY.MOBILE_FILTERS_HELP);
  }
  if (mobileFiltersHint) {
    mobileFiltersHint.textContent = HOUSEHOLD_DIRECTORY.MOBILE_FILTERS_HELP;
  }
}

/** Populates `#sortField` from {@link HOUSEHOLD_DIRECTORY.SORT_FIELD_OPTIONS}. */
function populateSortFieldSelect() {
  const select = document.getElementById('sortField');
  if (!select) return;

  const defaultField = DASHBOARD_DEFAULTS.SORT_FIELD;
  select.innerHTML = Object.entries(HOUSEHOLD_DIRECTORY.SORT_FIELD_OPTIONS)
    .map(([value, label]) => {
      const selected = value === defaultField ? ' selected' : '';
      return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
    })
    .join('');
}

/**
 * If URL has `?sabha=KnownSabha`, pre-selects the sabha facet and sorts by Pradeshika Sabha.
 */
function applySabhaDeepLinkFromUrl() {
  if (!isSuperAdmin()) return;

  const params = new URLSearchParams(window.location.search);
  const raw = params.get('sabha');
  if (!raw) return;

  const trimmed = raw.trim();
  const keys = Object.keys(PRADESHIKA_SABHA_OPTIONS);
  const match = keys.find((k) => k.toLowerCase() === trimmed.toLowerCase());
  if (!match) return;

  filterState.sabha.add(match);
  syncHouseholdFacetCheckboxes();

  const sortField = document.getElementById('sortField');
  if (sortField) sortField.value = 'pradeshikaSabha';
  resetPage();
}

/**
 * Loads all records from Firestore and triggers the initial render.
 *
 * @returns {Promise<void>}
 */
async function loadAllRecords() {
  setLoaderMessage(HOUSEHOLD_DIRECTORY.LOADING_MESSAGE);
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

/** Applies filters, sort, pagination, and updates cards, chips, and count. */
function processAndRender() {
  const query = document.getElementById(HOUSEHOLD_DIRECTORY_IDS.searchText)?.value || '';
  const sortField = document.getElementById('sortField')?.value || DASHBOARD_DEFAULTS.SORT_FIELD;
  const sortDir = DASHBOARD_DEFAULTS.SORT_DIRECTION;

  let filtered = applyHouseholdDirectoryFilters(allRecords, query, filterState);
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
  renderChips();
}

/**
 * @param {string} facet
 * @param {string} value
 * @param {boolean} checked
 */
function toggleFilterValue(facet, value, checked) {
  const set = filterState[facet];
  if (!set) return;
  if (checked) set.add(value);
  else set.delete(value);
}

function syncHouseholdFacetCheckboxes() {
  syncFacetCheckboxesFromState(
    document.getElementById(HOUSEHOLD_DIRECTORY_IDS.filtersContainer),
    filterState,
  );
}

function renderChips() {
  const row = document.getElementById(HOUSEHOLD_DIRECTORY_IDS.filterChipsRow);
  if (!row) return;

  const chips = [];
  HOUSEHOLD_DIRECTORY_FACETS.forEach((facet) => {
    if (facet === 'sabha' && !isSuperAdmin()) return;
    const set = filterState[facet];
    if (!set) return;
    set.forEach((value) => {
      const sectionTitle = TITLES[facet] || facet;
      const label = `${sectionTitle}: ${householdFacetValueLabel(facet, value)}`;
      chips.push(buildFilterChipButtonHtml({ facet, value, label }));
    });
  });

  if (chips.length === 0) {
    row.innerHTML = '';
    row.hidden = true;
    return;
  }

  row.innerHTML = buildFilterChipsRowHtml({
    chipButtonsHtml: chips.join(''),
    activePrefix: HOUSEHOLD_DIRECTORY.CHIPS_ACTIVE_PREFIX,
    clearAllLabel: HOUSEHOLD_DIRECTORY.CHIPS_CLEAR_ALL,
    clearChipsButtonId: HOUSEHOLD_DIRECTORY_IDS.clearChipsInline,
  });
  row.hidden = false;
}

function renderFacetGroups() {
  const container = document.getElementById(HOUSEHOLD_DIRECTORY_IDS.filtersContainer);
  if (!container) return;

  let idCounter = 0;
  const sections = [
    ...(isSuperAdmin()
      ? [[TITLES.sabha, 'sabha', Object.keys(PRADESHIKA_SABHA_OPTIONS), (v) => v]]
      : []),
    [TITLES.rationCard, 'rationCard', Object.keys(RATION_CARD_OPTIONS), formatLabel],
    [TITLES.healthInsurance, 'healthInsurance', ['yes', 'no'], (v) => HOUSEHOLD_DIRECTORY.HEALTH_INSURANCE_LABELS[v] || v],
    [
      TITLES.householdComposition,
      'householdComposition',
      ['members', 'nonMembers'],
      (v) => HOUSEHOLD_DIRECTORY.HOUSEHOLD_COMPOSITION_LABELS[v] || v,
    ],
  ];

  const parts = [];
  for (const [title, facet, keys, labelFn] of sections) {
    const { html, nextId } = buildFacetSectionHtml({
      title,
      facet,
      valueKeys: keys,
      labelFn,
      idOffset: idCounter,
      inputIdPrefix: 'household_facet',
      facetIcon: FACET_ICONS[facet] || 'bi-sliders',
      isValueChecked: (f, v) => Boolean(filterState[f]?.has(v)),
    });
    parts.push(html);
    idCounter = nextId;
  }

  container.innerHTML = parts.join('');

  container.querySelectorAll('.advanced-search-facet-input').forEach((el) => {
    el.addEventListener('change', () => {
      const facet = el.getAttribute('data-facet');
      const value = el.getAttribute('data-value');
      if (!facet || value == null) return;
      toggleFilterValue(facet, value, el.checked);
      resetPage();
      processAndRender();
    });
  });
}

function clearAllFilters() {
  const inp = document.getElementById(HOUSEHOLD_DIRECTORY_IDS.searchText);
  if (inp) inp.value = '';
  const clearBtn = document.getElementById(HOUSEHOLD_DIRECTORY_IDS.searchTextClear);
  if (clearBtn) clearBtn.hidden = true;
  filterState = createEmptyHouseholdFilterState();
  syncHouseholdFacetCheckboxes();
  resetPage();
  processAndRender();
  dismissFiltersOffcanvasOnMobile(HOUSEHOLD_DIRECTORY_IDS.filtersOffcanvas);
}

function bindFilterChipRow() {
  const chipRow = document.getElementById(HOUSEHOLD_DIRECTORY_IDS.filterChipsRow);
  chipRow?.addEventListener('click', (ev) => {
    const chip = ev.target.closest('.advanced-search-chip');
    if (chip) {
      ev.preventDefault();
      const facet = chip.getAttribute('data-chip-facet');
      const value = chip.getAttribute('data-chip-value');
      if (facet == null || value == null) return;
      toggleFilterValue(facet, value, false);
      syncHouseholdFacetCheckboxes();
      resetPage();
      processAndRender();
      return;
    }
    if (ev.target.closest(`#${HOUSEHOLD_DIRECTORY_IDS.clearChipsInline}`)) {
      ev.preventDefault();
      clearAllFilters();
    }
  });
}

function bindHouseholdDirectoryActions() {
  bindDebouncedQuickSearchField({
    inputEl: document.getElementById(HOUSEHOLD_DIRECTORY_IDS.searchText),
    clearBtnEl: document.getElementById(HOUSEHOLD_DIRECTORY_IDS.searchTextClear),
    debounceMs: DASHBOARD_DEFAULTS.SEARCH_DEBOUNCE_MS,
    onQueryChange: () => {
      resetPage();
      processAndRender();
    },
  });
  bindFilterChipRow();

  document.getElementById('householdDirectoryClearAllFilters')?.addEventListener('click', () => {
    clearAllFilters();
  });

  document.getElementById('sortField')?.addEventListener('change', () => {
    resetPage();
    processAndRender();
  });

  bindPageSizeSelectChange(document.getElementById('pageSizeSelect'), (n) => {
    setPaginationState({ pageSize: n, currentPage: 1 });
    processAndRender();
  });

  bindExportActions();
  bindHouseholdCardActions();
}

/**
 * @param {Array<Object>} records
 * @param {number} startIndex - Global index offset for PDF `data-index`.
 */
function renderHouseholdCards(records, startIndex) {
  const container = document.getElementById(HOUSEHOLD_DIRECTORY_IDS.results);
  if (!container) return;

  if (records.length === 0) {
    container.innerHTML = buildResultsEmptyStateHtml(escapeHtml(MESSAGES.NO_RECORDS), 'household');
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

/** @param {number} total */
function updateRecordCount(total) {
  const el = document.getElementById('recordCount');
  if (!el) return;
  const unit = total === 1
    ? HOUSEHOLD_DIRECTORY.RESULTS_UNIT
    : HOUSEHOLD_DIRECTORY.RESULTS_UNIT_PLURAL;
  el.textContent = `${HOUSEHOLD_DIRECTORY.RESULTS_COUNT_PREFIX} ${total} ${unit}`;
}

/** @param {string} message */
function renderEmptyState(message) {
  const container = document.getElementById(HOUSEHOLD_DIRECTORY_IDS.results);
  if (container) {
    container.innerHTML = `<p class="text-muted py-4">${escapeHtml(message)}</p>`;
  }
  updateRecordCount(0);
  renderChips();
}

function bindHouseholdCardActions() {
  const container = document.getElementById(HOUSEHOLD_DIRECTORY_IDS.results);
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
      ev.stopPropagation();
      const id = pdfBtn.dataset.id;
      if (!id) return;
      let record = processedRecords.find((r) => r.id === id)
        || allRecords.find((r) => r.id === id);
      if (!record) {
        record = await getMember(id);
      }
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

function bindExportActions() {
  document.getElementById('exportMyPDF')?.addEventListener('click', async () => {
    const { generateHouseholdDirectoryPDF } = await import('../services/pdf-service.js');
    generateHouseholdDirectoryPDF(getProcessedRecords());
  });
}

function bindAdminActions() {
}

/**
 * Returns household directory rows after the latest filters and sort (before pagination).
 *
 * @returns {Array<Object>} Filtered + sorted `member_details` documents.
 */
export function getProcessedRecords() {
  return processedRecords;
}
