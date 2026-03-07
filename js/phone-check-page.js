/**
 * @fileoverview Phone verification flow before creating a new record.
 * @module phone-check-page
 */

import { ROUTES } from './constants.js';
import { showToast, setButtonLoading } from './ui-service.js';
import { getMemberIdByPhone } from './member-id-service.js';
import { getAdminContacts } from './admin-contacts-service.js';
import { initI18n, bindLanguageToggle, t, addLocaleChangeListener } from './i18n-service.js';

/**
 * Normalizes a phone string to just digits.
 * @param {string} value
 * @returns {string}
 */
function normalizePhone(value) {
  return (value || '').replace(/\\D/g, '');
}

/**
 * Validates a phone number (10 digits).
 * @param {string} value
 * @returns {boolean}
 */
function isValidPhone(value) {
  const digits = normalizePhone(value);
  return digits.length === 10;
}

/** Cached admin numbers for re-render on locale change */
let lastAdminNumbers = null;

function renderAdminContacts(numbers) {
  lastAdminNumbers = numbers;
  const container = document.getElementById('adminContactNumbers');
  if (!container) return;

  if (!numbers || numbers.length === 0) {
    container.textContent = t('phoneCheck.noContacts');
    return;
  }

  container.innerHTML = numbers
    .map((n) => `<span><a href="https://wa.me/${n}" target="_blank">${n}</a></span>`)
    .join(', ');
}

/** Last memberId shown (for re-render on locale change) */
let lastShownMemberId = null;

function renderExistingRecord(memberId, phone) {
  lastShownMemberId = memberId;
  const resultEl = document.getElementById('phoneCheckResult');
  if (!resultEl) return;

  resultEl.classList.remove('d-none');
  resultEl.innerHTML = `
    <div class="alert alert-warning" role="alert">
      <p class="mb-2">${t('phoneCheck.recordExists')}</p>
      <p class="mb-2">${t('phoneCheck.recordExistsContact')}</p>
    </div>
  `;
}

function reapplyDynamicTranslations() {
  if (lastShownMemberId) renderExistingRecord(lastShownMemberId);
  if (lastAdminNumbers !== null) renderAdminContacts(lastAdminNumbers);
}

export async function initPhoneCheckPage() {
  initI18n();
  bindLanguageToggle();
  addLocaleChangeListener(reapplyDynamicTranslations);

  const form = document.getElementById('phoneCheckForm');
  const input = document.getElementById('phoneInput');
  const submitBtn = document.getElementById('phoneCheckSubmit');
  const resultEl = document.getElementById('phoneCheckResult');

  if (!form || !input || !submitBtn) return;

  // digits-only behavior for consistency with create page
  input.addEventListener('input', () => {
    const digits = normalizePhone(input.value);
    input.value = digits;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = normalizePhone(input.value);

    if (!isValidPhone(phone)) {
      input.classList.add('is-invalid');
      return;
    }
    input.classList.remove('is-invalid');

    if (resultEl) {
      resultEl.classList.add('d-none');
      resultEl.innerHTML = '';
      lastShownMemberId = null;
    }

    setButtonLoading(submitBtn, true);
    try {
      const memberId = await getMemberIdByPhone(phone);
      if (memberId) {
        renderExistingRecord(memberId, phone);
      } else {
        // No record yet — go to create page with prefilled phone
        const url = `${ROUTES.CREATE}?phone=${encodeURIComponent(phone)}`;
        window.location.href = url;
      }
    } catch (err) {
      console.error('Phone check failed', err);
      showToast(t('phoneCheck.checkError'), 'error');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  // Load admin contacts (non-blocking)
  try {
    const numbers = await getAdminContacts();
    renderAdminContacts(numbers);
  } catch (err) {
    console.error('Failed to load admin contacts', err);
  }
}

