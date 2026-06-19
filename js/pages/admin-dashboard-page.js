/**
 * @file Admin dashboard hub — URL-driven panel switching, welcome overview data, and statistics headings.
 *
 * RESPONSIBILITIES
 *   - Read `?section=` and toggle which `.dashboard-panel` has `.active` (with statistics lazy-load).
 *   - Populate welcome overview: household count, people count, homes vs Jilla target %, people breakdown.
 *   - Super-admin only: per–Pradeshika Sabha mini-tiles with live counts (HTML string + DOM update).
 *   - Target achievement strip: Jilla rows vs live `member_details` aggregates (all sabhas or one).
 *   - Copy section titles into the Statistics panel from `STATS_PAGE_SECTION_HEADINGS`.
 *
 * NON-RESPONSIBILITIES (see other modules)
 *   - Chart rendering / calculators: `./admin-dashboard-stats.js`, `../admin-stats/*`.
 *   - Firestore reads: `../services/member-service.js`, `../services/firestore-service.js`.
 *   - Auth truth: `../services/auth-service.js` (`isSuperAdmin`, `isAdmin`, `getUserPradeshikaSabha`).
 *
 * ENTRY
 *   {@link initAdminDashboard} from `app-init.js` after auth; loader message varies by active section.
 *
 * @module admin-dashboard-page
 */

import { COLLECTIONS, PRADESHIKA_SABHA_OPTIONS, MESSAGES } from '../constants/constants.js';
import { STATS_PAGE_SECTION_HEADINGS } from '../admin-stats/admin-stats-constants.js';
import { isSuperAdmin, getUserPradeshikaSabha, isAdmin } from '../services/auth-service.js';
import { escapeHtml, setLoaderMessage } from '../ui/ui-service.js';
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
  countPeopleInRecord,
} from '../utils/target-achievement-utils.js';
import * as Logger from '../utils/logger.js';

/**
 * Canonical hex gradient stops for each Pradeshika Sabha name on the super-admin overview grid.
 * Keys must match `PRADESHIKA_SABHA_OPTIONS` / `defaultSabhaOrder()` naming.
 *
 * @type {Readonly<Record<string, readonly [string, string]>>}
 */
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
 * Resolves gradient hex pair for a sabha tile, or neutral gray if unknown.
 *
 * @param {string} sabhaName Display name (e.g. `Ernakulam`).
 * @returns {readonly [string, string]} Two `#RRGGBB` colors for CSS `linear-gradient`.
 */
function sabhaGradientPair(sabhaName) {
  const pair = SABHA_TILE_GRADIENTS[sabhaName];
  return pair || ['#6b7280', '#4b5563'];
}

/**
 * Parses a 6-digit hex color to RGB channels; invalid input yields a neutral gray.
 *
 * @param {string} hex Color with leading `#` or bare six hex digits.
 * @returns {{ r: number, g: number, b: number }} Channel values 0–255.
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
 * @param {number} n Channel value (clamped 0–255 before hex encoding).
 * @returns {string} Two lowercase hex digits.
 */
function byteToHex(n) {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0');
}

/**
 * Linearly interpolates a hex color toward white for soft tile backgrounds.
 *
 * @param {string} hex Source `#RRGGBB`.
 * @param {number} t Blend factor in `[0, 1]` (1 = white).
 * @returns {string} Resulting `#RRGGBB`.
 */
function mixWithWhite(hex, t) {
  const { r, g, b } = hexToRgb(hex);
  const u = Math.max(0, Math.min(1, t));
  return `#${byteToHex(r + (255 - r) * u)}${byteToHex(g + (255 - g) * u)}${byteToHex(b + (255 - b) * u)}`;
}

/**
 * Builds a light multi-stop CSS gradient string for target-achievement PS blocks so
 * vertical bar colors remain readable on pastel tile backgrounds.
 *
 * @param {string} sabhaName Pradeshika Sabha display name.
 * @returns {string} Value suitable for `element.style.background` or inline `background:` in HTML.
 */
