/**
 * @fileoverview Pure helpers for Target Achievement Analysis (jilla targets vs live member_details).
 * @module target-achievement-utils
 */

import { PRADESHIKA_SABHA_OPTIONS, MEMBERSHIP_OPTIONS } from '../constants/constants.js';

const ACTIVE_MEMBERSHIP = new Set(Object.keys(MEMBERSHIP_OPTIONS));

/**
 * @param {unknown} n
 * @returns {number}
 */
export function toNonNegInt(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.floor(x);
}

/**
 * @param {Array<Record<string, unknown>>|null|undefined} savedArr
 * @param {string[]} sabhaOrder
 * @returns {Array<{ psName: string, lifeMembers: number, ordinaryMembers: number, home: number, pushpakadhwani: number }>}
 */
export function mergeJillaMembershipRows(savedArr, sabhaOrder) {
  const defaults = sabhaOrder.map((psName) => ({
    psName,
    lifeMembers: 0,
    ordinaryMembers: 0,
    home: 0,
    pushpakadhwani: 0,
  }));
  if (!Array.isArray(savedArr)) return defaults;
  return defaults.map((def) => {
    const saved = savedArr.find(
      (s) =>
        String(s?.psName || '')
          .trim()
          .toLowerCase() === def.psName.toLowerCase()
    );
    if (!saved) return { ...def };
    return {
      ...def,
      lifeMembers: toNonNegInt(saved.lifeMembers),
      ordinaryMembers: toNonNegInt(saved.ordinaryMembers),
      home: toNonNegInt(saved.home),
      pushpakadhwani: toNonNegInt(saved.pushpakadhwani),
    };
  });
}

/**
 * @param {Object} record
 * @param {string[]} sabhaOrder
 * @returns {string|null}
 */
export function resolveSabhaKey(record, sabhaOrder) {
  const sabha = (record.personalDetails || {}).pradeshikaSabha;
  if (!sabha || typeof sabha !== 'string') return null;
  const trimmed = sabha.trim();
  const match = sabhaOrder.find((k) => k.toLowerCase() === trimmed.toLowerCase());
  return match || null;
}

/**
 * Counts house owner + members with life_member or ordinary_member (excludes nonMembers).
 * @param {Object} record
 * @returns {number}
 */
export function countActiveMembersInRecord(record) {
  let n = 0;
  const pd = record.personalDetails || {};
  const headType = pd.membershipType;
  if (headType && ACTIVE_MEMBERSHIP.has(headType)) n += 1;
  for (const m of record.members || []) {
    const mt = m.membershipType;
    if (mt && ACTIVE_MEMBERSHIP.has(mt)) n += 1;
  }
  return n;
}

/**
 * Per-PS actual homes (member_details doc count) and active members from filtered records.
 * @param {Array<Object>} records
 * @param {string[]} sabhaOrder
 * @returns {{ homes: Record<string, number>, members: Record<string, number> }}
 */
export function aggregateActualsBySabha(records, sabhaOrder) {
  /** @type {Record<string, number>} */
  const homes = Object.fromEntries(sabhaOrder.map((k) => [k, 0]));
  /** @type {Record<string, number>} */
  const members = Object.fromEntries(sabhaOrder.map((k) => [k, 0]));

  for (const r of records) {
    const key = resolveSabhaKey(r, sabhaOrder);
    if (!key) continue;
    homes[key] += 1;
    members[key] += countActiveMembersInRecord(r);
  }
  return { homes, members };
}

/**
 * Achievement ratio for display. Returns null if target is 0 (no division).
 * Bar fill uses min(100, pct) so the track does not overflow; label shows true % (can exceed 100).
 * @param {number} actual
 * @param {number} target
 * @returns {{ pct: number, barPct: number } | null}
 */
export function achievementRatio(actual, target) {
  const t = toNonNegInt(target);
  const a = toNonNegInt(actual);
  if (t <= 0) return null;
  const pct = (a / t) * 100;
  const barPct = Math.min(100, pct);
  return { pct, barPct };
}

/**
 * @param {Array<{ psName: string, lifeMembers: number, ordinaryMembers: number, home: number }>} jillaRows
 * @returns {boolean}
 */
export function hasAnyJillaTargets(jillaRows) {
  return jillaRows.some((r) => {
    const memberTarget = r.lifeMembers + r.ordinaryMembers;
    return memberTarget > 0 || r.home > 0;
  });
}

/**
 * Default sabha list for ordering.
 * @returns {string[]}
 */
export function defaultSabhaOrder() {
  return Object.keys(PRADESHIKA_SABHA_OPTIONS);
}
