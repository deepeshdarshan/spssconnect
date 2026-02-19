/**
 * @fileoverview Business logic for the member_details Firestore collection.
 * Wraps firestore-service with domain-specific operations and metadata handling.
 * @module member-service
 */

import { COLLECTIONS } from './constants.js';
import {
  addDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  getCollection,
  getServerTimestamp,
} from './firestore-service.js';
import { getCurrentUser } from './auth-service.js';

/**
 * Creates a new member_details document with metadata.
 * @param {Object} data - The form data (personalDetails, members, nonMembers).
 * @returns {Promise<string>} The new document ID.
 */
export async function createMember(data) {
  const user = getCurrentUser();
  const document = {
    ...data,
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
  return updateDocument(COLLECTIONS.MEMBER_DETAILS, id, {
    ...data,
    'metadata.updatedAt': getServerTimestamp(),
  });
}

/**
 * Deletes a member_details document.
 * @param {string} id - Document ID.
 * @returns {Promise<void>}
 */
export async function deleteMember(id) {
  return deleteDocument(COLLECTIONS.MEMBER_DETAILS, id);
}

/**
 * Retrieves all member_details documents (admin use).
 * @returns {Promise<Array<Object>>}
 */
export async function getAllMembers() {
  return getCollection(COLLECTIONS.MEMBER_DETAILS);
}
