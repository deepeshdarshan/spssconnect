/**
 * @fileoverview Internationalization (i18n) service for dynamic locale switching.
 * Only active on the data entry (create) page.
 * @module i18n-service
 */

import { DEFAULT_LOCALE, LOCALES } from './constants.js';
import en from './locales/en.js';
import ml from './locales/ml.js';

const STORAGE_KEY = 'spss_locale';

/** @type {Object<string, Object<string, string>>} */
const localeMap = {
  [LOCALES.EN]: en,
  [LOCALES.ML]: ml,
};

/** @type {string} */
let currentLocale = DEFAULT_LOCALE;

/**
 * Initializes the i18n service, loading the saved locale from localStorage.
 */
export function initI18n() {
  const saved = localStorage.getItem(STORAGE_KEY);
  currentLocale = saved && localeMap[saved] ? saved : DEFAULT_LOCALE;
  applyTranslations();
  updateToggleUI();
}

/**
 * Sets the active locale and re-applies all translations to the DOM.
 * @param {string} lang - Locale code ('en' or 'ml').
 */
export function setLocale(lang) {
  if (!localeMap[lang]) return;
  currentLocale = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  applyTranslations();
  updateToggleUI();
}

/**
 * Returns the translated string for a given key in the current locale.
 * Falls back to the English locale, then to the key itself.
 * @param {string} key - Dot-notation translation key.
 * @returns {string}
 */
export function t(key) {
  return localeMap[currentLocale]?.[key]
    || localeMap[LOCALES.EN]?.[key]
    || key;
}

/**
 * Returns the current locale code.
 * @returns {string}
 */
export function getCurrentLocale() {
  return currentLocale;
}

/**
 * Walks the DOM and updates all elements with a `data-i18n` attribute.
 * Supports textContent for most elements and placeholder for inputs.
 */
export function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const translated = t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = translated;
    } else if (el.tagName === 'OPTION') {
      el.textContent = translated;
    } else {
      const icon = el.querySelector(':scope > i');
      if (icon) {
        Array.from(el.childNodes).forEach((n) => {
          if (n !== icon) n.remove();
        });
        icon.after(document.createTextNode(translated));
      } else {
        el.textContent = translated;
      }
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
}

/**
 * Updates the language toggle buttons to reflect the active locale.
 */
function updateToggleUI() {
  const enBtn = document.getElementById('langEN');
  const mlBtn = document.getElementById('langML');
  if (enBtn) enBtn.classList.toggle('active', currentLocale === LOCALES.EN);
  if (mlBtn) mlBtn.classList.toggle('active', currentLocale === LOCALES.ML);
}

/**
 * Binds click events to the language toggle buttons.
 */
export function bindLanguageToggle() {
  const enBtn = document.getElementById('langEN');
  const mlBtn = document.getElementById('langML');
  if (enBtn) enBtn.addEventListener('click', () => setLocale(LOCALES.EN));
  if (mlBtn) mlBtn.addEventListener('click', () => setLocale(LOCALES.ML));
}
