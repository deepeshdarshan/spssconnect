/**
 * @fileoverview Application routes and view/create page referrer navigation.
 * @module constants/routing
 */

import { FAMILY_TREE } from './family-tree.js';

/**
 * Application routes (URL pathnames). Some admin nav labels differ from the slug
 * (e.g. phone number lookup uses path `phone-check`).
 */
export const ROUTES = Object.freeze({
  LOGIN: '/login',
  ADMIN_DASHBOARD: '/admin-dashboard',
  HOUSEHOLD_DIRECTORY: '/household-directory',
  ADMIN_CONTACTS: '/admin-contacts',
  /** Phone number lookup page; slug remains `phone-check` for links and hosting. */
  PHONE_CHECK: '/phone-check',
  CREATE: '/create',
  VIEW: '/view',
  ADVANCED_MEMBER_SEARCH: '/advanced-member-search',
  BIRTHDAY_DASHBOARD: '/birthday-dashboard',
  FAMILY_TREE: '/family-tree',
  BACKUP_SYNC_CENTER: '/backup-sync-center',
  BACKUP_RESTORE_CENTER: '/backup-restore-center',
  BACKUP_SYNC: '/backup-sync',
  RESTORE_CENTER: '/restore-center',
});

/**
 * Query param on the view page indicating which records list opened this record
 * (used for the view page "Back" navigation and the create page "return to list" link).
 */
export const VIEW_PAGE_FROM_PARAM = 'from';

/** Allowed values for {@link VIEW_PAGE_FROM_PARAM}. */
export const VIEW_REFERRER = Object.freeze({
  MEMBER_LIST: 'member-list',
  ADVANCED_SEARCH: 'advanced-search',
});

/**
 * Allowed `from` values on the family tree page ({@link VIEW_PAGE_FROM_PARAM}).
 * Household directory uses {@link VIEW_REFERRER.MEMBER_LIST}; the view page uses `view`.
 */
export const FAMILY_TREE_REFERRER = Object.freeze({
  HOUSEHOLD_DIRECTORY: VIEW_REFERRER.MEMBER_LIST,
  VIEW: 'view',
});

/**
 * Resolves the relative path for the view page "Back" button from the `from` query value.
 * Unknown or missing values default to the household directory (`household-directory`).
 *
 * @param {string|null|undefined} fromValue - Raw `from` query string.
 * @returns {string} Relative path without a leading slash (e.g. `household-directory`).
 */
export function resolveRecordsListHrefFromViewReferrer(fromValue) {
  const v = String(fromValue ?? '').trim();
  if (v === VIEW_REFERRER.ADVANCED_SEARCH) return 'advanced-member-search';
  return 'household-directory';
}

/**
 * Create page (`create.html`) header link back to the list the user came from.
 * Uses the same `from` query param and values as the view page ({@link VIEW_PAGE_FROM_PARAM}, {@link VIEW_REFERRER}).
 *
 * @param {string|null|undefined} fromValue - Raw `from` query string.
 * @returns {{ href: string, label: string, ariaLabel: string }}
 */
export function resolveCreatePageBackNav(fromValue) {
  const href = resolveRecordsListHrefFromViewReferrer(fromValue);
  const advanced = String(fromValue ?? '').trim() === VIEW_REFERRER.ADVANCED_SEARCH;
  return {
    href,
    label: advanced ? 'Advanced member search' : 'Household directory',
    ariaLabel: advanced ? 'Return to advanced member search' : 'Return to household directory',
  };
}

/**
 * Builds the relative URL for the Family Relationship Tree page.
 * Supports `family-tree?id=` (static hosting) and `/households/{id}/family-tree` when rewrites are configured.
 *
 * @param {string} householdId - `member_details` document id.
 * @param {string} [fromReferrer] - Optional {@link FAMILY_TREE_REFERRER} value for dynamic back navigation.
 * @returns {string}
 */
export function buildFamilyTreeHref(householdId, fromReferrer) {
  const rawId = String(householdId ?? '').trim();
  const id = encodeURIComponent(rawId);
  const from = String(fromReferrer ?? '').trim();
  if (!from) return `family-tree?id=${id}`;
  return `family-tree?id=${id}&${VIEW_PAGE_FROM_PARAM}=${encodeURIComponent(from)}`;
}

/**
 * Family tree page back link and label from the `from` query value.
 * Defaults to the household directory when unknown or when returning to the view page without a record id.
 *
 * @param {string|null|undefined} fromValue - Raw `from` query string.
 * @param {string|null|undefined} [recordId] - Household record id (required when `from` is {@link FAMILY_TREE_REFERRER.VIEW}).
 * @returns {{ href: string, label: string, ariaLabel: string }}
 */
export function resolveFamilyTreeBackNav(fromValue, recordId) {
  const fromView = String(fromValue ?? '').trim() === FAMILY_TREE_REFERRER.VIEW;
  const id = String(recordId ?? '').trim();
  if (fromView && id) {
    return {
      href: `view?id=${encodeURIComponent(id)}`,
      label: FAMILY_TREE.BACK_TO_VIEW,
      ariaLabel: FAMILY_TREE.BACK_ARIA_VIEW,
    };
  }
  return {
    href: 'household-directory',
    label: FAMILY_TREE.BACK_TO_DIRECTORY,
    ariaLabel: FAMILY_TREE.BACK_ARIA,
  };
}