function sabhaLightBackgroundGradient(sabhaName) {
  const [from, to] = sabhaGradientPair(sabhaName);
  const top = mixWithWhite(from, 0.82);
  const mid = mixWithWhite(to, 0.74);
  const bot = mixWithWhite(from, 0.62);
  return `linear-gradient(168deg, ${top} 0%, #ffffff 22%, ${mid} 58%, ${bot} 100%)`;
}

/**
 * PS admins (one sabha): move `#statsPsAdminChartsRow` under demographics and hide the separate PS section.
 * Super admins: restore default DOM order and show both sections.
 *
 * @returns {void}
 */
function syncStatisticsPsChartsLayoutForRole() {
  const chartsRow = document.getElementById('statsPsAdminChartsRow');
  const demoSection = document.querySelector('.stats-page-section--demographics');
  const psSection = document.querySelector('.stats-page-section--ps');
  const divider = document.getElementById('statsDividerAfterDemographics');
  const psHead = psSection?.querySelector('.stats-page-section-head');
  const superRow = psSection?.querySelector('.stats-ps-super-admin-charts');
  const demoMainRow = demoSection?.querySelector(':scope > .row.g-4');

  if (!chartsRow || !demoSection || !psSection) return;

  if (isSuperAdmin()) {
    divider?.classList.remove('d-none');
    psSection.classList.remove('d-none');
    psHead?.classList.remove('d-none');
    psSection.removeAttribute('aria-hidden');
    if (superRow && chartsRow.previousElementSibling !== superRow) {
      superRow.insertAdjacentElement('afterend', chartsRow);
    }
    return;
  }

  if (isAdmin()) {
    divider?.classList.add('d-none');
    psSection.classList.add('d-none');
    psHead?.classList.add('d-none');
    psSection.setAttribute('aria-hidden', 'true');
    if (demoMainRow && chartsRow.previousElementSibling !== demoMainRow) {
      demoMainRow.insertAdjacentElement('afterend', chartsRow);
    }
  }
}

/**
 * Fills Statistics panel section titles from {@link STATS_PAGE_SECTION_HEADINGS}.
 * PS admins see "Pradeshika Sabha charts" on the first chart block and no separate PS section header.
 *
 * @returns {void}
 */
function applyStatsPageSectionHeadings() {
  const H = STATS_PAGE_SECTION_HEADINGS;
  const superAdmin = isSuperAdmin();
  const demographicsCopy = superAdmin
    ? H.demographics
    : isAdmin()
      ? { title: H.ps.title, subtitle: H.demographics.subtitle }
      : H.demographics;

  const rows = [
    ['statsSectionTrendTitle', 'statsSectionTrendSub', H.trend],
    ['statsSectionDemographicsTitle', 'statsSectionDemographicsSub', demographicsCopy],
  ];
  for (const [titleId, subId, copy] of rows) {
    const titleEl = document.getElementById(titleId);
    const subEl = document.getElementById(subId);
    if (titleEl) titleEl.textContent = copy.title;
    if (subEl) subEl.textContent = copy.subtitle;
  }

  const psTitle = document.getElementById('statsSectionPsTitle');
  const psSub = document.getElementById('statsSectionPsSub');
  if (superAdmin) {
    if (psTitle) psTitle.textContent = H.ps.title;
    if (psSub) psSub.textContent = H.ps.subtitle;
  } else {
    if (psTitle) psTitle.textContent = '';
    if (psSub) psSub.textContent = '';
  }

  syncStatisticsPsChartsLayoutForRole();
}

/**
 * Reads `?section=` from the URL and toggles `.dashboard-panel.active` plus loads statistics when needed.
 * Non-admin callers still switch panels; statistics load only when `isAdmin()` is true.
 *
 * @returns {Promise<void>|undefined} Resolves when Chart.js statistics finish loading for `?section=statistics`;
 *   otherwise `undefined` (overview loads are handled in {@link initAdminDashboard}).
 */
