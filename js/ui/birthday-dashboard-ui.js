/**
 * @fileoverview HTML builders for the Birthday Dashboard — summary cards, sabha accordion,
 * today member cards, and upcoming week/month rows.
 * @module ui/birthday-dashboard-ui
 */

import { BIRTHDAY_DASHBOARD } from '../constants/birthday-dashboard.js';
import { sabhaGradientCss } from '../constants/pradeshika-sabha-gradients.js';
import { escapeHtml, formatDOB } from './ui-service.js';
import {
  buildCardDetailRowHtml,
  buildCardContactFooterHtml,
  buildResultsEmptyStateHtml,
  buildMemberAvatarHtml,
} from './member-result-card-ui.js';
import { ageTurningOnBirthday, formatDaysRemainingLabel } from '../utils/birthday-date-utils.js';

const L = BIRTHDAY_DASHBOARD;

/** Summary tile hub gradient + icon per bucket (matches overview dashboard hub tiles). */
const SUMMARY_TILE_CONFIG = Object.freeze({
  today: {
    hubBg: 'dashboard-hub-tile-bg--households',
    icon: 'bi-cake2-fill',
  },
  week: {
    hubBg: 'dashboard-hub-tile-bg--people',
    icon: 'bi-calendar-week',
  },
  month: {
    hubBg: 'dashboard-hub-tile-bg--phone',
    icon: 'bi-calendar-month',
  },
});

/**
 * @param {string} sabha
 * @param {number} index
 * @returns {string}
 */
function sabhaCollapseId(sabha, index) {
  const slug = String(sabha)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `birthdaySabhaCollapse-${index}-${slug || 'sabha'}`;
}

/**
 * @param {{ today: number, week: number, month: number }} counts
 * @returns {string}
 */
export function buildSummaryCardsHtml(counts) {
  const cards = [
    { key: 'today', label: L.SUMMARY_TODAY_LABEL, value: counts.today },
    { key: 'week', label: L.SUMMARY_WEEK_LABEL, value: counts.week },
    { key: 'month', label: L.SUMMARY_MONTH_LABEL, value: counts.month },
  ];
  return cards
    .map((c) => {
      const cfg = SUMMARY_TILE_CONFIG[c.key];
      return `
    <div class="form-box overview-tile overview-tile--stat ${cfg.hubBg} birthday-summary-tile birthday-summary-tile--${escapeHtml(c.key)}" role="group" aria-label="${escapeHtml(c.label)}">
      <div class="overview-tile-stat-inner">
        <div class="overview-tile-stat-icon-wrap" aria-hidden="true">
          <i class="bi ${cfg.icon}"></i>
        </div>
        <div class="overview-tile-stat-main">
          <span class="overview-tile-stat-count" aria-label="${escapeHtml(c.label)}: ${c.value}">${c.value}</span>
          <span class="overview-tile-stat-label">${escapeHtml(c.label)}</span>
        </div>
      </div>
    </div>`;
    })
    .join('');
}

/**
 * @param {string} sabha
 * @param {{ today: number, week: number, month: number }} counts
 * @returns {string}
 */
export function buildSabhaAccordionHeaderHtml(sabha, counts) {
  const esc = escapeHtml(sabha);
  const desktopSummary = `${counts.today} ${L.SABHA_COUNT_TODAY} | ${counts.week} ${L.SABHA_COUNT_WEEK} | ${counts.month} ${L.SABHA_COUNT_MONTH}`;
  return `
    <span class="birthday-accordion__title">${esc}</span>
    <span class="birthday-accordion__counts birthday-accordion__counts--desktop" aria-hidden="true">(${escapeHtml(desktopSummary)})</span>
    <span class="birthday-accordion__counts birthday-accordion__counts--mobile" aria-hidden="true">
      <span class="birthday-accordion__count-line">${counts.today} ${escapeHtml(L.SABHA_COUNT_TODAY)}</span>
      <span class="birthday-accordion__count-line">${counts.week} ${escapeHtml(L.SABHA_COUNT_WEEK)}</span>
      <span class="birthday-accordion__count-line">${counts.month} ${escapeHtml(L.SABHA_COUNT_MONTH)}</span>
    </span>`;
}

