/**
 * @fileoverview Birthday Dashboard page — loads role-scoped data, categorizes birthdays,
 * and renders summary cards plus sabha accordion.
 * @module pages/birthday-dashboard-page
 */

import { BIRTHDAY_DASHBOARD } from '../constants/birthday-dashboard.js';
import { PRADESHIKA_SABHA_OPTIONS } from '../constants/member-options.js';
import { fetchBirthdayRecordsForCurrentUser } from '../services/birthday-service.js';
import {
  groupCategorizedBySabha,
  aggregateSummaryCounts,
} from '../utils/birthday-date-utils.js';
import {
  buildSummaryCardsHtml,
  buildSabhaAccordionHtml,
} from '../ui/birthday-dashboard-ui.js';
import { showToast, setLoaderMessage } from '../ui/ui-service.js';
import * as Logger from '../utils/logger.js';

/** @type {string|null} */
let expandedSabha = null;

/** Matches accordion mobile layout breakpoint in `14-birthday-dashboard.css`. */
const MOBILE_ACCORDION_MQ = '(max-width: 767.98px)';

/**
 * On narrow viewports, scroll/focus to the first panel section after expand so users
 * are not left at the bottom of a tall sabha panel.
 *
 * @param {HTMLElement} collapseEl - `.accordion-collapse` that finished opening.
 */
function focusExpandedAccordionContentStart(collapseEl) {
  if (!window.matchMedia(MOBILE_ACCORDION_MQ).matches) return;

  const firstSection = collapseEl.querySelector('.birthday-accordion__body .birthday-sabha-section--today');
  if (!firstSection) return;

  const heading = firstSection.querySelector('.birthday-sabha-section__title');
  if (heading && !heading.hasAttribute('tabindex')) {
    heading.setAttribute('tabindex', '-1');
  }

  const scrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  requestAnimationFrame(() => {
    firstSection.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
    heading?.focus({ preventScroll: true });
  });
}

/**
 * Writes static page chrome labels from constants.
 */
function applyPageLabels() {
  const title = document.getElementById('birthdayDashboardPageTitle');
  const subtitle = document.getElementById('birthdayDashboardPageSubtitle');
  const footerNote = document.getElementById('birthdayDashboardFooterNote');
  if (title) title.textContent = BIRTHDAY_DASHBOARD.PAGE_TITLE;
  if (subtitle) subtitle.textContent = BIRTHDAY_DASHBOARD.PAGE_SUBTITLE;
  if (footerNote) footerNote.textContent = BIRTHDAY_DASHBOARD.FOOTER_NOTE;
}

/**
 * @param {{ today: number, week: number, month: number }} counts
 */
function renderSummaryCards(counts) {
  const el = document.getElementById('birthdaySummaryCards');
  if (!el) return;
  el.innerHTML = buildSummaryCardsHtml(counts);
}

/**
 * @param {import('../utils/birthday-date-utils.js').SabhaBirthdayGroup[]} groups
 */
function renderSabhaAccordion(groups) {
  const el = document.getElementById('birthdaySabhaAccordion');
  if (!el) return;
  el.innerHTML = buildSabhaAccordionHtml(groups, expandedSabha);
}

/**
 * Tracks which sabha panel is open for subsequent re-renders.
 */
function bindAccordionExpandTracking() {
  const root = document.getElementById('birthdaySabhaAccordion');
  if (!root || root.dataset.bound === '1') return;
  root.dataset.bound = '1';

  root.addEventListener('shown.bs.collapse', (event) => {
    const collapseEl = event.target;
    if (!(collapseEl instanceof HTMLElement) || !collapseEl.classList.contains('accordion-collapse')) {
      return;
    }

    const item = collapseEl.closest('.accordion-item');
    const btn = item?.querySelector('.birthday-accordion__button');
    expandedSabha = btn?.getAttribute('data-sabha') || null;
    focusExpandedAccordionContentStart(collapseEl);
  });
}

/**
 * @param {string} message
 */
function showLoadError(message) {
  const errEl = document.getElementById('birthdayDashboardError');
  if (errEl) {
    errEl.textContent = message;
    errEl.classList.remove('d-none');
  }
  showToast(message, 'error');
}

/**
 * Loads Firestore data and paints the dashboard.
 */
async function loadAndRenderBirthdayDashboard() {
  const errorEl = document.getElementById('birthdayDashboardError');
  if (errorEl) errorEl.classList.add('d-none');

  setLoaderMessage(BIRTHDAY_DASHBOARD.LOADER_MESSAGE);

  const { batches } = await fetchBirthdayRecordsForCurrentUser();
  const sabhaOrder = Object.keys(PRADESHIKA_SABHA_OPTIONS);
  const sabhaBatches = batches.map((b) => ({ sabha: b.sabha, personRows: b.personRows }));
  const groups = groupCategorizedBySabha(sabhaBatches, sabhaOrder);
  const summary = aggregateSummaryCounts(groups);

  if (!expandedSabha && groups.length > 0) {
    expandedSabha = groups[0].sabha;
  }

  renderSummaryCards(summary);
  renderSabhaAccordion(groups);
}

/**
 * Entry point for `birthday-dashboard.html`.
 *
 * @returns {Promise<void>}
 */
export async function initBirthdayDashboardPage() {
  applyPageLabels();
  bindAccordionExpandTracking();

  try {
    await loadAndRenderBirthdayDashboard();
  } catch (error) {
    Logger.error('Birthday dashboard load failed:', error);
    showLoadError(BIRTHDAY_DASHBOARD.LOAD_ERROR);
  }
}
