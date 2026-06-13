/**
 * @fileoverview Chart.js rendering for the admin statistics panel.
 * @module admin-stats/admin-stats-charts
 */

import * as Logger from '../utils/logger.js';
import {
  buildGrowthTrendRecords,
  buildGrowthTrendMembers,
  buildAgeDistribution,
  collectGenders,
  buildSabhaDistribution,
  buildSabhaMemberPeopleDistribution,
  buildOccupationDistribution,
  buildMembershipDistribution,
  buildRationDistribution,
  buildEducationDistribution,
  buildBloodGroupDistribution,
  buildRecentRecordCounts,
  buildRecentPeopleCounts,
  buildSabhaNonMemberPeopleTotals,
  buildSabhaHouseholdInsuranceStack,
  filterRecordsForJillaWideCharts,
  resolvePradeshikaSabhaKey,
  resolveFirstOwnerPradeshikaSabhaKeyInRecords,
} from './admin-stats-calculators.js';
import { PRADESHIKA_SABHA_OPTIONS } from '../constants/constants.js';
import {
  barAxisStyle,
  OCCUPATION_BAR_COLORS,
  OCCUPATION_CHART_HEIGHT_PX,
  GROWTH_TREND_START_LABEL,
  STATS_HBAR_ROW_PX,
  STATS_HBAR_PADDING_PX,
  STATS_CHART_NON_MEMBERS_BAR_BG,
  STATS_NON_MEMBERS_PS_DATASET_LABEL,
  STATS_CHART_HEALTH_INSURANCE_YES_BG,
  STATS_CHART_HEALTH_INSURANCE_NO_BG,
  STATS_CHART_TERM_INSURANCE_YES_BG,
  STATS_CHART_TERM_INSURANCE_NO_BG,
  STATS_RECENT_REGISTRATION_TILES,
  STATS_CARD_TITLE_NON_MEMBERS_PS_SUPER_ADMIN,
  STATS_CARD_TITLE_NON_MEMBERS_PS_SABHA_ADMIN,
  STATS_JILLA_WIDE_PS_ADMIN_SELECT_TITLE,
  STATS_JILLA_WIDE_PS_DROPDOWN_LABEL_OVERRIDES,
  STATS_JILLA_WIDE_ALL_PS_VALUE,
  STATS_JILLA_WIDE_ALL_PS_LABEL,
} from './admin-stats-constants.js';

/** @type {import('chart.js').Chart[]} */
let chartInstances = [];

/**
 * @returns {typeof Chart|null}
 */
function getChartConstructor() {
  return typeof Chart !== 'undefined' ? Chart : null;
}

function destroyAllChartsInternal() {
  chartInstances.forEach((c) => {
    try {
      c.destroy();
    } catch {
      /* ignore */
    }
  });
  chartInstances = [];
}

/** @type {Array<Object>} */
let jillaStatsRecordsRef = [];

/**
 * @param {string} canvasId
 */
function destroyChartByCanvasId(canvasId) {
  const idx = chartInstances.findIndex((c) => c?.canvas?.id === canvasId);
  if (idx < 0) return;
  try {
    chartInstances[idx].destroy();
  } catch {
    /* ignore */
  }
  chartInstances.splice(idx, 1);
}

/**
 * @param {string} canvasId
 */
function resizeChartByCanvasId(canvasId) {
  requestAnimationFrame(() => {
    const chart = chartInstances.find((c) => c?.canvas?.id === canvasId);
    if (!chart) return;
    try {
      chart.resize();
    } catch {
      /* ignore */
    }
  });
}

/**
 * @typedef {{ superAdmin?: boolean, userSabhaRaw?: string|null }} AdminStatsViewerContext
 */

/**
 * @param {Array<Object>} records
 * @param {AdminStatsViewerContext} viewer
 * @returns {string|null}
 */
function computeDefaultJillaSabhaKey(records, viewer) {
  const keys = Object.keys(PRADESHIKA_SABHA_OPTIONS);
  const superAdmin = Boolean(viewer?.superAdmin);
  if (superAdmin) {
    return STATS_JILLA_WIDE_ALL_PS_VALUE;
  }
  const fromProfile = resolvePradeshikaSabhaKey(viewer?.userSabhaRaw ?? '');
  if (fromProfile) return fromProfile;
  const fromData = resolveFirstOwnerPradeshikaSabhaKeyInRecords(records);
  if (fromData) return fromData;
  return keys[0] || null;
}