function initDashboardSectionFromUrl() {
  const panels = document.querySelectorAll('.dashboard-panel');
  if (!panels.length) return undefined;

  const section = new URLSearchParams(window.location.search).get('section');
  let activePanelName = 'welcome';
  if (section === 'statistics') activePanelName = 'statistics';
  else if (section === 'members') activePanelName = 'members';
  else if (section === 'administration') activePanelName = 'administration';

  panels.forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panel === activePanelName);
  });

  if (activePanelName === 'statistics' && isAdmin()) {
    return loadAdminStatisticsPanel();
  }
  return undefined;
}

/**
 * Sets `textContent` on an element by id when the element exists (no-op if missing).
 *
 * @param {string} id DOM id.
 * @param {string|number} value Display value (coerced with `String`).
 * @returns {void}
 */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

/**
 * Renders the “% of yearly target” block on the welcome overview homes tile.
 * When there is no Jilla target for the scope, shows plain text and applies `overview-tile-stat-pct--plain`.
 *
 * @param {HTMLElement|null} el Host for percentage UI (`#overviewRecordPct`).
 * @param {number} actual Registered homes count (non-negative).
 * @param {number} target Sum of Jilla `home` targets for the same scope (non-negative).
 * @returns {void}
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
 * Sets loading placeholders on overview count tiles and hides achievement / breakdown chrome.
 *
 * @param {HTMLElement|null} pctRecEl
 * @param {HTMLElement|null} peopleBreakdownEl
 * @returns {void}
 */
function setOverviewCountTilesLoading(pctRecEl, peopleBreakdownEl) {
  setText('overviewRecordCount', '…');
  setText('overviewPeopleCount', '…');
  if (pctRecEl) {
    pctRecEl.textContent = '';
    pctRecEl.classList.remove('overview-tile-stat-pct--plain');
    pctRecEl.classList.add('d-none');
  }
  if (peopleBreakdownEl) {
    peopleBreakdownEl.replaceChildren();
    peopleBreakdownEl.classList.remove('overview-people-breakdown--plain');
    peopleBreakdownEl.classList.add('d-none');
  }
}

/**
 * Resets overview count tiles to empty/error state (used when PS admin has no sabha or after load failure).
 *
 * @param {HTMLElement|null} pctRecEl
 * @param {HTMLElement|null} peopleBreakdownEl
 * @returns {void}
 */
function clearOverviewCountTiles(pctRecEl, peopleBreakdownEl) {
  setText('overviewRecordCount', '—');
  setText('overviewPeopleCount', '—');
  if (pctRecEl) {
    pctRecEl.textContent = '';
    pctRecEl.classList.remove('overview-tile-stat-pct--plain');
    pctRecEl.classList.add('d-none');
  }
  if (peopleBreakdownEl) {
    peopleBreakdownEl.replaceChildren();
    peopleBreakdownEl.classList.remove('overview-people-breakdown--plain');
    peopleBreakdownEl.classList.add('d-none');
  }
}

/**
 * @param {HTMLElement|null} pctRecEl
 * @param {HTMLElement|null} peopleBreakdownEl
 * @param {number} actualHomes
 * @param {number} people
 * @param {number} actualActiveMembers
 * @param {number} targetHomes
 * @param {number} targetMembers
 * @returns {void}
 */
function applyOverviewCountResults(
  pctRecEl,
  peopleBreakdownEl,
  actualHomes,
  people,
  actualActiveMembers,
  targetHomes,
  targetMembers,
) {
  setText('overviewRecordCount', actualHomes);
  setText('overviewPeopleCount', people);
  setOverviewAchievementPct(pctRecEl, actualHomes, targetHomes);
  setOverviewPeopleBreakdown(peopleBreakdownEl, {
    totalPeople: people,
    activeMembers: actualActiveMembers,
    targetMembers,
  });
}

