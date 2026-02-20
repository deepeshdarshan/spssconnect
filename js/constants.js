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

/** Super Admin email addresses — full control including managing other admins */
export const SUPER_ADMIN_EMAILS = Object.freeze([
  'spssekm@gmail.com',
]);

/** Admin email addresses — users with these emails get admin privileges */
export const ADMIN_EMAILS = Object.freeze([
  ...SUPER_ADMIN_EMAILS,
]);

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