/**
 * @param {HTMLSelectElement} select
 * @param {AdminStatsViewerContext} viewer
 * @param {string|null} defaultKey
 */
function fillJillaSabhaSelectElement(select, viewer, defaultKey) {
  const superAdmin = Boolean(viewer?.superAdmin);
  select.innerHTML = '';
  const keys = Object.keys(PRADESHIKA_SABHA_OPTIONS);

  if (superAdmin) {
    const allOpt = document.createElement('option');
    allOpt.value = STATS_JILLA_WIDE_ALL_PS_VALUE;
    allOpt.textContent = STATS_JILLA_WIDE_ALL_PS_LABEL;
    select.appendChild(allOpt);
  }

  const optionKeys = superAdmin ? keys : defaultKey && keys.includes(defaultKey) ? [defaultKey] : keys;

  optionKeys.forEach((k) => {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = STATS_JILLA_WIDE_PS_DROPDOWN_LABEL_OVERRIDES[k] || k;
    select.appendChild(opt);
  });

  if (defaultKey === STATS_JILLA_WIDE_ALL_PS_VALUE && superAdmin) {
    select.value = STATS_JILLA_WIDE_ALL_PS_VALUE;
  } else if (defaultKey && keys.includes(defaultKey)) {
    select.value = defaultKey;
  } else if (select.options.length > 0) {
    select.selectedIndex = 0;
  }

  select.disabled = !superAdmin;
  select.title = superAdmin ? '' : STATS_JILLA_WIDE_PS_ADMIN_SELECT_TITLE;
}

/**
 * @param {import('chart.js').Chart} ChartCtor
 * @param {string} kind
 * @param {string} sabhaKey
 */
function rerenderJillaWideChartByKind(ChartCtor, kind, sabhaKey) {
  const cfg = JILLA_WIDE_CHART_BY_KIND[kind];
  if (!cfg) return;
  const filtered = filterRecordsForJillaWideCharts(jillaStatsRecordsRef, sabhaKey);
  destroyChartByCanvasId(cfg.canvasId);
  cfg.render(ChartCtor, filtered);
  resizeChartByCanvasId(cfg.canvasId);
}

/**
 * @param {import('chart.js').Chart} ChartCtor
 * @param {AdminStatsViewerContext} viewer
 * @param {string|null} defaultSabhaKey
 */
function populateAndBindJillaSabhaSelectors(ChartCtor, viewer, defaultSabhaKey) {
  const selects = document.querySelectorAll('select.stats-jilla-ps-select[data-jilla-chart]');
  selects.forEach((el) => {
    if (!(el instanceof HTMLSelectElement)) return;
    fillJillaSabhaSelectElement(el, viewer, defaultSabhaKey);
    el.onchange = () => {
      if (el.disabled) return;
      const kind = el.getAttribute('data-jilla-chart');
      if (!kind) return;
      rerenderJillaWideChartByKind(ChartCtor, kind, el.value);
    };
  });
}

/**
 * @param {string} canvasId
 * @param {string} emptyId
 * @param {boolean} hasData
 */
function toggleChartEmpty(canvasId, emptyId, hasData) {
  const canvas = document.getElementById(canvasId);
  const empty = document.getElementById(emptyId);
  if (canvas) canvas.hidden = !hasData;
  if (empty) empty.hidden = hasData;
}

/**
 * Sets height on a statistics chart host so horizontal bar charts get enough vertical space.
 *
 * @param {string|null|undefined} hostId
 * @param {number} rowCount
 * @param {boolean} hasData
 */
function setStatsHorizontalChartHostHeight(hostId, rowCount, hasData) {
  if (!hostId) return;
  const host = document.getElementById(hostId);
  if (!host) return;
  host.style.height =
    hasData && rowCount > 0 ? `${rowCount * STATS_HBAR_ROW_PX + STATS_HBAR_PADDING_PX}px` : '';
}

/**
 * Writes a numeric value into a “recent statistics” tile element when it exists.
 *
 * @param {string} elementId
 * @param {number} value
 */
function setStatsRecentTileValue(elementId, value) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = String(value);
}

