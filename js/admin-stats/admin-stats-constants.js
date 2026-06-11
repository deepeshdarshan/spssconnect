/**
 * @fileoverview Labels, colors, and layout constants for the admin statistics panel only.
 * @module admin-stats/admin-stats-constants
 */

/** English labels for stored occupation keys (aligned with en.js / form dropdown). */
export const OCCUPATION_LABELS = Object.freeze({
  central_govt: 'Central Government Employee',
  state_govt: 'State Government Employee',
  private_employee: 'Private Employee',
  self_employed: 'Self-Employed',
  kazhakam: 'Kazhakam',
  homemaker: 'Homemaker',
  retired: 'Retired',
  unemployed: 'Unemployed',
  student: 'Student',
});

/**
 * Stored occupation keys (same order as the registration dropdown + student).
 * Duplicated from app constants so statistics still match the form if an older
 * constants bundle is cached (see AGENT_GUIDELINES — backward compatibility).
 */
export const STATS_OCCUPATION_KEYS = Object.freeze([
  'central_govt',
  'state_govt',
  'private_employee',
  'self_employed',
  'kazhakam',
  'homemaker',
  'retired',
  'unemployed',
  'student',
]);

/** Older Firestore values → current keys (statistics only). */
export const LEGACY_OCCUPATION_KEYS = Object.freeze({
  govt: 'central_govt',
  private: 'private_employee',
  business: 'self_employed',
});

export const MEMBERSHIP_LABELS = Object.freeze({
  life_member: 'Life member',
  ordinary_member: 'Ordinary member',
});

/** English labels for ration card keys (matches en.js). */
export const RATION_LABELS = Object.freeze({
  none: 'No ration card',
  white: 'White',
  yellow: 'Yellow',
  blue: 'Blue',
  pink: 'Pink',
});

/** Bar colors aligned to ration types (household-level chart). */
export const RATION_KEY_COLORS = Object.freeze({
  none: 'rgba(148, 163, 184, 0.88)',
  white: 'rgba(226, 232, 240, 0.98)',
  yellow: 'rgba(250, 204, 21, 0.9)',
  blue: 'rgba(59, 130, 246, 0.88)',
  pink: 'rgba(244, 114, 182, 0.88)',
});

/** English labels for education keys (matches en.js). */
export const EDUCATION_LABELS = Object.freeze({
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

/** First instant included in growth charts (local) — April 1, 2026. */
export const GROWTH_TREND_START = new Date(2026, 3, 1);

/** User-visible label for the growth chart exclusion window (keep in sync with {@link GROWTH_TREND_START}). */
export const GROWTH_TREND_START_LABEL = 'Apr 2026';

export const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
export const MS_DAY = 24 * 60 * 60 * 1000;

/**
 * Rolling windows for “Recent records” / “Recent members” tiles on the Statistics panel.
 * Each `days` value is the look-back span from “now”; `countKey` matches return fields from
 * `buildRecentRecordCounts` and `buildRecentPeopleCounts` in this package.
 * Order matches the 2×2 grid and DOM ids `statsRecentRecords{days}` / `statsRecentMembers{days}`.
 *
 * @type {ReadonlyArray<{ days: number, countKey: 'last3'|'last7'|'last14'|'last30' }>}
 */
export const STATS_RECENT_REGISTRATION_TILES = Object.freeze([
  { days: 3, countKey: 'last3' },
  { days: 7, countKey: 'last7' },
  { days: 14, countKey: 'last14' },
  { days: 30, countKey: 'last30' },
]);

/** Distinct bar colors per ABO/Rh group (stats panel only). */
export const BLOOD_BAR_COLORS = Object.freeze({
  'A+': 'rgba(220, 38, 38, 0.9)',
  'A-': 'rgba(185, 28, 28, 0.88)',
  'B+': 'rgba(37, 99, 235, 0.88)',
  'B-': 'rgba(29, 78, 216, 0.88)',
  'AB+': 'rgba(147, 51, 234, 0.86)',
  'AB-': 'rgba(126, 34, 206, 0.85)',
  'O+': 'rgba(22, 163, 74, 0.88)',
  'O-': 'rgba(21, 128, 61, 0.88)',
});

/** Fixed bar count: all dropdown options + not specified + other. */
export const OCCUPATION_CHART_BAR_COUNT = STATS_OCCUPATION_KEYS.length + 2;

/** Match occupation chart height for other horizontal bar charts (px per row + top/bottom padding). */
export const STATS_HBAR_ROW_PX = 36;
export const STATS_HBAR_PADDING_PX = 48;
export const OCCUPATION_CHART_HEIGHT_PX =
  OCCUPATION_CHART_BAR_COUNT * STATS_HBAR_ROW_PX + STATS_HBAR_PADDING_PX;

/**
 * One color per horizontal bar, same order as occupation distribution
 * (dropdown keys, then Not specified, then Other).
 */
export const OCCUPATION_BAR_COLORS = Object.freeze([
  'rgba(59, 130, 246, 0.88)',
  'rgba(37, 99, 235, 0.88)',
  'rgba(99, 102, 241, 0.88)',
  'rgba(168, 85, 247, 0.88)',
  'rgba(34, 197, 94, 0.88)',
  'rgba(244, 114, 182, 0.88)',
  'rgba(245, 158, 11, 0.88)',
  'rgba(148, 163, 184, 0.88)',
  'rgba(14, 165, 233, 0.88)',
  'rgba(180, 83, 9, 0.55)',
  'rgba(87, 83, 78, 0.82)',
]);

/** Shared axis styling for Chart.js bar charts in this panel. */
export const barAxisStyle = {
  ticks: { color: '#6b5344', font: { size: 11 } },
  grid: { color: 'rgba(158, 63, 8, 0.1)' },
};

/** Chart.js dataset label — non-member people totals by Pradeshika Sabha. */
export const STATS_NON_MEMBERS_PS_DATASET_LABEL = 'Non-members';

/** Statistics card title — non-members by PS chart (super admin, all sabhas). */
export const STATS_CARD_TITLE_NON_MEMBERS_PS_SUPER_ADMIN = 'Non-members by Pradeshika Sabha';

/** Statistics card title — same chart for Pradeshika Sabha admin (scoped to one sabha). */
export const STATS_CARD_TITLE_NON_MEMBERS_PS_SABHA_ADMIN = 'Non-members only';

/** Bar fill — non-members by Pradeshika Sabha chart. */
export const STATS_CHART_NON_MEMBERS_BAR_BG = 'rgba(20, 184, 166, 0.78)';

/** Family health insurance chart — “yes” households. */
export const STATS_CHART_HEALTH_INSURANCE_YES_BG = 'rgba(16, 185, 129, 0.88)';

/** Family health insurance chart — “no” / not true. */
export const STATS_CHART_HEALTH_INSURANCE_NO_BG = 'rgba(100, 116, 139, 0.78)';

/** Term / life insurance chart — “yes” households. */
export const STATS_CHART_TERM_INSURANCE_YES_BG = 'rgba(99, 102, 241, 0.88)';

/** Term / life insurance chart — “no” / not true. */
export const STATS_CHART_TERM_INSURANCE_NO_BG = 'rgba(203, 170, 120, 0.82)';

/** Display label for sabha keys that are missing or not in the canonical list. */
export const STATS_PRADESHIKA_SABHA_OTHER_LABEL = 'Other';
