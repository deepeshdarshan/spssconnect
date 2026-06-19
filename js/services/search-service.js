/**
 * @fileoverview Client-side search logic for member records.
 * Pure functions — no DOM or Firebase dependency.
 * @module search-service
 */

import { ADVANCED_SEARCH_MEMBERSHIP_NON_MEMBER_FILTER } from '../constants/advanced-member-search.js';

/**
 * Filters an array of member_details records by a search query (household directory).
 * Matches only: house name, house owner name, PIN, and phone (display or digit-only substring).
 *
 * @param {Array<Object>} records - Array of Firestore member_details documents.
 * @param {string} query - The search string (case-insensitive on text fields; digits match PIN/phone).
 * @returns {Array<Object>} Filtered records.
 */
export function searchMembers(records, query) {
  if (!query || !query.trim()) return records;

  const q = query.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, '');

  return records.filter((record) => {
    const pd = record.personalDetails || {};
    return matchesHouseholdDirectorySearch(pd, q, qDigits);
  });
}

/**
 * Filters records to a single Pradeshika Sabha (case-insensitive exact match).
 *
 * @param {Array<Object>} records
 * @param {string} sabha - Canonical sabha name; empty returns all records.
 * @returns {Array<Object>}
 */
export function filterMembersBySabha(records, sabha) {
  const trimmed = String(sabha ?? '').trim();
  if (!trimmed) return records;

  const target = trimmed.toLowerCase();
  return records.filter((record) => {
    const value = String((record.personalDetails || {}).pradeshikaSabha || '').toLowerCase();
    return value === target;
  });
}

/**
 * Filters records by family & welfare fields on the house owner's `personalDetails`.
 *
 * @param {Array<Object>} records
 * @param {Object} [welfare]
 * @param {string} [welfare.healthInsurance] - `''`, `'yes'`, or `'no'`.
 * @param {string} [welfare.rationCardType] - `''` or a ration card key.
 * @returns {Array<Object>}
 */
export function filterMembersByWelfare(records, welfare = {}) {
  const health = String(welfare.healthInsurance ?? '').trim().toLowerCase();
  const ration = String(welfare.rationCardType ?? '').trim().toLowerCase();

  if (!health && !ration) return records;

  return records.filter((record) => {
    const pd = record.personalDetails || {};

    if (health) {
      const hasInsurance = Boolean(pd.healthInsurance);
      if (health === 'yes' && !hasInsurance) return false;
      if (health === 'no' && hasInsurance) return false;
    }

    if (ration) {
      const cardType = String(pd.rationCardType ?? 'none').toLowerCase();
      if (cardType !== ration) return false;
    }

    return true;
  });
}

/**
 * Filters records to any of the selected Pradeshika Sabhas (OR within set).
 *
 * @param {Array<Object>} records
 * @param {Set<string>} selected - Canonical sabha names; empty set returns all records.
 * @returns {Array<Object>}
 */
export function filterMembersBySabhaSet(records, selected) {
  if (!selected || selected.size === 0) return records;
  return records.filter((record) => {
    const value = String((record.personalDetails || {}).pradeshikaSabha ?? '').trim();
    return value && selected.has(value);
  });
}

/**
 * Filters records by ration card type on the house owner's `personalDetails` (OR within set).
 *
 * @param {Array<Object>} records
 * @param {Set<string>} selected - Ration card keys; empty set returns all records.
 * @returns {Array<Object>}
 */
export function filterMembersByRationCardSet(records, selected) {
  if (!selected || selected.size === 0) return records;
  return records.filter((record) => {
    const cardType = String((record.personalDetails || {}).rationCardType ?? 'none');
    return selected.has(cardType);
  });
}

/**
 * Filters records by family health insurance on the house owner's `personalDetails` (OR within set).
 *
 * @param {Array<Object>} records
 * @param {Set<string>} selected - `'yes'` and/or `'no'`; empty set returns all records.
 * @returns {Array<Object>}
 */
export function filterMembersByHealthInsuranceSet(records, selected) {
  if (!selected || selected.size === 0) return records;
  return records.filter((record) => {
    const hasInsurance = Boolean((record.personalDetails || {}).healthInsurance);
    if (selected.has('yes') && hasInsurance) return true;
    if (selected.has('no') && !hasInsurance) return true;
    return false;
  });
}

/**
 * Filters households by membership-related signals on file (OR within set).
 *
 * - `ordinary_member`: house owner or any `members[]` entry has `membershipType === 'ordinary_member'`.
 * - `life_member`: house owner or any `members[]` entry has `membershipType === 'life_member'`.
 * - `non_member`: household has at least one row in `nonMembers` (same notion as advanced search).
 *
 * @param {Array<Object>} records
 * @param {Set<string>} selected - `ordinary_member`, `life_member`, and/or `non_member` (same key as advanced search); empty set returns all records.
 * @returns {Array<Object>}
 */
export function filterMembersByHouseholdComposition(records, selected) {
  if (!selected || selected.size === 0) return records;
  return records.filter((record) => {
    const pd = record.personalDetails || {};
    const members = record.members || [];
    const nonMembers = record.nonMembers || [];

    if (selected.has(ADVANCED_SEARCH_MEMBERSHIP_NON_MEMBER_FILTER) && nonMembers.length > 0) return true;

    const ownerMt = String(pd.membershipType ?? '').trim();
    const hasLifeOnFile =
      ownerMt === 'life_member' ||
      members.some((m) => String(m.membershipType ?? '').trim() === 'life_member');
    const hasOrdinaryOnFile =
      ownerMt === 'ordinary_member' ||
      members.some((m) => String(m.membershipType ?? '').trim() === 'ordinary_member');

    if (selected.has('life_member') && hasLifeOnFile) return true;
    if (selected.has('ordinary_member') && hasOrdinaryOnFile) return true;
    return false;
  });
}

/**
 * @param {Object} pd - House owner's `personalDetails`.
 * @param {string} q - Trimmed, lowercased query.
 * @param {string} qDigits - Digits-only from query (for PIN / phone).
 * @returns {boolean}
 */
function matchesHouseholdDirectorySearch(pd, q, qDigits) {
  const houseName = String(pd.houseName ?? '').toLowerCase();
  const ownerName = String(pd.name ?? '').toLowerCase();
  const pinRaw = String((pd.address || {}).pin ?? '');
  const pin = pinRaw.toLowerCase();
  const phoneRaw = String(pd.phone ?? '');
  const phone = phoneRaw.toLowerCase();

  if (houseName.includes(q) || ownerName.includes(q) || pin.includes(q) || phone.includes(q)) {
    return true;
  }

  if (qDigits.length > 0) {
    const pinDigits = pinRaw.replace(/\D/g, '');
    const phoneDigits = phoneRaw.replace(/\D/g, '');
    if (pinDigits.includes(qDigits) || phoneDigits.includes(qDigits)) {
      return true;
    }
  }

  return false;
}