/** @returns {import('chart.js').ChartOptions} */
function baseChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          boxWidth: 12,
          font: { size: 11 },
          color: '#5c4030',
          padding: 8,
        },
      },
      tooltip: {
        titleColor: '#2c1810',
        bodyColor: '#2c1810',
        backgroundColor: 'rgba(255, 248, 240, 0.96)',
        borderColor: 'rgba(201, 91, 20, 0.35)',
        borderWidth: 1,
      },
    },
  };
}

/**
 * @returns {import('chart.js').ChartOptions}
 */
function growthBarChartOptions() {
  const base = baseChartOptions();
  return {
    ...base,
    plugins: {
      ...base.plugins,
      legend: { display: false },
    },
    scales: {
      x: { ...barAxisStyle, ticks: { ...barAxisStyle.ticks, maxRotation: 45, minRotation: 45 } },
      y: {
        ...barAxisStyle,
        beginAtZero: true,
        ticks: { ...barAxisStyle.ticks, precision: 0 },
      },
    },
  };
}

/**
 * Updates the growth-trend footnote from exclusion counts.
 *
 * @param {{ excludedNoDate: number, excludedBeforeRange: number }} growthRecords
 */
function updateGrowthNoteElement(growthRecords) {
  const growthNote = document.getElementById('statsGrowthNote');
  if (!growthNote) return;
  const parts = [];
  if (growthRecords.excludedNoDate > 0) {
    parts.push(
      `${growthRecords.excludedNoDate} record(s) without registration date are excluded from both trends.`
    );
  }
  if (growthRecords.excludedBeforeRange > 0) {
    parts.push(
      `${growthRecords.excludedBeforeRange} record(s) registered before ${GROWTH_TREND_START_LABEL} are excluded from both trends.`
    );
  }
  if (parts.length > 0) {
    growthNote.textContent = parts.join(' ');
    growthNote.hidden = false;
  } else {
    growthNote.textContent = '';
    growthNote.hidden = true;
  }
}

/**
 * Renders weekly new-records bar chart.
 * @param {import('chart.js').Chart} ChartCtor
 * @param {{ labels: string[], data: number[] }} growthRecords
 */
function renderGrowthRecordsChart(ChartCtor, growthRecords) {
  const sum = growthRecords.data.reduce((a, b) => a + b, 0);
  toggleChartEmpty('statsChartGrowth', 'statsChartGrowthEmpty', sum > 0);
  if (sum <= 0) return;
  const ctx = document.getElementById('statsChartGrowth')?.getContext('2d');
  if (!ctx) return;
  chartInstances.push(
    new ChartCtor(ctx, {
      type: 'bar',
      data: {
        labels: growthRecords.labels,
        datasets: [
          {
            label: 'Records',
            data: growthRecords.data,
            backgroundColor: 'rgba(201, 91, 20, 0.75)',
            borderRadius: 4,
          },
        ],
      },
      options: growthBarChartOptions(),
    })
  );
}

/**
 * Renders weekly new-people bar chart.
 * @param {import('chart.js').Chart} ChartCtor
 * @param {{ labels: string[], data: number[] }} growthMembers
 */
function renderGrowthMembersChart(ChartCtor, growthMembers) {
  const sum = growthMembers.data.reduce((a, b) => a + b, 0);
  toggleChartEmpty('statsChartGrowthMembers', 'statsChartGrowthMembersEmpty', sum > 0);
  if (sum <= 0) return;
  const ctxM = document.getElementById('statsChartGrowthMembers')?.getContext('2d');
  if (!ctxM) return;
  chartInstances.push(
    new ChartCtor(ctxM, {
      type: 'bar',
      data: {
        labels: growthMembers.labels,
        datasets: [
          {
            label: 'People',
            data: growthMembers.data,
            backgroundColor: 'rgba(124, 58, 237, 0.72)',
            borderRadius: 4,
          },
        ],
      },
      options: growthBarChartOptions(),
    })
  );
}

/**
 * @param {import('chart.js').Chart} ChartCtor
 * @param {Array<Object>} list
 */
