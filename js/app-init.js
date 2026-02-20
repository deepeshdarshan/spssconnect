/**
 * @fileoverview Application initializer — auth guard, role routing, page bootstrapping.
 * Runs on every page load to enforce authentication and configure the UI based on user role.
 * @module app-init
 */

import { logoutUser, isAdmin as checkIsAdmin, loginUser, registerUser } from './auth-service.js';
import { ROUTES } from './constants.js';
import { showToast, showLoader, hideLoader, setButtonLoading } from './ui-service.js';
import { auth } from './firebase-config.js';

/**
 * Determines the current page from the URL pathname.
 * @returns {string} One of 'login', 'dashboard', 'create', 'view'.
 */
function getCurrentPage() {
  const path = window.location.pathname;
  if (path.includes('import')) return 'import';
  if (path.includes('dashboard')) return 'dashboard';
  if (path.includes('success')) return 'success';
  if (path.includes('create')) return 'create';
  if (path.includes('view')) return 'view';
  if (path.includes('login')) return 'login';
  return 'landing';
}

/**
 * Applies admin class to body so CSS can show/hide admin-only elements.
 * @param {boolean} admin
 */
function applyAdminUI(admin) {
  document.body.classList.toggle('is-admin', admin);
}

/**
 * Binds the logout button on pages that have one.
 */
function bindLogoutButton() {
  const btn = document.getElementById('logoutBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
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
 * Initializes the login page — binds login/register forms and the toggle link.
 */
function initLoginPage() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const toggleBtn = document.getElementById('toggleAuth');

  if (toggleBtn && loginForm && registerForm) {
    toggleBtn.addEventListener('click', () => {
      const showingLogin = !loginForm.classList.contains('d-none');
      loginForm.classList.toggle('d-none', showingLogin);
      registerForm.classList.toggle('d-none', !showingLogin);
      toggleBtn.innerHTML = showingLogin
        ? 'Already have an account? <strong>Sign In</strong>'
        : 'Don\'t have an account? <strong>Register</strong>';
    });
  }

  if (loginForm) {
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

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;
      const confirm = document.getElementById('regPasswordConfirm').value;
      const btn = document.getElementById('registerBtn');

      if (password !== confirm) {
        showToast('Passwords do not match', 'error');
        return;
      }

      setButtonLoading(btn, true);
      try {
        await registerUser(email, password);
        showToast('Account created successfully!', 'success');
        window.location.href = ROUTES.DASHBOARD;
      } catch (err) {
        showToast(friendlyAuthError(err.code), 'error');
      } finally {
        setButtonLoading(btn, false);
      }
    });
  }
}

/**
 * Converts Firebase auth error codes to user-friendly messages.
 * @param {string} code
 * @returns {string}
 */
function friendlyAuthError(code) {
  const map = {
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/invalid-credential': 'Invalid credentials. Please check your email and password.',
  };
  return map[code] || 'An authentication error occurred. Please try again.';
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
    }
  } catch (err) {
    console.error(`Failed to initialize ${page} module:`, err);
    showToast('Failed to load page module.', 'error');
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

  if (page === 'landing' || page === 'success') {
    hideLoader();
    return;
  }

  if (page === 'login') {
    if (user) {
      window.location.href = ROUTES.DASHBOARD;
      return;
    }
    initLoginPage();
    hideLoader();
    return;
  }

  if (page === 'create' || page === 'view') {
    if (user) {
      displayUserEmail(user.email);
      bindLogoutButton();
      showAuthenticatedNav(true);

      const admin = checkIsAdmin();
      applyAdminUI(admin);
      await initPageModule(page, admin);
    } else {
      showAuthenticatedNav(false);
      await initPageModule(page, false);
    }
    hideLoader();
    return;
  }

  // Protected pages (dashboard, import) — require authentication
  if (!user) {
    window.location.href = ROUTES.LOGIN;
    return;
  }

  displayUserEmail(user.email);
  bindLogoutButton();

  const admin = checkIsAdmin();

  if (page === 'import' && !admin) {
    window.location.href = ROUTES.DASHBOARD;
    return;
  }

  applyAdminUI(admin);
  await initPageModule(page, admin);
  hideLoader();
}

bootstrap();
