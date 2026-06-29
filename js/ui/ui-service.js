/**
 * @fileoverview Shared UI helper functions — toasts, loaders, confirm dialogs, visibility, formatting.
 * Loader ref-counting supports nested action-time overlays; page bootstrap uses `showLoader` in
 * `app-init`, `setLoaderMessage` in page modules, and `hideLoaderAfterPaint` at bootstrap end.
 * @module ui-service
 */

import { t } from '../services/i18n-service.js';
import {
  MEMBER_OCCUPATION_OPTIONS,
  EDUCATION_OPTIONS,
  GENDER_OPTIONS,
  MEMBERSHIP_OPTIONS,
  RATION_CARD_OPTIONS,
  BLOOD_GROUP_OPTIONS,
  RELATIONSHIP_OPTIONS,
} from '../constants/constants.js';

/** Nested `showLoader` / `hideLoader` pairs (e.g. overview then statistics) keep the overlay visible until the last hide. */
let loaderDepth = 0;

/**
 * Sets the popup message text when the overlay element exists.
 *
 * @param {HTMLElement|null} overlay
 * @param {string} [message]
 * @returns {void}
 */
function setOverlayMessageText(overlay, message) {
  if (!overlay || !message) return;
  const p = overlay.querySelector('.loading-popup-message') || overlay.querySelector('p');
  if (p) p.textContent = message;
}

/**
 * Shows the loading overlay (centered popup when `.loading-popup` is present).
 * @param {string} [message] - Optional message to display below the spinner.
 */
export function showLoader(message) {
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;
  loaderDepth += 1;
  setOverlayMessageText(overlay, message);
  overlay.classList.remove('hidden');
}

/**
 * Hides the loading overlay when the outermost matching `showLoader` is cleared.
 */
export function hideLoader() {
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;
  if (loaderDepth > 0) loaderDepth -= 1;
  if (loaderDepth === 0) overlay.classList.add('hidden');
}

/**
 * Clears the loader ref-count and hides the overlay (e.g. after bfcache restore).
 *
 * @returns {void}
 */
export function resetLoader() {
  loaderDepth = 0;
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.add('hidden');
}

/**
 * Updates the loading overlay message without changing the loader ref-count.
 * Use during page bootstrap after `app-init` has called `showLoader()` so page modules
 * can show page-specific copy without owning dismiss timing.
 *
 * @param {string} message Text shown below the spinner.
 * @returns {void}
 */
export function setLoaderMessage(message) {
  const overlay = document.getElementById('loadingOverlay');
  setOverlayMessageText(overlay, message);
}

/**
 * Hides the loading overlay after the browser has painted the latest DOM updates.
 * Called at the end of `app-init` bootstrap so rendered content is visible before dismiss.
 *
 * @returns {void}
 */
export function hideLoaderAfterPaint() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      hideLoader();
    });
  });
}

/**
 * Displays a toast notification.
 * @param {string} message - The message to show.
 * @param {'success'|'error'|'info'|'warning'} [type='info'] - Toast type.
 * @param {number} [duration=4000] - Auto-dismiss duration in ms.
 */
