/**
 * @fileoverview Pure aggregation helpers for admin statistics (no DOM, no Chart.js).
 * @module admin-stats/admin-stats-calculators
 */

import {
  PRADESHIKA_SABHA_OPTIONS,
  MEMBERSHIP_OPTIONS,
  EDUCATION_OPTIONS,
  RATION_CARD_OPTIONS,
  BLOOD_GROUP_OPTIONS,
} from '../constants/constants.js';
import {
  OCCUPATION_LABELS,
  STATS_OCCUPATION_KEYS,
  LEGACY_OCCUPATION_KEYS,
  MEMBERSHIP_LABELS,
  RATION_LABELS,
  RATION_KEY_COLORS,
  EDUCATION_LABELS,
  GROWTH_TREND_START,
  MS_WEEK,
  MS_DAY,
  BLOOD_BAR_COLORS,
} from './admin-stats-constants.js';

const SABHA_KEYS = Object.keys(PRADESHIKA_SABHA_OPTIONS);

/**
 * Resolves a stored occupation to a canonical STATS_OCCUPATION_KEYS entry,
 * or sentinel tokens for chart buckets.
 * @param {unknown} occ
 * @param {string[]} known
 * @returns {'__empty__'|'__unknown__'|string}
 */
export function resolveOccupationKey(occ, known) {
  if (occ == null || typeof occ !== 'string') return '__empty__';
  const raw = occ.trim();
  if (!raw) return '__empty__';

  const legacy = LEGACY_OCCUPATION_KEYS[raw] || LEGACY_OCCUPATION_KEYS[raw.toLowerCase()];
  if (legacy) return legacy;

  if (known.includes(raw)) return raw;
  const ci = known.find((k) => k.toLowerCase() === raw.toLowerCase());
  if (ci) return ci;

  const snake = raw.toLowerCase().replace(/[\s-]+/g, '_');
  if (known.includes(snake)) return snake;
  const legacySnake = LEGACY_OCCUPATION_KEYS[snake];
  if (legacySnake) return legacySnake;

  const rl = raw.toLowerCase().replace(/_/g, ' ');
  for (const k of known) {
    const lab = (OCCUPATION_LABELS[k] || '').toLowerCase();
    if (lab && lab === rl) return k;
  }

  return '__unknown__';
}

/**
 * @param {*} val - Firestore Timestamp-like, Date, or ISO string.
 * @returns {Date|null}
 */
export function toTimestampDate(val) {
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
export function ageFromDob(dobStr) {
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
export function ageBucket(age) {
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
export function normalizeGender(g) {
  if (!g || typeof g !== 'string') return 'Unknown';
  const x = g.trim().toLowerCase();
  if (x === 'male' || x === 'm') return 'Male';
  if (x === 'female' || x === 'f') return 'Female';
  if (x === 'other') return 'Other';
  return 'Unknown';
}

/**
 * @param {Date} start
 * @param {Date} end Inclusive calendar end day of the bucket (same week).
 */
export function formatWeekRangeLabel(start, end) {
  const sameMonthYear =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const mo = (d) => d.toLocaleString('en', { month: 'short' });
  if (sameMonthYear) {
    return `${mo(start)} ${start.getDate()}–${end.getDate()}`;
  }
  return `${mo(start)} ${start.getDate()}–${mo(end)} ${end.getDate()}`;
}

/**
 * Contiguous 7-day buckets from GROWTH_TREND_START through the week that contains "now".
 * @returns {{ labels: string[], nWeeks: number }}
 */
export function buildGrowthWeekAxis() {
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
 * New household registrations per week from growth anchor (one count per member_details doc per bucket).
 * @param {Array<Object>} records
 * @returns {{ labels: string[], data: number[], excludedNoDate: number, excludedBeforeRange: number }}
 */
export function buildGrowthTrendRecords(records) {
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
 * People registered per week: owner + members + non-members, by doc createdAt.
 * @param {Array<Object>} records
 * @returns {{ labels: string[], data: number[], excludedNoDate: number, excludedBeforeRange: number }}
 */
export function buildGrowthTrendMembers(records) {
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
export function buildAgeDistribution(records) {
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
export function collectGenders(records) {
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
export function buildSabhaDistribution(records) {
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
 * @param {{ n: number }} unspecifiedRef
 * @param {{ n: number }} otherRef
 */
function bumpOccupationBucket(occ, known, counts, unspecifiedRef, otherRef) {
  const key = resolveOccupationKey(occ, known);
  if (key === '__empty__') {
    unspecifiedRef.n += 1;
    return;
  }
  if (key === '__unknown__') {
    otherRef.n += 1;
    return;
  }
  counts[key] += 1;
}

/**
 * Occupation for house owner, members, and non-members.
 * @param {Array<Object>} records
 */
export function buildOccupationDistribution(records) {
  const known = [...STATS_OCCUPATION_KEYS];
  const counts = Object.fromEntries(known.map((k) => [k, 0]));
  const unspecifiedRef = { n: 0 };
  const otherRef = { n: 0 };

  records.forEach((r) => {
    const pd = r.personalDetails || {};
    bumpOccupationBucket(pd.occupation, known, counts, unspecifiedRef, otherRef);
    (r.members || []).forEach((m) => bumpOccupationBucket(m.occupation, known, counts, unspecifiedRef, otherRef));
    (r.nonMembers || []).forEach((nm) =>
      bumpOccupationBucket(nm.occupation, known, counts, unspecifiedRef, otherRef)
    );
  });

  const unspecified = unspecifiedRef.n;
  const other = otherRef.n;

  const pairs = known.map((k) => ({ k, n: counts[k] }));
  pairs.push({ k: '__not_specified__', n: unspecified });
  pairs.push({ k: '__other__', n: other });

  const labels = pairs.map((p) => {
    if (p.k === '__other__') return 'Other (unrecognized code)';
    if (p.k === '__not_specified__') return 'Not specified';
    return OCCUPATION_LABELS[p.k] || p.k;
  });
  const data = pairs.map((p) => p.n);

  return { labels, data };
}

/**
 * Owner + members with membershipType.
 * @param {Array<Object>} records
 */
export function buildMembershipDistribution(records) {
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
export function buildRationDistribution(records) {
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
  const borderColor = pairs.map((p) => (p.k === 'white' ? 'rgba(100, 116, 139, 0.45)' : 'transparent'));
  const borderWidth = pairs.map((p) => (p.k === 'white' ? 1.5 : 0));
  return { labels, data, backgroundColor, borderColor, borderWidth };
}

/**
 * Highest education across house owner, members, and non-members.
 * @param {Array<Object>} records
 */
export function buildEducationDistribution(records) {
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

/**
 * Blood group across house owner, members, and non-members.
 * @param {Array<Object>} records
 */
export function buildBloodGroupDistribution(records) {
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
export function buildRecentRecordCounts(records) {
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
 * Rolling windows: total people in records whose metadata.createdAt falls in each window.
 * @param {Array<Object>} records
 */
export function buildRecentPeopleCounts(records) {
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
