/**
 * @fileoverview Phone-to-member ID mapping helpers (member_ids collection).
 * @module member-id-service
 */

import { COLLECTIONS } from '../constants/constants.js';
import {
  getDocument,
  createDocumentWithId,
  getServerTimestamp,
  queryCollection,
  deleteDocument,
} from './firestore-service.js';
import { getCurrentUser } from './auth-service.js';
import { normalizePhoneDigits } from './member-person-search.js';

/** Stable error code for duplicate owner phone numbers. */
export const PHONE_ALREADY_REGISTERED_CODE = 'app/phone-already-registered';

/**
 * Thrown when a phone number is already mapped to another member record.
 */
export class PhoneAlreadyRegisteredError extends Error {
  /**
   * @param {string} phone - Normalized 10-digit phone.
   * @param {string} [existingMemberId]
   */
  constructor(phone, existingMemberId) {
    super(`Phone number ${phone} is already registered`);
    this.name = 'PhoneAlreadyRegisteredError';
    this.code = PHONE_ALREADY_REGISTERED_CODE;
    this.phone = phone;
    this.existingMemberId = existingMemberId ?? null;
  }
}

/**
 * Normalizes an owner phone to digits-only (10-digit Indian mobile).
 * @param {string} value
 * @returns {string}
 */
export function normalizeOwnerPhone(value) {
  return normalizePhoneDigits(value);
}

/**
 * Looks up a member ID by householder phone number.
 * @param {string} phone
 * @returns {Promise<string|null>}
 */
export async function getMemberIdByPhone(phone) {
  const normalized = normalizeOwnerPhone(phone);
  if (!normalized) return null;
  const doc = await getDocument(COLLECTIONS.MEMBER_IDS, normalized);
  if (!doc || !doc.memberId) return null;
  return doc.memberId;
}

/**
 * Client-side pre-check before save: phone must be free, or unchanged on edit.
 * @param {string} phone
 * @param {string|null} recordId - Current record when editing.
 * @returns {Promise<{ok: true}|{ok: false, reason: 'invalid'|'duplicate', existingMemberId?: string}>}
 */
export async function validatePhoneAvailableForSave(phone, recordId = null) {
  const normalized = normalizeOwnerPhone(phone);
  if (!normalized || normalized.length !== 10) {
    return { ok: false, reason: 'invalid' };
  }

  const existingMemberId = await getMemberIdByPhone(normalized);
  if (!existingMemberId) return { ok: true };
  if (recordId && existingMemberId === recordId) return { ok: true };

  return { ok: false, reason: 'duplicate', existingMemberId };
}

/**
 * Asserts the phone is available for create or edit; throws {@link PhoneAlreadyRegisteredError} when not.
 * @param {string} phone
 * @param {string|null} recordId
 * @returns {Promise<string>} Normalized phone.
 */
export async function assertPhoneAvailableForSave(phone, recordId = null) {
  const result = await validatePhoneAvailableForSave(phone, recordId);
  if (result.ok) return normalizeOwnerPhone(phone);
  if (result.reason === 'duplicate') {
    throw new PhoneAlreadyRegisteredError(normalizeOwnerPhone(phone), result.existingMemberId);
  }
  throw new Error('Owner phone is required');
}

/**
 * Creates a phone-to-member mapping (create-only; does not merge/overwrite).
 * @param {string} phone
 * @param {string} memberId
 * @returns {Promise<void>}
 */
export async function createMemberIdForPhone(phone, memberId) {
  const normalized = normalizeOwnerPhone(phone);
  if (!normalized || !memberId) return;

  const existing = await getDocument(COLLECTIONS.MEMBER_IDS, normalized);
  if (existing?.memberId && existing.memberId !== memberId) {
    throw new PhoneAlreadyRegisteredError(normalized, existing.memberId);
  }
  if (existing?.memberId === memberId) return;

  const user = getCurrentUser();
  await createDocumentWithId(COLLECTIONS.MEMBER_IDS, normalized, {
    memberId,
    createdAt: getServerTimestamp(),
    createdBy: user ? user.uid : 'anonymous',
  });
}

/**
 * Overwrites a phone-to-member mapping (restore / admin tooling only).
 * @param {string} phone
 * @param {string} memberId
 * @returns {Promise<void>}
 */
export async function upsertMemberIdForPhone(phone, memberId) {
  const normalized = normalizeOwnerPhone(phone);
  if (!normalized || !memberId) return;
  const user = getCurrentUser();
  await createDocumentWithId(COLLECTIONS.MEMBER_IDS, normalized, {
    memberId,
    createdAt: getServerTimestamp(),
    createdBy: user ? user.uid : 'anonymous',
  });
}

/**
 * @deprecated Use {@link upsertMemberIdForPhone} for restore paths or transactional create in member-service.
 * @param {string} phone
 * @param {string} memberId
 * @returns {Promise<void>}
 */
export async function setMemberIdForPhone(phone, memberId) {
  return upsertMemberIdForPhone(phone, memberId);
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
