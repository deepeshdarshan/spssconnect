/**
 * @fileoverview Generic Firestore CRUD wrapper.
 * All direct Firestore SDK interactions are centralized here.
 * @module firestore-service
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase-config.js';

/**
 * Adds a new document to a Firestore collection.
 * @param {string} collectionName - The collection path.
 * @param {Object} data - The document data.
 * @returns {Promise<string>} The new document ID.
 */
export async function addDocument(collectionName, data) {
  const docRef = await addDoc(collection(db, collectionName), data);
  return docRef.id;
}

/**
 * Retrieves a single document by ID.
 * @param {string} collectionName
 * @param {string} id - Document ID.
 * @returns {Promise<Object|null>} The document data with id, or null if not found.
 */
export async function getDocument(collectionName, id) {
  const snap = await getDoc(doc(db, collectionName, id));
  if (!snap.exists()) return null;
  const data = snap.data();
  data.id = snap.id;
  return data;
}

/**
 * Updates an existing document.
 * @param {string} collectionName
 * @param {string} id
 * @param {Object} data - The fields to update (merged).
 * @returns {Promise<void>}
 */
export async function updateDocument(collectionName, id, data) {
  await updateDoc(doc(db, collectionName, id), data);
}

/**
 * Deletes a document by ID.
 * @param {string} collectionName
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteDocument(collectionName, id) {
  await deleteDoc(doc(db, collectionName, id));
}

/**
 * Retrieves all documents from a collection.
 * @param {string} collectionName
 * @returns {Promise<Array<Object>>} Array of document objects with id fields.
 */
export async function getCollection(collectionName) {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map((d) => {
    const data = d.data();
    data._docId = d.id;
    data.id = d.id;
    return data;
  });
}

/**
 * Queries a collection with a single where clause.
 * @param {string} collectionName
 * @param {string} field - The field to filter on.
 * @param {string} operator - The comparison operator (e.g. '==', '>=').
 * @param {*} value - The value to compare.
 * @returns {Promise<Array<Object>>}
 */
export async function queryCollection(collectionName, field, operator, value) {
  const q = query(collection(db, collectionName), where(field, operator, value));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Batch writes multiple documents to a collection.
 * @param {string} collectionName
 * @param {Array<Object>} documents - Array of document data objects.
 * @returns {Promise<number>} Number of documents written.
 */
export async function batchWrite(collectionName, documents) {
  const BATCH_LIMIT = 500;
  let written = 0;

  for (let i = 0; i < documents.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = documents.slice(i, i + BATCH_LIMIT);

    chunk.forEach((data) => {
      const docRef = doc(collection(db, collectionName));
      batch.set(docRef, data);
    });

    await batch.commit();
    written += chunk.length;
  }

  return written;
}

/**
 * Returns a Firestore server timestamp (for use in document writes).
 * @returns {import('firebase/firestore').FieldValue}
 */
export function getServerTimestamp() {
  return serverTimestamp();
}
