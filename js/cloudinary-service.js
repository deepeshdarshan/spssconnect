/**
 * @fileoverview Cloudinary unsigned upload service.
 * Replace CLOUD_NAME and UPLOAD_PRESET in constants.js with your Cloudinary project values.
 * @module cloudinary-service
 */

import { CLOUDINARY_CONFIG } from './constants.js';

/**
 * Uploads a file to Cloudinary using an unsigned upload preset.
 * @param {File} file - The image file to upload.
 * @returns {Promise<string>} The secure URL of the uploaded image.
 * @throws {Error} If the upload fails.
 */
export async function uploadToCloudinary(file) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.CLOUD_NAME}/image/upload`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.UPLOAD_PRESET);

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Cloudinary upload failed: ${errorBody}`);
  }

  const data = await response.json();
  return data.secure_url;
}
