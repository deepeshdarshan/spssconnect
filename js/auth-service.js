/**
 * @fileoverview Firebase Authentication service — login, register, logout, role management.
 * Roles are read from the Firestore `users` collection and cached at bootstrap time.
 * @module auth-service
 */

import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, firebaseConfig } from './firebase-config.js';
import { ROLES } from './constants.js';

/** Guest role constant (unauthenticated user) */
export const ROLE_GUEST = 'guest';

/** Cached role — populated by fetchUserRole(), read by getUserRole() */
let _cachedRole = null;

/** Cached Pradeshika Sabha — populated alongside the role */
let _cachedSabha = null;

/**
 * Fetches the current user's role from Firestore and caches it.
 * Must be called once during bootstrap after auth state is resolved.
 * For unauthenticated users the cache is set to 'guest'.
 * @returns {Promise<string>} The resolved role.
 */
export async function fetchUserRole() {
  const user = auth.currentUser;
  if (!user) {
    _cachedRole = ROLE_GUEST;
    return _cachedRole;
  }

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      const data = snap.data();
      _cachedRole = data.role || ROLES.USER;
      _cachedSabha = data.pradeshikaSabha || null;
    } else {
      _cachedRole = ROLES.USER;
      _cachedSabha = null;
    }
  } catch {
    _cachedRole = ROLES.USER;
    _cachedSabha = null;
  }
  return _cachedRole;
}

/**
 * Clears the cached role. Call on logout so the next bootstrap
 * starts with a clean slate.
 */
export function clearRoleCache() {
  _cachedRole = null;
  _cachedSabha = null;
}

/**
 * Creates a new user account (super_admin only).
 * Uses a temporary secondary Firebase app so the calling super_admin's
 * session is not affected by createUserWithEmailAndPassword.
 * @param {string} email
 * @param {string} password
 * @param {string} role - One of ROLES.ADMIN or ROLES.USER.
 * @param {string} pradeshikaSabha - The Pradeshika Sabha this user belongs to.
 * @returns {Promise<string>} The UID of the newly created user.
 */
export async function adminCreateUser(email, password, role, pradeshikaSabha) {
  const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await setDoc(doc(db, 'users', credential.user.uid), {
      email: credential.user.email,
      role,
      pradeshikaSabha,
      createdAt: new Date().toISOString(),
    });
    await signOut(secondaryAuth);
    return credential.user.uid;
  } finally {
    await deleteApp(secondaryApp);
  }
}

/**
 * Signs in an existing user with email and password.
 * Ensures a Firestore user profile exists (creates one with default 'user' role
 * if missing). Never overwrites an existing role — roles are managed from the
 * Firebase console.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export async function loginUser(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const userDocRef = doc(db, 'users', credential.user.uid);
  const snap = await getDoc(userDocRef);
  if (!snap.exists()) {
    await setDoc(userDocRef, {
      email: credential.user.email,
      role: ROLES.USER,
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
 * Returns the cached role for the current user.
 * Returns 'guest' if the cache hasn't been populated yet or no user is logged in.
 * @returns {string} The role string ('super_admin', 'admin', 'user', or 'guest').
 */
export function getUserRole() {
  return _cachedRole || ROLE_GUEST;
}

/**
 * Returns the cached Pradeshika Sabha for the current user, or null.
 * @returns {string|null}
 */
export function getUserPradeshikaSabha() {
  return _cachedSabha;
}

/**
 * Checks if the current user has admin privileges (admin or super_admin).
 * @returns {boolean}
 */
export function isAdmin() {
  const role = getUserRole();
  return role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN;
}

/**
 * Checks if the current user is a super admin.
 * @returns {boolean}
 */
export function isSuperAdmin() {
  return getUserRole() === ROLES.SUPER_ADMIN;
}

/**
 * Subscribes to authentication state changes.
 * @param {function(import('firebase/auth').User|null): void} callback
 * @returns {import('firebase/auth').Unsubscribe}
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
