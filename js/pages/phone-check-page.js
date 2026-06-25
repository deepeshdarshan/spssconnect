/**
 * @fileoverview Phone number lookup (`/phone-check`): verify a mobile number before registration.
 * Members (guests / non-admin users) are sent to the data entry form when the number is new.
 * Admins only see whether a record exists—no redirect to the form.
 * **i18n:** Signed-in users always get English (`initI18n({ ignoreStoredLocale: true })`, same as view/create).
 * Anonymous visitors use stored EN/ML plus the language toggle and locale listener for dynamic copy.
 * @module phone-check-page
 */

import { ROUTES, VIEW_PAGE_FROM_PARAM, VIEW_REFERRER } from '../constants/constants.js';
import { auth } from '../services/firebase-config.js';
import { isAdmin } from '../services/auth-service.js';
import { showToast, setButtonLoading, setLoaderMessage, escapeHtml, resetLoader, showLoader, hideLoader } from '../ui/ui-service.js';
import { getMemberIdByPhone } from '../services/member-id-service.js';
import { getAdminContacts } from '../services/admin-contacts-service.js';
import { normalizePhoneDigits, whatsappHref } from '../services/member-person-search.js';
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
 * Formats a 10-digit Indian mobile for compact display in the help row.
 *
 * @param {string} digits
 * @returns {string}
 */
function formatAdminContactDisplay(digits) {
  return normalizePhoneDigits(digits);
}

/**
 * Renders WhatsApp contact pills for admin help numbers (non-admin visitors only).
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
    container.innerHTML = `<p class="phone-check-help__empty mb-0" role="status">${escapeHtml(t('phoneCheck.noContacts'))}</p>`;
    return;
  }

  container.innerHTML = numbers
    .map((n) => {
      const display = formatAdminContactDisplay(n);
      const wa = whatsappHref(n);
      if (!wa) {
        return `<span class="phone-check-help__pill phone-check-help__pill--static" role="listitem"><i class="bi bi-telephone" aria-hidden="true"></i><span>${escapeHtml(display)}</span></span>`;
      }
      return `<a href="${escapeHtml(wa)}" class="phone-check-help__pill" target="_blank" rel="noopener noreferrer" role="listitem" aria-label="${escapeHtml(t('phoneCheck.contactWhatsApp').replace('{number}', display))}"><i class="bi bi-whatsapp" aria-hidden="true"></i><span>${escapeHtml(display)}</span></a>`;
    })
    .join('');
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
 * Adds layout class when the signed-in user is an admin (narrower phone-check shell).
 *
 * @returns {void}
 */
function applyPhoneCheckAdminShellClass() {
  if (isAdmin()) {
    document.body.classList.add('phone-check-admin-shell');
  }
}

/**
 * Initializes locale: English-only for signed-in users; guests get stored locale, EN/ML toggle, and re-render hook.
 *
 * @returns {void}
 */
function initPhoneCheckInternationalization() {
  if (auth.currentUser) {
    initI18n({ ignoreStoredLocale: true });
    return;
  }
  initI18n();
  bindLanguageToggle();
  addLocaleChangeListener(refreshPhoneCheckDynamicCopy);
}

/**
 * Clears prior lookup UI and in-memory result tracking before a new submit.
 *
 * @param {HTMLElement|null} resultEl
 * @returns {void}
 */
function resetPhoneCheckLookupState(resultEl) {
  lastShownMemberId = null;
  lastAdminResultMode = null;
  lastAdminMemberId = null;
  if (!resultEl) return;
  resultEl.classList.add('d-none');
  resultEl.innerHTML = '';
}

/**
 * Keeps the phone field digits-only as the user types.
 *
 * @param {HTMLInputElement} input
 * @returns {void}
 */
function bindPhoneInputDigitsOnly(input) {
  input.addEventListener('input', () => {
    input.value = normalizePhone(input.value);
  });
}

/**
 * Builds the guest redirect URL to the create form with phone prefill and list referrer.
 *
 * @param {string} phone - Normalized 10-digit string.
 * @returns {string}
 */
function buildGuestCreateUrlWithPhone(phone) {
  return `${ROUTES.CREATE}?phone=${encodeURIComponent(phone)}&${VIEW_PAGE_FROM_PARAM}=${VIEW_REFERRER.MEMBER_LIST}`;
}

