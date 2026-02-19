/**
 * @fileoverview Firebase Authentication service — login, register, logout, role management.
 * @module auth-service
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase-config.js';
import { ROLES, ADMIN_EMAILS } from './constants.js';

/**
 * Registers a new user with email and password.
 * Also creates a Firestore user profile with the appropriate role
 * (admin if email is in ADMIN_EMAILS, otherwise user).
 * The Firestore document is used for server-side rule enforcement (e.g. delete).
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export async function registerUser(email, password) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const role = ADMIN_EMAILS.includes(email.toLowerCase()) ? ROLES.ADMIN : ROLES.USER;
  await setDoc(doc(db, 'users', credential.user.uid), {
    email: credential.user.email,
    role,
    createdAt: new Date().toISOString(),
  });
  return credential;
}

/**
 * Signs in an existing user with email and password.
 * Also ensures a Firestore user profile exists (handles accounts created
 * before the users collection was set up).
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export async function loginUser(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const userDocRef = doc(db, 'users', credential.user.uid);
  const snap = await getDoc(userDocRef);
  if (!snap.exists()) {
    const role = ADMIN_EMAILS.includes(email.toLowerCase()) ? ROLES.ADMIN : ROLES.USER;
    await setDoc(userDocRef, {
      email: credential.user.email,
      role,
      createdAt: new Date().toISOString(),
    });
  }
  return credential;
}

/**
 * Signs out the current user.
 * @returns {Promise<void>}
 */
export async function logoutUser() {
  return signOut(auth);
}

/**
 * Returns the currently authenticated user or null.
 * @returns {import('firebase/auth').User|null}
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Returns the role for the current user based on the ADMIN_EMAILS list.
 * @returns {string} The role string ('admin' or 'user').
 */
export function getUserRole() {
  const user = auth.currentUser;
  if (user && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return ROLES.ADMIN;
  }
  return ROLES.USER;
}

/**
 * Checks if the current user has admin privileges.
 * @returns {boolean}
 */
export function isAdmin() {
  return getUserRole() === ROLES.ADMIN;
}

/**
 * Subscribes to authentication state changes.
 * @param {function(import('firebase/auth').User|null): void} callback
 * @returns {import('firebase/auth').Unsubscribe}
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
