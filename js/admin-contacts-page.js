/**
 * @fileoverview Admin contact numbers configuration page.
 * Super Admin can set up to 3 phone numbers shown on the phone verification page.
 * @module admin-contacts-page
 */

import { getAdminContacts, saveAdminContacts } from './admin-contacts-service.js';
import { showToast, setButtonLoading } from './ui-service.js';

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

export async function initAdminContactsPage() {
  const form = document.getElementById('adminContactsForm');
  const saveBtn = document.getElementById('saveContactsBtn');

  if (!form || !saveBtn) return;

  // digits-only: strip non-digits on input
  document.addEventListener('input', (e) => {
    if (e.target.classList.contains('digits-only')) {
      e.target.value = normalizePhone(e.target.value);
    }
  });

  // Load existing numbers
  try {
    const numbers = await getAdminContacts();
    CONTACT_IDS.forEach((id, i) => {
      const input = document.getElementById(id);
      if (input) input.value = numbers[i] || '';
    });
    renderCurrentContacts(numbers);
  } catch (err) {
    console.error('Failed to load admin contacts', err);
    showToast('Failed to load contact numbers.', 'error');
    const el = document.getElementById('currentContactsList');
    if (el) el.textContent = 'Could not load. Please refresh the page.';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const values = CONTACT_IDS.map((id) => {
      const input = document.getElementById(id);
      return input ? normalizePhone(input.value) : '';
    });

    // All non-empty entries must be 10 digits
    const invalid = values.filter((v) => v.length > 0 && v.length !== 10);
    if (invalid.length > 0) {
      showToast('Each contact number must be exactly 10 digits.', 'error');
      return;
    }

    const numbers = values.filter(Boolean);

    setButtonLoading(saveBtn, true);
    try {
      await saveAdminContacts(numbers);
      showToast('Contact numbers saved successfully.', 'success');
      renderCurrentContacts(numbers);
    } catch (err) {
      console.error('Failed to save admin contacts', err);
      showToast('Failed to save. Please try again.', 'error');
    } finally {
      setButtonLoading(saveBtn, false);
    }
  });
}
