/**
 * @fileoverview Business logic for the member_details Firestore collection.
 * Wraps firestore-service with domain-specific operations and metadata handling.
 * @module member-service
 */

import { COLLECTIONS } from '../constants/constants.js';
import {
  addDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  getCollection,
  queryCollection,
  getServerTimestamp,
} from './firestore-service.js';
import { getCurrentUser, isSuperAdmin, getUserPradeshikaSabha } from './auth-service.js';
import { deleteMemberIdByRecordId } from './member-id-service.js';
import { enrichMemberDocumentBirthParts } from '../utils/birthday-date-utils.js';

/**
 * Creates a new member_details document with metadata.
 * @param {Object} data - The form data (personalDetails, members, nonMembers).
 * @returns {Promise<string>} The new document ID.
 */
export async function createMember(data) {
  const user = getCurrentUser();
  const enriched = enrichMemberDocumentBirthParts(data);
  const document = {
    ...enriched,
    metadata: {
      createdAt: getServerTimestamp(),
      createdBy: user ? user.uid : 'anonymous',
      updatedAt: getServerTimestamp(),
    },
  };
  return addDocument(COLLECTIONS.MEMBER_DETAILS, document);
}

/**
 * Retrieves a single member_details document.
 * @param {string} id - Document ID.
 * @returns {Promise<Object|null>}
 */
export async function getMember(id) {
  return getDocument(COLLECTIONS.MEMBER_DETAILS, id);
}

/**
 * Updates an existing member_details document with new data and refreshed updatedAt.
 * @param {string} id - Document ID.
 * @param {Object} data - Updated form data.
 * @returns {Promise<void>}
 */
export async function updateMember(id, data) {
  const enriched = enrichMemberDocumentBirthParts(data);
  return updateDocument(COLLECTIONS.MEMBER_DETAILS, id, {
    ...enriched,
    'metadata.updatedAt': getServerTimestamp(),
  });
}

/**
 * Deletes a member_details document and the corresponding member_ids entry (if any).
 * @param {string} id - Document ID.
 * @returns {Promise<void>}
 */
export async function deleteMember(id) {
  await deleteMemberIdByRecordId(id);
  return deleteDocument(COLLECTIONS.MEMBER_DETAILS, id);
}

/**
 * Retrieves all member_details documents (admin use).
 * @returns {Promise<Array<Object>>}
 */
export async function getAllMembers() {
  return getCollection(COLLECTIONS.MEMBER_DETAILS);
}

/**
 * Narrows `member_details` rows to the signed-in user's scope: `super_admin` receives
 * the full array; other roles receive only documents whose owner's
 * `personalDetails.pradeshikaSabha` matches their profile Sabha (case-insensitive).
 * When the profile has no Sabha, the full array is returned (same as legacy dashboard
 * behavior when `getUserPradeshikaSabha()` is empty).
 *
 * @param {Array<Object>} records - Loaded member documents (each may include `personalDetails`).
 * @returns {Array<Object>} Filtered array (new array when filtering applies).
 */
export function scopeMemberDetailsForCurrentUser(records) {
  if (isSuperAdmin()) return records;
  const userSabha = (getUserPradeshikaSabha() || '').toLowerCase();
  if (!userSabha) return records;
  return records.filter((r) => {
    const sabha = String((r.personalDetails || {}).pradeshikaSabha || '').toLowerCase();
    return sabha === userSabha;
  });
}

/**
 * Loads member_details documents where the house owner's Pradeshika Sabha matches exactly.
 * Used for PS-admin dashboards (same filter as legacy inline Firestore query).
 *
 * @param {string} pradeshikaSabha - Stored value of `personalDetails.pradeshikaSabha`.
 * @returns {Promise<Array<Object>>} Member records with `id` set.
 */
export async function getMembersByPradeshikaSabha(pradeshikaSabha) {
  const sabha = String(pradeshikaSabha ?? '').trim();
  if (!sabha) return [];
  return queryCollection(
    COLLECTIONS.MEMBER_DETAILS,
    'personalDetails.pradeshikaSabha',
    '==',
    sabha
  );
}
