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
import { ROLES, ADMIN_EMAILS, SUPER_ADMIN_EMAILS } from './constants.js';

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
  await setDoc(doc(db, 'users', credential.user.uid), {
    email: credential.user.email,
    role: resolveRole(email),
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
  const expectedRole = resolveRole(email);
  if (!snap.exists()) {
    await setDoc(userDocRef, {
      email: credential.user.email,
      role: expectedRole,
      createdAt: new Date().toISOString(),
    });
  } else if (snap.data().role !== expectedRole) {
    await setDoc(userDocRef, { role: expectedRole }, { merge: true });
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
 * Resolves the role for a given email address.
 * @param {string} email
 * @returns {string}
 */
function resolveRole(email) {
  const lower = (email || '').toLowerCase();
  if (SUPER_ADMIN_EMAILS.includes(lower)) return ROLES.SUPER_ADMIN;
  if (ADMIN_EMAILS.includes(lower)) return ROLES.ADMIN;
  return ROLES.USER;
}

/**
 * Returns the role for the current user based on email lists.
 * @returns {string} The role string ('super_admin', 'admin', or 'user').
 */
export function getUserRole() {
  const user = auth.currentUser;
  if (!user) return ROLES.USER;
  return resolveRole(user.email);
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