function renderAgePieChart(ChartCtor, list) {
  const age = buildAgeDistribution(list);
  const ageTotal = age.data.reduce((a, b) => a + b, 0);
  toggleChartEmpty('statsChartAge', 'statsChartAgeEmpty', ageTotal > 0);
  if (ageTotal <= 0) return;
  const ctx = document.getElementById('statsChartAge')?.getContext('2d');
  if (!ctx) return;
  const opts = baseChartOptions();
  chartInstances.push(
    new ChartCtor(ctx, {
      type: 'pie',
      data: {
        labels: age.labels,
        datasets: [
          {
            data: age.data,
            backgroundColor: [
              'rgba(99, 102, 241, 0.85)',
              'rgba(34, 197, 94, 0.85)',
              'rgba(234, 179, 8, 0.9)',
              'rgba(236, 72, 153, 0.85)',
              'rgba(56, 189, 248, 0.85)',
              'rgba(148, 163, 184, 0.6)',
            ],
          },
        ],
      },
      options: opts,
    })
  );
}

/**
 * @param {import('chart.js').Chart} ChartCtor
 * @param {Array<Object>} list
 */
function renderGenderDoughnutChart(ChartCtor, list) {
  const gender = collectGenders(list);
  const genderSum = gender.data.reduce((a, b) => a + b, 0);
  const genderHas = genderSum > 0;
  toggleChartEmpty('statsChartGender', 'statsChartGenderEmpty', genderHas);
  if (!genderHas) return;
  const ctx = document.getElementById('statsChartGender')?.getContext('2d');
  if (!ctx) return;
  const base = baseChartOptions();
  chartInstances.push(
    new ChartCtor(ctx, {
      type: 'doughnut',
      data: {
        labels: gender.labels,
        datasets: [
          {
            data: gender.data,
            backgroundColor: [
              'rgba(59, 130, 246, 0.88)',
              'rgba(244, 114, 182, 0.88)',
              'rgba(167, 139, 250, 0.88)',
              'rgba(148, 163, 184, 0.55)',
            ],
          },
        ],
      },
      options: {
        ...base,
        cutout: '52%',
      },
    })
  );
}

/**
 * Horizontal bar chart for one sabha-keyed numeric series (super admin only).
 *
 * @param {import('chart.js').Chart} ChartCtor
 * @param {{ labels: string[], data: number[] }} dist
 * @param {string} canvasId
 * @param {string} emptyId
 * @param {string} datasetLabel
 * @param {string} barColor
 */
