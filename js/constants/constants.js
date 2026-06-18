/**
 * @fileoverview Application-wide constants for SPSS Connect — barrel re-exports.
 * Import from this module for backward compatibility; new code may import from typed modules directly.
 * @module constants
 */

export { ORG_NAME, ORG_SUBTITLE } from './app-branding.js';
export { ENABLE_PHOTO_UPLOAD, STORAGE_PHOTO_PATH, CLOUDINARY_CONFIG } from './feature-flags.js';
export { COLLECTIONS } from './firestore-collections.js';
export {
  ROLES,
  SESSION_KEY_ROLE_UI,
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_ACTIVITY_STORAGE_KEY,
  AUTH_ERRORS,
} from './auth.js';
export {
  ROUTES,
  VIEW_PAGE_FROM_PARAM,
  VIEW_REFERRER,
  resolveRecordsListHrefFromViewReferrer,
  resolveCreatePageBackNav,
} from './routing.js';
export { LOCALES, DEFAULT_LOCALE } from './i18n.js';
export {
  PRADESHIKA_SABHA_OPTIONS,
  OCCUPATION_OPTIONS,
  MEMBER_OCCUPATION_OPTIONS,
  BLOOD_GROUP_OPTIONS,
  GENDER_OPTIONS,
  MEMBERSHIP_OPTIONS,
  EDUCATION_OPTIONS,
  RATION_CARD_OPTIONS,
  OUTSIDE_REASONS,
  RELATIONSHIP_OPTIONS,
} from './member-options.js';
export {
  JILLA_MEMBERSHIP_MIN_YEAR,
  PRADESHIKA_SABHA_CODES,
  JILLA_MEMBERSHIP_COLUMN_LABELS,
} from './jilla-membership.js';
export { MEMBER_COUNT_UNIT, PDF_MEMBER_LIST, PDF_ADVANCED_SEARCH } from './pdf-export.js';
export { DASHBOARD_DEFAULTS } from './dashboard.js';
export { TIMING } from './timing.js';
export { MESSAGES } from './messages.js';
export { ADVANCED_SEARCH_AGE_BUCKET_IDS, ADVANCED_MEMBER_SEARCH } from './advanced-member-search.js';
export { HOUSEHOLD_DIRECTORY } from './household-directory.js';
