/**
 * @fileoverview Admin hub — sidebar section switching and overview stats.
 * @module admin-dashboard-page
 */

import { getCountFromServer, collection, query, where } from 'firebase/firestore';
import { db } from './firebase-config.js';
import { COLLECTIONS } from './constants.js';
import { isSuperAdmin, getUserPradeshikaSabha } from './auth-service.js';

/**
 * Binds left-nav buttons to right-hand panels.
 */
function initDashboardTabs() {
  const navLinks = document.querySelectorAll('.dashboard-nav-link');
  const panels = document.querySelectorAll('.dashboard-panel');
  if (!navLinks.length || !panels.length) return;

  navLinks.forEach((btn) => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      if (!section) return;

      navLinks.forEach((item) => item.classList.remove('active'));
      panels.forEach((panel) => panel.classList.remove('active'));

      btn.classList.add('active');
      const activePanel = document.querySelector(`.dashboard-panel[data-panel="${section}"]`);
      if (activePanel) activePanel.classList.add('active');
    });
  });
}

/**
 * @param {string} id
 * @param {string|number} value
 */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

/**
 * Loads member count for overview (all members for super_admin; filtered by sabha for others).
 */
export async function loadMemberCountForOverview() {
  const el = document.getElementById('overviewMemberCount');
  if (!el) return;
  const labelEl = document.getElementById('overviewMemberLabel');
  if (labelEl) {
    labelEl.textContent = isSuperAdmin()
      ? 'Member records (all)'
      : 'Member records (your sabha)';
  }
  el.textContent = '…';
  try {
    const col = collection(db, COLLECTIONS.MEMBER_DETAILS);
    if (isSuperAdmin()) {
      const snap = await getCountFromServer(col);
      setText('overviewMemberCount', snap.data().count);
      return;
    }
    const sabha = (getUserPradeshikaSabha() || '').trim();
    if (!sabha) {
      setText('overviewMemberCount', '—');
      return;
    }
    const q = query(
      col,
      where('personalDetails.pradeshikaSabha', '==', sabha)
    );
    const snap = await getCountFromServer(q);
    setText('overviewMemberCount', snap.data().count);
  } catch (err) {
    console.error('Admin dashboard: member count', err);
    setText('overviewMemberCount', '—');
  }
}

/**
 * Entry point for admin-dashboard.html (called from app-init).
 */
export function initAdminDashboard() {
  initDashboardTabs();
  loadMemberCountForOverview();
}
