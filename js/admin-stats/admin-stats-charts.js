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
  buildOccupationDistribution,
  buildMembershipDistribution,
  buildRationDistribution,
  buildEducationDistribution,
  buildBloodGroupDistribution,
  buildRecentRecordCounts,
  buildRecentPeopleCounts,
} from './admin-stats-calculators.js';
import {
  barAxisStyle,
  OCCUPATION_BAR_COLORS,
  OCCUPATION_CHART_HEIGHT_PX,
  GROWTH_TREND_START_LABEL,
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
  opts.plugins.legend = { ...opts.plugins.legend, position: 'right' };
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
        plugins: {
          ...base.plugins,
          legend: { ...base.plugins.legend, position: 'right' },
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
  const showSabhaChart =
    typeof document !== 'undefined' && document.body.classList.contains('is-super-admin');
  if (!showSabhaChart) return;
  const sabha = buildSabhaDistribution(list);
  const sabhaSum = sabha.data.reduce((a, b) => a + b, 0);
  toggleChartEmpty('statsChartSabha', 'statsChartSabhaEmpty', sabhaSum > 0);
  if (sabhaSum <= 0) return;
  const ctx = document.getElementById('statsChartSabha')?.getContext('2d');
  if (!ctx) return;
  chartInstances.push(
    new ChartCtor(ctx, {
      type: 'bar',
      data: {
        labels: sabha.labels,
        datasets: [
          {
            label: 'Records',
            data: sabha.data,
            backgroundColor: 'rgba(34, 197, 94, 0.7)',
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
 * Writes rolling-window summary numbers into the statistics panel DOM.
 * @param {Array<Object>} list
 */
function updateRecentRegistrationDom(list) {
  const recentRecords = buildRecentRecordCounts(list);
  const recentPeople = buildRecentPeopleCounts(list);
  const r7 = document.getElementById('statsRecentRecords7');
  const r30 = document.getElementById('statsRecentRecords30');
  const m7 = document.getElementById('statsRecentMembers7');
  const m30 = document.getElementById('statsRecentMembers30');
  if (r7) r7.textContent = String(recentRecords.last7);
  if (r30) r30.textContent = String(recentRecords.last30);
  if (m7) m7.textContent = String(recentPeople.last7);
  if (m30) m30.textContent = String(recentPeople.last30);
}

/**
 * Renders all statistics charts for RBAC-filtered member_details docs.
 *
 * @param {Array<Object>} records - Already RBAC-filtered member_details docs.
 */
export function renderAdminStatsCharts(records) {
  destroyAllChartsInternal();

  const ChartCtor = getChartConstructor();
  if (!ChartCtor) {
    Logger.warn('admin-dashboard-stats: Chart.js not loaded');
    return;
  }

  const list = Array.isArray(records) ? records : [];
  const growthRecords = buildGrowthTrendRecords(list);
  const growthMembers = buildGrowthTrendMembers(list);

  updateGrowthNoteElement(growthRecords);

  renderGrowthRecordsChart(ChartCtor, growthRecords);
  renderGrowthMembersChart(ChartCtor, growthMembers);
  renderAgePieChart(ChartCtor, list);
  renderGenderDoughnutChart(ChartCtor, list);
  renderSabhaBarChartIfSuperAdmin(ChartCtor, list);
  renderOccupationHorizontalBar(ChartCtor, list);
  renderMembershipHorizontalBar(ChartCtor, list);
  renderRationHorizontalBar(ChartCtor, list);
  renderEducationHorizontalBar(ChartCtor, list);
  renderBloodGroupHorizontalBar(ChartCtor, list);
  updateRecentRegistrationDom(list);

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
