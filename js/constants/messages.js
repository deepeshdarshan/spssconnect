/**
 * @fileoverview User-facing toast and inline messages.
 * @module constants/messages
 */

/** User-facing messages */
export const MESSAGES = Object.freeze({
  FILL_ALL_FIELDS: 'Please fill in all fields.',
  PAGE_LOAD_FAIL: 'Failed to load page module.',

  LOADING_RECORDS: 'Loading household details…',
  LOADING_DASHBOARD_OVERVIEW: 'Loading dashboard…',
  LOADING_STATISTICS: 'Loading statistics…',
  LOADING_JILLA_MEMBERSHIP: 'Loading membership…',
  LOADING_BACKUP: 'Loading backup…',
  LOADING_RESTORE: 'Loading restore…',
  LOADING_USER_MANAGEMENT: 'Loading user management…',
  LOADING_ADMIN_CONTACTS: 'Loading admin contact numbers…',
  /**
   * Full-page loader on `create.html` while auth, RBAC, and the form module load
   * (e.g. after “Add New” from household directory or advanced search).
   */
  LOADING_CREATE_FORM: 'Opening new record form…',
  /** Login submit button label while Firebase auth and profile load complete. */
  SIGNING_IN: 'Signing you in…',
  NO_RECORDS: 'No records found.',
  LOAD_ERROR: 'Failed to load records.',
  LOAD_ERROR_STATE: 'Error loading records.',
  RECORD_CREATED: 'Record created successfully!',

  DELETE_CONFIRM: 'Are you sure you want to delete this record?',
  DELETE_CONFIRM_PERMANENT: 'Are you sure you want to delete this record? This cannot be undone.',
  DELETE_SUCCESS: 'Record deleted.',
  DELETE_FAIL: 'Failed to delete record.',
  DELETING: 'Deleting...',

  LOADING_RECORD: 'Loading record...',
  RECORD_NOT_FOUND: 'Record not found. It may have been deleted.',
  NO_RECORD_ID: 'No record specified. Please go back to the household directory and select a record.',
  PERMISSION_DENIED: 'You do not have permission to view this record. Please contact an administrator.',
  RECORD_LOAD_FAIL: 'Failed to load record. Please try again.',
  EDIT_FORM_FAIL: 'Failed to load edit form.',
  SHARE_COPIED: 'Shareable edit link copied to clipboard!',
  SHARE_COPY_FAIL: 'Failed to copy link. Please copy manually: ',

  VALIDATION_ATTENTION: ' field(s) need attention. Please check the highlighted fields.',

  NO_USERS: 'No users found.',
  USERS_LOAD_FAIL: 'Failed to load users.',
  CONFIRM_DELETE_USER: 'Remove this user from the app? They will no longer be able to login to the application. You will not able be able to use the same email address to create a new account even though the user account is deleted from the application.',
  USER_DELETED: 'User removed.',
  DELETE_USER_FAIL: 'Failed to remove user.',
  CANNOT_DELETE_SELF: 'You cannot remove your own account from this page.',

  PDF_LIB_MISSING: 'PDF library not loaded. Please try again.',
  PDF_GENERATING: 'Generating PDF...',
  PDF_DOWNLOADED: 'PDF downloaded!',
  PDF_FAIL: 'PDF generation failed.',
  PDF_NO_RECORDS: 'No records to export.',

  AUTH_GENERIC: 'An authentication error occurred. Please try again.',
  ACCOUNT_DISABLED: 'Your account has been disabled. Please contact an administrator.',
  /** Firebase Auth succeeded but there is no `users/{uid}` document in Firestore. */
  NO_APP_PROFILE: 'Sign-in worked, but your account is not set up in this app. Ask a super admin to add you in User management (or add your user document in Firestore).',
  /** Firestore read failed after auth (network, rules, or App Check). */
  PROFILE_LOAD_FAILED: 'Could not load your user profile from the database. Check your connection; if you are on localhost, register the App Check debug token from the browser console in Firebase → App Check → your web app → Manage debug tokens.',
  /** Firestore permission-denied — often App Check on localhost; register debug token in Firebase. */
  FIRESTORE_ACCESS_HINT: 'Cannot read your user profile. On local dev, copy the App Check debug token from the browser console to Firebase → App Check → your web app → Manage debug tokens.',
  /** Shown after automatic sign-out when the idle timeout ({@link ../constants/auth.js SESSION_IDLE_TIMEOUT_MS}) elapses. */
  SESSION_IDLE_EXPIRED: 'You were signed out after 15 minutes of inactivity. Please sign in again.',
  /** Shown when the browser back button restores a page after sign-out. */
  SESSION_EXPIRED: 'You have been signed out. Please sign in again to continue.',
});
