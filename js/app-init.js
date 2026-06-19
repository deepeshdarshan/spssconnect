/**
 * @fileoverview Application initializer — auth guard, role routing, page bootstrapping.
 * Runs on every page load to enforce authentication and configure the UI based on user role.
 * @module app-init
 */

import { logoutUser, isAdmin as checkIsAdmin, isSuperAdmin as checkIsSuperAdmin, loginUser, fetchUserRole, clearRoleCache, getUserRole, ROLE_DISABLED, ROLE_PROFILE_ERROR } from './services/auth-service.js';
import { ROUTES, MESSAGES, AUTH_ERRORS, SESSION_KEY_ROLE_UI } from './constants/constants.js';
import { showToast, showLoader, hideLoaderAfterPaint, setButtonLoading } from './ui/ui-service.js';
import { auth } from './services/firebase-config.js';
import {
  clearSessionActivityRecord,
  isSessionIdleExpiredByStoredActivity,
  startSessionIdleMonitor,
  stopSessionIdleMonitor,
  touchSessionActivityRecordNow,
} from './services/session-idle-timeout.js';
import {
  markSessionRequiresLogin,
  clearSessionRequiresLogin,
  redirectToLoginAfterSignOut,
  installSessionNavigationGuard,
} from './services/session-navigation-guard.js';
import { canAccessPage, applyActionVisibility } from './services/permissions.js';
import { initAdminShellNav } from './ui/admin-shell-nav.js';
import { initAdminShellMobileDrawer } from './ui/admin-shell-mobile-drawer.js';
import * as Logger from './utils/logger.js';

/**
 * Determines the current page from the URL pathname.
 * @returns {string} One of 'login', 'admin_dashboard', 'household_directory', 'create', 'view', 'phone_check', etc.
 */
function getCurrentPage() {
  const path = window.location.pathname;
  if (path.includes('user-management')) return 'user_management';
  if (path.includes('jilla-membership')) return 'jilla_membership';
  if (path.includes('admin-contacts')) return 'admin_contacts';
  if (path.includes('backup-restore-center')) return 'backup_restore_center';
  if (path.includes('restore-center')) return 'restore_center';
  if (path.includes('backup-sync')) return 'backup_sync';
  if (path.includes('backup-sync-center')) return 'backup_restore_center';
  if (path.includes('admin-dashboard')) return 'admin_dashboard';
  if (path.includes('advanced-member-search')) return 'advanced_member_search';
  if (path.includes('household-directory') || path.includes('member-management')) return 'household_directory';
  if (path.includes('phone-check')) return 'phone_check';
  if (path.includes('success')) return 'success';
  if (path.includes('create')) return 'create';
  if (path.includes('view')) return 'view';
  if (path.includes('login')) return 'login';
  return 'landing';
}

/**
 * Applies role-based classes to body so CSS can show/hide role-specific elements,
 * and toggles visibility of elements with data-action attributes via the permissions module.
 * @param {boolean} admin
 * @param {boolean} superAdmin
 */
function applyRoleUI(admin, superAdmin) {
  document.body.classList.toggle('is-admin', admin);
  document.body.classList.toggle('is-super-admin', superAdmin);
  try {
    sessionStorage.setItem(SESSION_KEY_ROLE_UI, JSON.stringify({ admin, superAdmin }));
  } catch {
    /* private mode / quota */
  }
  applyActionVisibility();
}

/**
 * Binds the logout button on pages that have one.
 */
function bindLogoutButton() {
  const bind = (btn) => {
    if (!btn || btn.dataset.logoutBound === '1') return;
    btn.dataset.logoutBound = '1';
    btn.addEventListener('click', async () => {
      stopSessionIdleMonitor();
      clearSessionActivityRecord();
      clearRoleCache();
      markSessionRequiresLogin();
      await logoutUser();
      redirectToLoginAfterSignOut();
    });
  };
  bind(document.getElementById('logoutBtn'));
  bind(document.getElementById('logoutBtnTop'));
}

/**
 * Displays the current user's email in the navbar.
 * @param {string} email
 */
function displayUserEmail(email) {
  const text = String(email ?? '');
  const primary = document.getElementById('userEmail');
  if (primary) primary.textContent = text;
  const top = document.getElementById('userEmailTop');
  if (top) top.textContent = text;
}

/**
 * Toggles navbar elements between authenticated and unauthenticated states.
 * On public pages (e.g. create), logged-out users see guest chrome (e.g. language toggle) instead of logout/email.
 * @param {boolean} loggedIn
 */
function showAuthenticatedNav(loggedIn) {
  const authNav = document.getElementById('authNav');
  const guestNav = document.getElementById('guestNav');
  if (authNav) authNav.classList.toggle('d-none', !loggedIn);
  if (guestNav) guestNav.classList.toggle('d-none', loggedIn);
}

/**
 * Initializes the login page — binds the login form.
 */
