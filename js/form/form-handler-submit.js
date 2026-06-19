/**
 * @fileoverview Form submit handler — validation, photo, Firestore.
 * @module form/form-handler-submit
 */

import { validateForm } from '../validation/validation-service.js';
import { createMember, updateMember } from '../services/member-service.js';
import { showToast, showLoader, hideLoader } from '../ui/ui-service.js';
import { ENABLE_PHOTO_UPLOAD, ROUTES, MESSAGES, TIMING } from '../constants/constants.js';
import { isAdmin } from '../services/auth-service.js';
import { setMemberIdForPhone } from '../services/member-id-service.js';
import { t } from '../services/i18n-service.js';
import * as Logger from '../utils/logger.js';
import { formState } from './form-state.js';
import { collectFormData } from './form-handler-data.js';
import { uploadPhoto } from './form-handler-photo.js';
import {
  clearValidationErrors,
  displayValidationErrors,
} from './form-handler-validation-ui.js';

/** Binds the form submit event. */
export function bindFormSubmit() {
  const form = document.getElementById('memberForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSubmit();
  });
}

/** Handles form submission — validates, uploads photo, saves to Firestore. */
async function handleSubmit() {
  clearValidationErrors();

  const formData = collectFormData();
  const { isValid, errors } = validateForm(formData);

  if (!isValid) {
    displayValidationErrors(errors);
    const fieldCount = Object.keys(errors).length;
    showToast(`${fieldCount}${MESSAGES.VALIDATION_ATTENTION}`, 'error');
    return;
  }

  showLoader(ENABLE_PHOTO_UPLOAD ? t('msg.photoUploading') : t('msg.saveSuccess'));

  try {
    const photoURL = ENABLE_PHOTO_UPLOAD ? await uploadPhoto() : (formState.existingPhotoURL || '');
    formData.personalDetails.photoURL = photoURL;

    if (formState.editingId) {
      await updateMember(formState.editingId, {
        personalDetails: formData.personalDetails,
        members: formData.members,
        nonMembers: formData.nonMembers,
      });
      showToast(t('msg.updateSuccess'), 'success');
      hideLoader();
      setTimeout(() => {
        window.location.href = `view?id=${formState.editingId}`;
      }, TIMING.REDIRECT_DELAY);
    } else {
      const newId = await createMember(formData);

      const ownerPhone = (formData.personalDetails.phone || '').toString().replace(/\D/g, '');
      if (ownerPhone && ownerPhone.length === 10) {
        try {
          await setMemberIdForPhone(ownerPhone, newId);
        } catch (mapErr) {
          Logger.error('Failed to store member_id mapping', mapErr);
        }
      }

      hideLoader();
      if (isAdmin()) {
        showToast(MESSAGES.RECORD_CREATED, 'success');
        setTimeout(() => {
          window.location.href = ROUTES.HOUSEHOLD_DIRECTORY;
        }, TIMING.REDIRECT_DELAY);
      } else {
        window.location.href = `success?id=${newId}`;
      }
    }
  } catch (err) {
    hideLoader();
    Logger.error('Save failed:', err);
    showToast(t('msg.saveFailed'), 'error');
  }
}
