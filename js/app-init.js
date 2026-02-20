/**
 * @fileoverview Application initializer — auth guard, role routing, page bootstrapping.
 * Runs on every page load to enforce authentication and configure the UI based on user role.
 * @module app-init
 */

import { logoutUser, isAdmin as checkIsAdmin, isSuperAdmin as checkIsSuperAdmin, loginUser, fetchUserRole, clearRoleCache } from './auth-service.js';
import { ROUTES, MESSAGES, AUTH_ERRORS } from './constants.js';
import { showToast, showLoader, hideLoader, setButtonLoading } from './ui-service.js';
import { auth } from './firebase-config.js';
import { canAccessPage, applyActionVisibility } from './permissions.js';

/**
 * Determines the current page from the URL pathname.
 * @returns {string} One of 'login', 'dashboard', 'create', 'view'.
 */
function getCurrentPage() {
  const path = window.location.pathname;
  if (path.includes('user-management')) return 'user_management';
  if (path.includes('import')) return 'import';
  if (path.includes('dashboard')) return 'dashboard';
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

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');
    setButtonLoading(btn, true);
    try {
      await loginUser(email, password);
      window.location.href = ROUTES.DASHBOARD;
    } catch (err) {
      showToast(friendlyAuthError(err.code), 'error');
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

/**
 * Converts Firebase auth error codes to user-friendly messages.
 * @param {string} code
 * @returns {string}
 */
function friendlyAuthError(code) {
  return AUTH_ERRORS[code] || MESSAGES.AUTH_GENERIC;
}

/**
 * Dynamically imports and initializes the page-specific module.
 * @param {string} page
 * @param {boolean} admin
 */
async function initPageModule(page, admin) {
  try {
    switch (page) {
      case 'dashboard': {
        const { initDashboard } = await import('./dashboard-service.js');
        await initDashboard(admin);
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
      case 'import': {
        const { initImportPage } = await import('./import-page.js');
        initImportPage();
        break;
      }
      case 'user_management': {
        const { initUserManagement } = await import('./user-management.js');
        initUserManagement();
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

  // Landing and success are always accessible with no setup needed
  if (page === 'landing' || page === 'success') {
    hideLoader();
    return;
  }

  // Logged-in users shouldn't see login page
  if (page === 'login') {
    if (user) {
      window.location.href = ROUTES.DASHBOARD;
      return;
    }
    initLoginPage();
    hideLoader();
    return;
  }

  // Unified RBAC gate — check if current role can access this page
  if (!canAccessPage(page)) {
    window.location.href = user ? ROUTES.DASHBOARD : ROUTES.LOGIN;
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
