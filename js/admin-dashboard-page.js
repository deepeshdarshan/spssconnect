/**
 * @fileoverview Admin hub — sidebar section switching and overview stats.
 * @module admin-dashboard-page
 */

import { getCountFromServer, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from './firebase-config.js';
import { COLLECTIONS, PRADESHIKA_SABHA_OPTIONS, MESSAGES } from './constants.js';
import { isSuperAdmin, getUserPradeshikaSabha, isAdmin } from './auth-service.js';
import { escapeHtml, showLoader, hideLoader } from './ui-service.js';
import { getAllMembers } from './member-service.js';
import {
  filterRecordsForAdminStats,
  renderAdminStatsCharts,
  resizeAdminStatsCharts,
} from './admin-dashboard-stats.js';

/** Gradient pairs per Pradeshika Sabha (super-admin overview tiles). */
const SABHA_TILE_GRADIENTS = Object.freeze({
  Ernakulam: ['#c95b14', '#9e3f08'],
  Edappally: ['#0d6efd', '#0a4bad'],
  Tripunithura: ['#7c3aed', '#5b21b6'],
  Chottanikkara: ['#db2777', '#9d174d'],
  Perumbavoor: ['#0d9488', '#0f766e'],
  Aluva: ['#d97706', '#b45309'],
  Panangad: ['#16a34a', '#15803d'],
});

/** Set true after statistics charts render successfully (lazy first open). */
let adminStatisticsLoaded = false;

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

      if (section === 'statistics' && isAdmin()) {
        if (!adminStatisticsLoaded) {
          void loadAdminStatisticsPanel();
        } else {
          requestAnimationFrame(() => resizeAdminStatsCharts());
        }
      }
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
 * Sum of house owner + members + non-members for one member_details document.
 * @param {Object} data
 */
function countPeopleInRecord(data) {
  return 1 + (data.members || []).length + (data.nonMembers || []).length;
}

/**
 * Loads household record count + people count for overview (super_admin: all; PS admin: assigned sabha).
 */
export async function loadMemberCountForOverview() {
  const titleEl = document.getElementById('overviewMemberTitle');
  const totalTitleEl = document.getElementById('overviewTotalMembersTitle');
  const recordEl = document.getElementById('overviewRecordCount');
  const peopleEl = document.getElementById('overviewPeopleCount');
  if (!recordEl || !peopleEl) return;

  if (titleEl) {
    titleEl.textContent = isSuperAdmin() ? 'Member records (all)' : 'Member records';
  }
  if (totalTitleEl) {
    totalTitleEl.textContent = isSuperAdmin() ? 'Total members (all)' : 'Total members';
  }
  setText('overviewRecordCount', '…');
  setText('overviewPeopleCount', '…');

  try {
    const col = collection(db, COLLECTIONS.MEMBER_DETAILS);
    if (isSuperAdmin()) {
      const records = await getAllMembers();
      const people = records.reduce((sum, r) => sum + countPeopleInRecord(r), 0);
      if (titleEl) titleEl.textContent = 'Member records (all)';
      if (totalTitleEl) totalTitleEl.textContent = 'Total members (all)';
      setText('overviewRecordCount', records.length);
      setText('overviewPeopleCount', people);
      return;
    }

    const sabha = (getUserPradeshikaSabha() || '').trim();
    if (!sabha) {
      setText('overviewRecordCount', '—');
      setText('overviewPeopleCount', '—');
      return;
    }

    if (titleEl) titleEl.textContent = `Member records (${sabha})`;
    if (totalTitleEl) totalTitleEl.textContent = `Total members (${sabha})`;

    const q = query(col, where('personalDetails.pradeshikaSabha', '==', sabha));
    const snap = await getDocs(q);
    let people = 0;
    snap.forEach((doc) => {
      people += countPeopleInRecord(doc.data());
    });
    setText('overviewRecordCount', snap.size);
    setText('overviewPeopleCount', people);
  } catch (err) {
    console.error('Admin dashboard: member count', err);
    setText('overviewRecordCount', '—');
    setText('overviewPeopleCount', '—');
  }
}

/**
 * Builds one Pradeshika Sabha overview tile (matches Administration form-box layout).
 * @param {string} sabha
 * @returns {string}
 */
function buildSabhaTileHtml(sabha) {
  const [from, to] = SABHA_TILE_GRADIENTS[sabha] || ['#6b7280', '#4b5563'];
  const href = `member-management?sabha=${encodeURIComponent(sabha)}`;
  return `
    <div class="col-md-6 col-lg-4">
      <a href="${escapeHtml(href)}" class="form-box overview-tile overview-tile--stat" style="background: linear-gradient(135deg, ${from} 0%, ${to} 100%);" aria-label="Open member list filtered by ${escapeHtml(sabha)}">
        <div class="overview-tile-stat-inner">
          <div class="overview-tile-stat-icon-wrap" aria-hidden="true">
            <i class="bi bi-geo-alt-fill"></i>
          </div>
          <div class="overview-tile-stat-main">
            <span class="overview-tile-stat-count" data-sabha="${escapeHtml(sabha)}">…</span>
            <span class="overview-tile-stat-label">${escapeHtml(sabha)}</span>
          </div>
          <span class="overview-tile-stat-cta"><i class="bi bi-arrow-right-short" aria-hidden="true"></i> Click to view members</span>
        </div>
      </a>
    </div>`;
}

/**
 * Loads per-sabha member counts for super-admin overview (one tile per sabha).
 */
export async function loadSabhaCountsForOverview() {
  const tilesEl = document.getElementById('overviewSabhaTiles');
  if (!tilesEl || !isSuperAdmin()) return;

  const sabhas = Object.keys(PRADESHIKA_SABHA_OPTIONS);
  tilesEl.innerHTML = sabhas.map((sabha) => buildSabhaTileHtml(sabha)).join('');

  const col = collection(db, COLLECTIONS.MEMBER_DETAILS);
  try {
    const counts = await Promise.all(
      sabhas.map(async (sabha) => {
        const q = query(col, where('personalDetails.pradeshikaSabha', '==', sabha));
        const snap = await getCountFromServer(q);
        return snap.data().count;
      })
    );
    sabhas.forEach((sabha, i) => {
      const countEl = tilesEl.querySelector(`[data-sabha="${CSS.escape(sabha)}"]`);
      if (countEl) countEl.textContent = String(counts[i]);
    });
  } catch (err) {
    console.error('Admin dashboard: sabha counts', err);
    tilesEl.querySelectorAll('[data-sabha]').forEach((el) => {
      el.textContent = '—';
    });
  }
}

/**
 * Loads member records (RBAC-filtered) and renders the Statistics panel charts.
 */
async function loadAdminStatisticsPanel() {
  const statsPanel = document.querySelector('.dashboard-panel[data-panel="statistics"]');
  if (!statsPanel || !isAdmin()) return;
  showLoader(MESSAGES.LOADING_STATISTICS);
  try {
    const records = await getAllMembers();
    const filtered = filterRecordsForAdminStats(
      records,
      isSuperAdmin(),
      getUserPradeshikaSabha()
    );
    renderAdminStatsCharts(filtered);
    adminStatisticsLoaded = true;
  } catch (err) {
    console.error('Admin dashboard: statistics', err);
  } finally {
    hideLoader();
  }
}

/**
 * Entry point for admin-dashboard.html (called from app-init).
 */
export async function initAdminDashboard() {
  initDashboardTabs();
  showLoader(MESSAGES.LOADING_DASHBOARD_OVERVIEW);
  try {
    await Promise.all([loadMemberCountForOverview(), loadSabhaCountsForOverview()]);
  } catch (err) {
    console.error('Admin dashboard: overview', err);
  } finally {
    hideLoader();
  }
}
