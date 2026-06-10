/**
 * @fileoverview Application initializer — auth guard, role routing, page bootstrapping.
 * Runs on every page load to enforce authentication and configure the UI based on user role.
 * @module app-init
 */

import { logoutUser, isAdmin as checkIsAdmin, isSuperAdmin as checkIsSuperAdmin, loginUser, fetchUserRole, clearRoleCache, getUserRole, ROLE_DISABLED, ROLE_PROFILE_ERROR } from './auth-service.js';
import { ROUTES, MESSAGES, AUTH_ERRORS } from './constants.js';
import { showToast, showLoader, hideLoader, setButtonLoading } from './ui-service.js';
import { auth } from './firebase-config.js';
import { canAccessPage, applyActionVisibility } from './permissions.js';

/**
 * Determines the current page from the URL pathname.
 * @returns {string} One of 'login', 'admin_dashboard', 'member_management', 'create', 'view', 'phone_check', etc.
 */
function getCurrentPage() {
  const path = window.location.pathname;
  if (path.includes('user-management')) return 'user_management';
  if (path.includes('admin-contacts')) return 'admin_contacts';
  if (path.includes('admin-dashboard')) return 'admin_dashboard';
  if (path.includes('member-management')) return 'member_management';
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
  applyActionVisibility();
}

/**
 * Binds the logout button on pages that have one.
 */
function bindLogoutButton() {
  const btn = document.getElementById('logoutBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    clearRoleCache();
    await logoutUser();
    window.location.href = ROUTES.LOGIN;
  });
}

/**
 * Displays the current user's email in the navbar.
 * @param {string} email
 */
function displayUserEmail(email) {
  const el = document.getElementById('userEmail');
  if (el) el.textContent = email;
}

/**
 * Toggles navbar elements between authenticated and unauthenticated states.
 * On public pages (e.g. create), logged-out users see a "Login" link instead of logout/email.
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
  if (params.get('account') === 'disabled') {
    showToast(MESSAGES.ACCOUNT_DISABLED, 'error');
    window.history.replaceState({}, '', window.location.pathname);
  } else if (params.get('reason') === 'profile_load_failed') {
    showToast(MESSAGES.PROFILE_LOAD_FAILED, 'error');
    window.history.replaceState({}, '', window.location.pathname);
  } else if (params.get('reason') === 'no_profile') {
    showToast(MESSAGES.NO_APP_PROFILE, 'error');
    window.history.replaceState({}, '', window.location.pathname);
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');
    setButtonLoading(btn, true);
    try {
      await loginUser(email, password);
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
    } finally {
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
    console.warn('[SPSS Connect] Unmapped login error code:', code, err);
  } else {
    console.warn('[SPSS Connect] Login error with no code:', err);
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
      case 'member_management': {
        const { initDashboard } = await import('./dashboard-service.js');
        await initDashboard(admin);
        break;
      }
      case 'phone_check': {
        const { initPhoneCheckPage } = await import('./phone-check-page.js');
        await initPhoneCheckPage();
        break;
      }
      case 'create': {
        const { initForm } = await import('./form-handler.js');
        initForm();
        break;
      }
      case 'view': {
        const { initViewPage } = await import('./view-service.js');
        await initViewPage(admin);
        break;
      }
      case 'user_management': {
        const { initUserManagement } = await import('./user-management.js');
        initUserManagement();
        break;
      }
      case 'admin_contacts': {
        const { initAdminContactsPage } = await import('./admin-contacts-page.js');
        await initAdminContactsPage();
        break;
      }
      case 'admin_dashboard': {
        const { initAdminDashboard } = await import('./admin-dashboard-page.js');
        await initAdminDashboard();
        break;
      }
    }
  } catch (err) {
    console.error(`Failed to initialize ${page} module:`, err);
    showToast(MESSAGES.PAGE_LOAD_FAIL, 'error');
  }
}

/* ------------------------------------------------------------------ */
/*  Bootstrap — runs on page load                                      */
/* ------------------------------------------------------------------ */

const page = getCurrentPage();

/**
 * Waits for Firebase Auth to fully resolve the persisted session from IndexedDB
 * before making any routing decisions. This prevents false redirects when
 * navigating between pages (e.g. dashboard → view) where the auth state
 * hasn't loaded yet on the new page.
 */
async function bootstrap() {
  try {
    await auth.authStateReady();
  } catch {
    // authStateReady not supported in older SDKs; fall through
  }

  const user = auth.currentUser;

  // Fetch and cache the user's role from Firestore (sets 'guest' if not logged in)
  await fetchUserRole();

  // Firestore unreadable for this session — not "disabled"; sign out and explain
  if (getUserRole() === ROLE_PROFILE_ERROR) {
    await logoutUser();
    clearRoleCache();
    window.location.href = ROUTES.LOGIN + '?reason=profile_load_failed';
    return;
  }

  // User has no users doc (e.g. removed from app) — sign out and send to login with message
  if (getUserRole() === ROLE_DISABLED) {
    await logoutUser();
    clearRoleCache();
    window.location.href = ROUTES.LOGIN + '?reason=no_profile';
    return;
  }

  // Landing and success are always accessible with no setup needed
  if (page === 'landing' || page === 'success') {
    hideLoader();
    return;
  }

  // Logged-in users shouldn't see login page
  if (page === 'login') {
    if (user) {
      window.location.href = ROUTES.ADMIN_DASHBOARD;
      return;
    }
    initLoginPage();
    hideLoader();
    return;
  }

  // Unified RBAC gate — check if current role can access this page
  if (!canAccessPage(page)) {
    window.location.href = user ? ROUTES.ADMIN_DASHBOARD : ROUTES.LOGIN;
    return;
  }

  const admin = checkIsAdmin();
  const superAdmin = checkIsSuperAdmin();

  if (user) {
    document.body.classList.add('is-authenticated');
    displayUserEmail(user.email);
    bindLogoutButton();
    showAuthenticatedNav(true);
  } else {
    showAuthenticatedNav(false);
  }

  applyRoleUI(admin, superAdmin);
  await initPageModule(page, admin);
  hideLoader();
}

bootstrap();
