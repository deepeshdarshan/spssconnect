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

    ${blockSubSectionGroup('subsection.basicDetails', 'person', t('subsection.basicDetails'), `
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.name">${t('form.name')}</label>
        ${spssInputGroup('person', `<input type="text" class="form-control" name="member_name_${index}" value="${esc(d.name)}" required>
        <div class="invalid-feedback"></div>`, true)}
      </div>
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.dob">${t('form.dob')}</label>
        ${spssInputGroup('calendar-event', `<input type="date" class="form-control" name="member_dob_${index}" value="${esc(d.dob)}">`)}
      </div>
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.gender">${t('form.gender')}</label>
        ${spssInputGroup('gender-ambiguous', `<select class="form-select" name="member_gender_${index}">
          <option value="" data-i18n="form.selectOption">${t('form.selectOption')}</option>
          ${buildGenderOptions(d.gender)}
        </select>`)}
      </div>
    </div>`)}

    ${blockSubSectionGroup('subsection.relationshipDetails', 'people', t('subsection.relationshipDetails'), `
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.relationship">${t('form.relationship')}</label>
        ${spssInputGroup('people', `<select class="form-select" name="member_relationship_${index}">
          <option value="" data-i18n="form.selectOption">${t('form.selectOption')}</option>
          ${buildRelationshipOptions(d.relationship)}
        </select>`)}
      </div>
    </div>`)}

    ${blockSubSectionGroup('subsection.contactDetails', 'telephone', t('subsection.contactDetails'), `
    <div class="row g-3">
      <div class="col-md-6">
        <label class="form-label" data-i18n="form.phone">${t('form.phone')} <span class="text-danger">*</span></label>
        ${spssInputGroup('phone', `<input type="tel" class="form-control digits-only" name="member_phone_${index}" value="${esc(d.phone)}" inputmode="numeric" pattern="[0-9]*" maxlength="10" required>
        <div class="invalid-feedback"></div>`, true)}
        <small class="text-muted" data-i18n="form.phoneHintMember">${t('form.phoneHintMember')}</small>
      </div>
      <div class="col-md-6">
        <label class="form-label" data-i18n="form.email">${t('form.email')}</label>
        ${spssInputGroup('envelope', `<input type="email" class="form-control" name="member_email_${index}" value="${esc(d.email)}">
        <div class="invalid-feedback"></div>`, true)}
      </div>
    </div>`)}

    ${blockSubSectionGroup('subsection.personalDetails', 'clipboard2-pulse', t('subsection.personalDetails'), `
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.bloodGroup">${t('form.bloodGroup')}</label>
        ${spssInputGroup('droplet', `<select class="form-select" name="member_blood_${index}">
          <option value="">—</option>
          ${buildBloodGroupOptions(d.bloodGroup)}
        </select>`)}
      </div>
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.education">${t('form.education')}</label>
        ${spssInputGroup('mortarboard', `<select class="form-select" name="member_education_${index}">
          <option value="" data-i18n="form.selectOption">${t('form.selectOption')}</option>
          ${buildEducationOptions(d.highestEducation)}
        </select>`)}
      </div>
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.occupation">${t('form.occupation')}</label>
        ${spssInputGroup('briefcase', `<select class="form-select member-occupation-select" name="member_occupation_${index}">
          <option value="" data-i18n="form.selectOption">${t('form.selectOption')}</option>
          ${buildOccupationOptions(d.occupation, true)}
        </select>`)}
      </div>
      <div class="col-md-4 ${(d.occupation && String(d.occupation).trim()) ? '' : 'd-none'} member-expertise-group">
        <label class="form-label" data-i18n="form.areaOfExpertise">${t('form.areaOfExpertise')}</label>
        ${spssInputGroup('stars', `<input type="text" class="form-control" name="member_expertise_${index}" value="${esc(d.areaOfExpertise)}">`)}
      </div>
    </div>`)}

    ${blockSubSectionGroup('subsection.membershipInfo', 'card-checklist', t('subsection.membershipInfo'), `
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.membership">${t('form.membership')}</label>
        ${spssInputGroup('award', `<select class="form-select" name="member_membership_${index}">
          <option value="" data-i18n="form.selectOption">${t('form.selectOption')}</option>
          <option value="life_member" ${d.membershipType === 'life_member' ? 'selected' : ''} data-i18n="option.lifeMember">${t('option.lifeMember')}</option>
          <option value="ordinary_member" ${d.membershipType === 'ordinary_member' ? 'selected' : ''} data-i18n="option.ordinaryMember">${t('option.ordinaryMember')}</option>
        </select>`)}
      </div>
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.holdsSpssPositionMember">${t('form.holdsSpssPositionMember')}</label>
        ${spssInputGroup('person-badge', `<select class="form-select member-spss-toggle" name="member_holdsSpssPosition_${index}">
          ${buildYesNoOptions(d.holdsSpssPosition)}
        </select>`)}
      </div>
      <div class="col-md-4 ${d.holdsSpssPosition ? '' : 'd-none'} member-spss-name-group">
        <label class="form-label" data-i18n="form.spssPositionName">${t('form.spssPositionName')}</label>
        ${spssInputGroup('pin-angle', `<input type="text" class="form-control" name="member_spssPositionName_${index}" value="${esc(d.spssPositionName)}">`)}
      </div>
    </div>`)}

    ${blockSubSectionGroup('subsection.locationDetails', 'pin-map', t('subsection.locationDetails'), `
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.livingOutsideKeralaMember">${t('form.livingOutsideKeralaMember')}</label>
        ${spssInputGroup('globe', `<select class="form-select living-outside-toggle" name="member_livingOutside_${index}">
          <option value="no" ${(!d.livingOutsideKerala) ? 'selected' : ''} data-i18n="option.livingOutsideKeralaNo">${t('option.livingOutsideKeralaNo')}</option>
          <option value="yes" ${d.livingOutsideKerala ? 'selected' : ''} data-i18n="option.livingOutsideKeralaYes">${t('option.livingOutsideKeralaYes')}</option>
        </select>`)}
      </div>
      <div class="col-md-4 ${d.livingOutsideKerala ? '' : 'd-none'} living-outside-reason-group">
        <label class="form-label" data-i18n="form.outsideReason">${t('form.outsideReason')}</label>
        ${spssInputGroup('airplane', `<select class="form-select" name="member_outsideReason_${index}">
          <option value="" data-i18n="form.selectOption">${t('form.selectOption')}</option>
          <option value="job" ${d.outsideReason === 'job' ? 'selected' : ''} data-i18n="option.job">${t('option.job')}</option>
          <option value="study" ${d.outsideReason === 'study' ? 'selected' : ''} data-i18n="option.study">${t('option.study')}</option>
        </select>`)}
      </div>
    </div>`)}
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

    ${blockSubSectionGroup('subsection.basicDetails', 'person', t('subsection.basicDetails'), `
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.name">${t('form.name')}</label>
        ${spssInputGroup('person', `<input type="text" class="form-control" name="nonMember_name_${index}" value="${esc(d.name)}" required>
        <div class="invalid-feedback"></div>`, true)}
      </div>
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.dob">${t('form.dob')}</label>
        ${spssInputGroup('calendar-event', `<input type="date" class="form-control" name="nonMember_dob_${index}" value="${esc(d.dob)}">`)}
      </div>
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.gender">${t('form.gender')}</label>
        ${spssInputGroup('gender-ambiguous', `<select class="form-select" name="nonMember_gender_${index}">
          <option value="" data-i18n="form.selectOption">${t('form.selectOption')}</option>
          ${buildGenderOptions(d.gender)}
        </select>`)}
      </div>
    </div>`)}

    ${blockSubSectionGroup('subsection.relationshipDetails', 'people', t('subsection.relationshipDetails'), `
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.relationship">${t('form.relationship')}</label>
        ${spssInputGroup('people', `<select class="form-select" name="nonMember_relationship_${index}">
          <option value="" data-i18n="form.selectOption">${t('form.selectOption')}</option>
          ${buildRelationshipOptions(d.relationship)}
        </select>`)}
      </div>
    </div>`)}

    ${blockSubSectionGroup('subsection.contactDetails', 'telephone', t('subsection.contactDetails'), `
    <div class="row g-3">
      <div class="col-md-6">
        <label class="form-label" data-i18n="form.phone">${t('form.phone')} <span class="text-danger">*</span></label>
        ${spssInputGroup('phone', `<input type="tel" class="form-control digits-only" name="nonMember_phone_${index}" value="${esc(d.phone)}" inputmode="numeric" pattern="[0-9]*" maxlength="10" required>
        <div class="invalid-feedback"></div>`, true)}
        <small class="text-muted" data-i18n="form.phoneHintMember">${t('form.phoneHintMember')}</small>
      </div>
      <div class="col-md-6">
        <label class="form-label" data-i18n="form.email">${t('form.email')}</label>
        ${spssInputGroup('envelope', `<input type="email" class="form-control" name="nonMember_email_${index}" value="${esc(d.email)}">
        <div class="invalid-feedback"></div>`, true)}
      </div>
    </div>`)}

    ${blockSubSectionGroup('subsection.personalDetails', 'clipboard2-pulse', t('subsection.personalDetails'), `
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.bloodGroup">${t('form.bloodGroup')}</label>
        ${spssInputGroup('droplet', `<select class="form-select" name="nonMember_blood_${index}">
          <option value="">—</option>
          ${buildBloodGroupOptions(d.bloodGroup)}
        </select>`)}
      </div>
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.education">${t('form.education')}</label>
        ${spssInputGroup('mortarboard', `<select class="form-select" name="nonMember_education_${index}">
          <option value="" data-i18n="form.selectOption">${t('form.selectOption')}</option>
          ${buildEducationOptions(d.highestEducation)}
        </select>`)}
      </div>
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.occupation">${t('form.occupation')}</label>
        ${spssInputGroup('briefcase', `<select class="form-select member-occupation-select" name="nonMember_occupation_${index}">
          <option value="" data-i18n="form.selectOption">${t('form.selectOption')}</option>
          ${buildOccupationOptions(d.occupation, true)}
        </select>`)}
      </div>
      <div class="col-md-4 ${(d.occupation && String(d.occupation).trim()) ? '' : 'd-none'} member-expertise-group">
        <label class="form-label" data-i18n="form.areaOfExpertise">${t('form.areaOfExpertise')}</label>
        ${spssInputGroup('stars', `<input type="text" class="form-control" name="nonMember_expertise_${index}" value="${esc(d.areaOfExpertise)}">`)}
      </div>
    </div>`)}

    ${blockSubSectionGroup('subsection.membershipStatus', 'person-x', t('subsection.membershipStatus'), `
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.reasonNoMembership">${t('form.reasonNoMembership')}</label>
        ${spssInputGroup('question-circle', `<input type="text" class="form-control" name="nonMember_reason_${index}" value="${esc(d.reasonForNoMembership)}">`)}
      </div>
    </div>`)}

    ${blockSubSectionGroup('subsection.locationDetails', 'pin-map', t('subsection.locationDetails'), `
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label" data-i18n="form.livingOutsideKeralaMember">${t('form.livingOutsideKeralaMember')}</label>
        ${spssInputGroup('globe', `<select class="form-select living-outside-toggle" name="nonMember_livingOutside_${index}">
          <option value="no" ${(!d.livingOutsideKerala) ? 'selected' : ''} data-i18n="option.livingOutsideKeralaNo">${t('option.livingOutsideKeralaNo')}</option>
          <option value="yes" ${d.livingOutsideKerala ? 'selected' : ''} data-i18n="option.livingOutsideKeralaYes">${t('option.livingOutsideKeralaYes')}</option>
        </select>`)}
      </div>
      <div class="col-md-4 ${d.livingOutsideKerala ? '' : 'd-none'} living-outside-reason-group">
        <label class="form-label" data-i18n="form.outsideReason">${t('form.outsideReason')}</label>
        ${spssInputGroup('airplane', `<select class="form-select" name="nonMember_outsideReason_${index}">
          <option value="" data-i18n="form.selectOption">${t('form.selectOption')}</option>
          <option value="job" ${d.outsideReason === 'job' ? 'selected' : ''} data-i18n="option.job">${t('option.job')}</option>
          <option value="study" ${d.outsideReason === 'study' ? 'selected' : ''} data-i18n="option.study">${t('option.study')}</option>
        </select>`)}
      </div>
    </div>`)}
  `;
}

/* ================================================================== */
/*  HTML Option Builders                                               */
/* ================================================================== */

/** @param {boolean} isYes */
function buildYesNoOptions(isYes) {
  return [
    ['no', 'option.no', !isYes],
    ['yes', 'option.yes', Boolean(isYes)],
  ]
    .map(([val, key, selected]) =>
      `<option value="${val}" ${selected ? 'selected' : ''} data-i18n="${key}">${t(key)}</option>`
    )
    .join('');
}

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
    ['son_in_law', 'option.sonInLaw'], ['father_in_law', 'option.fatherInLaw'],
    ['mother_in_law', 'option.motherInLaw'], ['grandchild', 'option.grandchild'],
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

/**
 * Groups a subsection title and its fields in one readable card inside a member/non-member block.
 *
 * @param {string} i18nKey - `data-i18n` key for the title label.
 * @param {string} icon - Bootstrap Icons suffix (without `bi-`).
 * @param {string} label - Translated title text.
 * @param {string} bodyHtml - Field markup (typically a `.row.g-3`).
 * @returns {string}
 */
function blockSubSectionGroup(i18nKey, icon, label, bodyHtml) {
  return `
    <div class="block-sub-section-group">
      <div class="block-sub-section">
        <span class="block-sub-section-icon" aria-hidden="true"><i class="bi bi-${icon}"></i></span>
        <span class="block-sub-section-label" data-i18n="${i18nKey}">${label}</span>
      </div>
      ${bodyHtml}
    </div>`;
}

/**
 * Wraps a form control in a saffron-themed Bootstrap input-group (matches `/create` and `/phone-check`).
 *
 * @param {string} icon - Bootstrap Icons suffix without the `bi-` prefix.
 * @param {string} controlHtml - Inner input/select markup (may include `.invalid-feedback`).
 * @param {boolean} [hasValidation=false] - Adds `has-validation` when true.
 * @returns {string}
 */
function spssInputGroup(icon, controlHtml, hasValidation = false) {
  const validationClass = hasValidation ? ' has-validation' : '';
  return `<div class="input-group spss-input-group${validationClass}">
    <span class="input-group-text" aria-hidden="true"><i class="bi bi-${icon}"></i></span>
    ${controlHtml}
  </div>`;
}
