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
 *   super_admin — full access including import
 *   admin       — everything except import
 *   user        — authenticated user, limited to public pages + viewing
 *   guest       — unauthenticated, public pages only
 */
export const PERMISSIONS = Object.freeze({
  super_admin: {
    pages: ['landing', 'login', 'create', 'success', 'view', 'dashboard', 'import', 'user_management'],
    actions: ['create', 'update', 'delete', 'export_pdf', 'share', 'import', 'manage_users'],
  },
  admin: {
    pages: ['landing', 'login', 'create', 'success', 'view', 'dashboard'],
    actions: ['create', 'update', 'delete', 'export_pdf', 'share'],
  },
  user: {
    pages: ['landing', 'login', 'view', 'dashboard'],
    actions: ['export_pdf', 'share'],
  },
  guest: {
    pages: ['landing', 'create', 'success', 'view'],
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
 * Checks whether the current user can access the given page.
 * @param {string} page - Page identifier (e.g. 'dashboard', 'create').
 * @returns {boolean}
 */
export function canAccessPage(page) {
  return getPermissions().pages.includes(page);
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
