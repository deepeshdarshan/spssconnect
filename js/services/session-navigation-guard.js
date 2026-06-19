/**
 * @fileoverview Guards against browser back / bfcache restoring authenticated pages after sign-out.
 * Uses a sessionStorage invalidation flag plus auth re-validation on cached page restore.
 * @module session-navigation-guard
 */

import { auth } from './firebase-config.js';
import {
  clearRoleCache,
  fetchUserRole,
  getUserRole,
  ROLE_DISABLED,
  ROLE_PROFILE_ERROR,
  onAuthChange,
} from './auth-service.js';
import { canAccessPage } from './permissions.js';
import { ROUTES, SESSION_FORCE_LOGIN_KEY } from '../constants/constants.js';
import * as Logger from '../utils/logger.js';

/** Pages that are always reachable without an active Firebase session. */
const PUBLIC_PAGES = new Set(['landing', 'success', 'login']);

/** Pages that support guest workflows when signed out (must stay interactive). */
const GUEST_SESSION_PAGES = new Set(['phone_check', 'create', 'view']);

let guardInstalled = false;
let actionGuardInstalled = false;
let revalidating = false;
let loginRedirectScheduled = false;
let authListenerBound = false;

/**
 * @param {string} page
 * @returns {boolean}
 */
export function pageRequiresAuthenticatedSession(page) {
  if (PUBLIC_PAGES.has(page)) return false;
  if (GUEST_SESSION_PAGES.has(page)) return false;
  return true;
}

/**
 * @returns {boolean}
 */
export function isAuthenticatedSessionActive() {
  if (isSessionMarkedRequiresLogin()) return false;
  return !!auth.currentUser;
}

/**
 * Blocks stale admin UI interaction and sends the user to login once.
 *
 * @returns {void}
 */
function scheduleLoginRedirectAfterSignOut() {
  if (loginRedirectScheduled) return;
  loginRedirectScheduled = true;
  markSessionRequiresLogin();
  stripAuthenticatedSessionChrome();
  redirectToLoginAfterSignOut('session_expired');
}

/**
 * Marks the browser session as signed out so bfcache restores redirect to login.
 *
 * @returns {void}
 */
export function markSessionRequiresLogin() {
  try {
    sessionStorage.setItem(SESSION_FORCE_LOGIN_KEY, '1');
  } catch {
    /* private mode / quota */
  }
}

/**
 * Clears the post-sign-out invalidation flag after a successful login.
 *
 * @returns {void}
 */
export function clearSessionRequiresLogin() {
  try {
    sessionStorage.removeItem(SESSION_FORCE_LOGIN_KEY);
  } catch {
    /* private mode / quota */
  }
}

/**
 * @returns {boolean}
 */
