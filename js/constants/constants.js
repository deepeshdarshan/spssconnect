/**
 * @fileoverview Application-wide constants for SPSS Connect.
 * All dropdown values use key:value maps for consistent rendering and i18n support.
 * @module constants
 */

/** Organization branding */
export const ORG_NAME = 'SREE PUSHPAKA BRAHMANA SEVA SANGHAM';
export const ORG_SUBTITLE = 'ERNAKULAM JILLA';

/** Firestore collection names */
export const COLLECTIONS = Object.freeze({
  MEMBER_DETAILS: 'member_details',
  USERS: 'users',
  MEMBER_IDS: 'member_ids',
  ADMIN_CONTACTS: 'admin_contacts',
  JILLA_MEMBERSHIP_DETAILS: 'jilla_membership_details',
});

/** Feature flags */
export const ENABLE_PHOTO_UPLOAD = false;

/** Google Apps Script API for spreadsheet backup. When true, successful Firebase writes are also sent to Sheets. */
export const ENABLE_SPREADSHEET_SYNC = true;

/** Google Apps Script web app URL for family registration spreadsheet backup. */
export const SPREADSHEET_API_URL = 'https://script.google.com/macros/s/AKfycbwqpS8b-tiEXdBGI_JCVxzMmbeU99t-uZcT957rOBE7Le1aPYqXcIQufpkjw98SrTgH/exec';

/** Earliest calendar year selectable for Jilla membership details (Firestore doc id = year). */
export const JILLA_MEMBERSHIP_MIN_YEAR = 2015;

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

/** Application routes */
export const ROUTES = Object.freeze({
  LOGIN: '/login',
  ADMIN_DASHBOARD: '/admin-dashboard',
  MEMBER_MANAGEMENT: '/member-management',
  ADMIN_CONTACTS: '/admin-contacts',
  PHONE_CHECK: '/phone-check',
  CREATE: '/create',
  VIEW: '/view',
  ADVANCED_MEMBER_SEARCH: '/advanced-member-search',
});

/**
 * Query param on the view page indicating which records list opened this record
 * (used for the view page "Back" navigation).
 */
export const VIEW_PAGE_FROM_PARAM = 'from';

/** Allowed values for {@link VIEW_PAGE_FROM_PARAM}. */
export const VIEW_REFERRER = Object.freeze({
  MEMBER_LIST: 'member-list',
  ADVANCED_SEARCH: 'advanced-search',
});

/**
 * Resolves the relative path for the view page "Back" button from the `from` query value.
 * Unknown or missing values default to the household directory (`member-management`).
 *
 * @param {string|null|undefined} fromValue - Raw `from` query string.
 * @returns {string} Relative path without a leading slash (e.g. `member-management`).
 */
export function resolveRecordsListHrefFromViewReferrer(fromValue) {
  const v = String(fromValue ?? '').trim();
  if (v === VIEW_REFERRER.ADVANCED_SEARCH) return 'advanced-member-search';
  return 'member-management';
}

/** Supported locales */
export const LOCALES = Object.freeze({
  EN: 'en',
  ML: 'ml',
});

/** Default locale */
export const DEFAULT_LOCALE = LOCALES.EN;

/** Pradeshika Sabha options — key stored in Firestore, value is the i18n label key */
export const PRADESHIKA_SABHA_OPTIONS = Object.freeze({
  Ernakulam: 'option.ernakulam',
  Edappally: 'option.edappally',
  Tripunithura: 'option.tripunithura',
  Chottanikkara: 'option.chottanikkara',
  Perumbavoor: 'option.perumbavoor',
  Aluva: 'option.aluva',
  Panangad: 'option.panangad',
});

/**
 * Short codes for each Pradeshika Sabha — keys must match {@link PRADESHIKA_SABHA_OPTIONS} (used in jilla membership Firestore rows).
 */
export const PRADESHIKA_SABHA_CODES = Object.freeze({
  Ernakulam: 'ERN',
  Edappally: 'EDP',
  Tripunithura: 'TPR',
  Chottanikkara: 'CNK',
  Perumbavoor: 'PMB',
  Aluva: 'ALV',
  Panangad: 'PNG',
});

/**
 * Jilla membership table — expanded column titles (LM / OM / PD) for UI, CSV, and PDF exports.
 */
