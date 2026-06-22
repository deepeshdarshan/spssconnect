/**
 * @fileoverview HTML builders for the Birthday Dashboard — summary cards, sabha accordion,
 * today member cards, and upcoming week/month widget + person cards.
 * @module ui/birthday-dashboard-ui
 */

import { BIRTHDAY_DASHBOARD } from '../constants/birthday-dashboard.js';
import { ENABLE_PHOTO_UPLOAD } from '../constants/constants.js';
import { sabhaGradientCss } from '../constants/pradeshika-sabha-gradients.js';
import { escapeHtml, formatDOB } from './ui-service.js';
import {
  buildCardDetailRowHtml,
  buildCardPhoneBlockHtml,
  buildResultsEmptyStateHtml,
  buildMemberAvatarHtml,
} from './member-result-card-ui.js';
import { whatsappHref } from '../services/member-person-search.js';
import { getMemberAvatarInitials } from '../utils/member-avatar-initials.js';
import {
  ageTurningOnBirthday,
  formatDaysRemainingLabel,
  formatUpcomingBirthdayCalendarLine,
  nextBirthdayDateFromDaysUntil,
} from '../utils/birthday-date-utils.js';

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
 * Pre-filled WhatsApp message for the “Send Birthday Wishes” button.
 * @param {string} name Member display name
 * @returns {string}
 */
export function buildBirthdayWishWhatsAppMessage(name) {
  const displayName = String(name ?? '').trim() || L.BIRTHDAY_WISH_DEFAULT_NAME;
  const greeting = L.BIRTHDAY_WISH_GREETING.replace('{name}', displayName);
  return `${greeting}\n${L.BIRTHDAY_WISH_BODY}\n${L.BIRTHDAY_WISH_SIGNOFF}`;
}

/**
 * @param {string} phone
 * @param {string} name
 * @returns {string}
 */
function buildBirthdayTodayFooterHtml(phone, name) {
  const phoneBlock = buildCardPhoneBlockHtml(phone);
  if (!phoneBlock) return '';
  const trimmed = String(phone ?? '').trim();
  const wa = whatsappHref(trimmed);
  const waWithWish = whatsappHref(trimmed, buildBirthdayWishWhatsAppMessage(name));
  const wishBtn =
    waWithWish != null
      ? `<a href="${escapeHtml(waWithWish)}" class="birthday-today-card__wish-btn" target="_blank" rel="noopener noreferrer"><i class="bi bi-whatsapp" aria-hidden="true"></i><span>${escapeHtml(L.SEND_BIRTHDAY_WISHES)}</span></a>`
      : '';
  const hint = wa != null ? `<p class="birthday-today-card__wa-hint">${escapeHtml(L.WHATSAPP_TAP_HINT)}</p>` : '';
  return `
    <footer class="birthday-today-card__footer advanced-search-card__interaction">
      <div class="birthday-today-card__footer-col birthday-today-card__footer-col--contact">
        ${phoneBlock}
        ${hint}
      </div>
      ${
        wishBtn
          ? `<div class="birthday-today-card__footer-divider" aria-hidden="true"></div><div class="birthday-today-card__footer-col birthday-today-card__footer-col--action">${wishBtn}</div>`
          : ''
      }
    </footer>`;
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
  const turningTodayLine =
    turning != null
      ? `${escapeHtml(L.TURNING_LABEL)} ${turning} ${escapeHtml(L.TURNING_TODAY_SUFFIX)}`
      : '';
  const ageRow =
    turning != null
      ? `${escapeHtml(L.AGE_LABEL)}: ${turning} ${escapeHtml(L.YEARS_SUFFIX)}`
      : `${escapeHtml(L.AGE_LABEL)}: —`;
  const phone = String(p.phone ?? '').trim();
  const dobChip =
    dobDisp !== '—'
      ? `<p class="birthday-today-card__meta"><span class="birthday-today-card__dob-chip"><i class="bi bi-calendar3" aria-hidden="true"></i>${escapeHtml(dobDisp)}</span></p>`
      : '';
  const turningBadge =
    turningTodayLine !== ''
      ? `<p class="birthday-today-card__turning-badge"><i class="bi bi-balloon-fill" aria-hidden="true"></i><span>${turningTodayLine}</span></p>`
      : '';

  return `
    <article class="advanced-search-card card-spss birthday-today-card" role="listitem">
      <div class="birthday-today-card__surface">
        <div class="birthday-upcoming-widget__header-art birthday-today-card__bg-art" aria-hidden="true">
          <i class="bi bi-balloon-fill birthday-upcoming-widget__balloon birthday-upcoming-widget__balloon--1"></i>
          <i class="bi bi-balloon-fill birthday-upcoming-widget__balloon birthday-upcoming-widget__balloon--2"></i>
          <i class="bi bi-gift-fill birthday-upcoming-widget__gift"></i>
        </div>
        <div class="birthday-today-card__ribbon">
          <i class="bi bi-cake2-fill" aria-hidden="true"></i>
          <span>${escapeHtml(L.HAPPY_BIRTHDAY_RIBBON)}</span>
        </div>
        <div class="birthday-today-card__hero">
          <div class="birthday-today-card__avatar-shell">
            <div class="birthday-today-card__avatar-ring" aria-hidden="true"></div>
            <div class="advanced-search-card__avatar birthday-today-card__avatar">${buildMemberAvatarHtml(p)}</div>
          </div>
          <div class="birthday-today-card__intro">
            <h3 class="birthday-today-card__name h6 mb-0">${escapeHtml(name)}</h3>
            ${dobChip}
            ${turningBadge}
          </div>
        </div>
        <div class="birthday-today-card__details">
          ${buildCardDetailRowHtml('bi-house-door', `<span class="birthday-today-card__house-label">${escapeHtml(L.HOUSE_LABEL)}:</span> ${escapeHtml(houseName)}`)}
          <div class="birthday-today-card__detail-divider" aria-hidden="true"></div>
          ${buildCardDetailRowHtml('bi-gift', escapeHtml(ageRow))}
        </div>
        ${buildBirthdayTodayFooterHtml(phone, name)}
      </div>
    </article>`;
}

