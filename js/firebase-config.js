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

// 🔹 Required for localhost development
self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;

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
