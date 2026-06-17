/**
 * @fileoverview Client-side sort logic for member records.
 * Pure functions — no DOM or Firebase dependency.
 * @module sort-service
 */

import { formatHouseholdAddress } from './member-person-search.js';

/**
 * Sorts an array of member_details records by a given field and direction.
 *
 * @param {Array<Object>} records - Array of Firestore member_details documents.
 * @param {string} field - Sort field: 'name', 'pradeshikaSabha', 'houseName', 'address'.
 * @param {'asc'|'desc'} [direction='asc'] - Sort direction.
 * @returns {Array<Object>} New sorted array (does not mutate input).
 */
export function sortMembers(records, field, direction = 'asc') {
  const sorted = [...records];
  const dir = direction === 'desc' ? -1 : 1;

  sorted.sort((a, b) => {
    const valA = extractSortValue(a, field);
    const valB = extractSortValue(b, field);
    return valA.localeCompare(valB, undefined, { sensitivity: 'base' }) * dir;
  });

  return sorted;
}

/**
 * Extracts the string value to sort by from a record.
 * For owner-level fields, reads from personalDetails.
 * For address, concatenates address lines via {@link formatHouseholdAddress}.
 *
 * @param {Object} record
 * @param {string} field
 * @returns {string}
 */
function extractSortValue(record, field) {
  const pd = record.personalDetails || {};

  switch (field) {
    case 'name':
      return pd.name || '';
    case 'pradeshikaSabha':
      return pd.pradeshikaSabha || '';
    case 'houseName':
      return pd.houseName || '';
    case 'address':
      return formatHouseholdAddress(pd);
    default:
      return pd[field] || '';
  }
}