function initLoginPage() {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  const params = new URLSearchParams(window.location.search);
  if (params.has('username') || params.has('password')) {
    window.history.replaceState({}, '', window.location.pathname);
  }
  if (params.get('account') === 'disabled') {
    showToast(MESSAGES.ACCOUNT_DISABLED, 'error');
    window.history.replaceState({}, '', window.location.pathname);
  } else if (params.get('reason') === 'profile_load_failed') {
    showToast(MESSAGES.PROFILE_LOAD_FAILED, 'error');
    window.history.replaceState({}, '', window.location.pathname);
  } else if (params.get('reason') === 'no_profile') {
    showToast(MESSAGES.NO_APP_PROFILE, 'error');
    window.history.replaceState({}, '', window.location.pathname);
  } else if (params.get('reason') === 'session_idle') {
    showToast(MESSAGES.SESSION_IDLE_EXPIRED, 'error');
    window.history.replaceState({}, '', window.location.pathname);
  } else if (params.get('reason') === 'session_expired') {
    showToast(MESSAGES.SESSION_EXPIRED, 'error');
    window.history.replaceState({}, '', window.location.pathname);
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');
    setButtonLoading(btn, true, MESSAGES.SIGNING_IN);
    try {
      await loginUser(email, password);
      touchSessionActivityRecordNow();
      clearSessionRequiresLogin();
      window.location.href = ROUTES.ADMIN_DASHBOARD;
    } catch (err) {
      const code = normalizeLoginErrorCode(err);
      let message;
      if (err && err.code === 'app/no-user-profile') {
        message = MESSAGES.NO_APP_PROFILE;
      } else if (err && err.code === 'app/profile-read-failed') {
        message = MESSAGES.PROFILE_LOAD_FAILED;
      } else if (code === 'permission-denied') {
        message = MESSAGES.FIRESTORE_ACCESS_HINT;
      } else if (code === 'failed-precondition') {
        message = MESSAGES.PROFILE_LOAD_FAILED;
      } else if (err && err.code === 'auth/account-disabled') {
        message = MESSAGES.ACCOUNT_DISABLED;
      } else {
        message = friendlyAuthError(code || (err && err.code), err);
      }
      showToast(message, 'error');
      setButtonLoading(btn, false);
    }
  });
}

/**
 * Maps Firestore / wrapped errors to codes our UI already handles.
 * @param {unknown} err
 * @returns {string|undefined} Normalized code, or undefined
 */
function normalizeLoginErrorCode(err) {
  const raw = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
  if (!raw) return undefined;
  if (raw === 'permission-denied' || raw.endsWith('/permission-denied')) {
    return 'permission-denied';
  }
  if (raw === 'unauthenticated' || raw.endsWith('/unauthenticated')) {
    return 'permission-denied';
  }
  if (raw === 'failed-precondition' || raw.includes('failed-precondition')) {
    return 'failed-precondition';
  }
  return raw;
}

/**
 * Converts Firebase auth error codes to user-friendly messages.
 * Logs unmapped codes so you can see the real value in DevTools → Console.
 * @param {string|undefined} code
 * @param {unknown} [err] Full error for logging
 * @returns {string}
 */
function friendlyAuthError(code, err) {
  if (code && AUTH_ERRORS[code]) return AUTH_ERRORS[code];
  if (code) {
    Logger.warn('Unmapped login error code:', code, err);
  } else {
    Logger.warn('Login error with no code:', err);
  }
  return MESSAGES.AUTH_GENERIC;
}

/**
 * Dynamically imports and initializes the page-specific module.
 * @param {string} page
 * @param {boolean} admin
 */
async function initPageModule(page, admin) {
  try {
    switch (page) {
      case 'household_directory': {
        const { initDashboard } = await import('./pages/dashboard-service.js');
        await initDashboard(admin);
        break;
      }
      case 'advanced_member_search': {
        const { initAdvancedMemberSearch } = await import('./pages/member-advanced-search-page.js');
        await initAdvancedMemberSearch();
        break;
      }
      case 'phone_check': {
        const { initPhoneCheckPage } = await import('./pages/phone-check-page.js');
        await initPhoneCheckPage();
        break;
      }
      case 'create': {
        const { initForm } = await import('./pages/form-handler.js');
        initForm();
        break;
      }
      case 'view': {
        const { initViewPage } = await import('./pages/view-service.js');
        await initViewPage(admin);
        break;
      }
      case 'user_management': {
        const { initUserManagement } = await import('./pages/user-management.js');
        await initUserManagement();
        break;
      }
      case 'jilla_membership': {
        const { initJillaMembershipPage } = await import('./pages/jilla-membership.js');
        await initJillaMembershipPage();
        break;
      }
      case 'admin_contacts': {
        const { initAdminContactsPage } = await import('./pages/admin-contacts-page.js');
        await initAdminContactsPage();
        break;
      }
      case 'backup_restore_center': {
        const { initBackupRestoreCenterPage } = await import('./pages/backup-restore-center-page.js');
        await initBackupRestoreCenterPage();
        break;
      }
      case 'backup_sync': {
        const { initBackupSyncPage } = await import('./pages/backup-sync-page.js');
        await initBackupSyncPage();
        break;
      }
      case 'restore_center': {
        const { initRestoreCenterPage } = await import('./pages/restore-center-page.js');
        await initRestoreCenterPage();
        break;
      }
      case 'admin_dashboard': {
        // Query busts browser ES-module cache for the admin dashboard graph after deploys.
        const { initAdminDashboard } = await import('./pages/admin-dashboard-page.js?v=20260612-1');
        await initAdminDashboard();
        break;
      }
    }
  } catch (err) {
    Logger.error(`Failed to initialize ${page} module:`, err);
    showToast(MESSAGES.PAGE_LOAD_FAIL, 'error');
  }
}

