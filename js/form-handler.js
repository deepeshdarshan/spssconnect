/**
 * @fileoverview Form handler for the data entry page (create.html).
 * Manages form binding, dynamic member/non-member sections, photo upload, and submission.
 * @module form-handler
 */

import { initI18n, bindLanguageToggle, t, applyTranslations } from './i18n-service.js';
import { validateForm } from './validation-service.js';
import { uploadToFirebaseStorage } from './storage-service.js';
import { createMember, updateMember } from './member-service.js';
import { showToast, showLoader, hideLoader } from './ui-service.js';
import { ENABLE_PHOTO_UPLOAD, ROUTES, MESSAGES, TIMING } from './constants.js';
import { isAdmin, isSuperAdmin, getUserPradeshikaSabha } from './auth-service.js';

/** @type {number} Running counter for member blocks */
let memberCount = 0;

/** @type {number} Running counter for non-member blocks */
let nonMemberCount = 0;

/** @type {File|null} Selected photo file pending upload */
let selectedPhoto = null;

/** @type {string|null} Existing photo URL (for edits) */
let existingPhotoURL = null;

/** @type {string|null} If editing, the document ID */
let editingId = null;

/** @type {boolean} Whether the current edit is via a shared link */
let isSharedEdit = false;

/**
 * Initializes the create/edit form — sets up i18n, photo upload, dynamic sections, and submit.
 * @param {Object} [existingData] - Existing document data for edit mode.
 * @param {string} [docId] - Document ID for edit mode.
 * @param {boolean} [shared] - Whether this is a shared (public) edit.
 */
export function initForm(existingData, docId, shared = false) {
  isSharedEdit = shared;
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
  bindOccupationExpertiseToggle();
  bindMemberExpertiseToggle();
  bindDynamicSections();
  bindFormSubmit();
  lockSabhaForAdmin();

  if (existingData && docId) {
    editingId = docId;
    populateForm(existingData);
  }
}

/* ================================================================== */
/*  Photo Upload                                                       */
/* ================================================================== */

/**
 * Uses event delegation to strip non-digit characters from any input with the
 * "digits-only" class, including dynamically added member/non-member fields.
 */
function bindDigitsOnlyInputs() {
  document.addEventListener('input', (e) => {
    if (e.target.classList.contains('digits-only')) {
      e.target.value = e.target.value.replace(/\D/g, '');
    }
  });
}

/**
 * Binds click and drag-drop events on the photo upload area.
 */