/**
 * Super-admin overview counts: all records + Jilla targets for the current year.
 *
 * @param {string} yearStr - Calendar year as Firestore doc id.
 * @param {string[]} sabhaOrder - Canonical sabha names for merging Jilla rows.
 * @returns {Promise<{ people: number, actualHomes: number, actualActiveMembers: number, targetHomes: number, targetMembers: number }>}
 */
async function fetchOverviewCountsSuperAdmin(yearStr, sabhaOrder) {
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
  return { people, actualHomes, actualActiveMembers, targetHomes, targetMembers };
}

/**
 * PS-admin overview counts: records for the assigned sabha + that row’s Jilla targets.
 *
 * @param {string} sabha - Raw user sabha from profile (trimmed, non-empty).
 * @param {string} yearStr
 * @param {string[]} sabhaOrder
 * @returns {Promise<{ people: number, actualHomes: number, actualActiveMembers: number, targetHomes: number, targetMembers: number }>}
 */
async function fetchOverviewCountsPsAdmin(sabha, yearStr, sabhaOrder) {
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
  return { people, actualHomes, actualActiveMembers, targetHomes, targetMembers };
}

/**
 * Builds the DOM subtree for `#overviewPeopleBreakdown` (stacked bar + two metrics).
 * Uses `innerHTML` only for numeric/template fragments derived from counts (not raw Firestore text).
 *
 * @param {{ totalPeople: number, activeMembers: number, targetMembers: number }} stats
 * @returns {HTMLElement}
 */
function buildOverviewPeopleBreakdownPanel(stats) {
  const { totalPeople, activeMembers, targetMembers } = stats;
  const nonActive = Math.max(0, totalPeople - activeMembers);
  const memberRatio = achievementRatio(activeMembers, targetMembers);
  const nonMemberSharePct = totalPeople > 0 ? Math.round((nonActive / totalPeople) * 100) : 0;
  const memberBarPct = totalPeople > 0 ? (activeMembers / totalPeople) * 100 : 50;
  const nonBarPct = 100 - memberBarPct;

  const panel = document.createElement('div');
  panel.className = 'overview-people-breakdown-panel';

  const bar = document.createElement('div');
  bar.className = 'overview-people-breakdown-bar';
  bar.setAttribute('aria-hidden', 'true');
  const segMembers = document.createElement('span');
  segMembers.className = 'overview-people-breakdown-bar-seg overview-people-breakdown-bar-seg--members';
  segMembers.style.width = `${memberBarPct}%`;
  const segNon = document.createElement('span');
  segNon.className = 'overview-people-breakdown-bar-seg overview-people-breakdown-bar-seg--non';
  segNon.style.width = `${nonBarPct}%`;
  bar.append(segMembers, segNon);

  const metrics = document.createElement('div');
  metrics.className = 'overview-people-breakdown-metrics';

  const memberMetric = document.createElement('div');
  memberMetric.className = 'overview-people-breakdown-metric overview-people-breakdown-metric--members';
  if (memberRatio) {
    const memberPct = Math.round(memberRatio.pct);
    memberMetric.title = `${activeMembers.toLocaleString()} life and ordinary members of ${targetMembers.toLocaleString()} yearly target (${memberPct}%)`;
    memberMetric.innerHTML = `
      <span class="overview-people-breakdown-metric-head">
        <span class="overview-people-breakdown-dot" aria-hidden="true"></span>
        <span class="overview-people-breakdown-pct">${memberPct}%</span>
      </span>
      <span class="overview-people-breakdown-caption">Members <em>of target</em></span>`;
  } else {
    memberMetric.title = 'No yearly member target set in Jilla membership details';
    memberMetric.classList.add('overview-people-breakdown-metric--muted');
    memberMetric.innerHTML = `
      <span class="overview-people-breakdown-metric-head">
        <span class="overview-people-breakdown-dot" aria-hidden="true"></span>
        <span class="overview-people-breakdown-pct">—</span>
      </span>
      <span class="overview-people-breakdown-caption">Members <em>no target</em></span>`;
  }

  const nonMetric = document.createElement('div');
  nonMetric.className = 'overview-people-breakdown-metric overview-people-breakdown-metric--non';
  nonMetric.title = `${nonActive.toLocaleString()} non-members among ${totalPeople.toLocaleString()} registered members (${nonMemberSharePct}%)`;
  nonMetric.innerHTML = `
    <span class="overview-people-breakdown-metric-head">
      <span class="overview-people-breakdown-dot" aria-hidden="true"></span>
      <span class="overview-people-breakdown-pct">${nonMemberSharePct}%</span>
    </span>
    <span class="overview-people-breakdown-caption">Non-members <em>among registered members</em></span>`;

  metrics.append(memberMetric, nonMetric);
  panel.append(bar, metrics);
  return panel;
}

