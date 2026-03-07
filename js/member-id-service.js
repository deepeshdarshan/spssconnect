/**
 * @fileoverview Phone-to-member ID mapping helpers (member_ids collection).
 * @module member-id-service
 */

import { COLLECTIONS } from './constants.js';
import { getDocument, setDocument, getServerTimestamp, queryCollection, deleteDocument } from './firestore-service.js';
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

/**
 * Removes member_ids document(s) that point to the given record ID.
 * Call when a member_details record is deleted to keep member_ids in sync.
 * @param {string} recordId - The member_details document ID.
 * @returns {Promise<void>}
 */
export async function deleteMemberIdByRecordId(recordId) {
  if (!recordId) return;
  const docs = await queryCollection(COLLECTIONS.MEMBER_IDS, 'memberId', '==', recordId);
  for (const d of docs) {
    if (d.id) await deleteDocument(COLLECTIONS.MEMBER_IDS, d.id);
  }
}