function bindPhotoUpload() {
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
  selectedPhoto = file;
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
async function uploadPhoto() {
  if (!selectedPhoto) return existingPhotoURL || '';
  return uploadToFirebaseStorage(selectedPhoto);
}

/* ================================================================== */
/*  Conditional Toggles                                                */
/* ================================================================== */

/** Event-delegated toggle for "Living outside Kerala" reason dropdown in member/non-member blocks. */
function bindLivingOutsideToggle() {
  document.addEventListener('change', (e) => {
    if (!e.target.classList.contains('living-outside-toggle')) return;
    const block = e.target.closest('.dynamic-block');
    if (!block) return;
    const reasonGroup = block.querySelector('.living-outside-reason-group');
    if (reasonGroup) reasonGroup.classList.toggle('d-none', e.target.value !== 'yes');
  });
}

/** Shows/hides the SPSS position name field based on the Yes/No select. */
function bindSpssPositionToggle() {
  const select = document.getElementById('holdsSpssPosition');
  const nameGroup = document.getElementById('spssPositionNameGroup');
  if (!select || !nameGroup) return;

  select.addEventListener('change', () => {
    nameGroup.classList.toggle('d-none', select.value !== 'yes');
  });
}

/**
 * If the current user is an admin (not super_admin), pre-selects their assigned
 * Pradeshika Sabha and disables the dropdown so they cannot change it.
 */
function lockSabhaForAdmin() {
  if (!isAdmin() || isSuperAdmin()) return;
  const sabha = getUserPradeshikaSabha();
  if (!sabha) return;

  const select = document.getElementById('pradeshikaSabha');
  if (!select) return;

  select.value = sabha;
  select.setAttribute('disabled', 'true');

  const form = document.getElementById('memberForm');
  if (!form) return;
  const hidden = document.createElement('input');
  hidden.type = 'hidden';
  hidden.name = 'pradeshikaSabhaHidden';
  hidden.id = 'pradeshikaSabhaHidden';
  hidden.value = sabha;
  form.appendChild(hidden);
}

/** Event-delegated toggle for SPSS position fields inside dynamic member blocks. */
function bindMemberSpssPositionToggle() {
  document.addEventListener('change', (e) => {
    if (!e.target.classList.contains('member-spss-toggle')) return;
    const block = e.target.closest('.dynamic-block');
    if (!block) return;
    const nameGroup = block.querySelector('.member-spss-name-group');
    if (nameGroup) nameGroup.classList.toggle('d-none', e.target.value !== 'yes');
  });
}

const EXPERTISE_OCCUPATIONS = ['central_govt', 'state_govt', 'private_employee', 'self_employed'];

/** Shows/hides the Area of Expertise field for the house owner based on occupation. */
function bindOccupationExpertiseToggle() {
  const select = document.getElementById('ownerOccupation');
  const group = document.getElementById('ownerExpertiseGroup');
  if (!select || !group) return;

  select.addEventListener('change', () => {
    group.classList.toggle('d-none', !EXPERTISE_OCCUPATIONS.includes(select.value));
  });
}

/** Event-delegated toggle for Area of Expertise inside dynamic member blocks. */
function bindMemberExpertiseToggle() {
  document.addEventListener('change', (e) => {
    if (!e.target.classList.contains('member-occupation-select')) return;
    const block = e.target.closest('.dynamic-block');
    if (!block) return;
    const group = block.querySelector('.member-expertise-group');
    if (group) group.classList.toggle('d-none', !EXPERTISE_OCCUPATIONS.includes(e.target.value));
  });
}

/* ================================================================== */
/*  Dynamic Member / Non-Member Sections                               */
/* ================================================================== */

/** Binds the "Add Member" and "Add Non-Member" buttons. */
function bindDynamicSections() {
  document.getElementById('addMemberBtn')?.addEventListener('click', () => addMemberBlock());
  document.getElementById('addNonMemberBtn')?.addEventListener('click', () => addNonMemberBlock());
}

/**
 * Creates a dynamic member block and appends it to the container.
 * @param {Object} [data] - Pre-filled data for edit mode.
 */
export function addMemberBlock(data) {
  memberCount++;
  const container = document.getElementById('membersContainer');
  if (!container) return;

  document.getElementById('noMembersMsg')?.classList.add('d-none');

  const index = memberCount;
  const block = document.createElement('div');
  block.className = 'dynamic-block';
  block.dataset.memberIndex = index;
  block.innerHTML = buildMemberBlockHTML(index, data);

  block.querySelector('.btn-remove-block')?.addEventListener('click', () => {
    block.remove();
    toggleEmptyMessage('membersContainer', 'noMembersMsg');
  });

  container.appendChild(block);
  applyTranslations();
}

/**
 * Creates a dynamic non-member block and appends it to the container.
 * @param {Object} [data] - Pre-filled data for edit mode.
 */
export function addNonMemberBlock(data) {
  nonMemberCount++;
  const container = document.getElementById('nonMembersContainer');
  if (!container) return;

  document.getElementById('noNonMembersMsg')?.classList.add('d-none');

  const index = nonMemberCount;
  const block = document.createElement('div');
  block.className = 'dynamic-block';
  block.dataset.nonMemberIndex = index;
  block.innerHTML = buildNonMemberBlockHTML(index, data);

  block.querySelector('.btn-remove-block')?.addEventListener('click', () => {
    block.remove();
    toggleEmptyMessage('nonMembersContainer', 'noNonMembersMsg');
  });

  container.appendChild(block);
  applyTranslations();
}

/** Toggles the "no items" message visibility. */
function toggleEmptyMessage(containerId, messageId) {
  const container = document.getElementById(containerId);
  const msg = document.getElementById(messageId);
  if (container && msg) {
    msg.classList.toggle('d-none', container.children.length > 0);
  }
}

/**
 * Builds the inner HTML for a member block.
 * Includes: name, DOB, relationship, membership, blood group, phone, email, education, occupation.
 * @param {number} index
 * @param {Object} [data]
 * @returns {string}
 */
function buildMemberBlockHTML(index, data) {
  const d = data || {};
  return `
    <div class="block-header">
      <span class="block-number"><span class="block-index">#${index}</span> <span data-i18n="block.member">${t('block.member')}</span></span>
      <button type="button" class="btn-remove-block" title="Remove">
        <i class="bi bi-x-lg"></i>
      </button>
    </div>

    <div class="block-sub-section" data-i18n="subsection.basicDetails"><i class="bi bi-person me-1"></i>${t('subsection.basicDetails')}</div>
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.name">${t('form.name')}</label>
        <input type="text" class="form-control" name="member_name_${index}" value="${esc(d.name)}" required>
        <div class="invalid-feedback"></div>
      </div>
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.dob">${t('form.dob')}</label>
        <input type="date" class="form-control" name="member_dob_${index}" value="${esc(d.dob)}">
      </div>
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.relationship">${t('form.relationship')}</label>
        <select class="form-select" name="member_relationship_${index}">
          <option value="" data-i18n="form.selectOption">${t('form.selectOption')}</option>
          ${buildRelationshipOptions(d.relationship)}
        </select>
      </div>
    </div>

    <div class="block-sub-section" data-i18n="subsection.contactDetails"><i class="bi bi-telephone me-1"></i>${t('subsection.contactDetails')}</div>
    <div class="row g-3">
      <div class="col-md-6">
        <label class="form-label" data-i18n="form.phone">${t('form.phone')} <span class="text-danger">*</span></label>
        <input type="tel" class="form-control digits-only" name="member_phone_${index}" value="${esc(d.phone)}" inputmode="numeric" pattern="[0-9]*" maxlength="10" required>
        <small class="text-muted" data-i18n="form.phoneHintMember">${t('form.phoneHintMember')}</small>
        <div class="invalid-feedback"></div>
      </div>
      <div class="col-md-6">
        <label class="form-label" data-i18n="form.email">${t('form.email')}</label>
        <input type="email" class="form-control" name="member_email_${index}" value="${esc(d.email)}">
        <div class="invalid-feedback"></div>
      </div>
    </div>

    <div class="block-sub-section" data-i18n="subsection.personalDetails"><i class="bi bi-clipboard2-pulse me-1"></i>${t('subsection.personalDetails')}</div>
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.bloodGroup">${t('form.bloodGroup')}</label>
        <select class="form-select" name="member_blood_${index}">
          <option value="">—</option>
          ${buildBloodGroupOptions(d.bloodGroup)}
        </select>
      </div>
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.education">${t('form.education')}</label>
        <select class="form-select" name="member_education_${index}">
          <option value="" data-i18n="form.selectOption">${t('form.selectOption')}</option>
          ${buildEducationOptions(d.highestEducation)}
        </select>
      </div>
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.occupation">${t('form.occupation')}</label>
        <select class="form-select member-occupation-select" name="member_occupation_${index}">
          <option value="" data-i18n="form.selectOption">${t('form.selectOption')}</option>
          ${buildOccupationOptions(d.occupation, true)}
        </select>
      </div>
      <div class="col-md-4 ${EXPERTISE_OCCUPATIONS.includes(d.occupation) ? '' : 'd-none'} member-expertise-group">
        <label class="form-label" data-i18n="form.areaOfExpertise">${t('form.areaOfExpertise')}</label>
        <input type="text" class="form-control" name="member_expertise_${index}" value="${esc(d.areaOfExpertise)}">
      </div>
    </div>

    <div class="block-sub-section" data-i18n="subsection.membershipInfo"><i class="bi bi-card-checklist me-1"></i>${t('subsection.membershipInfo')}</div>
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.membership">${t('form.membership')}</label>
        <select class="form-select" name="member_membership_${index}">
          <option value="" data-i18n="form.selectOption">${t('form.selectOption')}</option>
          <option value="life_member" ${d.membershipType === 'life_member' ? 'selected' : ''} data-i18n="option.lifeMember">${t('option.lifeMember')}</option>
          <option value="ordinary_member" ${d.membershipType === 'ordinary_member' ? 'selected' : ''} data-i18n="option.ordinaryMember">${t('option.ordinaryMember')}</option>
        </select>
      </div>
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.holdsSpssPositionMember">${t('form.holdsSpssPositionMember')}</label>
        <select class="form-select member-spss-toggle" name="member_holdsSpssPosition_${index}">
          <option value="no" ${(!d.holdsSpssPosition) ? 'selected' : ''} data-i18n="option.no">${t('option.no')}</option>
          <option value="yes" ${d.holdsSpssPosition ? 'selected' : ''} data-i18n="option.yes">${t('option.yes')}</option>
        </select>
      </div>
      <div class="col-md-4 ${d.holdsSpssPosition ? '' : 'd-none'} member-spss-name-group">
        <label class="form-label" data-i18n="form.spssPositionName">${t('form.spssPositionName')}</label>
        <input type="text" class="form-control" name="member_spssPositionName_${index}" value="${esc(d.spssPositionName)}">
      </div>
    </div>

    <div class="block-sub-section" data-i18n="subsection.locationDetails"><i class="bi bi-pin-map me-1"></i>${t('subsection.locationDetails')}</div>
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.livingOutsideKeralaMember">${t('form.livingOutsideKeralaMember')}</label>
        <select class="form-select living-outside-toggle" name="member_livingOutside_${index}">
          <option value="no" ${(!d.livingOutsideKerala) ? 'selected' : ''} data-i18n="option.no">${t('option.no')}</option>
          <option value="yes" ${d.livingOutsideKerala ? 'selected' : ''} data-i18n="option.yes">${t('option.yes')}</option>
        </select>
      </div>
      <div class="col-md-4 ${d.livingOutsideKerala ? '' : 'd-none'} living-outside-reason-group">
        <label class="form-label" data-i18n="form.outsideReason">${t('form.outsideReason')}</label>
        <select class="form-select" name="member_outsideReason_${index}">
          <option value="" data-i18n="form.selectOption">${t('form.selectOption')}</option>
          <option value="job" ${d.outsideReason === 'job' ? 'selected' : ''} data-i18n="option.job">${t('option.job')}</option>
          <option value="study" ${d.outsideReason === 'study' ? 'selected' : ''} data-i18n="option.study">${t('option.study')}</option>
        </select>
      </div>
    </div>
  `;
}

/**
 * Builds the inner HTML for a non-member block.
 * Same as member but WITHOUT membership dropdown, WITH reason for no membership.
 * @param {number} index
 * @param {Object} [data]
 * @returns {string}
 */
function buildNonMemberBlockHTML(index, data) {
  const d = data || {};
  return `
    <div class="block-header">
      <span class="block-number"><span class="block-index">#${index}</span> <span data-i18n="block.nonMember">${t('block.nonMember')}</span></span>
      <button type="button" class="btn-remove-block" title="Remove">
        <i class="bi bi-x-lg"></i>
      </button>
    </div>

    <div class="block-sub-section" data-i18n="subsection.basicDetails"><i class="bi bi-person me-1"></i>${t('subsection.basicDetails')}</div>
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.name">${t('form.name')}</label>
        <input type="text" class="form-control" name="nonMember_name_${index}" value="${esc(d.name)}" required>
        <div class="invalid-feedback"></div>
      </div>
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.dob">${t('form.dob')}</label>
        <input type="date" class="form-control" name="nonMember_dob_${index}" value="${esc(d.dob)}">
      </div>
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.relationship">${t('form.relationship')}</label>
        <select class="form-select" name="nonMember_relationship_${index}">
          <option value="" data-i18n="form.selectOption">${t('form.selectOption')}</option>
          ${buildRelationshipOptions(d.relationship)}
        </select>
      </div>
    </div>

    <div class="block-sub-section" data-i18n="subsection.contactDetails"><i class="bi bi-telephone me-1"></i>${t('subsection.contactDetails')}</div>
    <div class="row g-3">
      <div class="col-md-6">
        <label class="form-label" data-i18n="form.phone">${t('form.phone')} <span class="text-danger">*</span></label>
        <input type="tel" class="form-control digits-only" name="nonMember_phone_${index}" value="${esc(d.phone)}" inputmode="numeric" pattern="[0-9]*" maxlength="10" required>
        <small class="text-muted" data-i18n="form.phoneHintMember">${t('form.phoneHintMember')}</small>
        <div class="invalid-feedback"></div>
      </div>
      <div class="col-md-6">
        <label class="form-label" data-i18n="form.email">${t('form.email')}</label>
        <input type="email" class="form-control" name="nonMember_email_${index}" value="${esc(d.email)}">
        <div class="invalid-feedback"></div>
      </div>
    </div>

    <div class="block-sub-section" data-i18n="subsection.personalDetails"><i class="bi bi-clipboard2-pulse me-1"></i>${t('subsection.personalDetails')}</div>
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.bloodGroup">${t('form.bloodGroup')}</label>
        <select class="form-select" name="nonMember_blood_${index}">
          <option value="">—</option>
          ${buildBloodGroupOptions(d.bloodGroup)}
        </select>
      </div>
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.education">${t('form.education')}</label>
        <select class="form-select" name="nonMember_education_${index}">
          <option value="" data-i18n="form.selectOption">${t('form.selectOption')}</option>
          ${buildEducationOptions(d.highestEducation)}
        </select>
      </div>
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.occupation">${t('form.occupation')}</label>
        <select class="form-select member-occupation-select" name="nonMember_occupation_${index}">
          <option value="" data-i18n="form.selectOption">${t('form.selectOption')}</option>
          ${buildOccupationOptions(d.occupation, true)}
        </select>
      </div>
      <div class="col-md-4 ${EXPERTISE_OCCUPATIONS.includes(d.occupation) ? '' : 'd-none'} member-expertise-group">
        <label class="form-label" data-i18n="form.areaOfExpertise">${t('form.areaOfExpertise')}</label>
        <input type="text" class="form-control" name="nonMember_expertise_${index}" value="${esc(d.areaOfExpertise)}">
      </div>
    </div>

    <div class="block-sub-section" data-i18n="subsection.membershipStatus"><i class="bi bi-person-x me-1"></i>${t('subsection.membershipStatus')}</div>
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.reasonNoMembership">${t('form.reasonNoMembership')}</label>
        <input type="text" class="form-control" name="nonMember_reason_${index}" value="${esc(d.reasonForNoMembership)}">
      </div>
    </div>

    <div class="block-sub-section" data-i18n="subsection.locationDetails"><i class="bi bi-pin-map me-1"></i>${t('subsection.locationDetails')}</div>
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.livingOutsideKeralaMember">${t('form.livingOutsideKeralaMember')}</label>
        <select class="form-select living-outside-toggle" name="nonMember_livingOutside_${index}">
          <option value="no" ${(!d.livingOutsideKerala) ? 'selected' : ''} data-i18n="option.no">${t('option.no')}</option>
          <option value="yes" ${d.livingOutsideKerala ? 'selected' : ''} data-i18n="option.yes">${t('option.yes')}</option>
        </select>
      </div>
      <div class="col-md-4 ${d.livingOutsideKerala ? '' : 'd-none'} living-outside-reason-group">
        <label class="form-label" data-i18n="form.outsideReason">${t('form.outsideReason')}</label>
        <select class="form-select" name="nonMember_outsideReason_${index}">
          <option value="" data-i18n="form.selectOption">${t('form.selectOption')}</option>
          <option value="job" ${d.outsideReason === 'job' ? 'selected' : ''} data-i18n="option.job">${t('option.job')}</option>
          <option value="study" ${d.outsideReason === 'study' ? 'selected' : ''} data-i18n="option.study">${t('option.study')}</option>
        </select>
      </div>
    </div>
  `;
}

/* ================================================================== */
/*  HTML Option Builders                                               */
/* ================================================================== */

/** @param {string} [selected] */
function buildBloodGroupOptions(selected) {
  return ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
    .map((bg) => `<option value="${bg}" ${selected === bg ? 'selected' : ''}>${bg}</option>`)
    .join('');
}

/** @param {string} [selected] */
function buildEducationOptions(selected) {
  const opts = [
    ['below_10th', 'option.below10th'], ['10th', 'option.tenth'], ['plus_two', 'option.plusTwo'],
    ['diploma', 'option.diploma'], ['bachelors', 'option.bachelors'], ['masters', 'option.masters'],
    ['doctorate', 'option.doctorate'], ['professional', 'option.professional'], ['other', 'option.otherEdu'],
  ];
  return opts
    .map(([val, key]) => `<option value="${val}" ${selected === val ? 'selected' : ''} data-i18n="${key}">${t(key)}</option>`)
    .join('');
}

/**
 * @param {string} [selected]
 * @param {boolean} [includeStudent]
 */
function buildOccupationOptions(selected, includeStudent = false) {
  const opts = [
    ['central_govt', 'option.centralGovt'], ['state_govt', 'option.stateGovt'],
    ['private_employee', 'option.privateEmployee'], ['self_employed', 'option.selfEmployed'],
    ['kazhakam', 'option.kazhakam'], ['homemaker', 'option.homemaker'],
    ['retired', 'option.retired'], ['unemployed', 'option.unemployed'],
  ];
  if (includeStudent) opts.push(['student', 'option.student']);
  return opts
    .map(([val, key]) => `<option value="${val}" ${selected === val ? 'selected' : ''} data-i18n="${key}">${t(key)}</option>`)
    .join('');
}

/** @param {string} [selected] */
function buildRelationshipOptions(selected) {
  const opts = [
    ['spouse', 'option.spouse'], ['son', 'option.son'], ['daughter', 'option.daughter'],
    ['father', 'option.father'], ['mother', 'option.mother'], ['brother', 'option.brother'],
    ['sister', 'option.sister'], ['daughter_in_law', 'option.daughterInLaw'],
    ['son_in_law', 'option.sonInLaw'], ['grandchild', 'option.grandchild'],
    ['other', 'option.otherRelation'],
  ];
  return opts
    .map(([val, key]) => `<option value="${val}" ${selected === val ? 'selected' : ''} data-i18n="${key}">${t(key)}</option>`)
    .join('');
}

/** Escapes a value for safe HTML attribute insertion. */
function esc(val) {
  if (val == null) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ================================================================== */
/*  Form Data Collection                                               */
/* ================================================================== */

/**
 * Reads all form fields and returns the structured document data.
 * Uses element IDs directly — no name attributes needed.
 * @returns {Object} The form data matching the Firestore schema.
 */
export function collectFormData() {
  const val = (id) => document.getElementById(id)?.value?.trim() || '';
  const radio = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value || 'false';

  const holdsPosition = val('holdsSpssPosition') === 'yes';

  const personalDetails = {
    name: val('ownerName'),
    dob: val('ownerDOB'),
    houseName: val('houseName'),
    gender: val('ownerGender'),
    pradeshikaSabha: val('pradeshikaSabha') || val('pradeshikaSabhaHidden'),
    photoURL: '',
    bloodGroup: val('ownerBloodGroup'),
    occupation: val('ownerOccupation'),
    areaOfExpertise: EXPERTISE_OCCUPATIONS.includes(val('ownerOccupation')) ? val('ownerExpertise') : '',
    phone: val('ownerPhone'),
    email: val('ownerEmail'),
    membershipType: val('ownerMembership'),
    highestEducation: val('ownerEducation'),
    address: {
      address1: val('address1'),
      address2: val('address2'),
      place: val('place'),
      pin: val('pin'),
    },
    holdsSpssPosition: holdsPosition,
    spssPositionName: holdsPosition ? val('spssPositionName') : '',
    healthInsurance: radio('healthInsurance') === 'true',
    termLifeInsurance: radio('termLifeInsurance') === 'true',
    rationCardType: val('rationCardType'),
  };

  const members = collectDynamicEntries('membersContainer', 'member', false);
  const nonMembers = collectDynamicEntries('nonMembersContainer', 'nonMember', true);

  return { personalDetails, members, nonMembers };
}

/**
 * Collects data from dynamic member/non-member blocks.
 * @param {string} containerId
 * @param {string} prefix
 * @param {boolean} [isNonMember=false]
 * @returns {Array<Object>}
 */
function collectDynamicEntries(containerId, prefix, isNonMember = false) {
  const container = document.getElementById(containerId);
  if (!container) return [];

  const blocks = container.querySelectorAll('.dynamic-block');
  const entries = [];

  blocks.forEach((block) => {
    const idx = block.dataset.memberIndex || block.dataset.nonMemberIndex;
    const field = (name) => block.querySelector(`[name="${prefix}_${name}_${idx}"]`)?.value?.trim() || '';

    const holdsPosition = field('holdsSpssPosition') === 'yes';

    const livingOutside = field('livingOutside') === 'yes';

    const entry = {
      name: field('name'),
      dob: field('dob'),
      relationship: field('relationship'),
      bloodGroup: field('blood'),
      phone: field('phone'),
      email: field('email'),
      highestEducation: field('education'),
      occupation: field('occupation'),
      areaOfExpertise: EXPERTISE_OCCUPATIONS.includes(field('occupation')) ? field('expertise') : '',
      livingOutsideKerala: livingOutside,
      outsideReason: livingOutside ? field('outsideReason') : '',
    };

    if (!isNonMember) {
      entry.membershipType = field('membership');
      entry.holdsSpssPosition = holdsPosition;
      entry.spssPositionName = holdsPosition ? field('spssPositionName') : '';
    }

    if (isNonMember) {
      entry.reasonForNoMembership = field('reason');
    }

    entries.push(entry);
  });

  return entries;
}

/* ================================================================== */
/*  Form Submission                                                    */
/* ================================================================== */

/** Binds the form submit event. */
function bindFormSubmit() {
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
    const photoURL = ENABLE_PHOTO_UPLOAD ? await uploadPhoto() : (existingPhotoURL || '');
    formData.personalDetails.photoURL = photoURL;

    if (editingId) {
      await updateMember(editingId, {
        personalDetails: formData.personalDetails,
        members: formData.members,
        nonMembers: formData.nonMembers,
      });
      showToast(t('msg.updateSuccess'), 'success');
      hideLoader();
      setTimeout(() => {
        window.location.href = `view?id=${editingId}`;
      }, TIMING.REDIRECT_DELAY);
    } else {
      const newId = await createMember(formData);
      hideLoader();
      if (isAdmin()) {
        showToast(MESSAGES.RECORD_CREATED, 'success');
        setTimeout(() => { window.location.href = ROUTES.MEMBER_MANAGEMENT; }, TIMING.REDIRECT_DELAY);
      } else {
        window.location.href = `success?id=${newId}`;
      }
    }
  } catch (err) {
    hideLoader();
    console.error('Save failed:', err);
    showToast(t('msg.saveFailed'), 'error');
  }
}

/* ================================================================== */
/*  Validation Error Display                                           */
/* ================================================================== */

/**
 * Map from validation error keys to form element IDs.
 * This ensures every validation key reliably finds its DOM element.
 */
const FIELD_ID_MAP = {
  ownerName: 'ownerName',
  ownerDOB: 'ownerDOB',
  ownerGender: 'ownerGender',
  houseName: 'houseName',
  pradeshikaSabha: 'pradeshikaSabha',
  ownerBloodGroup: 'ownerBloodGroup',
  ownerOccupation: 'ownerOccupation',
  ownerPhone: 'ownerPhone',
  ownerEmail: 'ownerEmail',
  ownerMembership: 'ownerMembership',
  ownerEducation: 'ownerEducation',
  address1: 'address1',
  address2: 'address2',
  place: 'place',
  pin: 'pin',
  rationCardType: 'rationCardType',
  spssPositionName: 'spssPositionName',
};

/**
 * Displays validation errors by adding 'is-invalid' class to form controls.
 * @param {Object<string, string>} errors
 */
function displayValidationErrors(errors) {
  Object.entries(errors).forEach(([field, message]) => {
    const elId = FIELD_ID_MAP[field] || field;
    const el = document.getElementById(elId)
      || document.querySelector(`[name="${field}"]`);

    if (el) {
      el.classList.add('is-invalid');
      const feedback = el.parentElement?.querySelector('.invalid-feedback');
      if (feedback) feedback.textContent = message;
    }
  });

  const firstInvalid = document.querySelector('.is-invalid');
  firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/** Clears all validation error states from the form. */
function clearValidationErrors() {
  document.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
}

/* ================================================================== */
/*  Populate Form (Edit Mode)                                          */
/* ================================================================== */

/**
 * Fills the form with existing data for editing.
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

  if (EXPERTISE_OCCUPATIONS.includes(pd.occupation)) {
    set('ownerExpertise', pd.areaOfExpertise);
    document.getElementById('ownerExpertiseGroup')?.classList.remove('d-none');
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
    existingPhotoURL = pd.photoURL;
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
