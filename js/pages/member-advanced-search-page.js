/**
 * @fileoverview Advanced member search page — wires Firestore-backed data (via
 * {@link ../services/member-service.js}), facet DOM, chips, and card rendering.
 * Filtering math lives in {@link ../services/member-person-search.js}; pagination
 * markup in {@link ../ui/pagination-nav-ui.js}. Page init uses {@link ../ui/ui-service.js showLoader}
 * for the full bootstrap including the initial load. Card avatars without photos use
 * {@link ../utils/member-avatar-initials.js}.
 *
 * @module member-advanced-search-page
 */

import { getAllMembers, scopeMemberDetailsForCurrentUser } from '../services/member-service.js';
import {
  DASHBOARD_DEFAULTS,
  ENABLE_PHOTO_UPLOAD,
  MESSAGES,
  ADVANCED_MEMBER_SEARCH,
  PRADESHIKA_SABHA_OPTIONS,
  MEMBER_OCCUPATION_OPTIONS,
  BLOOD_GROUP_OPTIONS,
  GENDER_OPTIONS,
  MEMBERSHIP_OPTIONS,
  EDUCATION_OPTIONS,
  RATION_CARD_OPTIONS,
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
  whatsappHref,
  PERSON_SEARCH_FACETS,
} from '../services/member-person-search.js';
import {
  bindPaginationNav,
  populatePageSizeSelectFromDefaults,
  bindPageSizeSelectChange,
} from '../ui/pagination-nav-ui.js';
import { showToast, showLoader, hideLoader, escapeHtml, formatLabel, formatDOB, calcAgeYears } from '../ui/ui-service.js';
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
  document.querySelectorAll('.advanced-search-facet-input').forEach((el) => {
    const facet = el.getAttribute('data-facet');
    const value = el.getAttribute('data-value');
    if (!facet || value == null) return;
    const set = filterState[facet];
    el.checked = Boolean(set && set.has(value));
  });
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
    const set = filterState[facet];
    if (!set) return;
    set.forEach((value) => {
      const sectionTitle = TITLES[facet] || facet;
      const label = `${sectionTitle}: ${facetValueLabel(facet, value, formatLabel)}`;
      chips.push(`
        <button type="button" class="advanced-search-chip btn btn-sm btn-outline-secondary"
          data-chip-facet="${escapeHtml(facet)}" data-chip-value="${escapeHtml(value)}" title="Remove filter">
          <span>${escapeHtml(label)}</span>
          <i class="bi bi-x-lg ms-1" aria-hidden="true"></i>
        </button>
      `);
    });
  });

  if (chips.length === 0) {
    row.innerHTML = '';
    row.hidden = true;
    return;
  }

  row.innerHTML = `
    <div class="d-flex flex-wrap align-items-center gap-2">
      <span class="small text-muted me-1">${escapeHtml(ADVANCED_MEMBER_SEARCH.CHIPS_ACTIVE_PREFIX)}</span>
      ${chips.join('')}
      <button type="button" class="btn btn-link btn-sm p-0" id="clearChipsInline">${escapeHtml(ADVANCED_MEMBER_SEARCH.CHIPS_CLEAR_ALL)}</button>
    </div>
  `;
  row.hidden = false;
}

/**
 * @param {string} facet
 * @param {string} value
 * @param {string} label
 * @param {number} idNum - Stable unique id suffix for this checkbox.
 */
function buildFacetCheckboxHtml(facet, value, label, idNum) {
  const esc = escapeHtml;
  const id = `facet_${facet}_${idNum}`;
  const checked = filterState[facet]?.has(value) ? 'checked' : '';
  return `
    <div class="form-check form-check-sm">
      <input class="form-check-input advanced-search-facet-input" type="checkbox"
        id="${esc(id)}" data-facet="${esc(facet)}" data-value="${esc(value)}" ${checked}>
      <label class="form-check-label small" for="${esc(id)}">${esc(label)}</label>
    </div>`;
}

/**
 * @param {string} title
 * @param {string} facet
 * @param {Array<string>} valueKeys
 * @param {(v: string) => string} labelFn
 * @param {number} idOffset - Starting index for checkbox ids.
 * @returns {{ html: string, nextId: number }}
 */