/**
 * @param {import('../utils/birthday-date-utils.js').BirthdayPersonEntry} entry
 * @returns {string}
 */
export function buildWeekBirthdayRowHtml(entry) {
  return buildUpcomingBirthdayRowHtml(entry, 'week', { themeIndex: 0 });
}

/**
 * @param {import('../utils/birthday-date-utils.js').BirthdayPersonEntry} entry
 * @returns {string}
 */
export function buildMonthBirthdayRowHtml(entry) {
  return buildUpcomingBirthdayRowHtml(entry, 'month', { themeIndex: 0 });
}

/**
 * Preserves first-seen order of each `days` bucket (matches `categorizeBirthdayPersons` sort).
 *
 * @param {import('../utils/birthday-date-utils.js').BirthdayPersonEntry[]} entries
 * @returns {Array<{ days: number, entries: import('../utils/birthday-date-utils.js').BirthdayPersonEntry[] }>}
 */
function groupBirthdayEntriesByDays(entries) {
  const order = [];
  /** @type {Map<number, import('../utils/birthday-date-utils.js').BirthdayPersonEntry[]>} */
  const byDays = new Map();
  for (const e of entries) {
    const d = e.days;
    if (!byDays.has(d)) {
      byDays.set(d, []);
      order.push(d);
    }
    byDays.get(d).push(e);
  }
  return order.map((days) => ({ days, entries: byDays.get(days) || [] }));
}

/**
 * @param {import('../utils/birthday-date-utils.js').BirthdayPersonEntry[]} entries
 * @param {'week'|'month'} sectionKey
 * @returns {string} List items only (parent supplies list wrapper).
 */
function buildUpcomingBirthdayListHtml(entries, sectionKey) {
  let themeIdx = 0;
  const flat = groupBirthdayEntriesByDays(entries).flatMap((g) => g.entries);
  return flat
    .map((e) => {
      const html = buildUpcomingBirthdayRowHtml(e, sectionKey, { themeIndex: themeIdx % 3 });
      themeIdx += 1;
      return html;
    })
    .join('');
}

/**
 * @param {{ name?: string, photoURL?: string }} person
 * @returns {string}
 */
function buildUpcomingPersonAvatarHtml(person) {
  const photoOk = ENABLE_PHOTO_UPLOAD && person?.photoURL;
  if (photoOk) {
    return `<img src="${escapeHtml(person.photoURL)}" alt="" class="birthday-upcoming-card__photo" loading="lazy">`;
  }
  const initials = escapeHtml(getMemberAvatarInitials(person?.name));
  return `<span class="birthday-upcoming-card__initials" aria-hidden="true">${initials}</span>`;
}