export const JILLA_MEMBERSHIP_COLUMN_LABELS = Object.freeze({
  LIFE_MEMBERS: 'Life members',
  ORDINARY_MEMBERS: 'Ordinary members',
  PUSHPAKADHWANI: 'Pushpakadhwani',
});

/**
 * Occupation keys stored in Firestore — must match create.html / form-handler
 * {@link ./form/form-handler-html.js buildOccupationOptions}.
 */
export const OCCUPATION_OPTIONS = Object.freeze({
  central_govt: 'option.centralGovt',
  state_govt: 'option.stateGovt',
  private_employee: 'option.privateEmployee',
  self_employed: 'option.selfEmployed',
  kazhakam: 'option.kazhakam',
  homemaker: 'option.homemaker',
  retired: 'option.retired',
  unemployed: 'option.unemployed',
});

/** Occupation options (members — includes student) */
export const MEMBER_OCCUPATION_OPTIONS = Object.freeze({
  ...OCCUPATION_OPTIONS,
  student: 'option.student',
});

/** Blood group options */
export const BLOOD_GROUP_OPTIONS = Object.freeze({
  'A+': 'A+',
  'A-': 'A-',
  'B+': 'B+',
  'B-': 'B-',
  'AB+': 'AB+',
  'AB-': 'AB-',
  'O+': 'O+',
  'O-': 'O-',
});

/** Gender options */
export const GENDER_OPTIONS = Object.freeze({
  male: 'option.male',
  female: 'option.female',
  other: 'option.other',
});

/** Membership type options */
export const MEMBERSHIP_OPTIONS = Object.freeze({
  life_member: 'option.lifeMember',
  ordinary_member: 'option.ordinaryMember',
});

/** Education qualification options */
export const EDUCATION_OPTIONS = Object.freeze({
  below_10th: 'option.below10th',
  '10th': 'option.tenth',
  plus_two: 'option.plusTwo',
  diploma: 'option.diploma',
  bachelors: 'option.bachelors',
  masters: 'option.masters',
  doctorate: 'option.doctorate',
  professional: 'option.professional',
  other: 'option.otherEdu',
});

/** Ration card color options */
export const RATION_CARD_OPTIONS = Object.freeze({
  none: 'option.rationNone',
  white: 'option.rationWhite',
  yellow: 'option.rationYellow',
  blue: 'option.rationBlue',
  pink: 'option.rationPink',
});

/**
 * UI copy for the advanced member search page (`advanced-member-search.html`).
 *
 * - `FACET_SECTION_TITLES` keys must match filter state keys in
 *   {@link ../services/member-person-search.js PERSON_SEARCH_FACETS}.
 * - Result cards show the Pradeshika Sabha **value** only (no facet title on the card).
 * - `LOADING_MESSAGE` is passed to {@link ../ui/ui-service.js showLoader} during page init.
 * - Results count and stretched-link aria strings are consumed by
 *   {@link ../pages/member-advanced-search-page.js}.
 * - `MOBILE_FILTERS_HELP` is shown beside the funnel control below the `lg` breakpoint and is
 *   applied to that control’s `aria-label` from {@link ../pages/member-advanced-search-page.js}.
 */
export const ADVANCED_MEMBER_SEARCH = Object.freeze({
  FACET_SECTION_TITLES: Object.freeze({
    sabha: 'Pradeshika Sabha',
    occupation: 'Occupation',
    bloodGroup: 'Blood group',
    gender: 'Gender',
    membership: 'Membership',
    education: 'Education',
    rationCard: 'Ration card',
  }),
  CHIPS_ACTIVE_PREFIX: 'Active filters:',
  CHIPS_CLEAR_ALL: 'Clear all',
  /**
   * Short label next to the mobile funnel button so the offcanvas filter entry point is obvious
   * without relying on the icon alone.
   */
  MOBILE_FILTERS_HELP: 'Tap to open filters',
  BADGE_NON_MEMBER: 'Non-member',
  MEMBERSHIP_FILTER_HINT:
    'When a membership type is selected, people listed only as non-members are hidden (they have no membership type on file).',
  /** Full-page loading popup (filters + Firestore load) via {@link ../ui/ui-service.js showLoader}. */
  LOADING_MESSAGE: 'Loading advanced search…',
  /** Prefix for `#advancedSearchRecordCount` (e.g. "Showing 12 people"). */
  RESULTS_COUNT_PREFIX: 'Showing',
  /** Singular unit after the numeric total in the results count line. */
  RESULTS_UNIT_PERSON: 'person',
  /** Plural unit after the numeric total in the results count line. */
  RESULTS_UNIT_PEOPLE: 'people',
  /** Base `aria-label` for the card stretched link to the view page; name is appended with `STRETCHED_LINK_ARIA_NAME_PREFIX` when known. */
  STRETCHED_LINK_ARIA_BASE: 'View household record',
  /** Joiner between `STRETCHED_LINK_ARIA_BASE` and the person name when the name is known. */
  STRETCHED_LINK_ARIA_NAME_PREFIX: ' for ',
});

