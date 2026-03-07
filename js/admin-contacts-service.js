/**
 * @fileoverview Admin contact numbers configuration helpers.
 * @module admin-contacts-service
 */

import { COLLECTIONS } from './constants.js';
import { getDocument, setDocument, getServerTimestamp } from './firestore-service.js';
import { getCurrentUser } from './auth-service.js';

const ADMIN_CONTACT_DOC_ID = 'primary';

/**
 * Returns the configured admin contact numbers (max 3).
 * @returns {Promise<string[]>}
 */
export async function getAdminContacts() {
  const doc = await getDocument(COLLECTIONS.ADMIN_CONTACTS, ADMIN_CONTACT_DOC_ID);
  if (!doc || !Array.isArray(doc.phoneNumbers)) return [];
  return doc.phoneNumbers.filter((n) => typeof n === 'string' && n.trim()).slice(0, 3);
}

/**
 * Saves up to three admin contact numbers.
 * @param {string[]} numbers
 * @returns {Promise<void>}
 */
export async function saveAdminContacts(numbers) {
  const normalized = (numbers || [])
    .map((n) => (n || '').toString().trim())
    .filter(Boolean)
    .slice(0, 3);

  const user = getCurrentUser();
  await setDocument(COLLECTIONS.ADMIN_CONTACTS, ADMIN_CONTACT_DOC_ID, {
    phoneNumbers: normalized,
    updatedAt: getServerTimestamp(),
    updatedBy: user ? user.uid : 'anonymous',
  });
}