/**
 * Shows the appropriate result for admin vs guest after a successful Firestore lookup.
 *
 * @param {string} phone - Normalized 10-digit string (used for guest redirect when no id).
 * @param {string|null|undefined} memberId - Member document id when found.
 * @returns {void}
 */
function applyPhoneLookupOutcome(phone, memberId) {
  if (isAdmin()) {
    if (memberId) renderAdminMemberFound(memberId);
    else renderAdminMemberNotFound();
    return;
  }
  if (memberId) {
    renderExistingRecordForGuest(memberId);
    return;
  }
  window.location.href = buildGuestCreateUrlWithPhone(phone);
}

/**
 * Validates input, calls the member-id lookup, and applies admin or guest UI / redirect.
 *
 * @param {HTMLInputElement} input
 * @param {HTMLButtonElement} submitBtn
 * @param {HTMLElement|null} resultEl
 * @returns {Promise<void>}
 */
async function runPhoneCheckSubmitFlow(input, submitBtn, resultEl) {
  const phone = normalizePhone(input.value);

  if (!isValidPhone(phone)) {
    input.classList.add('is-invalid');
    return;
  }
  input.classList.remove('is-invalid');

  resetPhoneCheckLookupState(resultEl);

  setButtonLoading(submitBtn, true);
  try {
    const memberId = await getMemberIdByPhone(phone);
    applyPhoneLookupOutcome(phone, memberId);
  } catch (err) {
    Logger.error('Phone number lookup failed', err);
    showToast(t('phoneCheck.checkError'), 'error');
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

/**
 * Wires the phone check form submit handler.
 *
 * @param {HTMLFormElement} form
 * @param {HTMLInputElement} input
 * @param {HTMLButtonElement} submitBtn
 * @param {HTMLElement|null} resultEl
 * @returns {void}
 */
function bindPhoneCheckFormSubmit(form, input, submitBtn, resultEl) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void runPhoneCheckSubmitFlow(input, submitBtn, resultEl);
  });
}

/**
 * Loads admin helpline numbers for the guest contact block (non-admin visitors only).
 *
 * @returns {Promise<void>}
 */
async function loadAndRenderGuestAdminContacts() {
  if (isAdmin()) return;

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

/**
 * Boots i18n, phone form validation, admin vs guest flows, and optional admin contact list (guests).
 * Signed-in users see English regardless of `spss_locale`. Anonymous visitors use the stored locale and
 * the topbar language toggle (see `body.is-authenticated` rules in `03-navbar-phone-lang.css`).
 * For guests, shows the global loading overlay until help-line numbers are loaded from the admin-contacts service.
 *
 * Side effects: registers DOM listeners, may set `document.body` classes for the admin shell,
 * may redirect to `/create`, and uses toast / global loader helpers.
 *
 * @returns {Promise<void>}
 */
export async function initPhoneCheckPage() {
  applyPhoneCheckAdminShellClass();
  initPhoneCheckInternationalization();

  const form = document.getElementById('phoneCheckForm');
  const input = document.getElementById('phoneInput');
  const submitBtn = document.getElementById('phoneCheckSubmit');
  const resultEl = document.getElementById('phoneCheckResult');

  if (!form || !input || !submitBtn) return;

  bindPhoneInputDigitsOnly(input);
  bindPhoneCheckFormSubmit(form, input, submitBtn, resultEl);

  await loadAndRenderGuestAdminContacts();
}

/**
 * Restores guest help-line contacts and loader state after browser back/forward (bfcache).
 * Called from the session navigation guard once auth re-validation completes.
 *
 * @returns {Promise<void>}
 */
export async function restorePhoneCheckAfterBfcache() {
  resetLoader();
  applyPhoneCheckAdminShellClass();

  if (isAdmin()) {
    refreshPhoneCheckDynamicCopy();
    return;
  }

  const container = document.getElementById('adminContactNumbers');
  if (!container) return;

  guestAdminContactsLoaded = false;
  lastAdminNumbers = null;

  showLoader(t('phoneCheck.loadingContacts'));
  try {
    const numbers = await getAdminContacts();
    renderAdminContacts(numbers);
  } catch (err) {
    Logger.error('Failed to load admin contacts after bfcache restore', err);
    renderAdminContacts([]);
  } finally {
    guestAdminContactsLoaded = true;
    hideLoader();
  }

  refreshPhoneCheckDynamicCopy();
}
