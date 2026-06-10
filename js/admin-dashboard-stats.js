/**
 * @fileoverview Admin dashboard Statistics panel — aggregates member records and renders Chart.js.
 * @module admin-dashboard-stats
 */

import {
  PRADESHIKA_SABHA_OPTIONS,
  MEMBER_OCCUPATION_OPTIONS,
  MEMBERSHIP_OPTIONS,
  EDUCATION_OPTIONS,
  RATION_CARD_OPTIONS,
  BLOOD_GROUP_OPTIONS,
} from './constants.js';

/** @type {import('chart.js').Chart[]} */
let chartInstances = [];

/** English labels for stored occupation keys (constants i18n keys may not match en.js). */
const OCCUPATION_LABELS = Object.freeze({
  govt: 'Government',
  private: 'Private',
  business: 'Business',
  kazhakam: 'Kazhakam',
  retired: 'Retired',
  unemployed: 'Unemployed',
  student: 'Student',
});

const MEMBERSHIP_LABELS = Object.freeze({
  life_member: 'Life member',
  ordinary_member: 'Ordinary member',
});

/** English labels for ration card keys (matches en.js). */
const RATION_LABELS = Object.freeze({
  none: 'No ration card',
  white: 'White',
  yellow: 'Yellow',
  blue: 'Blue',
  pink: 'Pink',
});

/** Bar colors aligned to ration types (household-level chart). */
const RATION_KEY_COLORS = Object.freeze({
  none: 'rgba(148, 163, 184, 0.88)',
  white: 'rgba(226, 232, 240, 0.98)',
  yellow: 'rgba(250, 204, 21, 0.9)',
  blue: 'rgba(59, 130, 246, 0.88)',
  pink: 'rgba(244, 114, 182, 0.88)',
});

/** English labels for education keys (matches en.js). */
const EDUCATION_LABELS = Object.freeze({
  below_10th: 'Below 10th',
  '10th': '10th',
  plus_two: 'Plus Two',
  diploma: 'Diploma',
  bachelors: "Bachelor's degree",
  masters: "Master's degree",
  doctorate: 'Doctorate',
  professional: 'Professional',
  other: 'Other',
});

const SABHA_KEYS = Object.keys(PRADESHIKA_SABHA_OPTIONS);

/**
 * @param {*} val - Firestore Timestamp-like, Date, or ISO string.
 * @returns {Date|null}
 */
function toTimestampDate(val) {
  if (!val) return null;
  if (typeof val.toDate === 'function') {
    try {
      const d = val.toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d : null;
    } catch {
      return null;
    }
  }
  if (val instanceof Date) return !isNaN(val.getTime()) ? val : null;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return !isNaN(d.getTime()) ? d : null;
  }
  return null;
}

/**
 * @param {string} dobStr - YYYY-MM-DD
 * @returns {number|null} Age in full years.
 */