function renderSabhaMetricBarChartSuperAdmin(
  ChartCtor,
  dist,
  canvasId,
  emptyId,
  datasetLabel,
  barColor
) {
  const showSabhaChart =
    typeof document !== 'undefined' && document.body.classList.contains('is-super-admin');
  if (!showSabhaChart) return;
  const sum = dist.data.reduce((a, b) => a + b, 0);
  toggleChartEmpty(canvasId, emptyId, sum > 0);
  if (sum <= 0) return;
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  chartInstances.push(
    new ChartCtor(ctx, {
      type: 'bar',
      data: {
        labels: dist.labels,
        datasets: [
          {
            label: datasetLabel,
            data: dist.data,
            backgroundColor: barColor,
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        ...baseChartOptions(),
        plugins: { ...baseChartOptions().plugins, legend: { display: false } },
        scales: {
          x: { ...barAxisStyle, beginAtZero: true, ticks: { ...barAxisStyle.ticks, precision: 0 } },
          y: { ...barAxisStyle, ticks: { ...barAxisStyle.ticks, font: { size: 10 } } },
        },
      },
    })
  );
}

/**
 * @param {import('chart.js').Chart} ChartCtor
 * @param {Array<Object>} list
 */
function renderSabhaBarChartIfSuperAdmin(ChartCtor, list) {
  renderSabhaMetricBarChartSuperAdmin(
    ChartCtor,
    buildSabhaDistribution(list),
    'statsChartSabha',
    'statsChartSabhaEmpty',
    'Homes',
    'rgba(34, 197, 94, 0.7)'
  );
}

/**
 * @param {import('chart.js').Chart} ChartCtor
 * @param {Array<Object>} list
 */
function renderSabhaMembersBarChartIfSuperAdmin(ChartCtor, list) {
  renderSabhaMetricBarChartSuperAdmin(
    ChartCtor,
    buildSabhaMemberPeopleDistribution(list),
    'statsChartSabhaMembers',
    'statsChartSabhaMembersEmpty',
    'Members',
    'rgba(99, 102, 241, 0.75)'
  );
}

/**
 * @param {import('chart.js').Chart} ChartCtor
 * @param {Array<Object>} list
 */
function renderOccupationHorizontalBar(ChartCtor, list) {
  const occ = buildOccupationDistribution(list);
  const occSum = occ.data.reduce((a, b) => a + b, 0);
  toggleChartEmpty('statsChartOccupation', 'statsChartOccupationEmpty', occSum > 0);
  const occHost = document.getElementById('statsOccupationChartHost');
  if (occHost) {
    occHost.style.height = occSum > 0 ? `${OCCUPATION_CHART_HEIGHT_PX}px` : '';
  }
  if (occSum <= 0) return;
  const ctx = document.getElementById('statsChartOccupation')?.getContext('2d');
  if (!ctx) return;
  const occBg =
    occ.data.length === OCCUPATION_BAR_COLORS.length
      ? [...OCCUPATION_BAR_COLORS]
      : occ.data.map((_, i) => OCCUPATION_BAR_COLORS[i % OCCUPATION_BAR_COLORS.length]);
  chartInstances.push(
    new ChartCtor(ctx, {
      type: 'bar',
      data: {
        labels: occ.labels,
        datasets: [
          {
            label: 'People',
            data: occ.data,
            backgroundColor: occBg,
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        ...baseChartOptions(),
        plugins: { ...baseChartOptions().plugins, legend: { display: false } },
        scales: {
          x: { ...barAxisStyle, beginAtZero: true, ticks: { ...barAxisStyle.ticks, precision: 0 } },
          y: {
            ...barAxisStyle,
            ticks: {
              ...barAxisStyle.ticks,
              autoSkip: false,
              font: { size: 9 },
            },
          },
        },
      },
    })
  );
}

/**
 * @param {import('chart.js').Chart} ChartCtor
 * @param {Array<Object>} list
 */
function renderMembershipHorizontalBar(ChartCtor, list) {
  const mem = buildMembershipDistribution(list);
  const memSum = mem.data.reduce((a, b) => a + b, 0);
  toggleChartEmpty('statsChartMembership', 'statsChartMembershipEmpty', memSum > 0);
  if (memSum <= 0) return;
  const ctx = document.getElementById('statsChartMembership')?.getContext('2d');
  if (!ctx) return;
  chartInstances.push(
    new ChartCtor(ctx, {
      type: 'bar',
      data: {
        labels: mem.labels,
        datasets: [
          {
            label: 'Count',
            data: mem.data,
            backgroundColor: 'rgba(129, 140, 248, 0.8)',
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        ...baseChartOptions(),
        plugins: { ...baseChartOptions().plugins, legend: { display: false } },
        scales: {
          x: { ...barAxisStyle, beginAtZero: true, ticks: { ...barAxisStyle.ticks, precision: 0 } },
          y: { ...barAxisStyle, ticks: { ...barAxisStyle.ticks, font: { size: 10 } } },
        },
      },
    })
  );
}

/**
 * @param {import('chart.js').Chart} ChartCtor
 * @param {Array<Object>} list
 */
function renderRationHorizontalBar(ChartCtor, list) {
  const ration = buildRationDistribution(list);
  const rationSum = ration.data.reduce((a, b) => a + b, 0);
  toggleChartEmpty('statsChartRation', 'statsChartRationEmpty', rationSum > 0);
  if (rationSum <= 0) return;
  const ctx = document.getElementById('statsChartRation')?.getContext('2d');
  if (!ctx) return;
  chartInstances.push(
    new ChartCtor(ctx, {
      type: 'bar',
      data: {
        labels: ration.labels,
        datasets: [
          {
            label: 'Households',
            data: ration.data,
            backgroundColor: ration.backgroundColor,
            borderColor: ration.borderColor,
            borderWidth: ration.borderWidth,
            borderRadius: 6,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        ...baseChartOptions(),
        plugins: { ...baseChartOptions().plugins, legend: { display: false } },
        scales: {
          x: { ...barAxisStyle, beginAtZero: true, ticks: { ...barAxisStyle.ticks, precision: 0 } },
          y: { ...barAxisStyle, ticks: { ...barAxisStyle.ticks, font: { size: 10 } } },
        },
      },
    })
  );
}

/**
 * @param {import('chart.js').Chart} ChartCtor
 * @param {Array<Object>} list
 */
function renderEducationHorizontalBar(ChartCtor, list) {
  const edu = buildEducationDistribution(list);
  const eduSum = edu.data.reduce((a, b) => a + b, 0);
  toggleChartEmpty('statsChartEducation', 'statsChartEducationEmpty', eduSum > 0);
  const eduHost = document.getElementById('statsEducationChartHost');
  if (eduHost) {
    eduHost.style.height = eduSum > 0 ? `${OCCUPATION_CHART_HEIGHT_PX}px` : '';
  }
  if (eduSum <= 0) return;
  const ctx = document.getElementById('statsChartEducation')?.getContext('2d');
  if (!ctx) return;
  const eduPalette = [
    'rgba(14, 165, 233, 0.82)',
    'rgba(99, 102, 241, 0.82)',
    'rgba(168, 85, 247, 0.82)',
    'rgba(236, 72, 153, 0.82)',
    'rgba(245, 158, 11, 0.82)',
    'rgba(34, 197, 94, 0.82)',
    'rgba(20, 184, 166, 0.82)',
    'rgba(201, 91, 20, 0.78)',
    'rgba(148, 163, 184, 0.78)',
    'rgba(120, 113, 108, 0.72)',
  ];
  const eduBg = edu.labels.map((_, i) => eduPalette[i % eduPalette.length]);
  chartInstances.push(
    new ChartCtor(ctx, {
      type: 'bar',
      data: {
        labels: edu.labels,
        datasets: [
          {
            label: 'People',
            data: edu.data,
            backgroundColor: eduBg,
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        ...baseChartOptions(),
        plugins: { ...baseChartOptions().plugins, legend: { display: false } },
        scales: {
          x: { ...barAxisStyle, beginAtZero: true, ticks: { ...barAxisStyle.ticks, precision: 0 } },
          y: {
            ...barAxisStyle,
            ticks: {
              ...barAxisStyle.ticks,
              autoSkip: false,
              font: { size: 9 },
            },
          },
        },
      },
    })
  );
}

/**
 * @param {import('chart.js').Chart} ChartCtor
 * @param {Array<Object>} list
 */
function renderBloodGroupHorizontalBar(ChartCtor, list) {
  const blood = buildBloodGroupDistribution(list);
  const bloodSum = blood.data.reduce((a, b) => a + b, 0);
  toggleChartEmpty('statsChartBloodGroup', 'statsChartBloodGroupEmpty', bloodSum > 0);
  const bloodHost = document.getElementById('statsBloodGroupChartHost');
  if (bloodHost) {
    bloodHost.style.height = bloodSum > 0 ? `${OCCUPATION_CHART_HEIGHT_PX}px` : '';
  }
  if (bloodSum <= 0) return;
  const ctx = document.getElementById('statsChartBloodGroup')?.getContext('2d');
  if (!ctx) return;
  chartInstances.push(
    new ChartCtor(ctx, {
      type: 'bar',
      data: {
        labels: blood.labels,
        datasets: [
          {
            label: 'People',
            data: blood.data,
            backgroundColor: blood.backgroundColor,
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        ...baseChartOptions(),
        plugins: { ...baseChartOptions().plugins, legend: { display: false } },
        scales: {
          x: { ...barAxisStyle, beginAtZero: true, ticks: { ...barAxisStyle.ticks, precision: 0 } },
          y: {
            ...barAxisStyle,
            ticks: {
              ...barAxisStyle.ticks,
              autoSkip: false,
              font: { size: 9 },
            },
          },
        },
      },
    })
  );
}

/**
 * @param {import('chart.js').Chart} ChartCtor
 * @param {Array<Object>} list
 */
function renderSabhaNonMembersHorizontalBar(ChartCtor, list) {
  const totals = buildSabhaNonMemberPeopleTotals(list);
  const sum = totals.data.reduce((a, b) => a + b, 0);
  toggleChartEmpty('statsChartNonMembersPs', 'statsChartNonMembersPsEmpty', sum > 0);
  const nRows = totals.labels.length;
  setStatsHorizontalChartHostHeight('statsNonMembersPsChartHost', nRows, sum > 0);
  if (sum <= 0) return;
  const ctx = document.getElementById('statsChartNonMembersPs')?.getContext('2d');
  if (!ctx) return;
  chartInstances.push(
    new ChartCtor(ctx, {
      type: 'bar',
      data: {
        labels: totals.labels,
        datasets: [
          {
            label: STATS_NON_MEMBERS_PS_DATASET_LABEL,
            data: totals.data,
            backgroundColor: STATS_CHART_NON_MEMBERS_BAR_BG,
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        ...baseChartOptions(),
        plugins: { ...baseChartOptions().plugins, legend: { display: false } },
        scales: {
          x: { ...barAxisStyle, beginAtZero: true, ticks: { ...barAxisStyle.ticks, precision: 0 } },
          y: { ...barAxisStyle, ticks: { ...barAxisStyle.ticks, font: { size: 10 } } },
        },
      },
    })
  );
}

/**
 * @param {import('chart.js').Chart} ChartCtor
 * @param {Array<Object>} list
 * @param {'healthInsurance'|'termLifeInsurance'} field
 * @param {string} canvasId
 * @param {string} emptyId
 * @param {string|null} hostId
 * @param {string} yesBackgroundColor
 * @param {string} noBackgroundColor
 */
function renderSabhaInsuranceStackedBar(
  ChartCtor,
  list,
  field,
  canvasId,
  emptyId,
  hostId,
  yesBackgroundColor,
  noBackgroundColor
) {
  const stack = buildSabhaHouseholdInsuranceStack(list, field);
  const total = stack.yesData.reduce((a, b) => a + b, 0) + stack.noData.reduce((a, b) => a + b, 0);
  toggleChartEmpty(canvasId, emptyId, total > 0);
  const nRows = stack.labels.length;
  setStatsHorizontalChartHostHeight(hostId, nRows, total > 0);
  if (total <= 0) return;
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  chartInstances.push(
    new ChartCtor(ctx, {
      type: 'bar',
      data: {
        labels: stack.labels,
        datasets: [
          {
            label: 'Yes',
            data: stack.yesData,
            backgroundColor: yesBackgroundColor,
            borderRadius: 4,
          },
          {
            label: 'No',
            data: stack.noData,
            backgroundColor: noBackgroundColor,
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        ...baseChartOptions(),
        plugins: { ...baseChartOptions().plugins, legend: { ...baseChartOptions().plugins.legend, position: 'bottom' } },
        scales: {
          x: {
            ...barAxisStyle,
            stacked: true,
            beginAtZero: true,
            ticks: { ...barAxisStyle.ticks, precision: 0 },
          },
          y: {
            ...barAxisStyle,
            stacked: true,
            ticks: { ...barAxisStyle.ticks, font: { size: 10 } },
          },
        },
      },
    })
  );
}

/**
 * Writes rolling-window summary numbers into the Statistics “Recent records” and “Recent members” tiles.
 *
 * @param {Array<Object>} list - RBAC-filtered member_details docs.
 */
function updateRecentRegistrationDom(list) {
  const recentRecords = buildRecentRecordCounts(list);
  const recentPeople = buildRecentPeopleCounts(list);
  for (const w of STATS_RECENT_REGISTRATION_TILES) {
    const suffix = w.days;
    setStatsRecentTileValue(`statsRecentRecords${suffix}`, recentRecords[w.countKey]);
    setStatsRecentTileValue(`statsRecentMembers${suffix}`, recentPeople[w.countKey]);
  }
}

/**
 * Sets the “Non-members by PS” statistics card title from role (super admin vs PS admin).
 */
function updateNonMembersPsCardTitleForRole() {
  const titleEl = document.getElementById('statsNonMembersPsCardTitle');
  if (!titleEl) return;
  const isSuper =
    typeof document !== 'undefined' && document.body.classList.contains('is-super-admin');
  titleEl.textContent = isSuper
    ? STATS_CARD_TITLE_NON_MEMBERS_PS_SUPER_ADMIN
    : STATS_CARD_TITLE_NON_MEMBERS_PS_SABHA_ADMIN;
}

/**
 * Maps `data-jilla-chart` to canvas id and render function (Jilla-wide demographics only).
 *
 * @type {Readonly<Record<string, { canvasId: string, render: (chartCtor: import('chart.js').Chart, list: Array<Object>) => void }>>}
 */
const JILLA_WIDE_CHART_BY_KIND = Object.freeze({
  age: { canvasId: 'statsChartAge', render: renderAgePieChart },
  gender: { canvasId: 'statsChartGender', render: renderGenderDoughnutChart },
  occupation: { canvasId: 'statsChartOccupation', render: renderOccupationHorizontalBar },
  education: { canvasId: 'statsChartEducation', render: renderEducationHorizontalBar },
  blood: { canvasId: 'statsChartBloodGroup', render: renderBloodGroupHorizontalBar },
  membership: { canvasId: 'statsChartMembership', render: renderMembershipHorizontalBar },
  ration: { canvasId: 'statsChartRation', render: renderRationHorizontalBar },
});

/**
 * Renders all statistics charts for RBAC-filtered member_details docs.
 * Destroys any previous Chart.js instances, mutates DOM under `#stats*`, and stores chart refs for {@link resizeAdminStatsCharts}.
 *
 * @param {Array<Object>} records - Already RBAC-filtered member_details docs.
 * @param {AdminStatsViewerContext} [viewer] - Role and raw sabha for Jilla-wide PS dropdown defaults.
 * @returns {void} No-op with a centralized `Logger.warn` if Chart.js is not on `window`.
 */
export function renderAdminStatsCharts(records, viewer = {}) {
  destroyAllChartsInternal();
  updateNonMembersPsCardTitleForRole();

  const ChartCtor = getChartConstructor();
  if (!ChartCtor) {
    Logger.warn('admin-dashboard-stats: Chart.js not loaded');
    return;
  }

  const list = Array.isArray(records) ? records : [];
  const viewerNorm = {
    superAdmin: Boolean(viewer?.superAdmin),
    userSabhaRaw: viewer?.userSabhaRaw ?? null,
  };
  jillaStatsRecordsRef = list;

  const defaultJillaKey = computeDefaultJillaSabhaKey(list, viewerNorm);
  const jillaFiltered = filterRecordsForJillaWideCharts(list, defaultJillaKey);

  const growthRecords = buildGrowthTrendRecords(list);
  const growthMembers = buildGrowthTrendMembers(list);

  updateGrowthNoteElement(growthRecords);

  renderGrowthRecordsChart(ChartCtor, growthRecords);
  renderGrowthMembersChart(ChartCtor, growthMembers);
  renderAgePieChart(ChartCtor, jillaFiltered);
  renderGenderDoughnutChart(ChartCtor, jillaFiltered);
  renderSabhaBarChartIfSuperAdmin(ChartCtor, list);
  renderSabhaMembersBarChartIfSuperAdmin(ChartCtor, list);
  renderOccupationHorizontalBar(ChartCtor, jillaFiltered);
  renderMembershipHorizontalBar(ChartCtor, jillaFiltered);
  renderRationHorizontalBar(ChartCtor, jillaFiltered);
  renderEducationHorizontalBar(ChartCtor, jillaFiltered);
  renderBloodGroupHorizontalBar(ChartCtor, jillaFiltered);
  renderSabhaNonMembersHorizontalBar(ChartCtor, list);
  renderSabhaInsuranceStackedBar(
    ChartCtor,
    list,
    'healthInsurance',
    'statsChartHealthInsurancePs',
    'statsChartHealthInsurancePsEmpty',
    'statsHealthInsurancePsChartHost',
    STATS_CHART_HEALTH_INSURANCE_YES_BG,
    STATS_CHART_HEALTH_INSURANCE_NO_BG
  );
  renderSabhaInsuranceStackedBar(
    ChartCtor,
    list,
    'termLifeInsurance',
    'statsChartTermInsurancePs',
    'statsChartTermInsurancePsEmpty',
    'statsTermInsurancePsChartHost',
    STATS_CHART_TERM_INSURANCE_YES_BG,
    STATS_CHART_TERM_INSURANCE_NO_BG
  );
  updateRecentRegistrationDom(list);

  populateAndBindJillaSabhaSelectors(ChartCtor, viewerNorm, defaultJillaKey);

  requestAnimationFrame(() => {
    chartInstances.forEach((chart) => {
      try {
        chart.resize();
      } catch {
        /* ignore */
      }
    });
  });
}

/**
 * Call after the Statistics panel becomes visible so Chart.js picks up layout width.
 *
 * @returns {void}
 */
export function resizeAdminStatsCharts() {
  chartInstances.forEach((chart) => {
    try {
      chart.resize();
    } catch {
      /* ignore */
    }
  });
}
