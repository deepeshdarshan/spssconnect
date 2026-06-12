/**
 * @fileoverview Firestore reads for the `users` collection (app accounts, roles, sabha scope).
 * Keeps query construction out of page modules per project Firestore guidelines.
 * @module services/users-service
 */

import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from './firebase-config.js';
import { COLLECTIONS } from '../constants/constants.js';

/**
 * Loads every user document ordered by `createdAt` descending (newest first).
 *
 * @returns {Promise<import('firebase/firestore').QuerySnapshot>} Raw snapshot for callers that need doc ids + data.
 * @throws {Error} Propagates Firestore permission or network errors.
 */
export async function getUsersOrderedByCreatedAtDesc() {
  const q = query(collection(db, COLLECTIONS.USERS), orderBy('createdAt', 'desc'));
  return getDocs(q);
}