function buildFacetSectionHtml(title, facet, valueKeys, labelFn, idOffset) {
  let n = idOffset;
  const body = valueKeys.map((val) => {
    n += 1;
    return buildFacetCheckboxHtml(facet, val, labelFn(val), n);
  }).join('');
  const esc = escapeHtml;
  return {
    html: `
      <div class="advanced-search-facet-group mb-3">
        <h3 class="small fw-semibold text-muted text-uppercase mb-2">${esc(title)}</h3>
        ${body}
      </div>`,
    nextId: n,
  };
}

/** Renders all facet groups into `#advancedSearchFilters` and binds checkbox changes. */
function renderFacetGroups() {
  const container = document.getElementById('advancedSearchFilters');
  if (!container) return;

  let idCounter = 0;
  const sections = [
    [TITLES.sabha, 'sabha', Object.keys(PRADESHIKA_SABHA_OPTIONS), (v) => v],
    [TITLES.occupation, 'occupation', Object.keys(MEMBER_OCCUPATION_OPTIONS), formatLabel],
    [TITLES.bloodGroup, 'bloodGroup', Object.keys(BLOOD_GROUP_OPTIONS), (v) => v],
    [TITLES.gender, 'gender', Object.keys(GENDER_OPTIONS), formatLabel],
    [TITLES.membership, 'membership', Object.keys(MEMBERSHIP_OPTIONS), formatLabel],
    [TITLES.education, 'education', Object.keys(EDUCATION_OPTIONS), formatLabel],
    [TITLES.rationCard, 'rationCard', Object.keys(RATION_CARD_OPTIONS), formatLabel],
  ];

  const parts = [];
  for (const [title, facet, keys, labelFn] of sections) {
    const { html, nextId } = buildFacetSectionHtml(title, facet, keys, labelFn, idCounter);
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
  const inp = document.getElementById('advancedSearchText');
  if (inp) inp.value = '';
  filterState = createEmptyFilterState();
  syncFilterCheckboxesFromState();
  resetPage();
  processAndRender();
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
 * @returns {string} HTML snippet for `.advanced-search-card__thumb`.
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
 * @param {string} phone - Raw display phone.
 * @returns {string}
 */
function buildCardPhoneBlockHtml(phone) {
  const trimmed = phone.trim();
  if (!trimmed) return '';
  const wa = whatsappHref(trimmed);
  if (wa) {
    return `<div class="advanced-search-card__line advanced-search-card__interaction"><i class="bi bi-whatsapp text-success me-1" aria-hidden="true"></i><a href="${escapeHtml(wa)}" target="_blank" rel="noopener noreferrer">${escapeHtml(trimmed)}</a></div>`;
  }
  return `<div class="advanced-search-card__line advanced-search-card__interaction"><i class="bi bi-telephone me-1" aria-hidden="true"></i>${escapeHtml(trimmed)}</div>`;
}

/**
 * @param {string} email
 * @returns {string}
 */
function buildCardEmailBlockHtml(email) {
  const trimmed = email.trim();
  if (!trimmed) return '';
  return `<div class="advanced-search-card__line advanced-search-card__interaction"><i class="bi bi-envelope me-1" aria-hidden="true"></i><a href="mailto:${encodeURIComponent(trimmed)}">${escapeHtml(trimmed)}</a></div>`;
}

/**
 * DOB (dd-mm-yyyy) and age for advanced search cards (owner, members, non-members).
 *
 * @param {string|undefined} dob
 * @returns {string} HTML snippet or empty string when nothing to show.
 */
function buildCardDobAgeHtml(dob) {
  const dobDisp = formatDOB(dob);
  const age = calcAgeYears(dob);
  const bits = [];
  if (dobDisp !== '—') bits.push(`DOB ${dobDisp}`);
  if (age !== '—') bits.push(`${age} years`);
  if (bits.length === 0) return '';
  return `<div class="advanced-search-card__line text-muted small">${escapeHtml(bits.join(' · '))}</div>`;
}

/**
 * Builds one hotel-style result card (photo, name, DOB/age, address, sabha, phone, email, view link).
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

  const nonMemberBadge =
    row.role === 'nonMember'
      ? `<span class="badge text-bg-secondary ms-2 align-middle">${escapeHtml(ADVANCED_MEMBER_SEARCH.BADGE_NON_MEMBER)}</span>`
      : '';

  const viewHref = `view?id=${escapeHtml(row.recordId)}&${VIEW_PAGE_FROM_PARAM}=${VIEW_REFERRER.ADVANCED_SEARCH}`;
  const viewAria =
    name && name !== '—'
      ? `${ADVANCED_MEMBER_SEARCH.STRETCHED_LINK_ARIA_BASE}${ADVANCED_MEMBER_SEARCH.STRETCHED_LINK_ARIA_NAME_PREFIX}${name}`
      : ADVANCED_MEMBER_SEARCH.STRETCHED_LINK_ARIA_BASE;

  return `
    <article class="advanced-search-card card-spss" role="listitem">
      <div class="advanced-search-card__thumb">${buildCardThumbHtml(p)}</div>
      <div class="advanced-search-card__body">
        <h2 class="advanced-search-card__title h6 mb-1">
          <a href="${viewHref}" class="link-dark stretched-link text-decoration-none" aria-label="${escapeHtml(viewAria)}">${escapeHtml(name)}</a>
          ${nonMemberBadge}
        </h2>
        ${buildCardDobAgeHtml(p.dob)}
        <div class="advanced-search-card__line text-muted small">${escapeHtml(addr) || '—'}</div>
        <div class="advanced-search-card__line text-muted small">${escapeHtml(sabha)}</div>
        ${buildCardPhoneBlockHtml(phoneStr)}
        ${buildCardEmailBlockHtml(emailStr)}
      </div>
    </article>
  `;
}

function renderResults(rows) {
  const container = document.getElementById('advancedSearchResults');
  if (!container) return;

  if (rows.length === 0) {
    container.innerHTML = `<p class="text-muted py-4">${escapeHtml(MESSAGES.NO_RECORDS)}</p>`;
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
  const unit = total === 1 ? ADVANCED_MEMBER_SEARCH.RESULTS_UNIT_PERSON : ADVANCED_MEMBER_SEARCH.RESULTS_UNIT_PEOPLE;
  el.textContent = `${ADVANCED_MEMBER_SEARCH.RESULTS_COUNT_PREFIX} ${total} ${unit}`;
}

/** Applies text + facet filters, paginates, and refreshes chips and result cards. */
function processAndRender() {
  const text = document.getElementById('advancedSearchText')?.value || '';
  let filtered = applyPersonFilters(allPersonRows, filterState);
  filtered = applyTextFilter(filtered, text);
  filtered = sortByName(filtered);

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
 * Initializes the advanced member search page: hint copy, pagination, facet DOM, debounced
 * quick search, filter chips, and the initial Firestore load.
 *
 * Side effects: toggles `#loadingOverlay` via {@link ../ui/ui-service.js showLoader} /
 * {@link ../ui/ui-service.js hideLoader} for the full init; mutates module `allPersonRows` and
 * `filterState`; binds listeners on `#pageSizeSelect`, `#advancedSearchText`, `#clearAllFilters`,
 * and the chip row; calls {@link applyMembershipHintCopy} and {@link applyMobileFiltersHelpCopy}.
 *
 * @returns {Promise<void>}
 */
export async function initAdvancedMemberSearch() {
  showLoader(ADVANCED_MEMBER_SEARCH.LOADING_MESSAGE);
  try {
    applyMembershipHintCopy();
    applyMobileFiltersHelpCopy();
    setPaginationState({ currentPage: 1, pageSize: DASHBOARD_DEFAULTS.PAGE_SIZE });
    filterState = createEmptyFilterState();
    populatePageSizeSelectFromDefaults(document.getElementById('pageSizeSelect'));
    renderFacetGroups();

    bindPageSizeSelectChange(document.getElementById('pageSizeSelect'), (n) => {
      setPaginationState({ pageSize: n, currentPage: 1 });
      processAndRender();
    });

    let textTimer;
    document.getElementById('advancedSearchText')?.addEventListener('input', () => {
      clearTimeout(textTimer);
      textTimer = setTimeout(() => {
        resetPage();
        processAndRender();
      }, DASHBOARD_DEFAULTS.SEARCH_DEBOUNCE_MS);
    });

    document.getElementById('clearAllFilters')?.addEventListener('click', () => {
      clearAllFilters();
    });

    bindFilterChipRow();
    await loadRecords();
  } finally {
    hideLoader();
  }
}
