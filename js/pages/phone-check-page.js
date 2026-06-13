/**
 * @fileoverview Phone number lookup (`/phone-check`): verify a mobile number before registration.
 * Members (guests / non-admin users) are sent to the data entry form when the number is new.
 * Admins only see whether a record exists—no redirect to the form.
 * Uses the same stored EN/ML preference as other public pages (`initI18n`); language toggle only for guests.
 * @module phone-check-page
 */

import { ROUTES } from '../constants/constants.js';
import { isAdmin } from '../services/auth-service.js';
import { showToast, setButtonLoading, setLoaderMessage } from '../ui/ui-service.js';
import { getMemberIdByPhone } from '../services/member-id-service.js';
import { getAdminContacts } from '../services/admin-contacts-service.js';
import {
  initI18n,
  bindLanguageToggle,
  addLocaleChangeListener,
  t,
} from '../services/i18n-service.js';
import * as Logger from '../utils/logger.js';

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

/** Last loaded guest help-line numbers (for the admin-contact block only). */
let lastAdminNumbers = null;

/**
 * Renders WhatsApp links for admin help numbers (non-admin visitors only).
 *
 * @param {string[]|null|undefined} numbers Normalized digit-only phone strings, or empty.
 * @returns {void}
 */
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

/** True after the guest help-line fetch has finished (used to re-apply locale to that block). */
let guestAdminContactsLoaded = false;

/**
 * Re-renders phone-check fragments built with {@link t} so they match after EN/ML switches.
 *
 * @returns {void}
 */
function refreshPhoneCheckDynamicCopy() {
  if (isAdmin()) {
    if (lastAdminResultMode === 'admin-found' && lastAdminMemberId) {
      renderAdminMemberFound(lastAdminMemberId);
    } else if (lastAdminResultMode === 'admin-notfound') {
      renderAdminMemberNotFound();
    }
    return;
  }
  if (guestAdminContactsLoaded) {
    renderAdminContacts(lastAdminNumbers);
  }
  if (lastShownMemberId) {
    renderExistingRecordForGuest(lastShownMemberId);
  }
}

/**
 * Renders the guest / member view when a record already exists (link-based guidance).
 *
 * @param {string} memberId Firestore member document id.
 * @returns {void}
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
 * Renders admin lookup result when a member id exists for the phone.
 *
 * @param {string} memberId Firestore document id for the member.
 * @returns {void}
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
 * Renders the admin-only “no member found” state after a lookup.
 *
 * @returns {void}
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

/**
 * Boots i18n, phone form validation, admin vs guest flows, and optional admin contact list (guests).
 * Respects the stored EN/ML preference. Anonymous guests get the topbar language toggle; signed-in users
 * do not (see `body.is-authenticated` rules in `03-navbar-phone-lang.css`).
 * For guests, shows the global loading overlay until help-line numbers are loaded from the admin-contacts service.
 *
 * Side effects: registers DOM listeners, may set `document.body` classes for the admin shell,
 * may redirect to `/create`, and uses toast / global loader helpers.
 *
 * @returns {Promise<void>}
 */
export async function initPhoneCheckPage() {
  if (isAdmin()) {
    document.body.classList.add('phone-check-admin-shell');
  }

  initI18n();
  if (!document.body.classList.contains('is-authenticated')) {
    bindLanguageToggle();
    addLocaleChangeListener(refreshPhoneCheckDynamicCopy);
  }

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
      Logger.error('Phone number lookup failed', err);
      showToast(t('phoneCheck.checkError'), 'error');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  if (!isAdmin()) {
    setLoaderMessage(t('phoneCheck.loadingContacts'));
    try {
      const numbers = await getAdminContacts();
      renderAdminContacts(numbers);
    } catch (err) {
      Logger.error('Failed to load admin contacts', err);
    } finally {
      guestAdminContactsLoaded = true;
    }
  }
}
