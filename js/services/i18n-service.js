/**
 * @fileoverview Internationalization (i18n) service for dynamic locale switching.
 * Used on landing, success, phone-check, create, and other pages that call `initI18n`.
 * @module i18n-service
 */

import { DEFAULT_LOCALE, LOCALES } from '../constants/constants.js';
import en from '../locales/en.js';
import ml from '../locales/ml.js';

const STORAGE_KEY = 'spss_locale';

/** @type {Object<string, Object<string, string>>} */
const localeMap = {
  [LOCALES.EN]: en,
  [LOCALES.ML]: ml,
};

/** @type {string} */
let currentLocale = DEFAULT_LOCALE;

/** @type {Set<function(): void>} */
const localeChangeListeners = new Set();

/**
 * Registers a callback to run after the locale is changed (e.g. to re-render dynamic content).
 * @param {function(): void} fn
 */
export function addLocaleChangeListener(fn) {
  if (typeof fn === 'function') localeChangeListeners.add(fn);
}

/**
 * Removes a previously registered locale-change listener.
 * @param {function(): void} fn
 */
export function removeLocaleChangeListener(fn) {
  localeChangeListeners.delete(fn);
}

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
  localeChangeListeners.forEach((fn) => { fn(); });
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
 * Syncs the active state on every `.lang-btn[data-lang]` in the document (supports multiple toggles, e.g. `/create`).
 */
function updateToggleUI() {
  document.querySelectorAll(`.lang-btn[data-lang="${LOCALES.EN}"]`).forEach((btn) => {
    btn.classList.toggle('active', currentLocale === LOCALES.EN);
  });
  document.querySelectorAll(`.lang-btn[data-lang="${LOCALES.ML}"]`).forEach((btn) => {
    btn.classList.toggle('active', currentLocale === LOCALES.ML);
  });
}

/**
 * Binds click handlers to every `.lang-btn[data-lang]` in the document.
 * Safe to call once per full page load; skips buttons already bound (guards against duplicate listeners).
 *
 * Side effects: adds a `click` listener per unbound language button; {@link setLocale} updates DOM and `localStorage`.
 *
 * @returns {void}
 */
export function bindLanguageToggle() {
  document.querySelectorAll('.lang-btn[data-lang]').forEach((btn) => {
    if (btn.dataset.i18nLangBound === '1') return;
    btn.dataset.i18nLangBound = '1';
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-lang');
      if (lang && localeMap[lang]) setLocale(lang);
    });
  });
}