/** Family member outside reasons */
export const OUTSIDE_REASONS = Object.freeze({
  work: 'option.work',
  study: 'option.study',
});

/** Relationship to house owner options */
export const RELATIONSHIP_OPTIONS = Object.freeze({
  spouse: 'option.spouse',
  son: 'option.son',
  daughter: 'option.daughter',
  father: 'option.father',
  mother: 'option.mother',
  brother: 'option.brother',
  sister: 'option.sister',
  daughter_in_law: 'option.daughterInLaw',
  son_in_law: 'option.sonInLaw',
  grandchild: 'option.grandchild',
  other: 'option.otherRelation',
});

/** Firebase Storage path prefix for photos */
export const STORAGE_PHOTO_PATH = 'member_photos';

/** Full / sabha-wise household directory PDF export. */
export const PDF_MEMBER_LIST = Object.freeze({
  /** Data rows per PDF page (explicit pagination for html2pdf.js). */
  ROWS_PER_PAGE: 30,
});

/** Dashboard defaults */
export const DASHBOARD_DEFAULTS = Object.freeze({
  SORT_FIELD: 'name',
  SORT_DIRECTION: 'asc',
  SEARCH_DEBOUNCE_MS: 300,
  TABLE_COLSPAN: 7,
  /** Default rows per page on the household directory table. */
  PAGE_SIZE: 25,
  /** Allowed page sizes for the household directory page size control. */
  PAGE_SIZE_OPTIONS: Object.freeze([10, 25, 50, 100]),
});

/** Timing defaults (ms) */
export const TIMING = Object.freeze({
  REDIRECT_DELAY: 1000,
});

/** User-facing messages */
export const MESSAGES = Object.freeze({
  FILL_ALL_FIELDS: 'Please fill in all fields.',
  PAGE_LOAD_FAIL: 'Failed to load page module.',

  LOADING_RECORDS: 'Loading member records…',
  LOADING_DASHBOARD_OVERVIEW: 'Loading dashboard…',
  LOADING_STATISTICS: 'Loading statistics…',
  NO_RECORDS: 'No records found.',
  LOAD_ERROR: 'Failed to load records.',
  LOAD_ERROR_STATE: 'Error loading records.',
  RECORD_CREATED: 'Record created successfully!',
  SELECT_SABHA: 'Please select a Pradeshika Sabha.',

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
});

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
  'auth/invalid-login-credentials': 'Invalid credentials. Please check your email and password.',
  'auth/account-disabled': 'Your account has been disabled. Please contact an administrator.',
  'auth/user-disabled': 'This account has been disabled in Firebase. Contact an administrator.',
  'auth/operation-not-allowed': 'Email/password sign-in is not enabled for this project. Enable it in Firebase Console → Authentication → Sign-in method.',
  'auth/invalid-api-key': 'Invalid API configuration. Check Firebase project settings in the app.',
  'auth/internal-error': 'Firebase reported an internal error. Try again shortly.',
  'auth/missing-email': 'Please enter your email address.',
  'auth/invalid-app-credential': 'App verification failed (reCAPTCHA / App Check). Refresh the page and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'unavailable': 'The service is temporarily unavailable. Please try again in a moment.',
  'deadline-exceeded': 'The request took too long. Check your connection and try again.',
  'resource-exhausted': 'Too many requests to the service. Please wait and try again.',
});
