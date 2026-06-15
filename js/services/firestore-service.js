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
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  writeBatch,
  serverTimestamp,
  getCountFromServer,
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
 * Creates or merges a document at a known ID.
 * @param {string} collectionName
 * @param {string} id
 * @param {Object} data
 * @returns {Promise<void>}
 */
export async function setDocument(collectionName, id, data) {
  await setDoc(doc(db, collectionName, id), data, { merge: true });
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
 * Returns the document count for a collection using Firestore aggregate count.
 * @param {string} collectionName
 * @returns {Promise<number>}
 */
export async function getCollectionCount(collectionName) {
  const snapshot = await getCountFromServer(collection(db, collectionName));
  return snapshot.data().count;
}

/**
 * Returns the document count for a filtered query.
 * @param {string} collectionName
 * @param {string} field
 * @param {string} operator
 * @param {*} value
 * @returns {Promise<number>}
 */
export async function getQueryCount(collectionName, field, operator, value) {
  const q = query(collection(db, collectionName), where(field, operator, value));
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
}

/**
 * Queries a collection with ordering, optional cursor, and limit (for paginated sync).
 * @param {string} collectionName
 * @param {Object} options
 * @param {string} options.field - Field to order/filter on.
 * @param {string} [options.operator] - Comparison operator when filtering.
 * @param {*} [options.value] - Filter value.
 * @param {string} [options.orderDirection='asc'] - 'asc' or 'desc'.
 * @param {import('firebase/firestore').QueryDocumentSnapshot|null} [options.startAfterDoc=null]
 * @param {number} [options.pageSize=25]
 * @returns {Promise<{ docs: Array<Object>, lastDoc: import('firebase/firestore').QueryDocumentSnapshot|null }>}
 */
export async function queryCollectionOrderedPaginated(collectionName, options) {
  const {
    field,
    operator,
    value,
    orderDirection = 'asc',
    startAfterDoc = null,
    pageSize = 25,
  } = options;

  const constraints = [];
  if (operator != null && value !== undefined) {
    constraints.push(where(field, operator, value));
  }
  constraints.push(orderBy(field, orderDirection));
  if (startAfterDoc) {
    constraints.push(startAfter(startAfterDoc));
  }
  constraints.push(limit(pageSize));

  const q = query(collection(db, collectionName), ...constraints);
  const snapshot = await getDocs(q);
  const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
  return { docs, lastDoc };
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
