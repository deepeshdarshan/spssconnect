/**
 * @fileoverview Firebase Storage upload service.
 * @module storage-service
 */

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase-config.js';
import { STORAGE_PHOTO_PATH } from './constants.js';

/**
 * Uploads a file to Firebase Storage and returns the download URL.
 * @param {File} file - The file to upload.
 * @param {string} [customPath] - Optional custom path; defaults to member_photos/{timestamp}_{filename}.
 * @returns {Promise<string>} The public download URL of the uploaded file.
 */
export async function uploadToFirebaseStorage(file, customPath) {
  const path = customPath || `${STORAGE_PHOTO_PATH}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
}
