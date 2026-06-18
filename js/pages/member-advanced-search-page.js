/**
 * @fileoverview Advanced member search page — wires Firestore-backed data (via
 * {@link ../services/member-service.js}), facet DOM, chips, and card rendering.
 * Filtering math lives in {@link ../services/member-person-search.js}; shared facet DOM in
 * {@link ../ui/advanced-search-facet-ui.js}; pagination markup in {@link ../ui/pagination-nav-ui.js}.
 * during bootstrap; overlay dismiss is owned by {@link ../app-init.js app-init}. Card avatars without photos use
 * {@link ../utils/member-avatar-initials.js}.
 *
 * @module member-advanced-search-page
 */

import { getAllMembers, scopeMemberDetailsForCurrentUser } from '../services/member-service.js';
import { isSuperAdmin } from '../services/auth-service.js';
import {
  DASHBOARD_DEFAULTS,
  ENABLE_PHOTO_UPLOAD,
  MESSAGES,
  ADVANCED_MEMBER_SEARCH,
  ADVANCED_SEARCH_AGE_BUCKET_IDS,
  PRADESHIKA_SABHA_OPTIONS,
  MEMBER_OCCUPATION_OPTIONS,
  BLOOD_GROUP_OPTIONS,
  GENDER_OPTIONS,
  MEMBERSHIP_OPTIONS,
  EDUCATION_OPTIONS,
  VIEW_PAGE_FROM_PARAM,
  VIEW_REFERRER,
} from '../constants/constants.js';
import {
  paginate,
  getTotalPages,
  getPaginationState,
  setPaginationState,
  resetPage,
} from '../services/pagination-service.js';
import {
  createEmptyFilterState,
  expandToPersonRows,
  applyPersonFilters,
  applyTextFilter,
  facetValueLabel,
  formatHouseholdAddress,
  PERSON_SEARCH_FACETS,
} from '../services/member-person-search.js';
import {
  buildCardDetailRowHtml,
  buildCardContactFooterHtml,
  buildResultsEmptyStateHtml,
} from '../ui/member-result-card-ui.js';
import {
  buildFacetSectionHtml,
  buildFilterChipButtonHtml,
  buildFilterChipsRowHtml,
  syncFacetCheckboxesFromState,
  dismissFiltersOffcanvasOnMobile,
  bindDebouncedQuickSearchField,
} from '../ui/advanced-search-facet-ui.js';
import {
  bindPaginationNav,
  populatePageSizeSelectFromDefaults,
  bindPageSizeSelectChange,
} from '../ui/pagination-nav-ui.js';
import { showToast, setLoaderMessage, escapeHtml, formatLabel, formatDOB, calcAgeYears } from '../ui/ui-service.js';
import * as Logger from '../utils/logger.js';
import {
  getMemberAvatarInitials,
  getMemberAvatarSwatchIndex,
} from '../utils/member-avatar-initials.js';

/** @type {import('../services/member-person-search.js').PersonSearchRow[]} */
let allPersonRows = [];
/** @type {Record<string, Set<string>>} */
let filterState = createEmptyFilterState();

const TITLES = ADVANCED_MEMBER_SEARCH.FACET_SECTION_TITLES;

/** Bootstrap Icons class per facet key (visual only; keys must match {@link PERSON_SEARCH_FACETS}). */
const FACET_ICONS = Object.freeze({
  sabha: 'bi-building',
  occupation: 'bi-briefcase',
  bloodGroup: 'bi-droplet',
  gender: 'bi-person',
  age: 'bi-hourglass-split',
  membership: 'bi-award',
  education: 'bi-mortarboard',
});

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

/** Syncs checkbox DOM with `filterState` after chip removal or clear-all. */
function syncFilterCheckboxesFromState() {
  syncFacetCheckboxesFromState(document.getElementById('advancedSearchFilters'), filterState);
}

function membershipFilterActive() {
  return filterState.membership && filterState.membership.size > 0;
}

function updateMembershipHintVisibility() {
  const hint = document.getElementById('membershipFilterHint');
  if (hint) hint.classList.toggle('d-none', !membershipFilterActive());
}

