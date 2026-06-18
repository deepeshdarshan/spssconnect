/**
 * @fileoverview Shared HTML builders for member/household result cards (Advanced Search,
 * Household Directory). Detail rows, contact pills, empty grid states, and footer bands.
 *
 * @module member-result-card-ui
 */

import { escapeHtml } from './ui-service.js';
import { normalizePhoneDigits, whatsappHref } from '../services/member-person-search.js';

/**
 * Centered empty state for household directory vs advanced search grids (Bootstrap Icons).
 * Returns static HTML only (no DOM writes); caller assigns to `innerHTML`.
 *
 * @param {string} messageEscaped - HTML-escaped line (e.g. {@link ../constants/constants.js MESSAGES.NO_RECORDS}).
 * @param {'household'|'members'} kind - `household` → buildings secondary icon; `members` → person-lines icon.
 * @returns {string} HTML fragment (root `.spss-results-empty`).
 */
export function buildResultsEmptyStateHtml(messageEscaped, kind) {
  const secondary = kind === 'household' ? 'bi-buildings' : 'bi-person-lines-fill';
  return `
    <div class="spss-results-empty" role="status">
      <div class="spss-results-empty__icons" aria-hidden="true">
        <span class="spss-results-empty__orbit spss-results-empty__orbit--primary"><i class="bi bi-search"></i></span>
        <span class="spss-results-empty__orbit spss-results-empty__orbit--secondary"><i class="bi ${secondary}"></i></span>
      </div>
      <p class="spss-results-empty__title">${messageEscaped}</p>
    </div>`;
}

/**
 * One detail row for advanced-search / household directory cards (icon + text).
 *
 * @param {string} iconClass - Bootstrap Icons class **including** the `bi-` prefix (e.g. `bi-geo-alt` → `class="bi bi-geo-alt"`).
 * @param {string} text - Escaped display text (or small HTML from trusted builders); passed through to the DOM.
 * @param {string} [rowExtraClass] - Optional extra class(es) on the row wrapper (e.g. SPSS position emphasis).
 * @returns {string} HTML fragment.
 */
export function buildCardDetailRowHtml(iconClass, text, rowExtraClass = '') {
  const display = text || '—';
  const extra = rowExtraClass.trim() ? ` ${rowExtraClass.trim()}` : '';
  return `
    <div class="advanced-search-card__detail${extra}">
      <span class="advanced-search-card__detail-icon" aria-hidden="true"><i class="bi ${iconClass}"></i></span>
      <span class="advanced-search-card__detail-text">${display}</span>
    </div>`;
}

/**
 * Builds a `tel:` href from a display phone when digits are usable.
 *
 * @param {string} phone
 * @returns {string|null}
 */
function telHref(phone) {
  const d = normalizePhoneDigits(phone);
  if (d.length === 10) return `tel:+91${d}`;
  if (d.length === 11 && d.startsWith('0')) return `tel:+91${d.slice(1)}`;
  if (d.length === 12 && d.startsWith('91')) return `tel:+${d}`;
  if (d.length >= 6) return `tel:${d}`;
  return null;
}

/**
 * @param {string} phone - Raw display phone.
 * @returns {string}
 */
export function buildCardPhoneBlockHtml(phone) {
  const trimmed = String(phone ?? '').trim();
  if (!trimmed) return '';
  const wa = whatsappHref(trimmed);
  if (wa) {
    return `<a href="${escapeHtml(wa)}" class="advanced-search-card__contact-pill advanced-search-card__contact-pill--whatsapp" target="_blank" rel="noopener noreferrer"><i class="bi bi-whatsapp" aria-hidden="true"></i><span>${escapeHtml(trimmed)}</span></a>`;
  }
  const tel = telHref(trimmed);
  if (tel) {
    return `<a href="${escapeHtml(tel)}" class="advanced-search-card__contact-pill advanced-search-card__contact-pill--phone"><i class="bi bi-telephone" aria-hidden="true"></i><span>${escapeHtml(trimmed)}</span></a>`;
  }
  return `<span class="advanced-search-card__contact-pill advanced-search-card__contact-pill--phone"><i class="bi bi-telephone" aria-hidden="true"></i><span>${escapeHtml(trimmed)}</span></span>`;
}

/**
 * @param {string} email
 * @returns {string}
 */
export function buildCardEmailBlockHtml(email) {
  const trimmed = String(email ?? '').trim();
  if (!trimmed) return '';
  return `<a href="mailto:${encodeURIComponent(trimmed)}" class="advanced-search-card__contact-pill advanced-search-card__contact-pill--email"><i class="bi bi-envelope" aria-hidden="true"></i><span>${escapeHtml(trimmed)}</span></a>`;
}

/**
 * @param {string} phone
 * @param {string} [email]
 * @returns {string}
 */
export function buildCardContactFooterHtml(phone, email = '') {
  const phoneBlock = buildCardPhoneBlockHtml(phone);
  const emailBlock = buildCardEmailBlockHtml(email);
  if (!phoneBlock && !emailBlock) return '';
  return `<footer class="advanced-search-card__footer advanced-search-card__interaction">${phoneBlock}${emailBlock}</footer>`;
}
