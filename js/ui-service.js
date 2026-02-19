/**
 * @fileoverview Shared UI helper functions — toasts, loaders, confirm dialogs, visibility, formatting.
 * @module ui-service
 */

/**
 * Shows the full-page loading overlay.
 * @param {string} [message] - Optional message to display below the spinner.
 */
export function showLoader(message) {
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;
  if (message) {
    const p = overlay.querySelector('p');
    if (p) p.textContent = message;
  }
  overlay.classList.remove('hidden');
}

/**
 * Hides the full-page loading overlay.
 */
export function hideLoader() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.add('hidden');
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
      <div class="confirm-dialog">
        <p>${escapeHtml(message)}</p>
        <div class="btn-group">
          <button class="btn btn-secondary btn-sm" id="confirmCancel">Cancel</button>
          <button class="btn btn-danger btn-sm" id="confirmOk">Confirm</button>
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
 * @param {HTMLElement} button - The button element.
 * @param {boolean} loading - True to set loading, false to reset.
 */
export function setButtonLoading(button, loading) {
  if (!button) return;
  const textEl = button.querySelector('.btn-text');
  const spinnerEl = button.querySelector('.spinner-border');
  button.disabled = loading;
  if (textEl) textEl.classList.toggle('d-none', loading);
  if (spinnerEl) spinnerEl.classList.toggle('d-none', !loading);
}
