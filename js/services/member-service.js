/**
 * @fileoverview Business logic for the member_details Firestore collection.
 * Wraps firestore-service with domain-specific operations and metadata handling.
 * @module member-service
 */

import { COLLECTIONS } from '../constants/constants.js';
import {
  getDocument,
  deleteDocument,
  getCollection,
  queryCollection,
  getServerTimestamp,
  runFirestoreTransaction,
  getDocRef,
  getNewDocRef,
} from './firestore-service.js';
import { getCurrentUser, isSuperAdmin, getUserPradeshikaSabha } from './auth-service.js';
import {
  deleteMemberIdByRecordId,
  normalizeOwnerPhone,
  PhoneAlreadyRegisteredError,
} from './member-id-service.js';
import { enrichMemberDocumentBirthParts } from '../utils/birthday-date-utils.js';

/**
 * Builds the member_details payload with normalized owner phone and metadata.
 * @param {Object} data
 * @param {string} phone
 * @param {boolean} isCreate
 * @returns {Object}
 */
function buildMemberDocument(data, phone, isCreate) {
  const user = getCurrentUser();
  const enriched = enrichMemberDocumentBirthParts(data);
  const document = {
    ...enriched,
    personalDetails: {
      ...enriched.personalDetails,
      phone,
    },
    metadata: {
      ...(isCreate
        ? {
            createdAt: getServerTimestamp(),
            createdBy: user ? user.uid : 'anonymous',
          }
        : {}),
      updatedAt: getServerTimestamp(),
    },
  };
  return document;
}

/**
 * Creates a new member_details document and member_ids mapping atomically.
 * @param {Object} data - The form data (personalDetails, members, nonMembers).
 * @returns {Promise<string>} The new document ID.
 */
export async function createMember(data) {
  const phone = normalizeOwnerPhone(data?.personalDetails?.phone);
  if (!phone || phone.length !== 10) {
    throw new Error('Owner phone is required');
  }

  const user = getCurrentUser();
  const document = buildMemberDocument(data, phone, true);

  return runFirestoreTransaction(async (transaction) => {
    const phoneRef = getDocRef(COLLECTIONS.MEMBER_IDS, phone);
    const phoneSnap = await transaction.get(phoneRef);
    if (phoneSnap.exists()) {
      const existingMemberId = phoneSnap.data()?.memberId ?? null;
      throw new PhoneAlreadyRegisteredError(phone, existingMemberId);
    }

    const memberRef = getNewDocRef(COLLECTIONS.MEMBER_DETAILS);
    transaction.set(memberRef, document);

    transaction.set(phoneRef, {
      memberId: memberRef.id,
      createdAt: getServerTimestamp(),
      createdBy: user ? user.uid : 'anonymous',
    });

    return memberRef.id;
  });
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
 * Updates an existing member_details document and syncs member_ids when the owner phone changes.
 * @param {string} id - Document ID.
 * @param {Object} data - Updated form data.
 * @returns {Promise<void>}
 */
export async function updateMember(id, data) {
  const newPhone = normalizeOwnerPhone(data?.personalDetails?.phone);
  if (!newPhone || newPhone.length !== 10) {
    throw new Error('Owner phone is required');
  }

  const user = getCurrentUser();
  const enriched = enrichMemberDocumentBirthParts(data);
  const updatePayload = {
    ...enriched,
    personalDetails: {
      ...enriched.personalDetails,
      phone: newPhone,
    },
    'metadata.updatedAt': getServerTimestamp(),
  };

  await runFirestoreTransaction(async (transaction) => {
    const memberRef = getDocRef(COLLECTIONS.MEMBER_DETAILS, id);
    const memberSnap = await transaction.get(memberRef);
    if (!memberSnap.exists()) {
      throw new Error('Record not found');
    }

    const oldPhone = normalizeOwnerPhone(memberSnap.data()?.personalDetails?.phone);
    const phoneChanged = oldPhone !== newPhone;

    if (phoneChanged) {
      const newPhoneRef = getDocRef(COLLECTIONS.MEMBER_IDS, newPhone);
      const newPhoneSnap = await transaction.get(newPhoneRef);
      if (newPhoneSnap.exists()) {
        const existingMemberId = newPhoneSnap.data()?.memberId ?? null;
        if (existingMemberId !== id) {
          throw new PhoneAlreadyRegisteredError(newPhone, existingMemberId);
        }
      }
    }

    transaction.update(memberRef, updatePayload);

    if (phoneChanged) {
      if (oldPhone) {
        transaction.delete(getDocRef(COLLECTIONS.MEMBER_IDS, oldPhone));
      }
      transaction.set(getDocRef(COLLECTIONS.MEMBER_IDS, newPhone), {
        memberId: id,
        createdAt: getServerTimestamp(),
        createdBy: user ? user.uid : 'anonymous',
      });
    }
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
