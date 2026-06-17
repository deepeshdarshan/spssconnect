/**
 * @fileoverview HTML builder for household directory result cards.
 * Reuses Advanced Search card styling via shared {@link ./member-result-card-ui.js} helpers.
 *
 * @module household-card-ui
 */

import { escapeHtml } from './ui-service.js';
import {
  buildCardDetailRowHtml,
  buildCardContactFooterHtml,
} from './member-result-card-ui.js';
import { HOUSEHOLD_DIRECTORY, VIEW_PAGE_FROM_PARAM } from '../constants/constants.js';
import { formatHouseholdAddress } from '../services/member-person-search.js';

/**
 * @typedef {Object} HouseholdCardOptions
 * @property {number} pdfDataIndex - Global index in filtered list for per-row PDF export.
 * @property {string} viewReferrer - Value for `VIEW_PAGE_FROM_PARAM` on view/edit links.
 */

/**
 * Membership stat chips for members and non-members.
 *
 * @param {number} memberCount
 * @param {number} nonMemberCount
 * @returns {string}
 */
function buildMembershipStatsHtml(memberCount, nonMemberCount) {
  const esc = escapeHtml;
  const membersLabel = HOUSEHOLD_DIRECTORY.MEMBERS_LABEL;
  const nonMembersLabel = HOUSEHOLD_DIRECTORY.NON_MEMBERS_LABEL;
  return `
    <div class="household-directory-card__stats" aria-label="Household membership summary">
      <span class="advanced-search-card__meta-chip household-directory-card__stat-chip household-directory-card__stat-chip--members">
        <i class="bi bi-people-fill" aria-hidden="true"></i>
        ${esc(membersLabel)}: ${memberCount}
      </span>
      <span class="advanced-search-card__meta-chip household-directory-card__stat-chip household-directory-card__stat-chip--non-members">
        <i class="bi bi-person-dash" aria-hidden="true"></i>
        ${esc(nonMembersLabel)}: ${nonMemberCount}
      </span>
    </div>`;
}

/**
 * Card actions footer: View, Edit, Delete (admin), plus flat PDF and Share actions.
 *
 * @param {Object} rec - Household record with `id`.
 * @param {number} pdfDataIndex
 * @param {string} viewReferrer
 * @returns {string}
 */
function buildHouseholdActionsFooterHtml(rec, pdfDataIndex, viewReferrer) {
  const esc = escapeHtml;
  const id = esc(rec.id);
  const viewHref = `view?id=${id}&${VIEW_PAGE_FROM_PARAM}=${viewReferrer}`;
  const editHref = `view?id=${id}&edit=1&${VIEW_PAGE_FROM_PARAM}=${viewReferrer}`;

  return `
    <footer class="household-directory-card__actions auth-only advanced-search-card__interaction">
      <div class="household-directory-card__actions-inner">
        <div class="household-directory-card__actions-primary admin-only">
          <a href="${viewHref}" class="btn btn-outline-primary btn-sm" title="${esc(HOUSEHOLD_DIRECTORY.ACTION_VIEW)}" aria-label="${esc(HOUSEHOLD_DIRECTORY.ACTION_VIEW)}">
            <i class="bi bi-eye" aria-hidden="true"></i>
            <span class="household-directory-card__action-label">View</span>
          </a>
          <a href="${editHref}" class="btn btn-outline-secondary btn-sm" title="${esc(HOUSEHOLD_DIRECTORY.ACTION_EDIT)}" aria-label="${esc(HOUSEHOLD_DIRECTORY.ACTION_EDIT)}">
            <i class="bi bi-pencil" aria-hidden="true"></i>
            <span class="household-directory-card__action-label">Edit</span>
          </a>
          <button type="button" class="btn btn-outline-danger btn-sm btn-delete" data-id="${id}" title="${esc(HOUSEHOLD_DIRECTORY.ACTION_DELETE)}" aria-label="${esc(HOUSEHOLD_DIRECTORY.ACTION_DELETE)}">
            <i class="bi bi-trash" aria-hidden="true"></i>
            <span class="household-directory-card__action-label">Delete</span>
          </button>
        </div>
        <div class="household-directory-card__actions-utilities">
          <button type="button" class="household-directory-card__flat-action btn-pdf" data-id="${id}" title="${esc(HOUSEHOLD_DIRECTORY.ACTION_PDF)}" aria-label="${esc(HOUSEHOLD_DIRECTORY.ACTION_PDF)}">
            <i class="bi bi-file-earmark-pdf" aria-hidden="true"></i>
            <span class="household-directory-card__flat-action-label">PDF</span>
          </button>
          <button type="button" class="household-directory-card__flat-action btn-share" data-id="${id}" title="${esc(HOUSEHOLD_DIRECTORY.ACTION_SHARE)}" aria-label="${esc(HOUSEHOLD_DIRECTORY.ACTION_SHARE)}">
            <i class="bi bi-share" aria-hidden="true"></i>
            <span class="household-directory-card__flat-action-label">Share</span>
          </button>
        </div>
      </div>
    </footer>`;
}

