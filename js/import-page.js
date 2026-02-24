/**
 * @fileoverview Import page logic — binds the import button and redirects on success.
 * @module import-page
 */

import { handleImportWithFile } from './json-import-service.js';
import { ROUTES, TIMING } from './constants.js';

/**
 * Initializes the import page by binding the import button.
 */
export function initImportPage() {
  document.getElementById('importJsonBtn')?.addEventListener('click', async () => {
    const count = await handleImportWithFile();
    if (count > 0) {
      setTimeout(() => {
        window.location.href = ROUTES.MEMBER_MANAGEMENT;
      }, TIMING.IMPORT_REDIRECT_DELAY);
    }
  });
}
