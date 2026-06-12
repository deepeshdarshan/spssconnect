/**
 * @fileoverview Bootstrap for the public landing route (`index.html`).
 * Wires i18n and the EN/ML toggle so the page stays free of inline scripts.
 * @module pages/landing-page
 */

import { initI18n, bindLanguageToggle } from '../services/i18n-service.js';

/**
 * Initializes persisted locale, applies `data-i18n` strings, and binds language controls.
 *
 * Side effects: reads/writes locale in `localStorage` (via {@link ../services/i18n-service.js initI18n}),
 * mutates DOM text for translated nodes, and attaches click listeners (via {@link ../services/i18n-service.js bindLanguageToggle}).
 *
 * @returns {void}
 */
function initLandingPage() {
  initI18n();
  bindLanguageToggle();
}

initLandingPage();
