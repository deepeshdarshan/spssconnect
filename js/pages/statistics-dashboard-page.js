/**
 * @file Statistics dashboard — section headings, RBAC layout, and Chart.js render.
 * @module pages/statistics-dashboard-page
 */

import { MESSAGES } from '../constants/constants.js';
import { STATS_PAGE_SECTION_HEADINGS } from '../admin-stats/admin-stats-constants.js';
import { isSuperAdmin, getUserPradeshikaSabha, isAdmin } from '../services/auth-service.js';
import { setLoaderMessage } from '../ui/ui-service.js';
import { getAllMembers } from '../services/member-service.js';
import {
  filterRecordsForAdminStats,
  renderAdminStatsCharts,
} from './admin-dashboard-stats.js?v=20260612-1';
import * as Logger from '../utils/logger.js';

/**
 * PS admins (one sabha): move `#statsPsAdminChartsRow` under demographics and hide the separate PS section.
 * Super admins: restore default DOM order and show both sections.
 *
 * **Side effects:** Reorders DOM nodes under statistics sections; toggles visibility and `aria-hidden`.
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
 * Fills statistics section titles from {@link STATS_PAGE_SECTION_HEADINGS}.
 *
 * **Side effects:** Updates heading/subtitle nodes; calls {@link syncStatisticsPsChartsLayoutForRole}.
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
 * Fetches RBAC-filtered `member_details` and passes them to `renderAdminStatsCharts`.
 *
 * **Side effects:** May reorder statistics DOM for PS admins and invokes Chart.js renderers.
 *
 * @returns {Promise<void>}
 */
async function loadStatisticsCharts() {
  if (!isAdmin()) return;
  syncStatisticsPsChartsLayoutForRole();
  try {
    const records = await getAllMembers();
    const filtered = filterRecordsForAdminStats(
      records,
      isSuperAdmin(),
      getUserPradeshikaSabha(),
    );
    renderAdminStatsCharts(filtered, {
      superAdmin: isSuperAdmin(),
      userSabhaRaw: getUserPradeshikaSabha(),
    });
  } catch (err) {
    Logger.error('Statistics dashboard: charts', err);
  }
}

/**
 * Bootstraps `statistics-dashboard.html` after authentication.
 *
 * @returns {Promise<void>}
 */
export async function initStatisticsDashboardPage() {
  applyStatsPageSectionHeadings();
  setLoaderMessage(MESSAGES.LOADING_STATISTICS);
  await loadStatisticsCharts();
}
