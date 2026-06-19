/**
 * @fileoverview Authentication roles, session idle timeout, and Firebase auth error copy.
 * @module constants/auth
 */

/** User roles */
export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  USER: 'user',
});

/**
 * sessionStorage key for pre-paint role UI hints on the admin shell (avoids sidebar FOUC).
 * Must match the storage key in {@link ../ui/role-ui-sync.js}.
 */
export const SESSION_KEY_ROLE_UI = 'spss_role_ui';

/**
 * Maximum time (ms) the signed-in app may remain without recorded user activity before
 * forcing sign-out. Enforced client-side in {@link ../services/session-idle-timeout.js};
 * does not revoke Firebase refresh tokens on the server.
 */
export const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * localStorage key for last user activity (epoch ms). Cleared on sign-out.
 * Must match {@link ../services/session-idle-timeout.js}.
 */
export const SESSION_ACTIVITY_STORAGE_KEY = 'spss_auth_last_activity_ms';

/**
 * sessionStorage flag set on sign-out so a back-forward cached page cannot restore
 * an authenticated shell. Cleared after a successful login. Checked only on
 * `pageshow` with `event.persisted` (bfcache restore).
 */
export const SESSION_FORCE_LOGIN_KEY = 'spss_force_login';

/** Firebase auth error code to friendly message map */
export const AUTH_ERRORS = Object.freeze({
  'auth/email-already-in-use': 'This email is already registered.',
  'auth/invalid-email': 'Invalid email address.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/invalid-credential': 'Invalid credentials. Please check your email and password.',
  /** Used by newer Firebase Auth instead of separate user-not-found / wrong-password in some flows */
  'auth/invalid-login-credentials': 'Invalid credentials. Please check your username and password.',
  'auth/account-disabled': 'Your account has been disabled. Please contact an administrator.',
  'auth/user-disabled': 'This account has been disabled in Firebase. Contact an administrator.',
  'auth/operation-not-allowed': 'Email/password sign-in is not enabled for this project. Enable it in Firebase Console → Authentication → Sign-in method.',
  'auth/invalid-api-key': 'Invalid API configuration. Check Firebase project settings in the app.',
  'auth/internal-error': 'Firebase reported an internal error. Try again shortly.',
  'auth/missing-email': 'Please enter your email address.',
  'auth/invalid-app-credential': 'App verification failed (reCAPTCHA / App Check). Refresh the page and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  unavailable: 'The service is temporarily unavailable. Please try again in a moment.',
  'deadline-exceeded': 'The request took too long. Check your connection and try again.',
  'resource-exhausted': 'Too many requests to the service. Please wait and try again.',
});
