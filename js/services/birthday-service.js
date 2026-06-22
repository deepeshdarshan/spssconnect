/**
 * @fileoverview Firestore access for the Birthday Dashboard — role-scoped sabha queries only.
 * @module services/birthday-service
 */

import { PRADESHIKA_SABHA_OPTIONS } from '../constants/member-options.js';
import { isSuperAdmin, isAdmin, getUserPradeshikaSabha } from './auth-service.js';
import { getMembersByPradeshikaSabha } from './member-service.js';
import { expandToPersonRows } from './member-person-search.js';
import * as Logger from '../utils/logger.js';

/**
 * @typedef {Object} SabhaBirthdayBatch
 * @property {string} sabha Pradeshika Sabha display name.
 * @property {Array<Object>} records Raw `member_details` documents for the sabha.
 * @property {import('./member-person-search.js').PersonSearchRow[]} personRows Flattened persons.
 */

/**
 * @typedef {Object} BirthdayDashboardFetchResult
 * @property {string[]} sabhas Sabha names included in this result (display order).
 * @property {SabhaBirthdayBatch[]} batches Per-sabha records and person rows.
 */

/**
 * Returns whether the signed-in user may load birthday dashboard data.
 *
 * @returns {boolean}
 */
export function canLoadBirthdayDashboard() {
  return isSuperAdmin() || isAdmin();
}

/**
 * Loads member records scoped by role: all sabhas for super admin, one sabha for PS admin.
 *
 * @returns {Promise<BirthdayDashboardFetchResult>}
 * @throws {Error} When the user lacks permission.
 */
export async function fetchBirthdayRecordsForCurrentUser() {
  if (!canLoadBirthdayDashboard()) {
    throw new Error('Birthday dashboard requires admin access.');
  }

  if (isSuperAdmin()) {
    const sabhas = Object.keys(PRADESHIKA_SABHA_OPTIONS);
    const recordSets = await Promise.all(sabhas.map((sabha) => getMembersByPradeshikaSabha(sabha)));
    const batches = sabhas.map((sabha, i) => {
      const records = recordSets[i] || [];
      return {
        sabha,
        records,
        personRows: expandToPersonRows(records),
      };
    });
    return { sabhas, batches };
  }

  const sabha = String(getUserPradeshikaSabha() ?? '').trim();
  if (!sabha) {
    Logger.warn('PS admin has no pradeshikaSabha on profile; birthday dashboard will be empty.');
    return { sabhas: [], batches: [] };
  }

  const records = await getMembersByPradeshikaSabha(sabha);
  return {
    sabhas: [sabha],
    batches: [
      {
        sabha,
        records,
        personRows: expandToPersonRows(records),
      },
    ],
  };
}