function ageFromDob(dobStr) {
  if (!dobStr || typeof dobStr !== 'string') return null;
  const parts = dobStr.trim().split('-');
  if (parts.length < 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(day)) return null;
  const birth = new Date(y, m, day);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const md = today.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

/**
 * @param {number} age
 * @returns {string}
 */
function ageBucket(age) {
  if (age == null || age < 0) return 'Unknown';
  if (age <= 18) return '0–18';
  if (age <= 30) return '19–30';
  if (age <= 45) return '31–45';
  if (age <= 60) return '46–60';
  return '60+';
}

/**
 * @param {string} g
 * @returns {string}
 */
function normalizeGender(g) {
  if (!g || typeof g !== 'string') return 'Unknown';
  const x = g.trim().toLowerCase();
  if (x === 'male' || x === 'm') return 'Male';
  if (x === 'female' || x === 'f') return 'Female';
  if (x === 'other') return 'Other';
  return 'Unknown';
}

/** First instant included in growth charts (local) — April 1, 2026. */
const GROWTH_TREND_START = new Date(2026, 3, 1);

const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
const MS_DAY = 24 * 60 * 60 * 1000;

/**
 * @param {Date} start
 * @param {Date} end Inclusive calendar end day of the bucket (same week).
 */
function formatWeekRangeLabel(start, end) {
  const sameMonthYear =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const mo = (d) => d.toLocaleString('en', { month: 'short' });
  if (sameMonthYear) {
    return `${mo(start)} ${start.getDate()}–${end.getDate()}`;
  }
  return `${mo(start)} ${start.getDate()}–${mo(end)} ${end.getDate()}`;
}

/**
 * Contiguous 7-day buckets from {@link GROWTH_TREND_START} through the week that contains "now".
 * @returns {{ labels: string[], nWeeks: number }}
 */
function buildGrowthWeekAxis() {
  const now = new Date();
  const anchorMs = GROWTH_TREND_START.getTime();
  const nowMs = now.getTime();

  if (nowMs < anchorMs) {
    return { labels: [], nWeeks: 0 };
  }

  const idxNow = Math.floor((nowMs - anchorMs) / MS_WEEK);
  const nWeeks = idxNow + 1;
  const labels = [];

  for (let i = 0; i < nWeeks; i++) {
    const start = new Date(anchorMs + i * MS_WEEK);
    const end = new Date(anchorMs + (i + 1) * MS_WEEK - MS_DAY);
    labels.push(formatWeekRangeLabel(start, end));
  }

  return { labels, nWeeks };
}

/**
 * New household registrations per week from Apr 2026 (one count per member_details doc per bucket).
 * @param {Array<Object>} records
 * @returns {{ labels: string[], data: number[], excludedNoDate: number, excludedBeforeRange: number }}
 */
function buildGrowthTrendRecords(records) {
  const { labels, nWeeks } = buildGrowthWeekAxis();
  if (nWeeks === 0) {
    return { labels: [], data: [], excludedNoDate: 0, excludedBeforeRange: 0 };
  }

  const counts = Array.from({ length: nWeeks }, () => 0);
  let excludedNoDate = 0;
  let excludedBeforeRange = 0;
  const anchorMs = GROWTH_TREND_START.getTime();

  records.forEach((r) => {
    const date = toTimestampDate(r.metadata?.createdAt);
    if (!date) {
      excludedNoDate++;
      return;
    }
    const t = date.getTime();
    if (t < anchorMs) {
      excludedBeforeRange++;
      return;
    }
    const idx = Math.floor((t - anchorMs) / MS_WEEK);
    if (idx >= 0 && idx < nWeeks) counts[idx] += 1;
    else if (idx >= nWeeks) counts[nWeeks - 1] += 1;
  });

  return { labels, data: counts, excludedNoDate, excludedBeforeRange };
}

/**
 * People registered per week from Apr 2026: owner + members + non-members, by doc createdAt.
 * @param {Array<Object>} records
 * @returns {{ labels: string[], data: number[], excludedNoDate: number, excludedBeforeRange: number }}
 */
function buildGrowthTrendMembers(records) {
  const { labels, nWeeks } = buildGrowthWeekAxis();
  if (nWeeks === 0) {
    return { labels: [], data: [], excludedNoDate: 0, excludedBeforeRange: 0 };
  }

  const counts = Array.from({ length: nWeeks }, () => 0);
  let excludedNoDate = 0;
  let excludedBeforeRange = 0;
  const anchorMs = GROWTH_TREND_START.getTime();

  records.forEach((r) => {
    const date = toTimestampDate(r.metadata?.createdAt);
    if (!date) {
      excludedNoDate++;
      return;
    }
    const t = date.getTime();
    if (t < anchorMs) {
      excludedBeforeRange++;
      return;
    }
    const idx = Math.floor((t - anchorMs) / MS_WEEK);
    const n = 1 + (r.members || []).length + (r.nonMembers || []).length;
    if (idx >= 0 && idx < nWeeks) counts[idx] += n;
    else if (idx >= nWeeks) counts[nWeeks - 1] += n;
  });

  return { labels, data: counts, excludedNoDate, excludedBeforeRange };
}

/**
 * Age buckets from DOB for house owner, members, and non-members.
 * @param {Array<Object>} records
 * @returns {{ labels: string[], data: number[] }}
 */
function buildAgeDistribution(records) {
  const buckets = ['0–18', '19–30', '31–45', '46–60', '60+', 'Unknown'];
  const counts = Object.fromEntries(buckets.map((b) => [b, 0]));

  /** @param {string|undefined} dobStr */
  function bumpFromDob(dobStr) {
    const age = ageFromDob(dobStr);
    const b = age == null ? 'Unknown' : ageBucket(age);
    counts[b] = (counts[b] || 0) + 1;
  }

  records.forEach((r) => {
    const pd = r.personalDetails || {};
    bumpFromDob(pd.dob);
    (r.members || []).forEach((m) => bumpFromDob(m.dob));
    (r.nonMembers || []).forEach((nm) => bumpFromDob(nm.dob));
  });

  return {
    labels: buckets,
    data: buckets.map((b) => counts[b] || 0),
  };
}

/**
 * @param {Array<Object>} records
 */
function collectGenders(records) {
  const counts = { Male: 0, Female: 0, Other: 0, Unknown: 0 };

  records.forEach((r) => {
    const pd = r.personalDetails || {};
    counts[normalizeGender(pd.gender)] += 1;
    (r.members || []).forEach((m) => {
      counts[normalizeGender(m.gender)] += 1;
    });
    (r.nonMembers || []).forEach((nm) => {
      counts[normalizeGender(nm.gender)] += 1;
    });
  });

  const labels = ['Male', 'Female', 'Other', 'Unknown'];
  return { labels, data: labels.map((l) => counts[l]) };
}

/**
 * @param {Array<Object>} records
 */
function buildSabhaDistribution(records) {
  const counts = Object.fromEntries(SABHA_KEYS.map((k) => [k, 0]));
  let other = 0;

  records.forEach((r) => {
    const sabha = (r.personalDetails || {}).pradeshikaSabha;
    if (!sabha || typeof sabha !== 'string') {
      other += 1;
      return;
    }
    const trimmed = sabha.trim();
    const match = SABHA_KEYS.find((k) => k.toLowerCase() === trimmed.toLowerCase());
    if (match) counts[match] += 1;
    else other += 1;
  });

  const labels = [...SABHA_KEYS];
  const data = labels.map((k) => counts[k]);
  if (other > 0) {
    labels.push('Other');
    data.push(other);
  }
  return { labels, data };
}

/**
 * @param {string|undefined} occ
 * @param {string[]} known
 * @param {Record<string, number>} counts
 * @param {{ n: number }} otherRef
 */
function bumpOccupationBucket(occ, known, counts, otherRef) {
  if (!occ || typeof occ !== 'string') {
    otherRef.n += 1;
    return;
  }
  const key = occ.trim();
  if (known.includes(key)) counts[key] += 1;
  else otherRef.n += 1;
}

/**
 * Occupation for house owner, members, and non-members.
 * @param {Array<Object>} records
 */
function buildOccupationDistribution(records) {
  const known = Object.keys(MEMBER_OCCUPATION_OPTIONS);
  const counts = Object.fromEntries(known.map((k) => [k, 0]));
  const otherRef = { n: 0 };

  records.forEach((r) => {
    const pd = r.personalDetails || {};
    bumpOccupationBucket(pd.occupation, known, counts, otherRef);
    (r.members || []).forEach((m) => bumpOccupationBucket(m.occupation, known, counts, otherRef));
    (r.nonMembers || []).forEach((nm) => bumpOccupationBucket(nm.occupation, known, counts, otherRef));
  });

  const other = otherRef.n;

  const pairs = known
    .map((k) => ({ k, n: counts[k] }))
    .filter((p) => p.n > 0)
    .sort((a, b) => b.n - a.n);
  if (other > 0) pairs.push({ k: '__other__', n: other });

  const labels = pairs.map((p) =>
    p.k === '__other__' ? 'Other' : OCCUPATION_LABELS[p.k] || p.k
  );
  const data = pairs.map((p) => p.n);
  return { labels, data };
}

/**
 * Owner + members with membershipType.
 * @param {Array<Object>} records
 */
function buildMembershipDistribution(records) {
  const keys = Object.keys(MEMBERSHIP_OPTIONS);
  const counts = Object.fromEntries(keys.map((k) => [k, 0]));
  let other = 0;

  records.forEach((r) => {
    const pd = r.personalDetails || {};
    const t = pd.membershipType;
    if (t && keys.includes(t)) counts[t] += 1;
    else if (t) other += 1;

    (r.members || []).forEach((m) => {
      const mt = m.membershipType;
      if (mt && keys.includes(mt)) counts[mt] += 1;
      else if (mt) other += 1;
    });
  });

  const labels = keys.map((k) => MEMBERSHIP_LABELS[k] || k);
  const data = keys.map((k) => counts[k]);
  if (other > 0) {
    labels.push('Other');
    data.push(other);
  }
  return { labels, data };
}

/**
 * House owner ration card type only (one value per household record).
 * @param {Array<Object>} records
 */
function buildRationDistribution(records) {
  const known = Object.keys(RATION_CARD_OPTIONS);
  const counts = Object.fromEntries(known.map((k) => [k, 0]));
  let other = 0;

  records.forEach((r) => {
    const raw = (r.personalDetails || {}).rationCardType;
    if (!raw || typeof raw !== 'string') {
      other += 1;
      return;
    }
    const key = raw.trim();
    if (known.includes(key)) counts[key] += 1;
    else other += 1;
  });

  const pairs = known
    .map((k) => ({ k, n: counts[k] }))
    .filter((p) => p.n > 0)
    .sort((a, b) => b.n - a.n);
  if (other > 0) pairs.push({ k: '__other__', n: other });

  const labels = pairs.map((p) =>
    p.k === '__other__' ? 'Other / unset' : RATION_LABELS[p.k] || p.k
  );
  const data = pairs.map((p) => p.n);
  const backgroundColor = pairs.map((p) => {
    if (p.k === '__other__') return 'rgba(120, 113, 108, 0.78)';
    const base = RATION_KEY_COLORS[p.k] || 'rgba(201, 91, 20, 0.75)';
    return base;
  });
  const borderColor = pairs.map((p) =>
    p.k === 'white' ? 'rgba(100, 116, 139, 0.45)' : 'transparent'
  );
  const borderWidth = pairs.map((p) => (p.k === 'white' ? 1.5 : 0));
  return { labels, data, backgroundColor, borderColor, borderWidth };
}

/**
 * Highest education across house owner, members, and non-members.
 * @param {Array<Object>} records
 */
function buildEducationDistribution(records) {
  const known = Object.keys(EDUCATION_OPTIONS);
  const counts = Object.fromEntries(known.map((k) => [k, 0]));
  let other = 0;
  let notSpecified = 0;

  /** @param {string|undefined} raw */
  function bump(raw) {
    if (!raw || typeof raw !== 'string' || !raw.trim()) {
      notSpecified += 1;
      return;
    }
    const key = raw.trim();
    if (known.includes(key)) counts[key] += 1;
    else other += 1;
  }

  records.forEach((r) => {
    const pd = r.personalDetails || {};
    bump(pd.highestEducation);
    (r.members || []).forEach((m) => bump(m.highestEducation));
    (r.nonMembers || []).forEach((nm) => bump(nm.highestEducation));
  });

  const pairs = known
    .map((k) => ({ k, n: counts[k] }))
    .filter((p) => p.n > 0)
    .sort((a, b) => b.n - a.n);
  if (other > 0) pairs.push({ k: '__other__', n: other });
  if (notSpecified > 0) pairs.push({ k: '__unspecified__', n: notSpecified });

  const labels = pairs.map((p) => {
    if (p.k === '__other__') return 'Other (invalid key)';
    if (p.k === '__unspecified__') return 'Not specified';
    return EDUCATION_LABELS[p.k] || p.k;
  });
  const data = pairs.map((p) => p.n);
  return { labels, data };
}

/** Distinct bar colors per ABO/Rh group (stats panel only). */
const BLOOD_BAR_COLORS = Object.freeze({
  'A+': 'rgba(220, 38, 38, 0.9)',
  'A-': 'rgba(185, 28, 28, 0.88)',
  'B+': 'rgba(37, 99, 235, 0.88)',
  'B-': 'rgba(29, 78, 216, 0.88)',
  'AB+': 'rgba(147, 51, 234, 0.86)',
  'AB-': 'rgba(126, 34, 206, 0.85)',
  'O+': 'rgba(22, 163, 74, 0.88)',
  'O-': 'rgba(21, 128, 61, 0.88)',
});

/**
 * Blood group across house owner, members, and non-members.
 * @param {Array<Object>} records
 */
function buildBloodGroupDistribution(records) {
  const known = Object.keys(BLOOD_GROUP_OPTIONS);
  const counts = Object.fromEntries(known.map((k) => [k, 0]));
  let other = 0;
  let notSpecified = 0;

  /** @param {string|undefined} raw */
  function bump(raw) {
    if (!raw || typeof raw !== 'string' || !raw.trim()) {
      notSpecified += 1;
      return;
    }
    const key = raw.trim();
    if (known.includes(key)) counts[key] += 1;
    else other += 1;
  }

  records.forEach((r) => {
    const pd = r.personalDetails || {};
    bump(pd.bloodGroup);
    (r.members || []).forEach((m) => bump(m.bloodGroup));
    (r.nonMembers || []).forEach((nm) => bump(nm.bloodGroup));
  });

  const pairs = known
    .map((k) => ({ k, n: counts[k] }))
    .filter((p) => p.n > 0)
    .sort((a, b) => b.n - a.n);
  if (other > 0) pairs.push({ k: '__other__', n: other });
  if (notSpecified > 0) pairs.push({ k: '__unspecified__', n: notSpecified });

  const labels = pairs.map((p) => {
    if (p.k === '__other__') return 'Other (invalid)';
    if (p.k === '__unspecified__') return 'Not specified';
    return p.k;
  });
  const data = pairs.map((p) => p.n);
  const backgroundColor = pairs.map((p) => {
    if (p.k === '__other__') return 'rgba(120, 113, 108, 0.72)';
    if (p.k === '__unspecified__') return 'rgba(148, 163, 184, 0.78)';
    return BLOOD_BAR_COLORS[p.k] || 'rgba(201, 91, 20, 0.8)';
  });
  return { labels, data, backgroundColor };
}

/**
 * Rolling windows: count of member_details documents from metadata.createdAt.
 * @param {Array<Object>} records
 */
function buildRecentRecordCounts(records) {
  const now = Date.now();
  const day7 = now - 7 * 24 * 60 * 60 * 1000;
  const day30 = now - 30 * 24 * 60 * 60 * 1000;
  let c7 = 0;
  let c30 = 0;

  records.forEach((r) => {
    const d = toTimestampDate(r.metadata?.createdAt);
    if (!d) return;
    const t = d.getTime();
    if (t >= day7) c7 += 1;
    if (t >= day30) c30 += 1;
  });

  return { last7: c7, last30: c30 };
}

/**
 * Rolling windows: total people (house owner + members + non-members) in records
 * whose metadata.createdAt falls in each window.
 * @param {Array<Object>} records
 */
function buildRecentPeopleCounts(records) {
  const now = Date.now();
  const day7 = now - 7 * 24 * 60 * 60 * 1000;
  const day30 = now - 30 * 24 * 60 * 60 * 1000;
  let c7 = 0;
  let c30 = 0;

  records.forEach((r) => {
    const d = toTimestampDate(r.metadata?.createdAt);
    if (!d) return;
    const t = d.getTime();
    const n = 1 + (r.members || []).length + (r.nonMembers || []).length;
    if (t >= day7) c7 += n;
    if (t >= day30) c30 += n;
  });

  return { last7: c7, last30: c30 };
}

function destroyAllCharts() {
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

const barAxisStyle = {
  ticks: { color: '#6b5344', font: { size: 11 } },
  grid: { color: 'rgba(158, 63, 8, 0.1)' },
};

/**
 * @param {Array<Object>} records - Already RBAC-filtered member_details docs.
 */
export function renderAdminStatsCharts(records) {
  destroyAllCharts();

  const ChartCtor = typeof Chart !== 'undefined' ? Chart : null;
  if (!ChartCtor) {
    console.warn('admin-dashboard-stats: Chart.js not loaded');
    return;
  }

  const list = Array.isArray(records) ? records : [];

  const growthRecords = buildGrowthTrendRecords(list);
  const growthMembers = buildGrowthTrendMembers(list);
  const growthNote = document.getElementById('statsGrowthNote');
  if (growthNote) {
    const parts = [];
    if (growthRecords.excludedNoDate > 0) {
      parts.push(
        `${growthRecords.excludedNoDate} record(s) without registration date are excluded from both trends.`
      );
    }
    if (growthRecords.excludedBeforeRange > 0) {
      parts.push(
        `${growthRecords.excludedBeforeRange} record(s) registered before Apr 2026 are excluded from both trends.`
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
  const growthRecordsSum = growthRecords.data.reduce((a, b) => a + b, 0);
  const growthMembersSum = growthMembers.data.reduce((a, b) => a + b, 0);
  toggleChartEmpty('statsChartGrowth', 'statsChartGrowthEmpty', growthRecordsSum > 0);
  toggleChartEmpty('statsChartGrowthMembers', 'statsChartGrowthMembersEmpty', growthMembersSum > 0);

  const growthBarOptions = {
    ...baseChartOptions(),
    plugins: {
      ...baseChartOptions().plugins,
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

  if (growthRecordsSum > 0) {
    const ctx = document.getElementById('statsChartGrowth')?.getContext('2d');
    if (ctx) {
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
          options: growthBarOptions,
        })
      );
    }
  }

  if (growthMembersSum > 0) {
    const ctxM = document.getElementById('statsChartGrowthMembers')?.getContext('2d');
    if (ctxM) {
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
          options: growthBarOptions,
        })
      );
    }
  }

  const age = buildAgeDistribution(list);
  const ageTotal = age.data.reduce((a, b) => a + b, 0);
  toggleChartEmpty('statsChartAge', 'statsChartAgeEmpty', ageTotal > 0);
  if (ageTotal > 0) {
    const ctx = document.getElementById('statsChartAge')?.getContext('2d');
    if (ctx) {
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
  }

  const gender = collectGenders(list);
  const genderSum = gender.data.reduce((a, b) => a + b, 0);
  const genderHas = genderSum > 0;
  toggleChartEmpty('statsChartGender', 'statsChartGenderEmpty', genderHas);
  if (genderHas) {
    const ctx = document.getElementById('statsChartGender')?.getContext('2d');
    if (ctx) {
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
  }

  const showSabhaChart =
    typeof document !== 'undefined' && document.body.classList.contains('is-super-admin');
  if (showSabhaChart) {
    const sabha = buildSabhaDistribution(list);
    const sabhaSum = sabha.data.reduce((a, b) => a + b, 0);
    toggleChartEmpty('statsChartSabha', 'statsChartSabhaEmpty', sabhaSum > 0);
    if (sabhaSum > 0) {
      const ctx = document.getElementById('statsChartSabha')?.getContext('2d');
      if (ctx) {
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
    }
  }

  const occ = buildOccupationDistribution(list);
  const occSum = occ.data.reduce((a, b) => a + b, 0);
  toggleChartEmpty('statsChartOccupation', 'statsChartOccupationEmpty', occSum > 0);
  if (occSum > 0) {
    const ctx = document.getElementById('statsChartOccupation')?.getContext('2d');
    if (ctx) {
      chartInstances.push(
        new ChartCtor(ctx, {
          type: 'bar',
          data: {
            labels: occ.labels,
            datasets: [
              {
                label: 'People',
                data: occ.data,
                backgroundColor: 'rgba(234, 179, 8, 0.75)',
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
  }

  const mem = buildMembershipDistribution(list);
  const memSum = mem.data.reduce((a, b) => a + b, 0);
  toggleChartEmpty('statsChartMembership', 'statsChartMembershipEmpty', memSum > 0);
  if (memSum > 0) {
    const ctx = document.getElementById('statsChartMembership')?.getContext('2d');
    if (ctx) {
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
  }

  const ration = buildRationDistribution(list);
  const rationSum = ration.data.reduce((a, b) => a + b, 0);
  toggleChartEmpty('statsChartRation', 'statsChartRationEmpty', rationSum > 0);
  if (rationSum > 0) {
    const ctx = document.getElementById('statsChartRation')?.getContext('2d');
    if (ctx) {
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
  }

  const edu = buildEducationDistribution(list);
  const eduSum = edu.data.reduce((a, b) => a + b, 0);
  toggleChartEmpty('statsChartEducation', 'statsChartEducationEmpty', eduSum > 0);
  if (eduSum > 0) {
    const ctx = document.getElementById('statsChartEducation')?.getContext('2d');
    if (ctx) {
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
              y: { ...barAxisStyle, ticks: { ...barAxisStyle.ticks, font: { size: 10 } } },
            },
          },
        })
      );
    }
  }

  const blood = buildBloodGroupDistribution(list);
  const bloodSum = blood.data.reduce((a, b) => a + b, 0);
  toggleChartEmpty('statsChartBloodGroup', 'statsChartBloodGroupEmpty', bloodSum > 0);
  if (bloodSum > 0) {
    const ctx = document.getElementById('statsChartBloodGroup')?.getContext('2d');
    if (ctx) {
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
              y: { ...barAxisStyle, ticks: { ...barAxisStyle.ticks, font: { size: 10 } } },
            },
          },
        })
      );
    }
  }

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
 * Call after the Statistics panel becomes visible (e.g. tab switch) so Chart.js picks up layout width.
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

/**
 * Filters records the same way as member management dashboard for non–super-admins.
 * @param {Array<Object>} records
 * @param {boolean} superAdmin
 * @param {string|null} userSabha
 * @returns {Array<Object>}
 */
export function filterRecordsForAdminStats(records, superAdmin, userSabha) {
  if (superAdmin) return records;
  const sabha = (userSabha || '').trim().toLowerCase();
  if (!sabha) return [];
  return records.filter((r) => {
    const ps = ((r.personalDetails || {}).pradeshikaSabha || '').toLowerCase();
    return ps === sabha;
  });
}
