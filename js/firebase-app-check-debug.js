/**
 * Classic (non-module) script — must run before any Firebase ESM import so App Check
 * uses the debug provider on local hosts when enforcement is enabled.
 *
 * @see js/services/firebase-config.js
 * @see https://firebase.google.com/docs/app-check/web/debug-provider
 */
(function enableFirebaseAppCheckDebugOnLocalHost() {
  if (typeof location === 'undefined' || !location.hostname) return;
  var h = location.hostname;
  var isLocal =
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h === '[::1]' ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h);
  if (!isLocal) return;
  if (typeof globalThis !== 'undefined') {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  if (typeof self !== 'undefined') {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
})();