/**
 * Renders the people-tile breakdown: stacked bar (members vs non-members of registered people)
 * and two metric columns (members vs Jilla life+ordinary target; non-members share).
 *
 * @param {HTMLElement|null} el Host (`#overviewPeopleBreakdown`).
 * @param {{ totalPeople: number, activeMembers: number, targetMembers: number }} stats Aggregated counts for the signed-in user’s scope.
 * @returns {void}
 */
function setOverviewPeopleBreakdown(el, stats) {
  if (!el) return;
  const { totalPeople, activeMembers, targetMembers } = stats;
  const memberRatio = achievementRatio(activeMembers, targetMembers);

  el.classList.remove('overview-people-breakdown--plain');
  el.replaceChildren();

  if (totalPeople <= 0 && !memberRatio) {
    el.textContent = 'No data yet';
    el.classList.add('overview-people-breakdown--plain');
    el.classList.remove('d-none');
    return;
  }

  el.append(buildOverviewPeopleBreakdownPanel(stats));
  el.classList.remove('d-none');
}

/**
 * Loads household and people counts for the welcome overview, plus Jilla target achievement copy
 * for super admins and scoped sabha users. Uses {@link Logger} on failure; leaves placeholders when data is absent.
 *
 * DATA SOURCES
 *   - `member_details` via `getAllMembers()` or `getMembersByPradeshikaSabha()`.
 *   - `jilla_membership_details/{currentYear}` for target homes and life+ordinary member targets.
 *
 * @returns {Promise<void>}
 */
export async function loadMemberCountForOverview() {
  const recordEl = document.getElementById('overviewRecordCount');
  const peopleEl = document.getElementById('overviewPeopleCount');
  const pctRecEl = document.getElementById('overviewRecordPct');
  const peopleBreakdownEl = document.getElementById('overviewPeopleBreakdown');
  if (!recordEl || !peopleEl) return;

  const yearStr = String(new Date().getFullYear());
  setOverviewCountTilesLoading(pctRecEl, peopleBreakdownEl);

  try {
    const sabhaOrder = defaultSabhaOrder();

    if (isSuperAdmin()) {
      const counts = await fetchOverviewCountsSuperAdmin(yearStr, sabhaOrder);
      applyOverviewCountResults(
        pctRecEl,
        peopleBreakdownEl,
        counts.actualHomes,
        counts.people,
        counts.actualActiveMembers,
        counts.targetHomes,
        counts.targetMembers,
      );
      return;
    }

    const sabha = (getUserPradeshikaSabha() || '').trim();
    if (!sabha) {
      clearOverviewCountTiles(pctRecEl, peopleBreakdownEl);
      return;
    }

    const counts = await fetchOverviewCountsPsAdmin(sabha, yearStr, sabhaOrder);
    applyOverviewCountResults(
      pctRecEl,
      peopleBreakdownEl,
      counts.actualHomes,
      counts.people,
      counts.actualActiveMembers,
      counts.targetHomes,
      counts.targetMembers,
    );
  } catch (err) {
    Logger.error('Admin dashboard: member count', err);
    clearOverviewCountTiles(pctRecEl, peopleBreakdownEl);
  }
}

