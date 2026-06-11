/**
 * @fileoverview Photo drop zone and Firebase Storage upload for the registration form.
 * @module form/form-handler-photo
 */

import { uploadToFirebaseStorage } from '../services/storage-service.js';
import { formState } from './form-state.js';

/**
 * Binds click and drag-drop events on the photo upload area.
 */
export function bindPhotoUpload() {
  const dropArea = document.getElementById('photoDropArea');
  const fileInput = document.getElementById('photoInput');

  if (!dropArea || !fileInput) return;

  dropArea.addEventListener('click', () => fileInput.click());

  dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.style.borderColor = 'var(--spss-primary-light)';
  });

  dropArea.addEventListener('dragleave', () => {
    dropArea.style.borderColor = '';
  });

  dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handlePhotoSelect(file);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handlePhotoSelect(fileInput.files[0]);
  });
}

/**
 * Previews the selected photo and stores it for later upload.
 * @param {File} file
 */
function handlePhotoSelect(file) {
  formState.selectedPhoto = file;
  const preview = document.getElementById('photoPreview');
  if (preview) {
    preview.src = URL.createObjectURL(file);
    preview.classList.remove('d-none');
  }
}

/**
 * Uploads the selected photo to Firebase Storage.
 * @returns {Promise<string>} The photo download URL.
 */
export async function uploadPhoto() {
  if (!formState.selectedPhoto) return formState.existingPhotoURL || '';
  return uploadToFirebaseStorage(formState.selectedPhoto);
}
