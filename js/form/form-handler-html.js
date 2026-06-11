/**
 * @fileoverview HTML templates and option lists for the member registration form.
 * @module form/form-handler-html
 */

import { t } from '../services/i18n-service.js';

/**
 * Builds the inner HTML for a member block.
 * Includes: name, DOB, gender, relationship (in Relationship Details), membership, blood group, phone, email, education, occupation.
 * @param {number} index
 * @param {Object} [data]
 * @returns {string}
 */
export function buildMemberBlockHTML(index, data) {
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
        <label class="form-label" data-i18n="form.gender">${t('form.gender')}</label>
        <select class="form-select" name="member_gender_${index}">
          <option value="" data-i18n="form.selectOption">${t('form.selectOption')}</option>
          ${buildGenderOptions(d.gender)}
        </select>
      </div>
    </div>

    <div class="block-sub-section" data-i18n="subsection.relationshipDetails"><i class="bi bi-people me-1"></i>${t('subsection.relationshipDetails')}</div>
    <div class="row g-3">
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
      <div class="col-md-4 ${(d.occupation && String(d.occupation).trim()) ? '' : 'd-none'} member-expertise-group">
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
export function buildNonMemberBlockHTML(index, data) {
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
        <label class="form-label" data-i18n="form.gender">${t('form.gender')}</label>
        <select class="form-select" name="nonMember_gender_${index}">
          <option value="" data-i18n="form.selectOption">${t('form.selectOption')}</option>
          ${buildGenderOptions(d.gender)}
        </select>
      </div>
    </div>

    <div class="block-sub-section" data-i18n="subsection.relationshipDetails"><i class="bi bi-people me-1"></i>${t('subsection.relationshipDetails')}</div>
    <div class="row g-3">
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
      <div class="col-md-4 ${(d.occupation && String(d.occupation).trim()) ? '' : 'd-none'} member-expertise-group">
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
function buildGenderOptions(selected) {
  const opts = [
    ['male', 'option.male'], ['female', 'option.female'], ['other', 'option.other'],
  ];
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
