/**
 * @fileoverview Client-side search logic for member records.
 * Pure functions — no DOM or Firebase dependency.
 * @module search-service
 */

/**
 * Filters an array of member_details records by a search query.
 * Searches across: house owner name, member/non-member names,
 * pradeshika sabha, blood group, and education.
 *
 * @param {Array<Object>} records - Array of Firestore member_details documents.
 * @param {string} query - The search string (case-insensitive, partial match).
 * @returns {Array<Object>} Filtered records.
 */
export function searchMembers(records, query) {
  if (!query || !query.trim()) return records;

  const q = query.trim().toLowerCase();

  return records.filter((record) => {
    const pd = record.personalDetails || {};
    const searchableFields = collectSearchableFields(pd, record.members, record.nonMembers);
    return searchableFields.some((field) => field.toLowerCase().includes(q));
  });
}

/**
 * Collects all searchable string values from a record.
 * @param {Object} pd - personalDetails object.
 * @param {Array<Object>} [members]
 * @param {Array<Object>} [nonMembers]
 * @returns {Array<string>} Flat array of searchable values.
 */
function collectSearchableFields(pd, members = [], nonMembers = []) {
  const fields = [
    pd.name,
    pd.pradeshikaSabha,
    pd.bloodGroup,
    pd.highestEducation,
    pd.houseName,
    pd.occupation,
  ];

  const addPersonFields = (person) => {
    fields.push(person.name, person.bloodGroup, person.highestEducation, person.occupation);
  };

  members.forEach(addPersonFields);
  nonMembers.forEach(addPersonFields);

  return fields.filter(Boolean);
}