/**
 * Builds static HTML for one Sabha overview tile (gradient inline per sabha — see partial 07 for fixed hub tiles).
 * Uses {@link escapeHtml} on sabha name and URL query value to avoid XSS when injecting into `innerHTML`.
 *
 * @param {string} sabha Pradeshika Sabha display name.
 * @returns {string} HTML snippet (wrapped in outer cell div for grid layout).
 */
function buildSabhaTileHtml(sabha) {
  const [from, to] = SABHA_TILE_GRADIENTS[sabha] || ['#6b7280', '#4b5563'];
  const href = `household-directory?sabha=${encodeURIComponent(sabha)}`;
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
 * Injects one tile per `PRADESHIKA_SABHA_OPTIONS` and fills homes/members counts from `getAllMembers()`.
 * No-op when not super admin or when `#overviewSabhaTiles` is missing.
 *
 * @returns {Promise<void>}
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
 * Updates the explainer line above the target-achievement grid for the current role.
 *
 * @param {HTMLElement|null} yearNote
 * @param {number} year - Calendar year (for copy only).
 * @returns {void}
 */
function configureTargetAchievementYearNote(yearNote, year) {
  if (!yearNote) return;
  yearNote.textContent = isSuperAdmin()
    ? `Targets for ${year} (from Jilla membership details) compared to live registrations across all Pradeshika Sabhas.`
    : `Targets for ${year} compared to live registrations for your Pradeshika Sabha.`;
}

/**
 * Clears the achievement host and hides auxiliary summary elements before a fresh load.
 *
 * @param {HTMLElement} host
 * @param {HTMLElement|null} emptyEl
 * @param {HTMLElement|null} orgSummary
 * @returns {void}
 */
function resetTargetAchievementOverviewShell(host, emptyEl, orgSummary) {
  host.innerHTML = '';
  host.classList.remove('ta-overview-wrap--single');
  if (emptyEl) emptyEl.hidden = true;
  if (orgSummary) {
    orgSummary.hidden = true;
    orgSummary.textContent = '';
  }
}

/**
 * Super admins see all sabhas in order; PS admins see at most their assigned canonical sabha.
 *
 * @param {string[]} sabhaOrder - Canonical sabha keys from {@link defaultSabhaOrder}.
 * @returns {string[]} Keys to render (empty when PS admin has no matching assignment).
 */
function resolveTargetAchievementDisplayedKeys(sabhaOrder) {
  if (isSuperAdmin()) return sabhaOrder;
  const u = (getUserPradeshikaSabha() || '').trim();
  const canon = sabhaOrder.find((k) => k.toLowerCase() === u.toLowerCase());
  return canon ? [canon] : [];
}

/**
 * @param {HTMLElement|null} emptyEl
 * @param {string} message - Plain text (assigned to `textContent`).
 * @returns {void}
 */
function showTargetAchievementEmpty(emptyEl, message) {
  if (!emptyEl) return;
  emptyEl.hidden = false;
  emptyEl.textContent = message;
}

/**
 * Builds concatenated HTML for each displayed sabha block (pastel card + two vertical bars).
 * Escapes sabha display names; bar helpers escape their own dynamic fragments.
 *
 * @param {string[]} displayedKeys
 * @param {Array<{ psName: string, lifeMembers: number, ordinaryMembers: number, home: number }>} jillaRows - Merged rows from {@link mergeJillaMembershipRows}.
 * @param {{ homes: Record<string, number>, members: Record<string, number> }} actuals - From {@link aggregateActualsBySabha}.
 * @returns {string}
 */
function buildTargetAchievementBlocksHtml(displayedKeys, jillaRows, actuals) {
  const rowByPs = Object.fromEntries(jillaRows.map((r) => [r.psName, r]));
  return displayedKeys
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
}

/**
 * Renders the “Target Achievement Analysis” overview: for each displayed sabha, a pastel block with
 * two vertical bars (homes vs `home` target; members vs life+ordinary targets). Uses current calendar year
 * document in `jilla_membership_details`. Shows empty-state copy when no targets or no sabha assignment.
 *
 * @returns {Promise<void>}
 */
export async function loadTargetAchievementOverview() {
  const host = document.getElementById('overviewTargetAchievementHost');
  const emptyEl = document.getElementById('overviewTargetAchievementEmpty');
  const yearNote = document.getElementById('overviewTargetAchievementYearNote');
  const orgSummary = document.getElementById('overviewTargetAchievementOrgSummary');

  if (!host || !isAdmin()) return;

  const year = new Date().getFullYear();
  const yearStr = String(year);
  configureTargetAchievementYearNote(yearNote, year);
  resetTargetAchievementOverviewShell(host, emptyEl, orgSummary);

  const sabhaOrder = defaultSabhaOrder();
  const displayedKeys = resolveTargetAchievementDisplayedKeys(sabhaOrder);

  if (displayedKeys.length === 0) {
    showTargetAchievementEmpty(
      emptyEl,
      'No Pradeshika Sabha is assigned to your account. Contact a super admin to update your user profile.',
    );
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
      getUserPradeshikaSabha(),
    );
    const jillaRows = mergeJillaMembershipRows(jillaDoc?.membershipDetails, sabhaOrder);

    if (!hasAnyJillaTargets(jillaRows)) {
      showTargetAchievementEmpty(
        emptyEl,
        `No membership targets for ${year} yet. A super admin can add them under Administration → Jilla membership details.`,
      );
      host.classList.remove('ta-overview-wrap--single');
      return;
    }

    const actuals = aggregateActualsBySabha(filtered, sabhaOrder);
    const blocksHtml = buildTargetAchievementBlocksHtml(displayedKeys, jillaRows, actuals);

    host.classList.toggle('ta-overview-wrap--single', displayedKeys.length === 1);
    host.innerHTML = blocksHtml;
  } catch (err) {
    Logger.error('Admin dashboard: target achievement', err);
    host.innerHTML = '';
    host.classList.remove('ta-overview-wrap--single');
    showTargetAchievementEmpty(
      emptyEl,
      'Could not load target achievement data. Try again later, or ask a super admin to confirm Firestore access for Jilla targets.',
    );
  }
}