export function isSessionMarkedRequiresLogin() {
  try {
    return sessionStorage.getItem(SESSION_FORCE_LOGIN_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Strips authenticated chrome and blocks interaction until auth is restored or redirect completes.
 *
 * @returns {void}
 */
export function stripAuthenticatedSessionChrome() {
  document.body.classList.remove(
    'is-authenticated',
    'is-admin',
    'is-super-admin',
    'phone-check-admin-shell',
  );
  document.body.classList.add('auth-session-locked');
  try {
    sessionStorage.removeItem('spss_role_ui');
  } catch {
    /* private mode / quota */
  }
}

/**
 * @returns {void}
 */
export function releaseAuthSessionLock() {
  document.body.classList.remove('auth-session-locked');
}

/**
 * Replaces the current history entry with the login page.
 *
 * @param {string} [reason] Optional `reason` query value for login messaging.
 * @returns {void}
 */
export function redirectToLoginAfterSignOut(reason) {
  const suffix = reason ? `?reason=${encodeURIComponent(reason)}` : '';
  window.location.replace(`${ROUTES.LOGIN}${suffix}`);
}

/**
 * Immediate redirect when a cached page is shown after sign-out.
 *
 * @param {string} page
 * @returns {boolean} True when a redirect was started.
 */
export function handleCachedPageAfterSignOut(page) {
  if (!isSessionMarkedRequiresLogin() || !pageRequiresAuthenticatedSession(page)) return false;
  scheduleLoginRedirectAfterSignOut();
  return true;
}

/**
 * Re-validates Firebase auth and RBAC for the current page (used after bfcache restore).
 *
 * @param {string} page
 * @returns {Promise<boolean>} False when a redirect was started.
 */
export async function revalidateSessionForPage(page) {
  if (PUBLIC_PAGES.has(page)) return true;

  try {
    await auth.authStateReady();
  } catch {
    /* authStateReady not supported in older SDKs */
  }

  if (!auth.currentUser) {
    stripAuthenticatedSessionChrome();
  }

  clearRoleCache();
  await fetchUserRole();

  const role = getUserRole();
  if (role === ROLE_PROFILE_ERROR) {
    markSessionRequiresLogin();
    redirectToLoginAfterSignOut('profile_load_failed');
    return false;
  }
  if (role === ROLE_DISABLED) {
    markSessionRequiresLogin();
    redirectToLoginAfterSignOut('no_profile');
    return false;
  }

  if (!canAccessPage(page)) {
    if (!auth.currentUser) {
      scheduleLoginRedirectAfterSignOut();
    } else {
      redirectToLoginAfterSignOut();
    }
    return false;
  }

  if (auth.currentUser) {
    releaseAuthSessionLock();
    loginRedirectScheduled = false;
  } else if (pageRequiresAuthenticatedSession(page)) {
    stripAuthenticatedSessionChrome();
  }

  return true;
}

/**
 * @param {string} page
 * @returns {Promise<void>}
 */
async function handlePersistedPageShow(page) {
  if (handleCachedPageAfterSignOut(page)) return;

  if (revalidating) return;
  revalidating = true;
  try {
    await revalidateSessionForPage(page);
  } catch (err) {
    Logger.error('Session navigation guard failed', err);
    if (pageRequiresAuthenticatedSession(page) && !auth.currentUser) {
      scheduleLoginRedirectAfterSignOut();
    }
  } finally {
    revalidating = false;
  }
}

/**
 * Capture-phase guard: blocks clicks, submits, and control changes on auth-required pages
 * when the Firebase session is missing or was invalidated by sign-out.
 *
 * @param {string} page
 * @returns {void}
 */
function installAdminSessionActionGuard(page) {
  if (actionGuardInstalled || !pageRequiresAuthenticatedSession(page)) return;
  actionGuardInstalled = true;

  const blockIfSessionInactive = (event) => {
    if (isAuthenticatedSessionActive()) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
    scheduleLoginRedirectAfterSignOut();
  };

  document.addEventListener('click', blockIfSessionInactive, true);
  document.addEventListener('submit', blockIfSessionInactive, true);
  document.addEventListener('change', blockIfSessionInactive, true);
  document.addEventListener('input', blockIfSessionInactive, true);
}

/**
 * Locks the admin shell as soon as Firebase reports sign-out on an auth-required page.
 *
 * @param {string} page
 * @returns {void}
 */
function installAuthStateSessionListener(page) {
  if (authListenerBound || !pageRequiresAuthenticatedSession(page)) return;
  authListenerBound = true;

  onAuthChange((user) => {
    if (!pageRequiresAuthenticatedSession(page)) return;
    if (isAuthenticatedSessionActive()) {
      releaseAuthSessionLock();
      loginRedirectScheduled = false;
      return;
    }
    if (!user || isSessionMarkedRequiresLogin()) {
      scheduleLoginRedirectAfterSignOut();
    }
  });
}

/**
 * @returns {Promise<boolean>} Resolves false when the session is not active.
 */
export async function requireAuthenticatedSession() {
  try {
    await auth.authStateReady();
  } catch {
    /* authStateReady not supported in older SDKs */
  }
  if (isAuthenticatedSessionActive()) return true;
  scheduleLoginRedirectAfterSignOut();
  return false;
}

/**
 * Keeps the login page as the effective back target after sign-out.
 *
 * @returns {void}
 */
export function installLoginHistoryTrap() {
  if (window.history.state?.spssLoginTrap) return;
  history.replaceState({ spssLoginTrap: true }, '', window.location.href);
  window.addEventListener('popstate', () => {
    history.pushState({ spssLoginTrap: true }, '', window.location.href);
  });
}

/**
 * Registers `pageshow` / `visibilitychange` listeners for session invalidation.
 *
 * @param {string} page Current page id from app bootstrap.
 * @returns {void}
 */
export function installSessionNavigationGuard(page) {
  if (guardInstalled) return;
  guardInstalled = true;

  installAdminSessionActionGuard(page);
  installAuthStateSessionListener(page);

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    void handlePersistedPageShow(page);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!pageRequiresAuthenticatedSession(page)) return;
    if (!isSessionMarkedRequiresLogin() && isAuthenticatedSessionActive()) return;
    if (isSessionMarkedRequiresLogin()) {
      handleCachedPageAfterSignOut(page);
      return;
    }
    if (!auth.currentUser) {
      scheduleLoginRedirectAfterSignOut();
    }
  });

  if (page === 'login') {
    installLoginHistoryTrap();
  }
}
