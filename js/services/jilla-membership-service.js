/**
 * @fileoverview Firestore access and row merging for Jilla membership by year.
 * @module jilla-membership-service
 */

import {
  COLLECTIONS,
  PRADESHIKA_SABHA_OPTIONS,
  PRADESHIKA_SABHA_CODES,
} from '../constants/constants.js';
import { getDocument, setDocument, getServerTimestamp } from './firestore-service.js';

/**
 * @param {unknown} n
 * @returns {number}
 */
function toNonNegInt(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.floor(x);
}

/**
 * Default one row per Pradeshika Sabha for a new year document.
 *
 * @returns {Array<{ psName: string, psCode: string, lifeMembers: number, ordinaryMembers: number, home: number, pushpakadhwani: number }>}
 */
export function buildDefaultJillaRows() {
  return Object.keys(PRADESHIKA_SABHA_OPTIONS).map((psName) => ({
    psName,
    psCode: PRADESHIKA_SABHA_CODES[psName] || psName.slice(0, 3).toUpperCase(),
    lifeMembers: 0,
    ordinaryMembers: 0,
    home: 0,
    pushpakadhwani: 0,
  }));
}

/**
 * Merges saved Firestore rows with the canonical sabha list.
 *
 * @param {Array<Record<string, unknown>>|null|undefined} savedArr
 * @returns {Array<{ psName: string, psCode: string, lifeMembers: number, ordinaryMembers: number, home: number, pushpakadhwani: number }>}
 */
export function mergeJillaMembershipDetails(savedArr) {
  const defaults = buildDefaultJillaRows();
  if (!Array.isArray(savedArr)) return defaults;

  return defaults.map((def) => {
    const saved = savedArr.find(
      (s) =>
        String(s?.psName || '').trim().toLowerCase() === def.psName.toLowerCase() ||
        String(s?.psCode || '').trim().toUpperCase() === def.psCode.toUpperCase()
    );
    if (!saved) return { ...def };
    return {
      ...def,
      lifeMembers: toNonNegInt(saved.lifeMembers),
      ordinaryMembers: toNonNegInt(saved.ordinaryMembers),
      home: toNonNegInt(saved.home),
      pushpakadhwani: toNonNegInt(saved.pushpakadhwani),
    };
  });
}

/**
 * Loads the Jilla membership document for a calendar year (document id = year string).
 *
 * @param {string} yearStr
 * @returns {Promise<Object|null>}
 */
export async function fetchJillaMembershipByYear(yearStr) {
  return getDocument(COLLECTIONS.JILLA_MEMBERSHIP_DETAILS, yearStr);
}

/**
 * Persists Jilla membership targets and counts for one year.
 *
 * @param {string} yearStr - Firestore document id.
 * @param {number} yearNum - Numeric year stored on the document.
 * @param {string} updatedByEmail - Auditor email.
 * @param {Array<{ psCode: string, psName: string, lifeMembers: number, ordinaryMembers: number, home: number, pushpakadhwani: number }>} membershipDetails
 * @returns {Promise<void>}
 */
export async function saveJillaMembershipByYear(yearStr, yearNum, updatedByEmail, membershipDetails) {
  await setDocument(COLLECTIONS.JILLA_MEMBERSHIP_DETAILS, yearStr, {
    year: yearNum,
    lastUpdated: getServerTimestamp(),
    updatedBy: updatedByEmail,
    membershipDetails,
  });
}
