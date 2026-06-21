/**
 * @fileoverview Lightweight bootstrap for `login.html` only.
 * Avoids the full `app-init.js` graph (session guard, permissions, page modules, admin shell).
 * After successful sign-in, redirects to the admin dashboard where `app-init.js` runs the full bootstrap.
 *
 * @module login-init
 */

import { loginUser } from './services/auth-service.js';
import { ROUTES, MESSAGES, AUTH_ERRORS } from './constants/constants.js';
import { showToast, setButtonLoading } from './ui/ui-service.js';
import { auth } from './services/firebase-config.js';
import { touchSessionActivityRecordNow } from './services/session-idle-timeout.js';
import { clearSessionRequiresLogin } from './services/session-navigation-guard.js';
import * as Logger from './utils/logger.js';

/**
 * Maps Firestore / wrapped errors to codes the login UI handles.
 * @param {unknown} err
 * @returns {string|undefined}
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
 * @param {string|undefined} code
 * @param {unknown} [err]
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
 * Binds the login form and shows redirect query-param toasts.
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

async function bootstrapLogin() {
  try {
    await auth.authStateReady();
  } catch {
    /* authStateReady not supported in older SDKs */
  }

  if (auth.currentUser) {
    window.location.href = ROUTES.ADMIN_DASHBOARD;
    return;
  }

  initLoginPage();
}

bootstrapLogin();
