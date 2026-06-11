/**
 * @fileoverview RBAC filtering of member records for the admin statistics panel.
 * @module admin-stats/admin-stats-filter
 */

/**
 * Filters records the same way as member management dashboard for non–super-admins.
 *
 * @param {Array<Object>} records
 * @param {boolean} superAdmin
 * @param {string|null} userSabha
 * @returns {Array<Object>}
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