/**
 * @param {import('../utils/birthday-date-utils.js').BirthdayPersonEntry} entry
 * @param {'week'|'month'} sectionKey
 * @param {{ themeIndex?: number }} [opts]
 * @returns {string}
 */
function buildUpcomingBirthdayRowHtml(entry, sectionKey, opts = {}) {
  const themeIndex = Number.isFinite(opts.themeIndex) ? Math.max(0, Math.floor(opts.themeIndex)) % 3 : 0;
  const row = entry.row;
  const p = row.person || {};
  const pd = row.householdPd || {};
  const name = p.name || '—';
  const houseName = pd.houseName || '—';
  const dobDisp = formatDOB(p.dob);
  const turning = ageTurningOnBirthday(p.dob);
  const ageLine =
    turning != null
      ? `${escapeHtml(String(turning))} ${escapeHtml(L.YEARS_SUFFIX)}`
      : escapeHtml('—');
  const daysLine = formatDaysRemainingLabel(entry.days);
  const nextDate = nextBirthdayDateFromDaysUntil(entry.days);
  const whenLine = formatUpcomingBirthdayCalendarLine(nextDate);
  const statusTop = daysLine !== '' ? daysLine : '—';
  const avatarInner = buildUpcomingPersonAvatarHtml(p);

  return `
    <article class="birthday-upcoming-card birthday-upcoming-card--${sectionKey} birthday-upcoming-card--theme-${themeIndex}" role="listitem">
      <div class="birthday-upcoming-card__stars" aria-hidden="true"></div>
      <div class="birthday-upcoming-card__avatar-col">
        <div class="birthday-upcoming-card__avatar-ring">
          <span class="birthday-upcoming-card__cake-cap" aria-hidden="true"><i class="bi bi-cake2-fill"></i></span>
          ${avatarInner}
        </div>
      </div>
      <div class="birthday-upcoming-card__main">
        <p class="birthday-upcoming-card__name mb-0">${escapeHtml(name)}</p>
        <p class="birthday-upcoming-card__house mb-0">${escapeHtml(houseName)}</p>
        <div class="birthday-upcoming-card__meta-row">
          <span class="birthday-upcoming-card__meta-item">
            <i class="bi bi-calendar3" aria-hidden="true"></i>
            <span>${escapeHtml(dobDisp)}</span>
          </span>
          <span class="birthday-upcoming-card__meta-sep" aria-hidden="true">|</span>
          <span class="birthday-upcoming-card__meta-item">
            <i class="bi bi-cake2-fill" aria-hidden="true"></i>
            <span>${ageLine}</span>
          </span>
        </div>
      </div>
      <div class="birthday-upcoming-card__status birthday-upcoming-card__status--theme-${themeIndex}">
        <i class="bi bi-calendar-event birthday-upcoming-card__status-icon" aria-hidden="true"></i>
        <p class="birthday-upcoming-card__status-top mb-0">${escapeHtml(statusTop)}</p>
        <p class="birthday-upcoming-card__status-bottom mb-0">${escapeHtml(whenLine)}</p>
      </div>
    </article>`;
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
 * @param {{ weekHeadingId: string, monthHeadingId: string, monthSectionId: string }} panelIds
 * @returns {string}
 */
function buildSabhaPanelBodyHtml(group, panelIds) {
  const { weekHeadingId, monthHeadingId, monthSectionId } = panelIds;
  const { categorized } = group;
  const todayHeading = `${L.SECTION_TODAY} (${categorized.today.length})`;
  const weekTitle = `${L.SECTION_WEEK} (${categorized.week.length})`;
  const monthTitle = `${L.SECTION_MONTH} (${categorized.month.length})`;

  const todayBody =
    categorized.today.length > 0
      ? `<div class="birthday-today-grid" role="list">${categorized.today.map(buildTodayBirthdayCardHtml).join('')}</div>`
      : buildSectionEmptyHtml(L.EMPTY_TODAY);

  const weekSectionAttrs = categorized.week.length > 0 ? ` aria-labelledby="${escapeHtml(weekHeadingId)}"` : '';
  const monthSectionAttrs = categorized.month.length > 0 ? ` aria-labelledby="${escapeHtml(monthHeadingId)}"` : '';

  const weekFooter =
    categorized.week.length > 0 && categorized.month.length > 0
      ? `<footer class="birthday-upcoming-widget__footer">
        <a href="#${escapeHtml(monthSectionId)}" class="birthday-upcoming-widget__footer-link">
          <i class="bi bi-gift-fill" aria-hidden="true"></i>
          <span>${escapeHtml(L.VIEW_ALL_WEEK_CTA)}</span>
          <i class="bi bi-chevron-right" aria-hidden="true"></i>
        </a>
      </footer>`
      : '';

  const weekWidget =
    categorized.week.length > 0
      ? `<div class="birthday-upcoming-widget birthday-upcoming-widget--week" role="region" aria-labelledby="${escapeHtml(weekHeadingId)}">
      <header class="birthday-upcoming-widget__header birthday-upcoming-widget__header--week">
        <div class="birthday-upcoming-widget__header-text">
          <div class="birthday-upcoming-widget__title-row">
            <span class="birthday-upcoming-widget__accent-bar" aria-hidden="true"></span>
            <h3 id="${escapeHtml(weekHeadingId)}" class="birthday-upcoming-widget__title">${escapeHtml(weekTitle)}</h3>
          </div>
          <p class="birthday-upcoming-widget__subtitle">${escapeHtml(L.WEEK_WIDGET_SUBTITLE)}</p>
        </div>
        <div class="birthday-upcoming-widget__header-art" aria-hidden="true">
          <i class="bi bi-balloon-fill birthday-upcoming-widget__balloon birthday-upcoming-widget__balloon--1"></i>
          <i class="bi bi-balloon-fill birthday-upcoming-widget__balloon birthday-upcoming-widget__balloon--2"></i>
          <i class="bi bi-gift-fill birthday-upcoming-widget__gift"></i>
        </div>
      </header>
      <div class="birthday-upcoming-widget__body">
        <div class="birthday-upcoming-widget__list" role="list">${buildUpcomingBirthdayListHtml(categorized.week, 'week')}</div>
      </div>
      ${weekFooter}
    </div>`
      : buildSectionEmptyHtml(L.EMPTY_WEEK);

  const monthWidget =
    categorized.month.length > 0
      ? `<div class="birthday-upcoming-widget birthday-upcoming-widget--month" role="region" aria-labelledby="${escapeHtml(monthHeadingId)}">
      <header class="birthday-upcoming-widget__header birthday-upcoming-widget__header--month">
        <div class="birthday-upcoming-widget__header-text">
          <div class="birthday-upcoming-widget__title-row">
            <span class="birthday-upcoming-widget__accent-bar" aria-hidden="true"></span>
            <h3 id="${escapeHtml(monthHeadingId)}" class="birthday-upcoming-widget__title">${escapeHtml(monthTitle)}</h3>
          </div>
          <p class="birthday-upcoming-widget__subtitle">${escapeHtml(L.MONTH_WIDGET_SUBTITLE)}</p>
        </div>
        <div class="birthday-upcoming-widget__header-art birthday-upcoming-widget__header-art--month" aria-hidden="true">
          <i class="bi bi-calendar-heart birthday-upcoming-widget__gift"></i>
        </div>
      </header>
      <div class="birthday-upcoming-widget__body">
        <div class="birthday-upcoming-widget__list" role="list">${buildUpcomingBirthdayListHtml(categorized.month, 'month')}</div>
      </div>
    </div>`
      : buildSectionEmptyHtml(L.EMPTY_MONTH);

  return `
    <section class="birthday-sabha-section birthday-sabha-section--today">
      <h3 class="birthday-sabha-section__title h6">${escapeHtml(todayHeading)}</h3>
      ${todayBody}
    </section>
    <section class="birthday-sabha-section birthday-sabha-section--week"${weekSectionAttrs}>
      ${weekWidget}
    </section>
    <section id="${escapeHtml(monthSectionId)}" class="birthday-sabha-section birthday-sabha-section--month"${monthSectionAttrs}>
      ${monthWidget}
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
      const panelIds = {
        weekHeadingId: `${collapseId}-week-h`,
        monthHeadingId: `${collapseId}-month-h`,
        monthSectionId: `${collapseId}-month-sec`,
      };

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
          ${buildSabhaPanelBodyHtml(group, panelIds)}
        </div>
      </div>
    </div>`;
    })
    .join('');
}
