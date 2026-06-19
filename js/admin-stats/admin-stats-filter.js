/**
 * @fileoverview RBAC filtering of member records for the admin statistics panel.
 * @module admin-stats/admin-stats-filter
 */

/**
 * Filters member_details records to match the household directory dashboard scope.
 *
 * @param {Array<Object>} records - Full or partially loaded `member_details` documents.
 * @param {boolean} superAdmin - When true, returns `records` unchanged (global view).
 * @param {string|null} userSabha - Logged-in PS admin’s sabha name; matched case-insensitively on `personalDetails.pradeshikaSabha`.
 * @returns {Array<Object>} Same objects as input, narrowed for non–super-admins; empty array if `userSabha` is missing/blank.
 */
export function filterRecordsForAdminStats(records, superAdmin, userSabha) {
  if (superAdmin) return records;
  const sabha = (userSabha || '').trim().toLowerCase();
  if (!sabha) return [];
  return records.filter((r) => {
    const ps = ((r.personalDetails || {}).pradeshikaSabha || '').toLowerCase();
    return ps === sabha;
  });
}
