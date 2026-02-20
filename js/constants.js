/**
 * @fileoverview Application-wide constants for SPSS Connect.
 * All dropdown values use key:value maps for consistent rendering and i18n support.
 * @module constants
 */

/** Firestore collection names */
export const COLLECTIONS = Object.freeze({
  MEMBER_DETAILS: 'member_details',
  USERS: 'users',
});

/** Feature flags */
export const ENABLE_PHOTO_UPLOAD = false;

/** Pagination defaults */
export const PAGE_SIZE = 10;

/** User roles */
export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  USER: 'user',
});

/** Application routes */
export const ROUTES = Object.freeze({
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  CREATE: '/create',
  VIEW: '/view',
});

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

/** Occupation options (house owner) */
export const OCCUPATION_OPTIONS = Object.freeze({
  govt: 'option.govt',
  private: 'option.private',
  business: 'option.business',
  kazhakam: 'option.kazhakam',
  retired: 'option.retired',
  non_salaried: 'option.nonSalaried',
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

/** Family member outside reasons */
export const OUTSIDE_REASONS = Object.freeze({
  studying: 'option.studying',
  job: 'option.job',
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

/** Dashboard defaults */
export const DASHBOARD_DEFAULTS = Object.freeze({
  SORT_FIELD: 'name',
  SORT_DIRECTION: 'asc',
  SEARCH_DEBOUNCE_MS: 300,
  TABLE_COLSPAN: 7,
});

/** Timing defaults (ms) */
export const TIMING = Object.freeze({
  REDIRECT_DELAY: 1000,
  IMPORT_REDIRECT_DELAY: 1500,
});

/** User-facing messages */
export const MESSAGES = Object.freeze({
  FILL_ALL_FIELDS: 'Please fill in all fields.',
  PAGE_LOAD_FAIL: 'Failed to load page module.',

  LOADING_RECORDS: 'Loading records...',
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
  NO_RECORD_ID: 'No record specified. Please go back to the dashboard and select a record.',
  PERMISSION_DENIED: 'You do not have permission to view this record. Please contact an administrator.',
  RECORD_LOAD_FAIL: 'Failed to load record. Please try again.',
  EDIT_FORM_FAIL: 'Failed to load edit form.',
  SHARE_COPIED: 'Shareable edit link copied to clipboard!',
  SHARE_COPY_FAIL: 'Failed to copy link. Please copy manually: ',

  VALIDATION_ATTENTION: ' field(s) need attention. Please check the highlighted fields.',

  NO_USERS: 'No users found.',
  USERS_LOAD_FAIL: 'Failed to load users.',

  IMPORT_NO_DATA: 'No JSON data provided.',
  IMPORT_NO_DATA_HINT: 'No JSON data provided. Paste JSON or select a file.',
  IMPORT_INVALID_JSON: 'Invalid JSON format.',
  IMPORT_NO_VALID: 'No valid records to import.',
  IMPORT_FAIL: 'Import failed.',
  IMPORT_FAIL_DETAIL: 'Import failed. Check console for details.',

  PDF_LIB_MISSING: 'PDF library not loaded. Please try again.',
  PDF_GENERATING: 'Generating PDF...',
  PDF_DOWNLOADED: 'PDF downloaded!',
  PDF_FAIL: 'PDF generation failed.',
  PDF_NO_RECORDS: 'No records to export.',

  AUTH_GENERIC: 'An authentication error occurred. Please try again.',
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
});
