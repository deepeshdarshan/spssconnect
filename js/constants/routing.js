/**
 * @fileoverview Application routes and view/create page referrer navigation.
 * @module constants/routing
 */

/**
 * Application routes (URL pathnames). Some admin nav labels differ from the slug
 * (e.g. phone number lookup uses path `phone-check`).
 */
export const ROUTES = Object.freeze({
  LOGIN: '/login',
  ADMIN_DASHBOARD: '/admin-dashboard',
  MEMBER_MANAGEMENT: '/member-management',
  ADMIN_CONTACTS: '/admin-contacts',
  /** Phone number lookup page; slug remains `phone-check` for links and hosting. */
  PHONE_CHECK: '/phone-check',
  CREATE: '/create',
  VIEW: '/view',
  ADVANCED_MEMBER_SEARCH: '/advanced-member-search',
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
 * Resolves the relative path for the view page "Back" button from the `from` query value.
 * Unknown or missing values default to the household directory (`member-management`).
 *
 * @param {string|null|undefined} fromValue - Raw `from` query string.
 * @returns {string} Relative path without a leading slash (e.g. `member-management`).
 */
export function resolveRecordsListHrefFromViewReferrer(fromValue) {
  const v = String(fromValue ?? '').trim();
  if (v === VIEW_REFERRER.ADVANCED_SEARCH) return 'advanced-member-search';
  return 'member-management';
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
