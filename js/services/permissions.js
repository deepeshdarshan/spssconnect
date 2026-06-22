/**
 * @fileoverview Centralized role-based access control (RBAC) for SPSS Connect.
 * Defines which pages and actions each role can access, and provides
 * helper functions for gating page access and UI visibility.
 * @module permissions
 */

import { getUserRole } from './auth-service.js';

/**
 * Permissions map — each role lists the pages it can visit
 * and the actions it can perform.
 *
 * Roles:
 *   super_admin — full access
 *   admin       — all admin features for their scope
 *   user        — authenticated user, limited to public pages + viewing
 *   guest       — unauthenticated, public pages only
 *   disabled       — logged in but no users doc (e.g. removed from app); access only landing + login
 *   profile_error  — Firestore failed while loading users/{uid} (network / App Check / rules)
 *
 * Household directory (`household_directory`) and advanced search (`advanced_member_search`) stay
 * aligned in {@link canAccessPage}: any role with `household_directory` may open advanced search.
 */
export const PERMISSIONS = Object.freeze({
  disabled: {
    pages: ['landing', 'login'],
    actions: [],
  },
  profile_error: {
    pages: ['landing', 'login'],
    actions: [],
  },
  super_admin: {
    pages: ['landing', 'login', 'phone_check', 'create', 'success', 'view', 'admin_dashboard', 'household_directory', 'advanced_member_search', 'birthday_dashboard', 'user_management', 'admin_contacts', 'jilla_membership', 'backup_restore_center', 'backup_sync', 'restore_center'],
    actions: ['create', 'update', 'delete', 'export_pdf', 'share', 'manage_users'],
  },
  admin: {
    pages: ['landing', 'login', 'phone_check', 'create', 'success', 'view', 'admin_dashboard', 'household_directory', 'advanced_member_search', 'birthday_dashboard'],
    actions: ['create', 'update', 'delete', 'export_pdf', 'share'],
  },
  user: {
    pages: ['landing', 'login', 'phone_check', 'view', 'admin_dashboard', 'household_directory', 'advanced_member_search'],
    actions: ['export_pdf', 'share'],
  },
  guest: {
    pages: ['landing', 'phone_check', 'create', 'success', 'view'],
    actions: ['create', 'export_pdf'],
  },
});

/**
 * Returns the permissions object for the current user's role.
 * Falls back to guest permissions if the role is unknown.
 * @returns {{ pages: string[], actions: string[] }}
 */
export function getPermissions() {
  const role = getUserRole();
  return PERMISSIONS[role] || PERMISSIONS.guest;
}

/**
 * Advanced member search is allowed for every role that may open the household directory
 * (`household_directory`), so the two never get out of sync if page lists are edited separately.
 *
 * @param {string[]} pages - Role's `pages` array from {@link PERMISSIONS}.
 * @returns {boolean}
 */
function canAccessAdvancedMemberSearch(pages) {
  return pages.includes('advanced_member_search') || pages.includes('household_directory');
}

/**
 * Checks whether the current user can access the given page.
 * @param {string} page - Page identifier (e.g. 'dashboard', 'create').
 * @returns {boolean}
 */
export function canAccessPage(page) {
  const pages = getPermissions().pages;
  if (page === 'advanced_member_search') {
    return canAccessAdvancedMemberSearch(pages);
  }
  return pages.includes(page);
}

/**
 * Checks whether the current user can perform the given action.
 * @param {string} action - Action identifier (e.g. 'delete', 'share').
 * @returns {boolean}
 */
export function canPerformAction(action) {
  return getPermissions().actions.includes(action);
}

/**
 * Applies visibility to all elements with a `data-action` attribute.
 * Elements whose action is not permitted for the current role are hidden.
 */
export function applyActionVisibility() {
  const elements = document.querySelectorAll('[data-action]');
  elements.forEach((el) => {
    const action = el.getAttribute('data-action');
    const allowed = canPerformAction(action);
    el.classList.toggle('d-none', !allowed);
  });
}
