/**
 * @fileoverview Internationalization (i18n) service for dynamic locale switching.
 * Used on landing, success, create, phone-check, view, and other pages that call {@link initI18n} with defaults.
 * @module i18n-service
 */

import { DEFAULT_LOCALE, LOCALES } from '../constants/constants.js';
import en from '../locales/en.js';
import ml from '../locales/ml.js';

/**
 * `localStorage` key for the user’s last chosen UI locale (`en` | `ml`).
 * Read on {@link initI18n}; written by {@link setLocale}.
 */
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
 *
 * @param {function(): void} fn Handler invoked with no arguments after {@link setLocale}.
 * @returns {void}
 */
export function addLocaleChangeListener(fn) {
  if (typeof fn === 'function') localeChangeListeners.add(fn);
}

/**
 * Removes a previously registered locale-change listener.
 *
 * @param {function(): void} fn Same function reference passed to {@link addLocaleChangeListener}.
 * @returns {void}
 */
export function removeLocaleChangeListener(fn) {
  localeChangeListeners.delete(fn);
}

/**
 * @typedef {object} InitI18nOptions
 * @property {boolean} [ignoreStoredLocale] When true, sets active locale to {@link DEFAULT_LOCALE}
 *   without reading `localStorage` and without writing it. Use for routes that must stay English
 *   regardless of the user’s saved preference (rare; most public pages read the stored locale).
 */

/**
 * Initializes the active locale and applies `data-i18n` strings across the document.
 *
 * By default reads `spss_locale` from `localStorage` (see `STORAGE_KEY`). When
 * `ignoreStoredLocale` is set, the in-memory locale is English only and the stored value is
 * left unchanged so other pages keep the user’s choice after navigation.
 *
 * Side effects: updates module `currentLocale`, mutates the DOM via {@link applyTranslations} and
 * {@link updateToggleUI}. Does not write `localStorage` when `ignoreStoredLocale` is true.
 *
 * @param {InitI18nOptions} [options={}]
 * @returns {void}
 */
export function initI18n(options = {}) {
  if (options.ignoreStoredLocale) {
    currentLocale = DEFAULT_LOCALE;
  } else {
    const saved = localStorage.getItem(STORAGE_KEY);
    currentLocale = saved && localeMap[saved] ? saved : DEFAULT_LOCALE;
  }
  applyTranslations();
  updateToggleUI();
}

/**
 * Sets the active locale, persists it under the module `STORAGE_KEY`, and refreshes the DOM.
 *
 * Side effects: updates `currentLocale`, `localStorage`, DOM via {@link applyTranslations} and
 * {@link updateToggleUI}, then runs all {@link addLocaleChangeListener} callbacks.
 *
 * @param {string} lang Locale code (`en` or `ml` per {@link LOCALES}); no-op if unknown.
 * @returns {void}
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
 * Walks the DOM and updates every `[data-i18n]` and `[data-i18n-placeholder]` element.
 * Supports `textContent` for most nodes, `placeholder` for inputs/textareas, and preserves a
 * leading `<i>` child when present on the element.
 *
 * @returns {void}
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
 *
 * @returns {void}
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