/**
 * @param {import('../utils/birthday-date-utils.js').BirthdayPersonEntry} entry
 * @returns {string}
 */
export function buildTodayBirthdayCardHtml(entry) {
  const row = entry.row;
  const p = row.person || {};
  const pd = row.householdPd || {};
  const name = p.name || '—';
  const houseName = pd.houseName || '—';
  const dobDisp = formatDOB(p.dob);
  const turning = ageTurningOnBirthday(p.dob);
  const turningText =
    turning != null ? `${L.TURNING_LABEL}: ${turning} ${L.YEARS_SUFFIX}` : `${L.TURNING_LABEL}: —`;
  const phone = String(p.phone ?? '').trim();

  return `
    <article class="advanced-search-card card-spss birthday-today-card" role="listitem">
      <div class="advanced-search-card__main">
        <div class="advanced-search-card__avatar">${buildMemberAvatarHtml(p)}</div>
        <div class="advanced-search-card__header-body">
          <div class="advanced-search-card__header">
            <h3 class="advanced-search-card__title h6 mb-0">${escapeHtml(name)}</h3>
          </div>
          ${
            dobDisp !== '—'
              ? `<p class="advanced-search-card__meta"><span class="advanced-search-card__meta-chip"><i class="bi bi-calendar3" aria-hidden="true"></i>${escapeHtml(dobDisp)}</span></p>`
              : ''
          }
        </div>
      </div>
      <div class="advanced-search-card__details">
        ${buildCardDetailRowHtml('bi-house-door', `<span class="birthday-today-card__house-label">${escapeHtml(L.HOUSE_LABEL)}:</span> ${escapeHtml(houseName)}`)}
        ${buildCardDetailRowHtml('bi-gift', escapeHtml(turningText))}
      </div>
      ${buildCardContactFooterHtml(phone)}
    </article>`;
}

/**
 * @param {import('../utils/birthday-date-utils.js').BirthdayPersonEntry} entry
 * @returns {string}
 */
export function buildWeekBirthdayRowHtml(entry) {
  return buildUpcomingBirthdayRowHtml(entry, 'week');
}

/**
 * @param {import('../utils/birthday-date-utils.js').BirthdayPersonEntry} entry
 * @returns {string}
 */
export function buildMonthBirthdayRowHtml(entry) {
  return buildUpcomingBirthdayRowHtml(entry, 'month');
}

/**
 * @param {import('../utils/birthday-date-utils.js').BirthdayPersonEntry} entry
 * @param {'week'|'month'} sectionKey
 * @returns {string}
 */
function buildUpcomingBirthdayRowHtml(entry, sectionKey) {
  const row = entry.row;
  const p = row.person || {};
  const pd = row.householdPd || {};
  const name = p.name || '—';
  const houseName = pd.houseName || '—';
  const dobDisp = formatDOB(p.dob);
  const badge = formatDaysRemainingLabel(entry.days);

  return `
    <div class="birthday-upcoming-row birthday-upcoming-row--${sectionKey}" role="listitem">
      <div class="birthday-upcoming-row__main">
        <p class="birthday-upcoming-row__name mb-0">${escapeHtml(name)}</p>
        <p class="birthday-upcoming-row__house mb-0 text-muted">${escapeHtml(houseName)}</p>
        <p class="birthday-upcoming-row__date mb-0"><i class="bi bi-calendar3 me-1" aria-hidden="true"></i>${escapeHtml(dobDisp)}</p>
      </div>
      ${
        badge
          ? `<span class="advanced-search-card__meta-chip birthday-upcoming-row__badge">${escapeHtml(badge)}</span>`
          : ''
      }
    </div>`;
}

