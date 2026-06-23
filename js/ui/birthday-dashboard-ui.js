/**
 * @fileoverview HTML builders for the Birthday Dashboard — summary cards, sabha accordion,
 * today member cards, and upcoming week/month person cards.
 * @module ui/birthday-dashboard-ui
 */

import { BIRTHDAY_DASHBOARD } from '../constants/birthday-dashboard.js';
import { ENABLE_PHOTO_UPLOAD } from '../constants/constants.js';
import { escapeHtml, formatDOB } from './ui-service.js';
import { buildCardPhoneBlockHtml } from './member-result-card-ui.js';
import { whatsappHref, formatHouseholdAddress } from '../services/member-person-search.js';
import { getMemberAvatarInitials } from '../utils/member-avatar-initials.js';
import {
  ageTurningOnBirthday,
  formatDaysRemainingLabel,
  formatUpcomingBirthdayCalendarLine,
  nextBirthdayDateFromDaysUntil,
} from '../utils/birthday-date-utils.js';

const L = BIRTHDAY_DASHBOARD;

/** Summary card icon per bucket. */
const SUMMARY_CARD_CONFIG = Object.freeze({
  today: { icon: 'bi-cake2-fill', hint: L.SUMMARY_TODAY_HINT },
  week: { icon: 'bi-calendar-week', hint: L.SUMMARY_WEEK_HINT },
  month: { icon: 'bi-calendar-month', hint: L.SUMMARY_MONTH_HINT },
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
      const cfg = SUMMARY_CARD_CONFIG[c.key];
      return `
    <div class="birthday-summary-card birthday-summary-card--${escapeHtml(c.key)}" role="group" aria-label="${escapeHtml(c.label)}">
      <i class="bi ${cfg.icon} birthday-summary-card__icon" aria-hidden="true"></i>
      <span class="birthday-summary-card__count" aria-label="${escapeHtml(c.label)}: ${c.value}">${c.value}</span>
      <span class="birthday-summary-card__label">${escapeHtml(c.label)}</span>
      <span class="birthday-summary-card__hint">${escapeHtml(cfg.hint)}</span>
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
    <i class="bi bi-building birthday-accordion__icon" aria-hidden="true"></i>
    <span class="birthday-accordion__title">${esc}</span>
    <span class="birthday-accordion__counts" aria-hidden="true">${escapeHtml(desktopSummary)}</span>`;
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
 * @param {{ name?: string, photoURL?: string }} person
 * @returns {string}
 */
function buildPersonAvatarHtml(person) {
  const photoOk = ENABLE_PHOTO_UPLOAD && person?.photoURL;
  if (photoOk) {
    return `<img src="${escapeHtml(person.photoURL)}" alt="" class="birthday-person-card__photo" loading="lazy">`;
  }
  const initials = escapeHtml(getMemberAvatarInitials(person?.name));
  return `<span class="birthday-person-card__initials" aria-hidden="true">${initials}</span>`;
}

/**
 * House name plus formatted address lines for birthday person cards.
 *
 * @param {Object} pd - `personalDetails` from the household record.
 * @returns {string}
 */
function buildBirthdayHouseholdLocationHtml(pd) {
  const houseName = pd.houseName || '—';
  const address = formatHouseholdAddress(pd);
  const addressLine = address
    ? `<p class="birthday-person-card__address mb-0">${escapeHtml(address)}</p>`
    : '';
  return `
    <p class="birthday-person-card__house mb-0">${escapeHtml(houseName)}</p>
    ${addressLine}`;
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
  const dobDisp = formatDOB(p.dob);
  const turning = ageTurningOnBirthday(p.dob);
  const ageLine =
    turning != null
      ? `${escapeHtml(String(turning))} ${escapeHtml(L.YEARS_SUFFIX)}`
      : escapeHtml('—');
  const phone = String(p.phone ?? '').trim();
  const avatarInner = buildPersonAvatarHtml(p);
  const turningTodayLine =
    turning != null
      ? `${escapeHtml(L.TURNING_LABEL)} ${turning} ${escapeHtml(L.TURNING_TODAY_SUFFIX)}`
      : '';

  return `
    <article class="birthday-person-card birthday-person-card--today" role="listitem">
      <div class="birthday-person-card__avatar-col">
        <div class="birthday-person-card__avatar-ring">${avatarInner}</div>
      </div>
      <div class="birthday-person-card__main">
        <p class="birthday-person-card__name mb-0">${escapeHtml(name)}</p>
        ${buildBirthdayHouseholdLocationHtml(pd)}
        <div class="birthday-person-card__meta-row">
          <span class="birthday-person-card__meta-item">
            <i class="bi bi-calendar3" aria-hidden="true"></i>
            <span>${escapeHtml(dobDisp)}</span>
          </span>
          <span class="birthday-person-card__meta-sep" aria-hidden="true">|</span>
          <span class="birthday-person-card__meta-item">
            <i class="bi bi-cake2-fill" aria-hidden="true"></i>
            <span>${ageLine}</span>
          </span>
        </div>
        ${
          turningTodayLine !== ''
            ? `<p class="birthday-person-card__today-badge mb-0"><i class="bi bi-balloon-fill" aria-hidden="true"></i><span>${turningTodayLine}</span></p>`
            : ''
        }
      </div>
      <div class="birthday-person-card__status birthday-person-card__status--today">
        <i class="bi bi-cake2-fill birthday-person-card__status-icon" aria-hidden="true"></i>
        <p class="birthday-person-card__status-top mb-0">${escapeHtml(L.HAPPY_BIRTHDAY_RIBBON)}</p>
        <p class="birthday-person-card__status-bottom mb-0">${escapeHtml(dobDisp)}</p>
      </div>
      ${buildBirthdayTodayFooterHtml(phone, name)}
    </article>`;
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
  const avatarInner = buildPersonAvatarHtml(p);

  return `
    <article class="birthday-person-card birthday-person-card--${sectionKey}" role="listitem">
      <div class="birthday-person-card__avatar-col">
        <div class="birthday-person-card__avatar-ring">${avatarInner}</div>
      </div>
      <div class="birthday-person-card__main">
        <p class="birthday-person-card__name mb-0">${escapeHtml(name)}</p>
        ${buildBirthdayHouseholdLocationHtml(pd)}
        <div class="birthday-person-card__meta-row">
          <span class="birthday-person-card__meta-item">
            <i class="bi bi-calendar3" aria-hidden="true"></i>
            <span>${escapeHtml(dobDisp)}</span>
          </span>
          <span class="birthday-person-card__meta-sep" aria-hidden="true">|</span>
          <span class="birthday-person-card__meta-item">
            <i class="bi bi-cake2-fill" aria-hidden="true"></i>
            <span>${ageLine}</span>
          </span>
        </div>
      </div>
      <div class="birthday-person-card__status">
        <i class="bi bi-calendar-event birthday-person-card__status-icon" aria-hidden="true"></i>
        <p class="birthday-person-card__status-top mb-0">${escapeHtml(statusTop)}</p>
        <p class="birthday-person-card__status-bottom mb-0">${escapeHtml(whenLine)}</p>
      </div>
    </article>`;
}

/**
 * @param {import('../utils/birthday-date-utils.js').BirthdayPersonEntry[]} entries
 * @param {'week'|'month'} sectionKey
 * @returns {string}
 */
function buildUpcomingBirthdayListHtml(entries, sectionKey) {
  return entries.map((e) => buildUpcomingBirthdayRowHtml(e, sectionKey)).join('');
}

/**
 * @param {string} message
 * @returns {string}
 */
function buildBirthdayTodayEmptyHtml(message) {
  return `
    <div class="birthday-section-empty" role="status">
      <i class="bi bi-cake2-fill birthday-section-empty__icon" aria-hidden="true"></i>
      <p class="birthday-section-empty__text mb-0">${escapeHtml(message)}</p>
    </div>`;
}

/**
 * @param {string} message
 * @returns {string}
 */
export function buildSectionEmptyHtml(message) {
  return buildBirthdayTodayEmptyHtml(message);
}

/**
 * @param {string} title
 * @param {string} iconClass
 * @param {string} headingId
 * @param {{ href?: string, label?: string }|null} [viewAll=null]
 * @returns {string}
 */
function buildSectionHeaderHtml(title, iconClass, headingId, viewAll = null) {
  const viewAllHtml =
    viewAll?.href && viewAll?.label
      ? `<a href="${escapeHtml(viewAll.href)}" class="birthday-sabha-section__view-all">${escapeHtml(viewAll.label)} <i class="bi bi-chevron-right" aria-hidden="true"></i></a>`
      : '';
  return `
    <header class="birthday-sabha-section__header">
      <h3 id="${escapeHtml(headingId)}" class="birthday-sabha-section__title h6 mb-0">
        <i class="bi ${iconClass} birthday-sabha-section__title-icon" aria-hidden="true"></i>
        <span>${escapeHtml(title)}</span>
      </h3>
      ${viewAllHtml}
    </header>`;
}

/**
 * @param {import('../utils/birthday-date-utils.js').SabhaBirthdayGroup} group
 * @param {{ weekHeadingId: string, monthHeadingId: string, weekSectionId: string, monthSectionId: string }} panelIds
 * @returns {string}
 */
function buildSabhaPanelBodyHtml(group, panelIds) {
  const { weekHeadingId, monthHeadingId, weekSectionId, monthSectionId } = panelIds;
  const { categorized } = group;
  const todayHeading = `${L.SECTION_TODAY} (${categorized.today.length})`;
  const weekTitle = `${L.SECTION_WEEK} (${categorized.week.length})`;
  const monthTitle = `${L.SECTION_MONTH} (${categorized.month.length})`;

  const todayBody =
    categorized.today.length > 0
      ? `<div class="birthday-person-list birthday-person-list--today" role="list">${categorized.today.map(buildTodayBirthdayCardHtml).join('')}</div>`
      : buildBirthdayTodayEmptyHtml(L.EMPTY_TODAY);

  const weekSection =
    categorized.week.length > 0
      ? `<section id="${escapeHtml(weekSectionId)}" class="birthday-sabha-section birthday-sabha-section--week" aria-labelledby="${escapeHtml(weekHeadingId)}">
      ${buildSectionHeaderHtml(weekTitle, 'bi-calendar-week', weekHeadingId, {
        href: `#${weekSectionId}`,
        label: L.VIEW_ALL_WEEK_CTA,
      })}
      <p class="birthday-sabha-section__subtitle">${escapeHtml(L.WEEK_WIDGET_SUBTITLE)}</p>
      <div class="birthday-person-list" role="list">${buildUpcomingBirthdayListHtml(categorized.week, 'week')}</div>
    </section>`
      : `<section class="birthday-sabha-section birthday-sabha-section--week">
      ${buildSectionHeaderHtml(weekTitle, 'bi-calendar-week', weekHeadingId)}
      ${buildBirthdayTodayEmptyHtml(L.EMPTY_WEEK)}
    </section>`;

  const monthSection =
    categorized.month.length > 0
      ? `<section id="${escapeHtml(monthSectionId)}" class="birthday-sabha-section birthday-sabha-section--month" aria-labelledby="${escapeHtml(monthHeadingId)}">
      ${buildSectionHeaderHtml(monthTitle, 'bi-calendar-month', monthHeadingId, {
        href: `#${monthSectionId}`,
        label: L.VIEW_ALL_MONTH_CTA,
      })}
      <p class="birthday-sabha-section__subtitle">${escapeHtml(L.MONTH_WIDGET_SUBTITLE)}</p>
      <div class="birthday-person-list" role="list">${buildUpcomingBirthdayListHtml(categorized.month, 'month')}</div>
      <footer class="birthday-sabha-section__footer">
        <a href="#${escapeHtml(monthSectionId)}" class="birthday-sabha-section__view-all birthday-sabha-section__view-all--centered">
          ${escapeHtml(L.VIEW_ALL_MONTH_CTA)} <i class="bi bi-chevron-right" aria-hidden="true"></i>
        </a>
      </footer>
    </section>`
      : `<section class="birthday-sabha-section birthday-sabha-section--month">
      ${buildSectionHeaderHtml(monthTitle, 'bi-calendar-month', monthHeadingId)}
      ${buildBirthdayTodayEmptyHtml(L.EMPTY_MONTH)}
    </section>`;

  return `
    <section class="birthday-sabha-section birthday-sabha-section--today">
      ${buildSectionHeaderHtml(todayHeading, 'bi-cake2-fill', `${weekHeadingId}-today`)}
      ${todayBody}
    </section>
    ${weekSection}
    ${monthSection}`;
}

/**
 * @param {import('../utils/birthday-date-utils.js').SabhaBirthdayGroup[]} groups
 * @param {string|null} [expandedSabha=null] Sabha name whose panel should start expanded.
 * @returns {string}
 */
export function buildSabhaAccordionHtml(groups, expandedSabha = null) {
  if (!groups.length) {
    return buildBirthdayTodayEmptyHtml(L.EMPTY_TODAY);
  }

  return groups
    .map((group, index) => {
      const collapseId = sabhaCollapseId(group.sabha, index);
      const isOpen = expandedSabha ? group.sabha === expandedSabha : index === 0;
      const headerInner = buildSabhaAccordionHeaderHtml(group.sabha, group.counts);
      const panelIds = {
        weekHeadingId: `${collapseId}-week-h`,
        monthHeadingId: `${collapseId}-month-h`,
        weekSectionId: `${collapseId}-week-sec`,
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
