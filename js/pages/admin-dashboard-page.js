/**
 * @fileoverview Admin hub — sidebar section switching and overview stats.
 * @module admin-dashboard-page
 */

import { COLLECTIONS, PRADESHIKA_SABHA_OPTIONS, MESSAGES } from '../constants/constants.js';
import { STATS_PAGE_SECTION_HEADINGS } from '../admin-stats/admin-stats-constants.js';
import { isSuperAdmin, getUserPradeshikaSabha, isAdmin } from '../services/auth-service.js';
import { escapeHtml, showLoader, hideLoader } from '../ui/ui-service.js';
import { getAllMembers, getMembersByPradeshikaSabha } from '../services/member-service.js';
import { getDocument } from '../services/firestore-service.js';
import {
  filterRecordsForAdminStats,
  renderAdminStatsCharts,
} from './admin-dashboard-stats.js?v=20260612-1';
import {
  mergeJillaMembershipRows,
  aggregateActualsBySabha,
  achievementRatio,
  hasAnyJillaTargets,
  defaultSabhaOrder,
  countActiveMembersInRecord,
} from '../utils/target-achievement-utils.js';
import * as Logger from '../utils/logger.js';

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

/**
 * @param {string} sabhaName
 * @returns {[string, string]}
 */
function sabhaGradientPair(sabhaName) {
  const pair = SABHA_TILE_GRADIENTS[sabhaName];
  return pair || ['#6b7280', '#4b5563'];
}

/**
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number }}
 */
function hexToRgb(hex) {
  const h = String(hex).replace('#', '').trim();
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) {
    return { r: 107, g: 114, b: 128 };
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/**
 * @param {number} n
 * @returns {string}
 */
function byteToHex(n) {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0');
}

/**
 * Mix a hex color toward white. t=1 → white, t=0 → original.
 * @param {string} hex
 * @param {number} t
 * @returns {string}
 */
function mixWithWhite(hex, t) {
  const { r, g, b } = hexToRgb(hex);
  const u = Math.max(0, Math.min(1, t));
  return `#${byteToHex(r + (255 - r) * u)}${byteToHex(g + (255 - g) * u)}${byteToHex(b + (255 - b) * u)}`;
}

/**
 * Pastel tile background so member (orange) and home (green) bars read clearly.
 * @param {string} sabhaName
 * @returns {string}
 */
function sabhaLightBackgroundGradient(sabhaName) {
  const [from, to] = sabhaGradientPair(sabhaName);
  const top = mixWithWhite(from, 0.82);
  const mid = mixWithWhite(to, 0.74);
  const bot = mixWithWhite(from, 0.62);
  return `linear-gradient(168deg, ${top} 0%, #ffffff 22%, ${mid} 58%, ${bot} 100%)`;
}

/**
 * Fills Statistics panel section titles from {@link STATS_PAGE_SECTION_HEADINGS}.
 *
 * @returns {void}
 */
function applyStatsPageSectionHeadings() {
  const H = STATS_PAGE_SECTION_HEADINGS;
  const rows = [
    ['statsSectionTrendTitle', 'statsSectionTrendSub', H.trend],
    ['statsSectionDemographicsTitle', 'statsSectionDemographicsSub', H.demographics],
    ['statsSectionPsTitle', 'statsSectionPsSub', H.ps],
  ];
  for (const [titleId, subId, copy] of rows) {
    const titleEl = document.getElementById(titleId);
    const subEl = document.getElementById(subId);
    if (titleEl) titleEl.textContent = copy.title;
    if (subEl) subEl.textContent = copy.subtitle;
  }
}

/**
 * Shows the correct dashboard panel from URL: ?section=statistics | members | administration.
 * Loads statistics charts when that panel is shown.
 */
function initDashboardSectionFromUrl() {
  const panels = document.querySelectorAll('.dashboard-panel');
  if (!panels.length) return;

  const section = new URLSearchParams(window.location.search).get('section');
  let activePanelName = 'welcome';
  if (section === 'statistics') activePanelName = 'statistics';
  else if (section === 'members') activePanelName = 'members';
  else if (section === 'administration') activePanelName = 'administration';

  panels.forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panel === activePanelName);
  });

  if (activePanelName === 'statistics' && isAdmin()) {
    void loadAdminStatisticsPanel();
  }
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
 * @param {HTMLElement|null} el
 * @param {number} actual
 * @param {number} target
 */