/**
 * Fetches RBAC-filtered `member_details` and passes them to `renderAdminStatsCharts`.
 * Intended only when the statistics panel is active; errors are logged, not re-thrown.
 *
 * @returns {Promise<void>}
 */
async function loadAdminStatisticsPanel() {
  const statsPanel = document.querySelector('.dashboard-panel[data-panel="statistics"]');
  if (!statsPanel || !isAdmin()) return;
  syncStatisticsPsChartsLayoutForRole();
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
  }
}

/**
 * Bootstraps `admin-dashboard.html` after authentication: applies URL section, stats headings,
 * loader copy, then concurrently loads overview tiles (member counts, sabha grid, target achievement)
 * and optionally awaits statistics chart render when `?section=statistics`.
 *
 * @returns {Promise<void>}
 */
export async function initAdminDashboard() {
  const statsPromise = initDashboardSectionFromUrl();
  applyStatsPageSectionHeadings();
  setLoaderMessage(
    statsPromise ? MESSAGES.LOADING_STATISTICS : MESSAGES.LOADING_DASHBOARD_OVERVIEW
  );
  try {
    const overviewPromise = Promise.all([
      loadMemberCountForOverview(),
      loadSabhaCountsForOverview(),
      loadTargetAchievementOverview(),
    ]);
    if (statsPromise) {
      await Promise.all([overviewPromise, statsPromise]);
    } else {
      await overviewPromise;
    }
  } catch (err) {
    Logger.error('Admin dashboard: overview', err);
  }
}