/**
 * Signs out and redirects to login after the idle timeout fires.
 * Stops the idle monitor first so the redirect is not re-entered.
 *
 * @returns {Promise<void>}
 */
async function completeSessionIdleTerminationRedirect() {
  stopSessionIdleMonitor();
  clearSessionActivityRecord();
  clearRoleCache();
  markSessionRequiresLogin();
  try {
    await logoutUser();
  } catch (err) {
    Logger.error('Session idle sign-out failed:', err);
  }
  redirectToLoginAfterSignOut('session_idle');
}

/**
 * When a persisted session exists but last activity is past the idle limit, signs out and redirects.
 *
 * @returns {Promise<boolean>} True if bootstrap must stop (redirect scheduled).
 */
async function terminateIfSessionIdleExpired() {
  if (!auth.currentUser) return false;
  if (!isSessionIdleExpiredByStoredActivity()) return false;
  await completeSessionIdleTerminationRedirect();
  return true;
}

/* ------------------------------------------------------------------ */
/*  Bootstrap — runs on page load                                      */
/* ------------------------------------------------------------------ */

const page = getCurrentPage();
installSessionNavigationGuard(page);

/**
 * Waits for Firebase Auth to fully resolve the persisted session from IndexedDB
 * before making any routing decisions. This prevents false redirects when
 * navigating between pages (e.g. dashboard → view) where the auth state
 * hasn't loaded yet on the new page.
 *
 * Boot overlay: shows `#loadingOverlay` immediately (HTML is visible by default on app pages),
 * keeps it through auth, RBAC, page init, and admin-shell setup, then dismisses after paint.
 */
async function bootstrap() {
  if (page !== 'landing' && page !== 'success' && page !== 'login') {
    showLoader(page === 'create' ? MESSAGES.LOADING_CREATE_FORM : undefined);
  }

  try {
    await auth.authStateReady();
  } catch {
    // authStateReady not supported in older SDKs; fall through
  }

  const user = auth.currentUser;

  /** @returns {void} */
  const runIdleSignOut = () => {
    void completeSessionIdleTerminationRedirect();
  };

  if (await terminateIfSessionIdleExpired()) {
    return;
  }

  // Fetch and cache the user's role from Firestore (sets 'guest' if not logged in)
  await fetchUserRole();

  // Firestore unreadable for this session — not "disabled"; sign out and explain
  if (getUserRole() === ROLE_PROFILE_ERROR) {
    stopSessionIdleMonitor();
    clearSessionActivityRecord();
    markSessionRequiresLogin();
    await logoutUser();
    clearRoleCache();
    redirectToLoginAfterSignOut('profile_load_failed');
    return;
  }

  // User has no users doc (e.g. removed from app) — sign out and send to login with message
  if (getUserRole() === ROLE_DISABLED) {
    stopSessionIdleMonitor();
    clearSessionActivityRecord();
    markSessionRequiresLogin();
    await logoutUser();
    clearRoleCache();
    redirectToLoginAfterSignOut('no_profile');
    return;
  }

  // Landing and success are always accessible with no setup needed
  if (page === 'landing' || page === 'success') {
    if (user) {
      startSessionIdleMonitor(runIdleSignOut);
    }
    hideLoaderAfterPaint();
    return;
  }

  // Logged-in users shouldn't see login page
  if (page === 'login') {
    if (user) {
      window.location.href = ROUTES.ADMIN_DASHBOARD;
      return;
    }
    initLoginPage();
    hideLoaderAfterPaint();
    return;
  }

  // Unified RBAC gate — check if current role can access this page
  if (!canAccessPage(page)) {
    if (user) {
      window.location.replace(ROUTES.ADMIN_DASHBOARD);
    } else {
      markSessionRequiresLogin();
      redirectToLoginAfterSignOut('session_expired');
    }
    return;
  }

  const admin = checkIsAdmin();
  const superAdmin = checkIsSuperAdmin();

  if (user) {
    document.body.classList.add('is-authenticated');
    displayUserEmail(user.email);
    bindLogoutButton();
    showAuthenticatedNav(true);
    startSessionIdleMonitor(runIdleSignOut);
  } else {
    showAuthenticatedNav(false);
  }

  applyRoleUI(admin, superAdmin);
  await initPageModule(page, admin);
  initAdminShellNav();
  initAdminShellMobileDrawer();
  hideLoaderAfterPaint();
}

bootstrap();
