/**
 * @fileoverview Phone verification flow before creating a new record.
 * Members (guests / non-admin users) are sent to the data entry form when the number is new.
 * Admins only see whether a record exists—no redirect to the form.
 * @module phone-check-page
 */

import { ROUTES } from './constants.js';
import { isAdmin } from './auth-service.js';
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
  return (value || '').replace(/\D/g, '');
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

/** Cached admin numbers for re-render on locale change (guests only) */
let lastAdminNumbers = null;

function renderAdminContacts(numbers) {
  if (isAdmin()) return;
  lastAdminNumbers = numbers;
  const container = document.getElementById('adminContactNumbers');
  if (!container) return;

  if (!numbers || numbers.length === 0) {
    container.textContent = t('phoneCheck.noContacts');
    return;
  }

  container.innerHTML = numbers
    .map((n) => `<span><a href="https://wa.me/${n}" target="_blank" rel="noopener">${n}</a></span>`)
    .join(', ');
}

/** Last memberId for guest "record exists" card */
let lastShownMemberId = null;

/** @type {null | 'admin-found' | 'admin-notfound'} */
let lastAdminResultMode = null;
/** @type {string | null} */
let lastAdminMemberId = null;

/**
 * Renders the guest / member view when a record already exists (link-based guidance).
 * @param {string} memberId
 */
function renderExistingRecordForGuest(memberId) {
  lastShownMemberId = memberId;
  lastAdminResultMode = null;
  lastAdminMemberId = null;
  const resultEl = document.getElementById('phoneCheckResult');
  if (!resultEl) return;

  resultEl.classList.remove('d-none');
  resultEl.innerHTML = `
    <div class="alert alert-warning" role="alert">
      <p class="mb-2">${t('phoneCheck.recordExists')}</p>
      <p class="mb-0">${t('phoneCheck.recordExistsContact')}</p>
    </div>
  `;
}

/**
 * @param {string} memberId
 */
function renderAdminMemberFound(memberId) {
  lastAdminResultMode = 'admin-found';
  lastAdminMemberId = memberId;
  lastShownMemberId = null;
  const resultEl = document.getElementById('phoneCheckResult');
  if (!resultEl) return;

  const viewUrl = `view?id=${encodeURIComponent(memberId)}`;
  const editUrl = `view?id=${encodeURIComponent(memberId)}&edit=1`;

  resultEl.classList.remove('d-none');
  resultEl.innerHTML = `
    <div class="alert alert-info mb-0" role="status">
      <p class="mb-3"><i class="bi bi-check-circle-fill me-1" aria-hidden="true"></i>${t('phoneCheck.adminFound')}</p>
      <div class="d-flex flex-wrap gap-2">
        <a class="btn btn-sm btn-outline-primary" href="${viewUrl}">${t('phoneCheck.adminViewRecord')}</a>
        <a class="btn btn-sm btn-primary" href="${editUrl}">${t('phoneCheck.adminEditRecord')}</a>
      </div>
    </div>
  `;
}

/**
 * Renders "no record" for admin (no redirect to create).
 */
function renderAdminMemberNotFound() {
  lastAdminResultMode = 'admin-notfound';
  lastAdminMemberId = null;
  lastShownMemberId = null;
  const resultEl = document.getElementById('phoneCheckResult');
  if (!resultEl) return;

  resultEl.classList.remove('d-none');
  resultEl.innerHTML = `
    <div class="alert alert-success mb-0" role="status">
      <p class="mb-0"><i class="bi bi-info-circle me-1" aria-hidden="true"></i>${t('phoneCheck.adminNotFound')}</p>
    </div>
  `;
}

function reapplyDynamicTranslations() {
  if (isAdmin() && lastAdminResultMode === 'admin-found' && lastAdminMemberId) {
    renderAdminMemberFound(lastAdminMemberId);
  } else if (isAdmin() && lastAdminResultMode === 'admin-notfound') {
    renderAdminMemberNotFound();
  } else if (!isAdmin() && lastShownMemberId) {
    renderExistingRecordForGuest(lastShownMemberId);
  }
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
      lastAdminResultMode = null;
      lastAdminMemberId = null;
    }

    setButtonLoading(submitBtn, true);
    try {
      const memberId = await getMemberIdByPhone(phone);

      if (isAdmin()) {
        if (memberId) {
          renderAdminMemberFound(memberId);
        } else {
          renderAdminMemberNotFound();
        }
        return;
      }

      if (memberId) {
        renderExistingRecordForGuest(memberId);
      } else {
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

  if (!isAdmin()) {
    try {
      const numbers = await getAdminContacts();
      renderAdminContacts(numbers);
    } catch (err) {
      console.error('Failed to load admin contacts', err);
    }
  }
}