/**
 * @param {string} message
 * @returns {string}
 */
export function buildSectionEmptyHtml(message) {
  return buildResultsEmptyStateHtml(escapeHtml(message), 'members');
}

/**
 * @param {import('../utils/birthday-date-utils.js').SabhaBirthdayGroup} group
 * @returns {string}
 */
function buildSabhaPanelBodyHtml(group) {
  const { categorized } = group;
  const todayHeading = `${L.SECTION_TODAY} (${categorized.today.length})`;
  const weekHeading = `${L.SECTION_WEEK} (${categorized.week.length})`;
  const monthHeading = `${L.SECTION_MONTH} (${categorized.month.length})`;

  const todayBody =
    categorized.today.length > 0
      ? `<div class="birthday-today-grid" role="list">${categorized.today.map(buildTodayBirthdayCardHtml).join('')}</div>`
      : buildSectionEmptyHtml(L.EMPTY_TODAY);

  const weekBody =
    categorized.week.length > 0
      ? `<div class="birthday-upcoming-list" role="list">${categorized.week.map(buildWeekBirthdayRowHtml).join('')}</div>`
      : buildSectionEmptyHtml(L.EMPTY_WEEK);

  const monthBody =
    categorized.month.length > 0
      ? `<div class="birthday-upcoming-list" role="list">${categorized.month.map(buildMonthBirthdayRowHtml).join('')}</div>`
      : buildSectionEmptyHtml(L.EMPTY_MONTH);

  return `
    <section class="birthday-sabha-section birthday-sabha-section--today">
      <h3 class="birthday-sabha-section__title h6">${escapeHtml(todayHeading)}</h3>
      ${todayBody}
    </section>
    <section class="birthday-sabha-section birthday-sabha-section--week">
      <h3 class="birthday-sabha-section__title h6">${escapeHtml(weekHeading)}</h3>
      ${weekBody}
    </section>
    <section class="birthday-sabha-section birthday-sabha-section--month">
      <h3 class="birthday-sabha-section__title h6">${escapeHtml(monthHeading)}</h3>
      ${monthBody}
    </section>`;
}

/**
 * @param {import('../utils/birthday-date-utils.js').SabhaBirthdayGroup[]} groups
 * @param {string|null} [expandedSabha=null] Sabha name whose panel should start expanded.
 * @returns {string}
 */
export function buildSabhaAccordionHtml(groups, expandedSabha = null) {
  if (!groups.length) {
    return buildSectionEmptyHtml(L.EMPTY_TODAY);
  }

  return groups
    .map((group, index) => {
      const collapseId = sabhaCollapseId(group.sabha, index);
      const isOpen = expandedSabha ? group.sabha === expandedSabha : index === 0;
      const headerInner = buildSabhaAccordionHeaderHtml(group.sabha, group.counts);
      const gradient = sabhaGradientCss(group.sabha);

      return `
    <div class="accordion-item birthday-accordion__item" data-sabha="${escapeHtml(group.sabha)}">
      <h2 class="accordion-header" id="heading-${collapseId}">
        <button
          class="accordion-button birthday-accordion__button${isOpen ? '' : ' collapsed'}"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#${collapseId}"
          aria-expanded="${isOpen ? 'true' : 'false'}"
          aria-controls="${collapseId}"
          data-sabha="${escapeHtml(group.sabha)}"
          style="background: ${gradient};"
        >
          ${headerInner}
        </button>
      </h2>
      <div
        id="${collapseId}"
        class="accordion-collapse collapse${isOpen ? ' show' : ''}"
        data-bs-parent="#birthdaySabhaAccordion"
        aria-labelledby="heading-${collapseId}"
      >
        <div class="accordion-body birthday-accordion__body">
          ${buildSabhaPanelBodyHtml(group)}
        </div>
      </div>
    </div>`;
    })
    .join('');
}
