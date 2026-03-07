/**
 * @fileoverview User management page logic — create users (super_admin only).
 * @module user-management
 */

import { adminCreateUser, getCurrentUser } from './auth-service.js';
import { showToast, setButtonLoading, escapeHtml, formatDate, showConfirmDialog } from './ui-service.js';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from './firebase-config.js';
import { deleteDocument } from './firestore-service.js';
import { PRADESHIKA_SABHA_OPTIONS, MESSAGES, AUTH_ERRORS, COLLECTIONS } from './constants.js';

/**
 * Initializes the user management page — binds form and loads user list.
 */
export function initUserManagement() {
  populateSabhaDropdown();
  bindCreateForm();
  bindDeleteUser();
  loadUserList();
}

/**
 * Populates the Pradeshika Sabha dropdown from constants.
 */
function populateSabhaDropdown() {
  const select = document.getElementById('newUserSabha');
  if (!select) return;
  Object.keys(PRADESHIKA_SABHA_OPTIONS).forEach((key) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key;
    select.appendChild(opt);
  });
}

/**
 * Binds the create-user form submission.
 */
function bindCreateForm() {
  const form = document.getElementById('createUserForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('newUserEmail').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const role = document.getElementById('newUserRole').value;
    const pradeshikaSabha = document.getElementById('newUserSabha').value;
    const btn = document.getElementById('createUserBtn');

    if (!email || !password || !role || !pradeshikaSabha) {
      showToast(MESSAGES.FILL_ALL_FIELDS, 'error');
      return;
    }

    setButtonLoading(btn, true);
    try {
      await adminCreateUser(email, password, role, pradeshikaSabha);
      showToast(`User created: ${email} (${role} — ${pradeshikaSabha})`, 'success');
      form.reset();
      loadUserList();
    } catch (err) {
      const msg = friendlyCreateError(err.code) || err.message;
      showToast(msg, 'error');
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

/**
 * Loads the list of registered users from the Firestore users collection.
 */
async function loadUserList() {
  const tbody = document.getElementById('userTableBody');
  if (!tbody) return;

  try {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);

    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">${MESSAGES.NO_USERS}</td></tr>`;
      return;
    }

    const currentUid = getCurrentUser()?.uid || null;
    tbody.innerHTML = snap.docs.map((d, i) => {
      const u = d.data();
      const uid = d.id;
      const isSelf = currentUid && uid === currentUid;
      const deleteDisabled = isSelf ? ' disabled title="' + MESSAGES.CANNOT_DELETE_SELF + '"' : '';
      const deleteTitle = isSelf ? MESSAGES.CANNOT_DELETE_SELF : 'Remove user';
      return `<tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(u.email || '—')}</td>
        <td><span class="badge ${roleBadgeClass(u.role)}">${escapeHtml(u.role || 'user')}</span></td>
        <td>${escapeHtml(u.pradeshikaSabha || '—')}</td>
        <!-- <td class="small text-muted">${u.createdAt ? formatDate(u.createdAt) : '—'}</td> -->
        <td class="text-end">
          <button type="button" class="btn btn-outline-danger btn-sm" data-delete-user data-uid="${escapeHtml(uid)}"${deleteDisabled} title="${escapeHtml(deleteTitle)}" aria-label="Delete user">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.error('Failed to load users:', err);
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-3">${MESSAGES.USERS_LOAD_FAIL}</td></tr>`;
  }
}

/**
 * Returns a Bootstrap badge class based on role.
 * @param {string} role
 * @returns {string}
 */
function roleBadgeClass(role) {
  switch (role) {
    case 'super_admin': return 'bg-danger';
    case 'admin': return 'bg-warning text-dark';
    default: return 'bg-secondary';
  }
}

/**
 * Binds delete-user button clicks (event delegation on tbody).
 */
function bindDeleteUser() {
  const tbody = document.getElementById('userTableBody');
  if (!tbody) return;

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-delete-user]');
    if (!btn || btn.disabled) return;

    const uid = btn.getAttribute('data-uid');
    if (!uid) return;

    const currentUser = getCurrentUser();
    if (currentUser && currentUser.uid === uid) {
      showToast(MESSAGES.CANNOT_DELETE_SELF, 'error');
      return;
    }

    const confirmed = await showConfirmDialog(MESSAGES.CONFIRM_DELETE_USER);
    if (!confirmed) return;

    try {
      await deleteDocument(COLLECTIONS.USERS, uid);
      showToast(MESSAGES.USER_DELETED, 'success');
      loadUserList();
    } catch (err) {
      console.error('Delete user failed:', err);
      showToast(MESSAGES.DELETE_USER_FAIL, 'error');
    }
  });
}

/**
 * Maps Firebase auth error codes to friendly messages for user creation.
 * @param {string} code
 * @returns {string}
 */
function friendlyCreateError(code) {
  return AUTH_ERRORS[code] || '';
}