export function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-spss ${type}`;
  toast.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button class="toast-close" aria-label="Close">&times;</button>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
  container.appendChild(toast);

  setTimeout(() => removeToast(toast), duration);
}

/**
 * Removes a toast element with a fade-out.
 * @param {HTMLElement} toast
 */
function removeToast(toast) {
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(100%)';
  toast.style.transition = 'all 0.3s';
  setTimeout(() => toast.remove(), 300);
}

/**
 * Shows a confirmation dialog and returns a promise resolving to the user's choice.
 * @param {string} message - The confirmation message.
 * @returns {Promise<boolean>} True if confirmed, false if cancelled.
 */
export function showConfirmDialog(message) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'confirm-backdrop';
    backdrop.innerHTML = `
      <div class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmDialogMessage">
        <p class="confirm-dialog__message" id="confirmDialogMessage">${escapeHtml(message)}</p>
        <div class="confirm-dialog__actions">
          <button type="button" class="btn btn-sm confirm-dialog__btn confirm-dialog__btn--cancel" id="confirmCancel">Cancel</button>
          <button type="button" class="btn btn-sm confirm-dialog__btn confirm-dialog__btn--confirm" id="confirmOk">Confirm</button>
        </div>
      </div>
    `;

    const cleanup = (result) => {
      backdrop.remove();
      resolve(result);
    };

    backdrop.querySelector('#confirmCancel').addEventListener('click', () => cleanup(false));
    backdrop.querySelector('#confirmOk').addEventListener('click', () => cleanup(true));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) cleanup(false);
    });

    document.body.appendChild(backdrop);
  });
}

/**
 * Shows or hides elements matching a selector.
 * @param {string} selector - CSS selector.
 * @param {boolean} visible - True to show, false to hide.
 */
export function setElementVisibility(selector, visible) {
  document.querySelectorAll(selector).forEach((el) => {
    el.style.display = visible ? '' : 'none';
  });
}

/**
 * Formats a Firestore Timestamp or ISO string into a readable date string.
 * @param {Object|string|null} timestamp - Firestore Timestamp, Date, or ISO string.
 * @returns {string} Formatted date string.
 */
export function formatDate(timestamp) {
  if (!timestamp) return '—';
  let date;
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    return '—';
  }
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats a date-of-birth string from YYYY-MM-DD to dd-mm-yyyy.
 * @param {string} dob - Date string in YYYY-MM-DD format.
 * @returns {string} Formatted string in dd-mm-yyyy, or '—' if invalid/missing.
 */
export function formatDOB(dob) {
  if (!dob) return '—';
  const parts = dob.split('-');
  if (parts.length !== 3) return dob;
  const [y, m, d] = parts;
  return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
}

/**
 * Whole-year age from a date-of-birth string (`YYYY-MM-DD`), same rules as the household directory table.
 *
 * @param {string} [dob]
 * @returns {string} Age in years, or '—' if DOB is missing/invalid or age would be negative.
 */
export function calcAgeYears(dob) {
  if (!dob) return '—';
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return '—';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? String(age) : '—';
}

/**
 * Formats a stored enum / option key using the active i18n locale (e.g. `life_member` → translated label).
 * Use for read-only record details and anywhere Firestore stores canonical keys mapped in constants.
 *
 * @param {string|null|undefined} value - Stored key (e.g. `bachelors`, `male`).
 * @returns {string} Translated label, literal for blood group, or {@link formatLabel} fallback.
 */
export function formatEnumLabel(value) {
  if (value == null || value === '') return '—';
  const k = String(value).trim();
  const maps = [
    MEMBER_OCCUPATION_OPTIONS,
    EDUCATION_OPTIONS,
    GENDER_OPTIONS,
    MEMBERSHIP_OPTIONS,
    RATION_CARD_OPTIONS,
    BLOOD_GROUP_OPTIONS,
    RELATIONSHIP_OPTIONS,
  ];
  for (const map of maps) {
    if (map && Object.prototype.hasOwnProperty.call(map, k)) {
      const labelKey = map[k];
      if (typeof labelKey === 'string' && labelKey.includes('.')) return t(labelKey);
      return labelKey;
    }
  }
  if (k === 'job') return t('option.job');
  if (k === 'study') return t('option.study');
  if (k === 'others') return t('option.outsideOthers');
  return formatLabel(k);
}

/**
 * Formats a display-friendly label from an internal key.
 * @param {string} key - The internal key (e.g. 'life_member').
 * @returns {string} Human-readable label (e.g. 'Life Member').
 */
export function formatLabel(key) {
  if (!key) return '—';
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Escapes HTML entities to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/**
 * Sets the loading state on a button (disables + shows spinner).
 *
 * @param {HTMLElement} button - The button element.
 * @param {boolean} loading - True to set loading, false to reset.
 * @param {string} [loadingText] - When set, keeps the label visible and swaps to this text while loading.
 */
export function setButtonLoading(button, loading, loadingText) {
  if (!button) return;
  const textEl = button.querySelector('.btn-text');
  const spinnerEl = button.querySelector('.spinner-border');
  button.disabled = loading;

  if (textEl) {
    if (!textEl.dataset.defaultLabel) {
      textEl.dataset.defaultLabel = textEl.textContent.trim();
    }
    if (loading && loadingText) {
      textEl.textContent = loadingText;
      textEl.classList.remove('d-none');
    } else if (!loading) {
      textEl.textContent = textEl.dataset.defaultLabel;
      textEl.classList.remove('d-none');
    } else {
      textEl.classList.add('d-none');
    }
  }

  if (spinnerEl) spinnerEl.classList.toggle('d-none', !loading);
}
