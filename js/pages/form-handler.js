/**
 * @fileoverview Form handler for the data entry page (create.html).
 * Orchestrates i18n, bindings, dynamic sections, submit, and edit prefill.
 * @module form-handler
 */

import { initI18n, bindLanguageToggle, t, applyTranslations } from '../services/i18n-service.js';
import { ENABLE_PHOTO_UPLOAD } from '../constants/constants.js';
import { bindPhotoUpload } from '../form/form-handler-photo.js';
import { bindDynamicSections } from '../form/form-handler-sections.js';
import {
  bindDigitsOnlyInputs,
  bindSpssPositionToggle,
  bindMemberSpssPositionToggle,
  bindLivingOutsideToggle,
  lockSabhaForAdmin,
  bindOccupationExpertiseVisibility,
} from '../form/form-handler-bindings.js';
import { bindFormSubmit } from '../form/form-handler-submit.js';
import { formState } from '../form/form-state.js';
import { addMemberBlock, addNonMemberBlock } from '../form/form-handler-sections.js';

export { collectFormData } from '../form/form-handler-data.js';
export { addMemberBlock, addNonMemberBlock } from '../form/form-handler-sections.js';

/**
 * Prefills the owner phone field from the ?phone= query parameter, if present.
 */
function tryPrefillPhoneFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const phone = params.get('phone');
  if (!phone) return;
  const input = document.getElementById('ownerPhone');
  if (input) {
    input.value = phone.replace(/\D/g, '');
  }
}

/**
 * Initializes the create/edit form — sets up i18n, photo upload, dynamic sections, and submit.
 *
 * @param {Object} [existingData] - Existing document data for edit mode.
 * @param {string} [docId] - Document ID for edit mode.
 * @param {boolean} [shared] - Whether this is a shared (public) edit.
 */
export function initForm(existingData, docId, shared = false) {
  formState.isSharedEdit = shared;
  initI18n();
  bindLanguageToggle();

  if (ENABLE_PHOTO_UPLOAD) {
    const photoSection = document.getElementById('photoSection');
    if (photoSection) photoSection.classList.remove('d-none');
    bindPhotoUpload();
  }

  bindDigitsOnlyInputs();
  bindSpssPositionToggle();
  bindMemberSpssPositionToggle();
  bindLivingOutsideToggle();
  bindDynamicSections();
  bindFormSubmit();
  lockSabhaForAdmin();
  bindOccupationExpertiseVisibility();

  document.getElementById('btnFormCancelBack')?.addEventListener('click', () => {
    window.history.back();
  });

  tryPrefillPhoneFromQuery();

  if (existingData && docId) {
    formState.editingId = docId;
    populateForm(existingData);
  }
}

/**
 * Fills the form with existing data for editing.
 *
 * @param {Object} data - The existing Firestore document data.
 */
export function populateForm(data) {
  const pd = data.personalDetails || {};
  const addr = pd.address || {};

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };

  set('ownerName', pd.name);
  set('ownerDOB', pd.dob);
  set('ownerGender', pd.gender);
  set('houseName', pd.houseName);
  set('pradeshikaSabha', pd.pradeshikaSabha);
  set('ownerBloodGroup', pd.bloodGroup);
  set('ownerOccupation', pd.occupation);
  set('ownerPhone', pd.phone);
  set('ownerEmail', pd.email);
  set('ownerMembership', pd.membershipType);
  set('ownerEducation', pd.highestEducation);
  set('address1', addr.address1);
  set('address2', addr.address2);
  set('place', addr.place);
  set('pin', addr.pin);

  set('rationCardType', pd.rationCardType);

  set('ownerExpertise', pd.areaOfExpertise);
  {
    const os = document.getElementById('ownerOccupation');
    const eg = document.getElementById('ownerExpertiseGroup');
    if (os && eg) {
      const has = Boolean((os.value || '').trim());
      eg.classList.toggle('d-none', !has);
      if (!has) {
        set('ownerExpertise', '');
      }
    }
  }

  if (pd.holdsSpssPosition) {
    set('holdsSpssPosition', 'yes');
    document.getElementById('spssPositionNameGroup')?.classList.remove('d-none');
    set('spssPositionName', pd.spssPositionName);
  }

  if (pd.healthInsurance) {
    const el = document.getElementById('healthYes');
    if (el) el.checked = true;
  }

  if (pd.termLifeInsurance) {
    const el = document.getElementById('termLifeYes');
    if (el) el.checked = true;
  }

  if (pd.photoURL) {
    formState.existingPhotoURL = pd.photoURL;
    const preview = document.getElementById('photoPreview');
    if (preview) {
      preview.src = pd.photoURL;
      preview.classList.remove('d-none');
    }
  }

  (data.members || []).forEach((m) => addMemberBlock(m));
  (data.nonMembers || []).forEach((nm) => addNonMemberBlock(nm));

  const titleEl = document.querySelector('[data-i18n="page.title"]');
  if (titleEl) titleEl.setAttribute('data-i18n', 'page.editTitle');

  const submitBtnText = document.querySelector('#submitBtn [data-i18n="btn.submit"]');
  if (submitBtnText) submitBtnText.setAttribute('data-i18n', 'btn.update');

  applyTranslations();
}
