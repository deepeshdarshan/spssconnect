/**
 * @fileoverview Jilla membership table columns and pradeshika sabha code map.
 * @module constants/jilla-membership
 */

/** Earliest calendar year selectable for Jilla membership details (Firestore doc id = year). */
export const JILLA_MEMBERSHIP_MIN_YEAR = 2024;

/**
 * Short codes for each Pradeshika Sabha — keys must match {@link ./member-options.js PRADESHIKA_SABHA_OPTIONS} (used in jilla membership Firestore rows).
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
