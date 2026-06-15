/**
 * @fileoverview Firestore write operations for restore (create / update / delete households).
 * @module backup-sync/services/restore-write-service
 */

import { COLLECTIONS } from '../../constants/constants.js';
import {
  createDocumentWithId,
  getDocument,
  getServerTimestamp,
  updateDocument,
} from '../../services/firestore-service.js';
import { deleteMember } from '../../services/member-service.js';
import { setMemberIdForPhone } from '../../services/member-id-service.js';

/**
 * Syncs head phone to member_ids after a household is restored.
 *
 * @param {Object} memberData - Firestore member_details shape (without id).
 * @param {string} recordId - Household document ID.
 * @returns {Promise<void>}
 */
export async function syncHeadPhoneMapping(memberData, recordId) {
  const phone = memberData?.personalDetails?.phone;
  if (phone) {
    await setMemberIdForPhone(phone, recordId);
  }
}

/**
 * Creates a household document with a preserved Record ID.
 *
 * @param {string} recordId - Firestore document ID to use.
 * @param {Object} memberData - { personalDetails, members, nonMembers }.
 * @param {string} triggeredBy - Operator email or UID for metadata.createdBy.
 * @returns {Promise<void>}
 * @throws {Error} When Firestore write fails.
 */
export async function createHouseholdWithId(recordId, memberData, triggeredBy) {
  await createDocumentWithId(COLLECTIONS.MEMBER_DETAILS, recordId, {
    ...memberData,
    metadata: {
      createdAt: getServerTimestamp(),
      createdBy: triggeredBy,
      updatedAt: getServerTimestamp(),
    },
  });
  await syncHeadPhoneMapping(memberData, recordId);
}

/**
 * Updates an existing household, preserving original created metadata.
 *
 * @param {string} recordId - Firestore document ID.
 * @param {Object} memberData - Updated household data.
 * @returns {Promise<void>}
 * @throws {Error} When Firestore write fails.
 */
export async function updateHouseholdPreservingMeta(recordId, memberData) {
  const existing = await getDocument(COLLECTIONS.MEMBER_DETAILS, recordId);
  const createdAt = existing?.metadata?.createdAt ?? getServerTimestamp();
  const createdBy = existing?.metadata?.createdBy ?? 'restore';

  await updateDocument(COLLECTIONS.MEMBER_DETAILS, recordId, {
    ...memberData,
    metadata: {
      createdAt,
      createdBy,
      updatedAt: getServerTimestamp(),
    },
  });
  await syncHeadPhoneMapping(memberData, recordId);
}

/**
 * Deletes a household and its phone mapping.
 *
 * @param {string} recordId - Firestore document ID.
 * @returns {Promise<void>}
 * @throws {Error} When Firestore delete fails.
 */
export async function deleteHousehold(recordId) {
  await deleteMember(recordId);
}
