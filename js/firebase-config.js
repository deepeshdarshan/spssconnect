/**
 * @fileoverview Firebase initialization and service exports.
 * Replace the placeholder config with your actual Firebase project credentials.
 * @module firebase-config
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

/**
 * App Check: Netlify (HTTPS) uses reCAPTCHA v3. For local dev, Firebase requires the
 * debug path when enforcement is on — set the flag *before* initializeApp / App Check
 * (https://firebase.google.com/docs/app-check/web/debug-provider).
 * Then: DevTools → Console, copy the printed token → Firebase → App Check →
 * your web app → Manage debug tokens.
 */
function isLocalDevHost() {
  if (typeof location === 'undefined' || !location.hostname) return false;
  const h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]') {
    return true;
  }
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h);
}

if (isLocalDevHost()) {
  if (typeof globalThis !== 'undefined') {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  if (typeof self !== 'undefined') {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
}

/**
 * Firebase project configuration.
 * Replace these placeholder values with your Firebase project settings
 * from the Firebase Console -> Project Settings -> General -> Your Apps.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyC3NEOUHefj8wV5NK_8CqetJsrQhivcoYU",
  authDomain: "spssekm.firebaseapp.com",
  projectId: "spssekm",
  storageBucket: "spssekm.firebasestorage.app",
  messagingSenderId: "439974265453",
  appId: "1:439974265453:web:b692016935d0963c283564",
  measurementId: "G-FZF0SELRQG"
};


/** @type {import('firebase/app').FirebaseApp} */
const app = initializeApp(firebaseConfig);

// Enable App Check
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider("6Ld-soUsAAAAAFrDfmBwRncyNdOi6k08wZmJL6s1"),
  isTokenAutoRefreshEnabled: true
});

/** Firebase Authentication instance */
export const auth = getAuth(app);

/** Cloud Firestore instance */
export const db = getFirestore(app);

/** Firebase Storage instance */
export const storage = getStorage(app);

export default app;
