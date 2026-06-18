/**
 * @fileoverview Feature flags and third-party integration placeholders.
 * @module constants/feature-flags
 */

/** When true, create/edit forms show photo upload UI. */
export const ENABLE_PHOTO_UPLOAD = false;

/** Firebase Storage path prefix for member photos. */
export const STORAGE_PHOTO_PATH = 'member_photos';

/**
 * Cloudinary unsigned upload preset — replace with your project values before enabling uploads.
 * Consumed by {@link ../services/cloudinary-service.js}.
 */
export const CLOUDINARY_CONFIG = Object.freeze({
  CLOUD_NAME: '',
  UPLOAD_PRESET: '',
});