/**
 * House icon placeholder (mirrors Advanced Search avatar silhouette).
 *
 * @returns {string}
 */
function buildHouseIconHtml() {
  return `
    <div class="advanced-search-card__placeholder household-directory-card__icon" aria-hidden="true">
      <i class="bi bi-house-door-fill"></i>
    </div>`;
}

/**
 * Builds one household directory result card.
 *
 * @param {Object} rec - `member_details` document with `id` and nested fields.
 * @param {HouseholdCardOptions} options
 * @returns {string} HTML snippet (caller joins; values escaped where user-controlled).
 */
export function buildHouseholdCardHtml(rec, { pdfDataIndex, viewReferrer }) {
  const pd = rec.personalDetails || {};
  const houseName = pd.houseName || '—';
  const ownerName = pd.name || '—';
  const address = formatHouseholdAddress(pd) || '—';
  const sabha = pd.pradeshikaSabha || '—';
  const phoneStr = String(pd.phone ?? '');
  const emailStr = String(pd.email ?? '');
  const memberCount = (rec.members || []).length;
  const nonMemberCount = (rec.nonMembers || []).length;

  const viewHref = `view?id=${escapeHtml(rec.id)}&${VIEW_PAGE_FROM_PARAM}=${viewReferrer}`;
  const viewAria =
    houseName && houseName !== '—'
      ? `${HOUSEHOLD_DIRECTORY.STRETCHED_LINK_ARIA_BASE}${HOUSEHOLD_DIRECTORY.STRETCHED_LINK_ARIA_NAME_PREFIX}${houseName}`
      : HOUSEHOLD_DIRECTORY.STRETCHED_LINK_ARIA_BASE;

  return `
    <article class="advanced-search-card household-directory-card card-spss" role="listitem">
      <div class="advanced-search-card__main household-directory-card__main">
        <div class="advanced-search-card__avatar household-directory-card__avatar">${buildHouseIconHtml()}</div>
        <div class="advanced-search-card__header-body">
          <div class="advanced-search-card__header">
            <h2 class="household-directory-card__house-name h6 mb-0">
              <a href="${viewHref}" class="household-directory-card__house-link stretched-link" aria-label="${escapeHtml(viewAria)}">${escapeHtml(houseName)}</a>
            </h2>
            <span class="advanced-search-card__chevron" aria-hidden="true"><i class="bi bi-chevron-right"></i></span>
          </div>
          <p class="household-directory-card__owner-name mb-0">${escapeHtml(ownerName)}</p>
        </div>
      </div>
      <div class="advanced-search-card__details">
        ${buildCardDetailRowHtml('bi-geo-alt', escapeHtml(address))}
        ${buildCardDetailRowHtml('bi-building', escapeHtml(sabha))}
      </div>
      ${buildMembershipStatsHtml(memberCount, nonMemberCount)}
      ${buildCardContactFooterHtml(phoneStr, emailStr)}
      ${buildHouseholdActionsFooterHtml(rec, pdfDataIndex, viewReferrer)}
    </article>
  `;
}
