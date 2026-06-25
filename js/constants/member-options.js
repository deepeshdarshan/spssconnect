/**
 * @fileoverview Dropdown option maps (Firestore keys → i18n label keys) for member forms and filters.
 * @module constants/member-options
 */

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
 * Occupation keys stored in Firestore — must match create.html / form-handler
 * {@link ../form/form-handler-html.js buildOccupationOptions}.
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
  father_in_law: 'option.fatherInLaw',
  mother_in_law: 'option.motherInLaw',
  grandchild: 'option.grandchild',
  other: 'option.otherRelation',
});
