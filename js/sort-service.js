/**
 * @fileoverview Client-side sort logic for member records.
 * Pure functions — no DOM or Firebase dependency.
 * @module sort-service
 */

/**
 * Sorts an array of member_details records by a given field and direction.
 *
 * @param {Array<Object>} records - Array of Firestore member_details documents.
 * @param {string} field - Sort field: 'name', 'pradeshikaSabha', 'bloodGroup', 'highestEducation'.
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
 * For blood group and education, aggregates owner + members for richer sorting.
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
    case 'bloodGroup':
      return pd.bloodGroup || '';
    case 'highestEducation':
      return pd.highestEducation || '';
    default:
      return pd[field] || '';
  }
}
