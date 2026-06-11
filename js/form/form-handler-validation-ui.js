/**
 * @fileoverview Validation error highlighting for the registration form.
 * @module form/form-handler-validation-ui
 */

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
export function displayValidationErrors(errors) {
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
export function clearValidationErrors() {
  document.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
}
