/**
 * @fileoverview Admin contact numbers configuration page.
 * Super Admin can set up to 3 phone numbers shown on the phone verification page.
 * @module admin-contacts-page
 */

import { getAdminContacts, saveAdminContacts } from '../services/admin-contacts-service.js';
import { whatsappHref } from '../services/member-person-search.js';
import { MESSAGES } from '../constants/constants.js';
import { showToast, setButtonLoading, setLoaderMessage, escapeHtml } from '../ui/ui-service.js';
import { telHref } from '../ui/member-result-card-ui.js';
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

/**
 * Formats a 10-digit phone for display (e.g. `98765 43210`).
 *
 * @param {string} digits
 * @returns {string}
 */
function formatContactDisplay(digits) {
  const d = normalizePhone(digits);
  if (d.length === 10) return `${d.slice(0, 5)} ${d.slice(5)}`;
  return d;
}

/**
 * @param {string} message
 * @returns {string}
 */
function buildAdminContactsStatusHtml(message) {
  return `<p class="admin-contacts-list__status text-muted small mb-0">${escapeHtml(message)}</p>`;
}

/**
 * @returns {string}
 */
function buildAdminContactsEmptyHtml() {
  return `
    <div class="admin-contacts-list__empty" role="status">
      <i class="bi bi-telephone-x admin-contacts-list__empty-icon" aria-hidden="true"></i>
      <p class="admin-contacts-list__empty-title mb-1">No contact numbers yet</p>
      <p class="admin-contacts-list__empty-hint small text-muted mb-0">Add up to three numbers in the form and click Save.</p>
    </div>
  `;
}

/**
 * @param {string} number
 * @param {number} index - Zero-based slot index.
 * @returns {string}
 */
function buildAdminContactItemHtml(number, index) {
  const display = formatContactDisplay(number);
  const tel = telHref(number);
  const wa = whatsappHref(number);
  const slotLabel = `Number ${index + 1}`;

  const numberLink = tel
    ? `<a href="${escapeHtml(tel)}" class="admin-contacts-item__number">${escapeHtml(display)}</a>`
    : `<span class="admin-contacts-item__number">${escapeHtml(display)}</span>`;

  const callBtn = tel
    ? `<a href="${escapeHtml(tel)}" class="btn btn-sm admin-contacts-item__action admin-contacts-item__action--call" aria-label="Call ${escapeHtml(display)}"><i class="bi bi-telephone" aria-hidden="true"></i><span>Call</span></a>`
    : '';

  const waBtn = wa
    ? `<a href="${escapeHtml(wa)}" class="btn btn-sm admin-contacts-item__action admin-contacts-item__action--whatsapp" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp ${escapeHtml(display)}"><i class="bi bi-whatsapp" aria-hidden="true"></i><span>WhatsApp</span></a>`
    : '';

  return `
    <article class="admin-contacts-item" role="listitem" aria-label="${escapeHtml(slotLabel)}">
      <div class="admin-contacts-item__main">
        <span class="admin-contacts-item__badge" aria-hidden="true">${index + 1}</span>
        ${numberLink}
      </div>
      <div class="admin-contacts-item__actions">
        ${callBtn}
        ${waBtn}
      </div>
    </article>
  `;
}

function renderCurrentContacts(numbers) {
  const el = document.getElementById('currentContactsList');
  if (!el) return;

  if (!numbers || numbers.length === 0) {
    el.innerHTML = buildAdminContactsEmptyHtml();
    return;
  }

  el.innerHTML = numbers.map((n, i) => buildAdminContactItemHtml(n, i)).join('');
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
    if (el) el.innerHTML = buildAdminContactsStatusHtml('Could not load. Please refresh the page.');
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
 * Initializes Bootstrap tooltips on form field info buttons.
 *
 * @returns {void}
 */
function initFormFieldInfoTooltips() {
  if (typeof bootstrap === 'undefined' || !bootstrap.Tooltip) return;
  document.querySelectorAll('.form-field-info-btn[data-bs-toggle="tooltip"]').forEach((el) => {
    new bootstrap.Tooltip(el);
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
  initFormFieldInfoTooltips();
  await loadExistingAdminContactsIntoForm();
  bindAdminContactsFormSubmit(form, saveBtn);
}