function renderChips() {
  const row = document.getElementById('filterChipsRow');
  if (!row) return;

  const chips = [];
  PERSON_SEARCH_FACETS.forEach((facet) => {
    if (facet === 'sabha' && !isSuperAdmin()) return;
    const set = filterState[facet];
    if (!set) return;
    set.forEach((value) => {
      const sectionTitle = TITLES[facet] || facet;
      const label = `${sectionTitle}: ${facetValueLabel(facet, value, formatLabel)}`;
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
    activePrefix: ADVANCED_MEMBER_SEARCH.CHIPS_ACTIVE_PREFIX,
    clearAllLabel: ADVANCED_MEMBER_SEARCH.CHIPS_CLEAR_ALL,
    clearChipsButtonId: 'clearChipsInline',
  });
  row.hidden = false;
}

/**
 * Renders all facet groups into `#advancedSearchFilters` and binds checkbox changes.
 */
function renderFacetGroups() {
  const container = document.getElementById('advancedSearchFilters');
  if (!container) return;

  let idCounter = 0;
  const sections = [
    ...(isSuperAdmin()
      ? [[TITLES.sabha, 'sabha', Object.keys(PRADESHIKA_SABHA_OPTIONS), (v) => v]]
      : []),
    [TITLES.occupation, 'occupation', Object.keys(MEMBER_OCCUPATION_OPTIONS), formatLabel],
    [TITLES.bloodGroup, 'bloodGroup', Object.keys(BLOOD_GROUP_OPTIONS), (v) => v],
    [TITLES.gender, 'gender', Object.keys(GENDER_OPTIONS), formatLabel],
    [
      TITLES.age,
      'age',
      [...ADVANCED_SEARCH_AGE_BUCKET_IDS],
      (v) => ADVANCED_MEMBER_SEARCH.AGE_BUCKET_LABELS[v] || v,
    ],
    [TITLES.membership, 'membership', Object.keys(MEMBERSHIP_OPTIONS), formatLabel],
    [TITLES.education, 'education', Object.keys(EDUCATION_OPTIONS), formatLabel],
  ];

  const parts = [];
  for (const [title, facet, keys, labelFn] of sections) {
    const { html, nextId } = buildFacetSectionHtml({
      title,
      facet,
      valueKeys: keys,
      labelFn,
      idOffset: idCounter,
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

/** Below `md`, filters use Bootstrap offcanvas; hide the drawer after clear-all on narrow viewports. */
function dismissAdvancedSearchFiltersOffcanvasOnMobile() {
  dismissFiltersOffcanvasOnMobile('advancedSearchFiltersOffcanvas');
}

function clearAllFilters() {
  const inp = document.getElementById('advancedSearchText');
  if (inp) inp.value = '';
  const clearBtn = document.getElementById('advancedSearchTextClear');
  if (clearBtn) clearBtn.hidden = true;
  const holdsSpssYes = document.getElementById('advancedSearchHoldsSpssPositionYes');
  if (holdsSpssYes) holdsSpssYes.checked = false;
  filterState = createEmptyFilterState();
  syncFilterCheckboxesFromState();
  resetPage();
  processAndRender();
  dismissAdvancedSearchFiltersOffcanvasOnMobile();
}

/**
 * Syncs quick-search clear button visibility and wires debounced search + clear action.
 */
function bindQuickSearchField() {
  bindDebouncedQuickSearchField({
    inputEl: document.getElementById('advancedSearchText'),
    clearBtnEl: document.getElementById('advancedSearchTextClear'),
    debounceMs: DASHBOARD_DEFAULTS.SEARCH_DEBOUNCE_MS,
    onQueryChange: () => {
      resetPage();
      processAndRender();
    },
  });
}

/** Wires SPSS-position “Yes only” quick filter checkbox next to Quick search. */
function bindHoldsSpssPositionQuickFilter() {
  const cb = document.getElementById('advancedSearchHoldsSpssPositionYes');
  const headingText = document.getElementById('advancedSearchHoldsSpssPositionHeadingText');
  const label = document.getElementById('advancedSearchHoldsSpssPositionYesLabel');
  if (headingText) headingText.textContent = ADVANCED_MEMBER_SEARCH.HOLDS_SPSS_POSITION_QUICK_FILTER_HEADING;
  if (label) label.textContent = ADVANCED_MEMBER_SEARCH.HOLDS_SPSS_POSITION_QUICK_FILTER;
  if (!cb) return;
  cb.addEventListener('change', () => {
    resetPage();
    processAndRender();
  });
}

/**
 * @param {import('../services/member-person-search.js').PersonSearchRow[]} rows
 * @returns {import('../services/member-person-search.js').PersonSearchRow[]}
 */
function sortByName(rows) {
  return [...rows].sort((a, b) => {
    const na = String(a.person?.name ?? '').toLowerCase();
    const nb = String(b.person?.name ?? '').toLowerCase();
    if (na < nb) return -1;
    if (na > nb) return 1;
    return String(a.recordId).localeCompare(String(b.recordId));
  });
}

/**
 * Renders the card thumbnail: member photo when enabled and present, otherwise initials in a colored
 * circle on the standard muted placeholder background.
 *
 * @param {{ name?: string, photoURL?: string }} person - Person sub-object from a search row.
 * @returns {string} HTML snippet for `.advanced-search-card__avatar`.
 */
function buildCardThumbHtml(person) {
  const photoOk = ENABLE_PHOTO_UPLOAD && person.photoURL;
  if (photoOk) {
    return `<img src="${escapeHtml(person.photoURL)}" alt="" class="advanced-search-card__photo">`;
  }
  const displayName = String(person?.name ?? '').trim();
  const initials = getMemberAvatarInitials(person?.name);
  const swatch = getMemberAvatarSwatchIndex(displayName || initials);
  const esc = escapeHtml;
  return `<div class="advanced-search-card__placeholder" aria-hidden="true"><span class="advanced-search-card__initials advanced-search-card__initials--swatch-${swatch}">${esc(initials)}</span></div>`;
}

/**
 * Date of birth (calendar icon) and age in years (hourglass icon) for advanced search cards.
 *
 * @param {string|undefined} dob
 * @returns {string} HTML snippet or empty string when nothing to show.
 */
function buildCardDobAgeHtml(dob) {
  const dobDisp = formatDOB(dob);
  const age = calcAgeYears(dob);
  const chips = [];
  if (dobDisp !== '—') {
    chips.push(
      `<span class="advanced-search-card__meta-chip"><i class="bi bi-calendar3" aria-hidden="true"></i>${escapeHtml(dobDisp)}</span>`,
    );
  }
  if (age !== '—') {
    chips.push(
      `<span class="advanced-search-card__meta-chip"><i class="bi bi-hourglass-split" aria-hidden="true"></i>${escapeHtml(`${age} years`)}</span>`,
    );
  }
  if (chips.length === 0) return '';
  return `<p class="advanced-search-card__meta">${chips.join('')}</p>`;
}

/**
 * Builds one hotel-style result card (photo, name, DOB/age, address, sabha, occupation + optional
 * expertise on one line, optional SPSS position, phone, email, view link).
 *
 * @param {import('../services/member-person-search.js').PersonSearchRow} row
 * @returns {string} HTML snippet (caller joins; values escaped where user-controlled).
 */
function buildPersonResultCardHtml(row) {
  const pd = row.householdPd || {};
  const p = row.person || {};
  const name = p.name || '—';
  const addr = formatHouseholdAddress(pd);
  const sabha = pd.pradeshikaSabha || '—';
  const phoneStr = String(p.phone ?? '');
  const emailStr = String(p.email ?? '');

  const occRaw = String(p.occupation ?? '').trim();
  const occDisp = occRaw ? escapeHtml(formatLabel(p.occupation)) : '—';
  const expertiseRaw = String(p.areaOfExpertise ?? '').trim();
  const expertiseDisp = expertiseRaw ? escapeHtml(expertiseRaw) : '';
  const occupationExpertiseHtml = expertiseDisp
    ? `${occDisp}<span class="advanced-search-card__detail-sep" aria-hidden="true"> · </span><span class="advanced-search-card__detail-inline-sub advanced-search-card__detail-inline-sub--expertise"><i class="bi bi-stars advanced-search-card__detail-inline-icon" aria-hidden="true"></i><span>${expertiseDisp}</span></span>`
    : occDisp;
  const occupationExpertiseRow = buildCardDetailRowHtml('bi-briefcase', occupationExpertiseHtml);

  const positionName = String(p.spssPositionName ?? '').trim();
  const positionRow =
    p.holdsSpssPosition && positionName
      ? buildCardDetailRowHtml(
          'bi-pin-angle',
          escapeHtml(positionName),
          'advanced-search-card__detail--spss-position',
        )
      : '';

  const nonMemberBadge =
    row.role === 'nonMember'
      ? `<span class="advanced-search-card__badge advanced-search-card__badge--non-member">${escapeHtml(ADVANCED_MEMBER_SEARCH.BADGE_NON_MEMBER)}</span>`
      : '';

  const viewHref = `view?id=${escapeHtml(row.recordId)}&${VIEW_PAGE_FROM_PARAM}=${VIEW_REFERRER.ADVANCED_SEARCH}`;
  const viewAria =
    name && name !== '—'
      ? `${ADVANCED_MEMBER_SEARCH.STRETCHED_LINK_ARIA_BASE}${ADVANCED_MEMBER_SEARCH.STRETCHED_LINK_ARIA_NAME_PREFIX}${name}`
      : ADVANCED_MEMBER_SEARCH.STRETCHED_LINK_ARIA_BASE;

  return `
    <article class="advanced-search-card card-spss" role="listitem">
      <div class="advanced-search-card__main">
        <div class="advanced-search-card__avatar">${buildCardThumbHtml(p)}</div>
        <div class="advanced-search-card__header-body">
          <div class="advanced-search-card__header">
            <h2 class="advanced-search-card__title h6 mb-0">
              <a href="${viewHref}" class="advanced-search-card__name-link stretched-link" aria-label="${escapeHtml(viewAria)}">${escapeHtml(name)}</a>
              ${nonMemberBadge}
            </h2>
            <span class="advanced-search-card__chevron" aria-hidden="true"><i class="bi bi-chevron-right"></i></span>
          </div>
          ${buildCardDobAgeHtml(p.dob)}
        </div>
      </div>
      <div class="advanced-search-card__details">
        ${buildCardDetailRowHtml('bi-geo-alt', escapeHtml(addr) || '—')}
        ${buildCardDetailRowHtml('bi-building', escapeHtml(sabha))}
        ${occupationExpertiseRow}
        ${positionRow}
      </div>
      ${buildCardContactFooterHtml(phoneStr, emailStr)}
    </article>
  `;
}

function renderResults(rows) {
  const container = document.getElementById('advancedSearchResults');
  if (!container) return;

  if (rows.length === 0) {
    container.innerHTML = buildResultsEmptyStateHtml(escapeHtml(MESSAGES.NO_RECORDS), 'members');
    return;
  }

  container.innerHTML = rows.map((row) => buildPersonResultCardHtml(row)).join('');
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

/** Updates `#advancedSearchRecordCount` using {@link ADVANCED_MEMBER_SEARCH} copy. */
function updateRecordCount(total) {
  const el = document.getElementById('advancedSearchRecordCount');
  if (!el) return;
  const unit = total === 1 ? ADVANCED_MEMBER_SEARCH.RESULTS_UNIT_MEMBER : ADVANCED_MEMBER_SEARCH.RESULTS_UNIT_MEMBERS;
  el.textContent = `${ADVANCED_MEMBER_SEARCH.RESULTS_COUNT_PREFIX} ${total} ${unit}`;
}

/**
 * Applies facet + quick-search filters and name sort (full result set, not paginated).
 *
 * @returns {import('../services/member-person-search.js').PersonSearchRow[]}
 */
function getFilteredSortedPersonRows() {
  const text = document.getElementById('advancedSearchText')?.value || '';
  const holdsSpssOnly = Boolean(document.getElementById('advancedSearchHoldsSpssPositionYes')?.checked);
  let filtered = applyPersonFilters(allPersonRows, filterState);
  filtered = applyTextFilter(filtered, text);
  if (holdsSpssOnly) {
    filtered = filtered.filter((row) => Boolean(row.person?.holdsSpssPosition));
  }
  return sortByName(filtered);
}

/** Applies text + facet filters, paginates, and refreshes chips and result cards. */
function processAndRender() {
  const filtered = getFilteredSortedPersonRows();

  const { currentPage, pageSize } = getPaginationState();
  const totalPages = getTotalPages(filtered.length, pageSize);
  const page = Math.min(currentPage, totalPages);
  setPaginationState({ currentPage: page });

  const pageRows = paginate(filtered, page, pageSize);
  renderResults(pageRows);
  renderPagination(totalPages, page);
  updateRecordCount(filtered.length);
  renderChips();
  updateMembershipHintVisibility();
}

/**
 * Loads members via {@link ../services/member-service.js getAllMembers}, scopes fields for the
 * signed-in user, expands households into person rows (`allPersonRows`), then runs `processAndRender`.
 * On failure: logs, toast, error markup in `#advancedSearchResults`, and count reset (does not rethrow).
 *
 * @returns {Promise<void>}
 */
async function loadRecords() {
  try {
    const raw = await getAllMembers();
    const records = scopeMemberDetailsForCurrentUser(raw);
    allPersonRows = expandToPersonRows(records);
    processAndRender();
  } catch (err) {
    Logger.error('Advanced search load failed:', err);
    showToast(MESSAGES.LOAD_ERROR, 'error');
    const container = document.getElementById('advancedSearchResults');
    if (container) {
      container.innerHTML = `<p class="text-danger py-4">${escapeHtml(MESSAGES.LOAD_ERROR_STATE)}</p>`;
    }
    updateRecordCount(0);
  }
}

/**
 * Writes the membership facet hint into `#membershipFilterHint` from {@link ADVANCED_MEMBER_SEARCH}.
 *
 * @returns {void}
 */
function applyMembershipHintCopy() {
  const hint = document.getElementById('membershipFilterHint');
  if (hint) hint.textContent = ADVANCED_MEMBER_SEARCH.MEMBERSHIP_FILTER_HINT;
}

/**
 * Applies mobile-only filter entry copy: visible hint beside the funnel and matching `aria-label`
 * on `#advancedSearchOpenFiltersBtn`, both from {@link ADVANCED_MEMBER_SEARCH.MOBILE_FILTERS_HELP}.
 * No-ops when elements are absent (e.g. DOM not yet rendered).
 *
 * @returns {void}
 */
function applyMobileFiltersHelpCopy() {
  const openFiltersBtn = document.getElementById('advancedSearchOpenFiltersBtn');
  const mobileFiltersHint = document.getElementById('advancedSearchMobileFiltersHint');
  if (openFiltersBtn) {
    openFiltersBtn.setAttribute('aria-label', ADVANCED_MEMBER_SEARCH.MOBILE_FILTERS_HELP);
  }
  if (mobileFiltersHint) {
    mobileFiltersHint.textContent = ADVANCED_MEMBER_SEARCH.MOBILE_FILTERS_HELP;
  }
}

/**
 * Binds delegated clicks on the chip row (remove one filter or clear all).
 */
function bindFilterChipRow() {
  const chipRow = document.getElementById('filterChipsRow');
  chipRow?.addEventListener('click', (ev) => {
    const chip = ev.target.closest('.advanced-search-chip');
    if (chip) {
      ev.preventDefault();
      const facet = chip.getAttribute('data-chip-facet');
      const value = chip.getAttribute('data-chip-value');
      if (facet == null || value == null) return;
      toggleFilterValue(facet, value, false);
      syncFilterCheckboxesFromState();
      resetPage();
      processAndRender();
      return;
    }
    if (ev.target.closest('#clearChipsInline')) {
      ev.preventDefault();
      clearAllFilters();
    }
  });
}

/**
 * Sets loader copy and static hint strings (membership + mobile filters help).
 *
 * @returns {void}
 */
function initAdvancedSearchLoaderAndHints() {
  setLoaderMessage(ADVANCED_MEMBER_SEARCH.LOADING_MESSAGE);
  applyMembershipHintCopy();
  applyMobileFiltersHelpCopy();
}

/**
 * Resets pagination and empty facet filter state before building facet UI.
 *
 * @returns {void}
 */
function resetAdvancedSearchPaginationAndFilters() {
  setPaginationState({ currentPage: 1, pageSize: DASHBOARD_DEFAULTS.PAGE_SIZE });
  filterState = createEmptyFilterState();
}

/**
 * Builds facet checkbox sections and page-size select from defaults.
 *
 * @returns {void}
 */
function renderAdvancedSearchFacetChrome() {
  populatePageSizeSelectFromDefaults(document.getElementById('pageSizeSelect'));
  renderFacetGroups();
}

/**
 * Wires page size, quick search, SPSS quick filter, chips, clear-all, and PDF export.
 *
 * @returns {void}
 */
function bindAdvancedSearchToolbarAndResultsActions() {
  bindPageSizeSelectChange(document.getElementById('pageSizeSelect'), (n) => {
    setPaginationState({ pageSize: n, currentPage: 1 });
    processAndRender();
  });

  bindQuickSearchField();
  bindHoldsSpssPositionQuickFilter();

  document.getElementById('clearAllFilters')?.addEventListener('click', () => {
    clearAllFilters();
  });

  bindFilterChipRow();

  document.getElementById('advancedSearchExportPdf')?.addEventListener('click', async () => {
    const { generateAdvancedSearchPDF } = await import('../services/pdf-service.js');
    generateAdvancedSearchPDF(getFilteredSortedPersonRows());
  });
}

/**
 * Initializes the advanced member search page: hint copy, pagination, facet DOM, debounced
 * quick search, filter chips, and the initial Firestore load.
 *
 * Side effects: updates `#loadingOverlay` message via {@link ../ui/ui-service.js setLoaderMessage};
 * mutates module `allPersonRows` and
 * `filterState`; binds listeners on `#pageSizeSelect`, `#advancedSearchText`,
 * `#advancedSearchHoldsSpssPositionYes`, `#clearAllFilters`,
 * and the chip row; calls {@link applyMembershipHintCopy} and {@link applyMobileFiltersHelpCopy}.
 *
 * @returns {Promise<void>}
 */
export async function initAdvancedMemberSearch() {
  initAdvancedSearchLoaderAndHints();
  resetAdvancedSearchPaginationAndFilters();
  renderAdvancedSearchFacetChrome();
  bindAdvancedSearchToolbarAndResultsActions();
  await loadRecords();
}
