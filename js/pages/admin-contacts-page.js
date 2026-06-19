/**
 * @fileoverview Admin contact numbers configuration page.
 * Super Admin can set up to 3 phone numbers shown on the phone verification page.
 * @module admin-contacts-page
 */

import { getAdminContacts, saveAdminContacts } from '../services/admin-contacts-service.js';
import { MESSAGES } from '../constants/constants.js';
import { showToast, setButtonLoading, setLoaderMessage } from '../ui/ui-service.js';
import * as Logger from '../utils/logger.js';

const CONTACT_IDS = ['contact1', 'contact2', 'contact3'];

/**
 * Normalizes phone to digits only.
 * @param {string} value
 * @returns {string}
 */
function normalizePhone(value) {
  return (value || '').replace(/\D/g, '');
}

/**
 * Validates that a string is a 10-digit phone (or empty).
 * @param {string} value
 * @returns {boolean}
 */
function isValidPhoneOrEmpty(value) {
  const digits = normalizePhone(value);
  return digits.length === 0 || digits.length === 10;
}

function renderCurrentContacts(numbers) {
  const el = document.getElementById('currentContactsList');
  if (!el) return;

  if (!numbers || numbers.length === 0) {
    el.textContent = 'No contact numbers configured yet. Add them above and click Save.';
    return;
  }

  el.innerHTML = numbers
    .map((n, i) => `<div class="mb-1">${i + 1}. ${n}</div>`)
    .join('');
}

/**
 * Normalizes digit-only fields on input (delegated on `document`, same as previous inline handler).
 *
 * @returns {void}
 */
function bindAdminContactsDigitsOnlyOnInput() {
  document.addEventListener('input', (e) => {
    if (e.target.classList.contains('digits-only')) {
      e.target.value = normalizePhone(e.target.value);
    }
  });
}

/**
 * Reads the three contact inputs and returns normalized digit strings (may be empty).
 *
 * @returns {string[]}
 */
function readContactFieldValuesNormalized() {
  return CONTACT_IDS.map((id) => {
    const input = document.getElementById(id);
    return input ? normalizePhone(input.value) : '';
  });
}

/**
 * Validates that every non-empty value is exactly 10 digits.
 *
 * @param {string[]} values
 * @returns {string|null} User-facing error message, or `null` when valid.
 */
function validateContactValuesForSave(values) {
  const invalid = values.filter((v) => v.length > 0 && v.length !== 10);
  if (invalid.length > 0) {
    return 'Each contact number must be exactly 10 digits.';
  }
  return null;
}

/**
 * Writes stored numbers into the `#contact1`…`#contact3` inputs.
 *
 * @param {string[]|null|undefined} numbers - Index-aligned with {@link CONTACT_IDS}.
 * @returns {void}
 */
function populateContactInputsFromNumbers(numbers) {
  CONTACT_IDS.forEach((id, i) => {
    const input = document.getElementById(id);
    if (input) input.value = (numbers && numbers[i]) || '';
  });
}

/**
 * Fetches saved contacts from Firestore and fills the form + summary list.
 *
 * @returns {Promise<void>}
 */
async function loadExistingAdminContactsIntoForm() {
  try {
    const numbers = await getAdminContacts();
    populateContactInputsFromNumbers(numbers);
    renderCurrentContacts(numbers);
  } catch (err) {
    Logger.error('Failed to load admin contacts', err);
    showToast('Failed to load contact numbers.', 'error');
    const el = document.getElementById('currentContactsList');
    if (el) el.textContent = 'Could not load. Please refresh the page.';
  }
}

/**
 * Validates, persists non-empty numbers, and refreshes the summary list.
 *
 * @param {HTMLButtonElement} saveBtn
 * @returns {Promise<void>}
 */
async function handleAdminContactsFormSubmit(saveBtn) {
  const values = readContactFieldValuesNormalized();
  const validationError = validateContactValuesForSave(values);
  if (validationError) {
    showToast(validationError, 'error');
    return;
  }

  const numbers = values.filter(Boolean);

  setButtonLoading(saveBtn, true);
  try {
    await saveAdminContacts(numbers);
    showToast('Contact numbers saved successfully.', 'success');
    renderCurrentContacts(numbers);
  } catch (err) {
    Logger.error('Failed to save admin contacts', err);
    showToast('Failed to save. Please try again.', 'error');
  } finally {
    setButtonLoading(saveBtn, false);
  }
}

/**
 * Binds the save form submit handler.
 *
 * @param {HTMLFormElement} form
 * @param {HTMLButtonElement} saveBtn
 * @returns {void}
 */
function bindAdminContactsFormSubmit(form, saveBtn) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void handleAdminContactsFormSubmit(saveBtn);
  });
}

/**
 * Loads saved numbers into the form, renders the summary list, and binds save (super admin).
 *
 * @returns {Promise<void>}
 */
export async function initAdminContactsPage() {
  const form = document.getElementById('adminContactsForm');
  const saveBtn = document.getElementById('saveContactsBtn');

  if (!form || !saveBtn) return;

  setLoaderMessage(MESSAGES.LOADING_ADMIN_CONTACTS);
  bindAdminContactsDigitsOnlyOnInput();
  await loadExistingAdminContactsIntoForm();
  bindAdminContactsFormSubmit(form, saveBtn);
}
