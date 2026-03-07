/**
 * @fileoverview Phone-to-member ID mapping helpers (member_ids collection).
 * @module member-id-service
 */

import { COLLECTIONS } from './constants.js';
import { getDocument, setDocument, getServerTimestamp } from './firestore-service.js';
import { getCurrentUser } from './auth-service.js';

/**
 * Looks up a member ID by householder phone number.
 * @param {string} phone
 * @returns {Promise<string|null>}
 */
export async function getMemberIdByPhone(phone) {
  if (!phone) return null;
  const doc = await getDocument(COLLECTIONS.MEMBER_IDS, phone);
  if (!doc || !doc.memberId) return null;
  return doc.memberId;
}

/**
 * Stores or updates the mapping between phone number and member record ID.
 * @param {string} phone
 * @param {string} memberId
 * @returns {Promise<void>}
 */
export async function setMemberIdForPhone(phone, memberId) {
  if (!phone || !memberId) return;
  const user = getCurrentUser();
  await setDocument(COLLECTIONS.MEMBER_IDS, phone, {
    memberId,
    createdAt: getServerTimestamp(),
    createdBy: user ? user.uid : 'anonymous',
  });
}