function setOverviewAchievementPct(el, actual, target) {
  if (!el) return;
  el.classList.remove('overview-tile-stat-pct--plain');
  const ratio = achievementRatio(actual, target);
  if (!ratio) {
    el.replaceChildren();
    el.textContent = 'No yearly target';
    el.classList.add('overview-tile-stat-pct--plain');
    el.classList.remove('d-none');
    return;
  }
  const n = Math.round(ratio.pct);
  el.replaceChildren();
  const valueSpan = document.createElement('span');
  valueSpan.className = 'overview-tile-stat-pct-value';
  valueSpan.textContent = `${n}%`;
  const suffix = document.createElement('span');
  suffix.className = 'overview-tile-stat-pct-suffix';
  suffix.textContent = 'of the target';
  el.append(valueSpan, suffix);
  el.classList.remove('d-none');
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
 * Shows achievement % vs Jilla yearly targets (homes target; members = life + ordinary targets vs actual life+ordinary counts).
 */
export async function loadMemberCountForOverview() {
  const recordEl = document.getElementById('overviewRecordCount');
  const peopleEl = document.getElementById('overviewPeopleCount');
  const pctRecEl = document.getElementById('overviewRecordPct');
  const pctPeoEl = document.getElementById('overviewPeoplePct');
  if (!recordEl || !peopleEl) return;

  const yearStr = String(new Date().getFullYear());
  setText('overviewRecordCount', '…');
  setText('overviewPeopleCount', '…');
  if (pctRecEl) {
    pctRecEl.textContent = '';
    pctRecEl.classList.remove('overview-tile-stat-pct--plain');
    pctRecEl.classList.add('d-none');
  }
  if (pctPeoEl) {
    pctPeoEl.textContent = '';
    pctPeoEl.classList.remove('overview-tile-stat-pct--plain');
    pctPeoEl.classList.add('d-none');
  }

  try {
    const sabhaOrder = defaultSabhaOrder();

    if (isSuperAdmin()) {
      const [records, jillaDoc] = await Promise.all([
        getAllMembers(),
        getDocument(COLLECTIONS.JILLA_MEMBERSHIP_DETAILS, yearStr),
      ]);
      const jillaRows = mergeJillaMembershipRows(jillaDoc?.membershipDetails, sabhaOrder);
      const people = records.reduce((sum, r) => sum + countPeopleInRecord(r), 0);
      const actualHomes = records.length;
      const actualActiveMembers = records.reduce((sum, r) => sum + countActiveMembersInRecord(r), 0);

      const targetHomes = jillaRows.reduce((s, r) => s + r.home, 0);
      const targetMembers = jillaRows.reduce((s, r) => s + r.lifeMembers + r.ordinaryMembers, 0);

      setText('overviewRecordCount', actualHomes);
      setText('overviewPeopleCount', people);
      setOverviewAchievementPct(pctRecEl, actualHomes, targetHomes);
      setOverviewAchievementPct(pctPeoEl, actualActiveMembers, targetMembers);
      return;
    }

    const sabha = (getUserPradeshikaSabha() || '').trim();
    if (!sabha) {
      setText('overviewRecordCount', '—');
      setText('overviewPeopleCount', '—');
      if (pctRecEl) {
        pctRecEl.textContent = '';
        pctRecEl.classList.remove('overview-tile-stat-pct--plain');
        pctRecEl.classList.add('d-none');
      }
      if (pctPeoEl) {
        pctPeoEl.textContent = '';
        pctPeoEl.classList.remove('overview-tile-stat-pct--plain');
        pctPeoEl.classList.add('d-none');
      }
      return;
    }

    const [sabhaRecords, jillaDoc] = await Promise.all([
      getMembersByPradeshikaSabha(sabha),
      getDocument(COLLECTIONS.JILLA_MEMBERSHIP_DETAILS, yearStr),
    ]);
    const jillaRows = mergeJillaMembershipRows(jillaDoc?.membershipDetails, sabhaOrder);
    let people = 0;
    let actualActiveMembers = 0;
    for (const data of sabhaRecords) {
      people += countPeopleInRecord(data);
      actualActiveMembers += countActiveMembersInRecord(data);
    }
    const actualHomes = sabhaRecords.length;

    const canon = sabhaOrder.find((k) => k.toLowerCase() === sabha.toLowerCase());
    const row = canon ? jillaRows.find((r) => r.psName === canon) : null;
    const targetHomes = row ? row.home : 0;
    const targetMembers = row ? row.lifeMembers + row.ordinaryMembers : 0;

    setText('overviewRecordCount', actualHomes);
    setText('overviewPeopleCount', people);
    setOverviewAchievementPct(pctRecEl, actualHomes, targetHomes);
    setOverviewAchievementPct(pctPeoEl, actualActiveMembers, targetMembers);
  } catch (err) {
    Logger.error('Admin dashboard: member count', err);
    setText('overviewRecordCount', '—');
    setText('overviewPeopleCount', '—');
    if (pctRecEl) {
      pctRecEl.textContent = '';
      pctRecEl.classList.remove('overview-tile-stat-pct--plain');
      pctRecEl.classList.add('d-none');
    }
    if (pctPeoEl) {
      pctPeoEl.textContent = '';
      pctPeoEl.classList.remove('overview-tile-stat-pct--plain');
      pctPeoEl.classList.add('d-none');
    }
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
    <div class="overview-sabha-tile-cell">
      <a href="${escapeHtml(href)}" class="form-box overview-tile overview-tile--stat overview-tile--sabha" style="background: linear-gradient(135deg, ${from} 0%, ${to} 100%);" data-sabha-link="${escapeHtml(sabha)}" aria-label="Open household directory filtered by ${escapeHtml(sabha)}">
        <div class="overview-tile-stat-inner">
          <div class="overview-tile-stat-icon-wrap" aria-hidden="true">
            <i class="bi bi-geo-alt-fill"></i>
          </div>
          <div class="overview-tile-stat-main">
            <div class="overview-tile-sabha-text-wrap">
              <div class="overview-tile-sabha-split">
                <div class="overview-tile-sabha-col">
                  <span class="overview-tile-sabha-num overview-tile-sabha-num--dual" data-sabha-homes="${escapeHtml(sabha)}">…</span>
                  <span class="overview-tile-sabha-sublabel">Homes</span>
                </div>
                <div class="overview-tile-sabha-divider" aria-hidden="true"></div>
                <div class="overview-tile-sabha-col">
                  <span class="overview-tile-sabha-num overview-tile-sabha-num--dual" data-sabha-members="${escapeHtml(sabha)}">…</span>
                  <span class="overview-tile-sabha-sublabel">Members</span>
                </div>
              </div>
              <div class="overview-tile-sabha-name">${escapeHtml(sabha)}</div>
            </div>
          </div>
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

  try {
    const records = await getAllMembers();
    const { homes, members } = aggregateActualsBySabha(records, sabhas);
    sabhas.forEach((sabha) => {
      const h = homes[sabha] ?? 0;
      const m = members[sabha] ?? 0;
      const homesEl = tilesEl.querySelector(`[data-sabha-homes="${CSS.escape(sabha)}"]`);
      const membersEl = tilesEl.querySelector(`[data-sabha-members="${CSS.escape(sabha)}"]`);
      if (homesEl) homesEl.textContent = Number.isFinite(h) ? String(h) : '—';
      if (membersEl) membersEl.textContent = Number.isFinite(m) ? String(m) : '—';
      const link = tilesEl.querySelector(`a[data-sabha-link="${CSS.escape(sabha)}"]`);
      if (link) {
        link.setAttribute(
          'aria-label',
          `${h} homes, ${m} members (life and ordinary) in ${sabha}. Open household directory filtered by this sabha.`
        );
      }
    });
  } catch (err) {
    Logger.error('Admin dashboard: sabha counts', err);
    tilesEl.querySelectorAll('[data-sabha-homes], [data-sabha-members]').forEach((el) => {
      el.textContent = '—';
    });
  }
}

/**
 * One vertical achievement column (pct, track with fill from bottom, label, actual/target).
 * Bar height caps at 100%; label shows true % (can exceed 100).
 * @param {string} label
 * @param {number} actual
 * @param {number} target
 * @param {'members'|'homes'} variant
 * @returns {string}
 */
function buildAchievementVerticalBarHtml(label, actual, target, variant) {
  const ratio = achievementRatio(actual, target);
  const fillClass = variant === 'homes' ? 'ta-vfill--homes' : 'ta-vfill--members';
  const a = Math.max(0, Math.floor(Number(actual)) || 0);
  const t = Math.max(0, Math.floor(Number(target)) || 0);
  if (!ratio) {
    return `<div class="ta-vmetric">
      <span class="ta-vmetric-pct">N/A</span>
      <div class="ta-vtrack" role="img" aria-label="${escapeHtml(label)}: no target set, actual ${a}">
        <div class="ta-vfill ${fillClass}" style="height:0%"></div>
      </div>
      <span class="ta-vmetric-label">${escapeHtml(label)}</span>
      <span class="ta-vmetric-detail">Actual ${a}</span>
    </div>`;
  }
  const pctLabel = `${Math.round(ratio.pct)}%`;
  return `<div class="ta-vmetric">
    <span class="ta-vmetric-pct">${escapeHtml(pctLabel)}</span>
    <div class="ta-vtrack" role="img" aria-label="${escapeHtml(label)}: ${pctLabel}, ${a} of ${t} target">
      <div class="ta-vfill ${fillClass}" style="height:${ratio.barPct}%"></div>
    </div>
    <span class="ta-vmetric-label">${escapeHtml(label)}</span>
    <span class="ta-vmetric-detail">${a} / ${t}</span>
  </div>`;
}

/**
 * Loads Jilla targets for the calendar year and live member_details aggregates; renders per-PS achievement bars.
 * Super admin: all Sabhas. PS admin: assigned Sabha only.
 */
export async function loadTargetAchievementOverview() {
  const host = document.getElementById('overviewTargetAchievementHost');
  const emptyEl = document.getElementById('overviewTargetAchievementEmpty');
  const yearNote = document.getElementById('overviewTargetAchievementYearNote');
  const orgSummary = document.getElementById('overviewTargetAchievementOrgSummary');

  if (!host || !isAdmin()) return;

  const year = new Date().getFullYear();
  const yearStr = String(year);
  if (yearNote) {
    yearNote.textContent = isSuperAdmin()
      ? `Targets for ${year} (from Jilla membership details) compared to live registrations across all Pradeshika Sabhas.`
      : `Targets for ${year} compared to live registrations for your Pradeshika Sabha.`;
  }

  host.innerHTML = '';
  host.classList.remove('ta-overview-wrap--single');
  if (emptyEl) emptyEl.hidden = true;
  if (orgSummary) {
    orgSummary.hidden = true;
    orgSummary.textContent = '';
  }

  const sabhaOrder = defaultSabhaOrder();
  /** @type {string[]} */
  let displayedKeys;
  if (isSuperAdmin()) {
    displayedKeys = sabhaOrder;
  } else {
    const u = (getUserPradeshikaSabha() || '').trim();
    const canon = sabhaOrder.find((k) => k.toLowerCase() === u.toLowerCase());
    displayedKeys = canon ? [canon] : [];
  }

  if (displayedKeys.length === 0) {
    if (emptyEl) {
      emptyEl.hidden = false;
      emptyEl.textContent =
        'No Pradeshika Sabha is assigned to your account. Contact a super admin to update your user profile.';
    }
    return;
  }

  try {
    const [jillaDoc, records] = await Promise.all([
      getDocument(COLLECTIONS.JILLA_MEMBERSHIP_DETAILS, yearStr),
      getAllMembers(),
    ]);
    const filtered = filterRecordsForAdminStats(
      records,
      isSuperAdmin(),
      getUserPradeshikaSabha()
    );
    const jillaRows = mergeJillaMembershipRows(jillaDoc?.membershipDetails, sabhaOrder);

    if (!hasAnyJillaTargets(jillaRows)) {
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = `No membership targets for ${year} yet. A super admin can add them under Administration → Jilla membership details.`;
      }
      host.classList.remove('ta-overview-wrap--single');
      return;
    }

    const actuals = aggregateActualsBySabha(filtered, sabhaOrder);
    const rowByPs = Object.fromEntries(jillaRows.map((r) => [r.psName, r]));

    const blocksHtml = displayedKeys
      .map((ps) => {
        const row = rowByPs[ps] || {
          psName: ps,
          lifeMembers: 0,
          ordinaryMembers: 0,
          home: 0,
        };
        const targetMembers = row.lifeMembers + row.ordinaryMembers;
        const targetHomes = row.home;
        const actualMembers = actuals.members[ps] || 0;
        const actualHomes = actuals.homes[ps] || 0;

        const homesHtml = buildAchievementVerticalBarHtml('Homes', actualHomes, targetHomes, 'homes');
        const membersHtml = buildAchievementVerticalBarHtml('Members', actualMembers, targetMembers, 'members');

        const bgGrad = sabhaLightBackgroundGradient(ps);
        return `<div class="ta-ps-block ta-ps-block--sabha" style="background: ${bgGrad}; border-color: rgba(100, 72, 52, 0.16);">
  <div class="ta-ps-name">${escapeHtml(ps)}</div>
  <div class="ta-ps-bars-row">
    ${homesHtml}
    ${membersHtml}
  </div>
</div>`;
      })
      .join('');

    host.classList.toggle('ta-overview-wrap--single', displayedKeys.length === 1);
    host.innerHTML = blocksHtml;
  } catch (err) {
    Logger.error('Admin dashboard: target achievement', err);
    host.innerHTML = '';
    host.classList.remove('ta-overview-wrap--single');
    if (emptyEl) {
      emptyEl.hidden = false;
      emptyEl.textContent =
        'Could not load target achievement data. Try again later, or ask a super admin to confirm Firestore access for Jilla targets.';
    }
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
    renderAdminStatsCharts(filtered, {
      superAdmin: isSuperAdmin(),
      userSabhaRaw: getUserPradeshikaSabha(),
    });
  } catch (err) {
    Logger.error('Admin dashboard: statistics', err);
  } finally {
    hideLoader();
  }
}

/**
 * Entry point for admin-dashboard.html (called from app-init).
 */
export async function initAdminDashboard() {
  initDashboardSectionFromUrl();
  applyStatsPageSectionHeadings();
  showLoader(MESSAGES.LOADING_DASHBOARD_OVERVIEW);
  try {
    await Promise.all([
      loadMemberCountForOverview(),
      loadSabhaCountsForOverview(),
      loadTargetAchievementOverview(),
    ]);
  } catch (err) {
    Logger.error('Admin dashboard: overview', err);
  } finally {
    hideLoader();
  }
}
