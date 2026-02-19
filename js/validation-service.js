/**
 * @fileoverview Form validation service — individual field validators and full form validation.
 * Error keys use the actual DOM element IDs so displayValidationErrors can always find them.
 * @module validation-service
 */

import { t } from './i18n-service.js';

/**
 * @param {string} value
 * @returns {{valid: boolean, message: string}}
 */
export function validateRequired(value) {
  const valid = typeof value === 'string' && value.trim().length > 0;
  return { valid, message: valid ? '' : t('validation.required') };
}

/**
 * @param {string} value
 * @returns {{valid: boolean, message: string}}
 */
export function validateEmail(value) {
  if (!value || !value.trim()) return { valid: true, message: '' };
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  return { valid, message: valid ? '' : t('validation.emailInvalid') };
}

/**
 * @param {string} value
 * @returns {{valid: boolean, message: string}}
 */
export function validatePIN(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return { valid: false, message: t('validation.pinInvalid') };
  const valid = /^[0-9]{6}$/.test(trimmed);
  return { valid, message: valid ? '' : t('validation.pinInvalid') };
}

/**
 * @param {string} value
 * @returns {{valid: boolean, message: string}}
 */
export function validatePhone(value) {
  if (!value || !value.trim()) return { valid: true, message: '' };
  const valid = /^[0-9]{10}$/.test(value.trim());
  return { valid, message: valid ? '' : t('validation.phoneInvalid') };
}

/**
 * @param {string} value
 * @returns {{valid: boolean, message: string}}
 */
export function validateDOB(value) {
  if (!value) return { valid: false, message: t('validation.dobRequired') };
  const date = new Date(value);
  if (isNaN(date.getTime())) return { valid: false, message: t('validation.dobRequired') };
  if (date > new Date()) return { valid: false, message: t('validation.dobFuture') };
  return { valid: true, message: '' };
}

/**
 * Validates the house owner personal details.
 * Error keys use the element IDs (ownerName, ownerDOB, etc.).
 * @param {Object} data
 * @returns {{isValid: boolean, errors: Object<string, string>}}
 */
export function validatePersonalDetails(data) {
  const errors = {};

  addError(errors, 'ownerName', validateRequired(data.name), t('validation.nameRequired'));
  addError(errors, 'ownerDOB', validateDOB(data.dob));
  addError(errors, 'ownerGender', validateRequired(data.gender), t('validation.genderRequired'));
  addError(errors, 'houseName', validateRequired(data.houseName), t('validation.houseNameRequired'));
  addError(errors, 'pradeshikaSabha', validateRequired(data.pradeshikaSabha), t('validation.sabhaRequired'));
  addError(errors, 'ownerBloodGroup', validateRequired(data.bloodGroup), t('validation.bloodGroupRequired'));
  addError(errors, 'ownerOccupation', validateRequired(data.occupation), t('validation.occupationRequired'));
  addError(errors, 'ownerMembership', validateRequired(data.membershipType), t('validation.membershipRequired'));
  addError(errors, 'ownerEducation', validateRequired(data.highestEducation), t('validation.educationRequired'));
  if (!data.phone || !data.phone.trim()) {
    errors.ownerPhone = t('validation.phoneRequired');
  } else {
    addError(errors, 'ownerPhone', validatePhone(data.phone));
  }
  addError(errors, 'ownerEmail', validateEmail(data.email));

  return { isValid: Object.keys(errors).length === 0, errors };
}

/**
 * Validates address fields.
 * @param {Object} address
 * @returns {{isValid: boolean, errors: Object<string, string>}}
 */
export function validateAddress(address) {
  const errors = {};

  addError(errors, 'address1', validateRequired(address.address1), t('validation.address1Required'));
  addError(errors, 'place', validateRequired(address.place), t('validation.placeRequired'));
  addError(errors, 'pin', validatePIN(address.pin));

  return { isValid: Object.keys(errors).length === 0, errors };
}

/**
 * Validates a member or non-member entry.
 * @param {Object} entry
 * @param {number} index
 * @param {string} prefix - 'member' or 'nonMember'
 * @returns {{isValid: boolean, errors: Object<string, string>}}
 */
export function validateMemberEntry(entry, index, prefix = 'member') {
  const errors = {};

  addError(errors, `${prefix}_name_${index}`, validateRequired(entry.name), t('validation.nameRequired'));
  addError(errors, `${prefix}_phone_${index}`, validatePhone(entry.phone));
  addError(errors, `${prefix}_email_${index}`, validateEmail(entry.email));

  return { isValid: Object.keys(errors).length === 0, errors };
}

/**
 * Validates the full form data (personal + address + members + nonMembers).
 * @param {Object} formData
 * @returns {{isValid: boolean, errors: Object<string, string>}}
 */
export function validateForm(formData) {
  let allErrors = {};

  const personal = validatePersonalDetails(formData.personalDetails);
  Object.assign(allErrors, personal.errors);

  const addr = validateAddress(formData.personalDetails.address);
  Object.assign(allErrors, addr.errors);

  (formData.members || []).forEach((m, i) => {
    const result = validateMemberEntry(m, i + 1, 'member');
    Object.assign(allErrors, result.errors);
  });

  (formData.nonMembers || []).forEach((m, i) => {
    const result = validateMemberEntry(m, i + 1, 'nonMember');
    Object.assign(allErrors, result.errors);
  });

  return { isValid: Object.keys(allErrors).length === 0, errors: allErrors };
}

/**
 * @param {Object} errors
 * @param {string} field
 * @param {{valid: boolean, message: string}} result
 * @param {string} [fallbackMessage]
 */
function addError(errors, field, result, fallbackMessage) {
  if (!result.valid) {
    errors[field] = result.message || fallbackMessage || t('validation.required');
  }
}
