/**
 * @fileoverview Expand `member_details` Firestore documents into per-person rows and apply
 * client-side facet / text filters. No DOM and no Firebase I/O — safe for unit tests.
 *
 * Main exports: {@link expandToPersonRows}, {@link applyPersonFilters}, {@link applyTextFilter}.
 * @module member-person-search
 */

import { ADVANCED_MEMBER_SEARCH, ADVANCED_SEARCH_MEMBERSHIP_NON_MEMBER_FILTER } from '../constants/constants.js';

/** @typedef {'owner'|'member'|'nonMember'} PersonRole */

/**
 * One flattened row for search results (house owner, household member, or non-member).
 *
 * @typedef {Object} PersonSearchRow
 * @property {string} recordId - Firestore document id
 * @property {PersonRole} role
 * @property {number|null} memberIndex - Index in `members` or `nonMembers` when not owner
 * @property {Object} person - Person-level fields (name, phone, email, dob, facets, occupation,
 *   `areaOfExpertise`, `holdsSpssPosition`, `spssPositionName`, …). Owner rows mirror `personalDetails`
 *   via {@link ownerAsPerson}; member/non-member rows use the stored Firestore person object.
 * @property {Object} householdPd - House owner's `personalDetails` (address, PS, ration, …)
 */

/**
 * Stable facet key order for filter state and chips. Keys must match
 * `ADVANCED_MEMBER_SEARCH.FACET_SECTION_TITLES` in `constants.js` and `createEmptyFilterState`.
 *
 * @type {ReadonlyArray<string>}
 */
export const PERSON_SEARCH_FACETS = Object.freeze([
  'sabha',
  'occupation',
  'bloodGroup',
  'gender',
  'age',
  'membership',
  'education',
]);

/**
 * Minimum digit count in the advanced-search quick query before {@link applyTextFilter} matches on
 * `person.phone` (substring on normalized digits). Shorter runs rely on name / expertise / SPSS position only.
 * @type {number}
 */
const ADVANCED_PERSON_TEXT_SEARCH_MIN_PHONE_DIGITS = 3;

/**
 * Returns fresh mutable `Set`s for each facet (empty selection = no constraint for that facet).
 *
 * @returns {Record<string, Set<string>>} Keys: facet ids including `age` bucket ids (see {@link personAgeFacetBucketId}).
 */
export function createEmptyFilterState() {
  return {
    sabha: new Set(),
    occupation: new Set(),
    bloodGroup: new Set(),
    gender: new Set(),
    age: new Set(),
    membership: new Set(),
    education: new Set(),
  };
}

/**
 * Normalizes phone to digits only.
 * @param {string} value
 * @returns {string}
 */
export function normalizePhoneDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/**
 * Builds a WhatsApp click URL for Indian mobile numbers, or null if not usable.
 * @param {string} phone
 * @returns {string|null}
 */
export function whatsappHref(phone) {
  const d = normalizePhoneDigits(phone);
  if (d.length === 10) return `https://wa.me/91${d}`;
  if (d.length === 11 && d.startsWith('0')) return `https://wa.me/91${d.slice(1)}`;
  if (d.length === 12 && d.startsWith('91')) return `https://wa.me/${d}`;
  return null;
}

/**
 * Concatenates household address lines for display.
 * @param {Object} pd - personalDetails
 * @returns {string}
 */
export function formatHouseholdAddress(pd) {
  const addr = (pd && pd.address) || {};
  const parts = [addr.address1, addr.address2, addr.place, addr.pin].filter(Boolean);
  return parts.join(', ');
}

/**
 * Shapes house owner `personalDetails` like a `person` object for shared filter/display paths
 * (advanced search owner row, quick-search text haystack, …).
 *
 * @param {Object} pd - `personalDetails`
 * @returns {Object} Person-shaped fields aligned with member rows: name, phone, email, dob, gender,
 *   bloodGroup, occupation, areaOfExpertise, holdsSpssPosition, spssPositionName, highestEducation,
 *   membershipType, photoURL.
 */
function ownerAsPerson(pd) {
  return {
    name: pd.name,
    phone: pd.phone,
    email: pd.email,
    dob: pd.dob,
    gender: pd.gender,
    bloodGroup: pd.bloodGroup,
    occupation: pd.occupation,
    areaOfExpertise: pd.areaOfExpertise,
    holdsSpssPosition: pd.holdsSpssPosition,
    spssPositionName: pd.spssPositionName,
    highestEducation: pd.highestEducation,
    membershipType: pd.membershipType,
    photoURL: pd.photoURL,
  };
}

/**
 * Member / Non-member display label for advanced search cards and PDF exports.
 *
 * @param {PersonSearchRow} row
 * @param {{ BADGE_MEMBER: string, BADGE_NON_MEMBER: string }} labels - Typically {@link ../constants/constants.js ADVANCED_MEMBER_SEARCH}.
 * @returns {string}
 */
export function personRoleBadgeLabel(row, labels) {
  return row.role === 'nonMember' ? labels.BADGE_NON_MEMBER : labels.BADGE_MEMBER;
}

/**
 * Expands each member_details record to one row per house owner, member, and non-member.
 *
 * @param {Array<Object>} records - Documents with `id`, `personalDetails`, `members`, `nonMembers`.
 * @returns {PersonSearchRow[]}
 */
export function expandToPersonRows(records) {
  const out = [];
  for (const rec of records) {
    const id = rec.id;
    const pd = rec.personalDetails || {};
    if (!id) continue;

    out.push({
      recordId: id,
      role: 'owner',
      memberIndex: null,
      person: ownerAsPerson(pd),
      householdPd: pd,
    });

    (rec.members || []).forEach((m, i) => {
      out.push({
        recordId: id,
        role: 'member',
        memberIndex: i,
        person: m,
        householdPd: pd,
      });
    });

    (rec.nonMembers || []).forEach((m, i) => {
      out.push({
        recordId: id,
        role: 'nonMember',
        memberIndex: i,
        person: m,
        householdPd: pd,
      });
    });
  }
  return out;
}

/**
 * Whole-year age from a `YYYY-MM-DD` DOB string (same rules as {@link ../ui/ui-service.js calcAgeYears}).
 *
 * @param {string|undefined|null} dob
 * @returns {number|null} Non-negative age, or `null` if missing/invalid/negative.
 */
export function ageYearsFromDobForFilter(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  if (age < 0) return null;
  return age;
}

/**
 * Maps whole-year age to an advanced-search facet bucket id (inclusive ranges, except `66+`).
 *
 * @param {number|null} ageYears
 * @returns {string} One of {@link ../constants/constants.js ADVANCED_SEARCH_AGE_BUCKET_IDS}.
 */
export function personAgeFacetBucketId(ageYears) {
  if (ageYears == null || Number.isNaN(ageYears)) return 'unknown';
  const a = Math.floor(ageYears);
  if (a <= 12) return '0-12';
  if (a <= 17) return '13-17';
  if (a <= 25) return '18-25';
  if (a <= 35) return '26-35';
  if (a <= 45) return '36-45';
  if (a <= 55) return '46-55';
  if (a <= 65) return '56-65';
  return '66+';
}

/**
 * @param {PersonSearchRow} row
 * @param {string} facet - One of {@link PERSON_SEARCH_FACETS}.
 * @param {Set<string>} selected - Stored facet values; empty = no filter. For `membership`, may include
 *   Firestore `membershipType` keys and {@link ../constants/constants.js ADVANCED_SEARCH_MEMBERSHIP_NON_MEMBER_FILTER}.
 * @returns {boolean} True when the row matches the facet selection (OR: any selected value).
 */
function matchesFacet(row, facet, selected) {
  if (!selected || selected.size === 0) return true;
  const pd = row.householdPd || {};
  const p = row.person || {};

  switch (facet) {
    case 'sabha': {
      const v = String(pd.pradeshikaSabha ?? '').trim();
      return v && selected.has(v);
    }
    case 'occupation': {
      const v = String(p.occupation ?? '').trim();
      return v && selected.has(v);
    }
    case 'bloodGroup': {
      const v = String(p.bloodGroup ?? '').trim();
      return v && selected.has(v);
    }
    case 'gender': {
      const v = String(p.gender ?? '').trim();
      return v && selected.has(v);
    }
    case 'age': {
      const ageNum = ageYearsFromDobForFilter(p.dob);
      const bucket = personAgeFacetBucketId(ageNum);
      return Boolean(bucket && selected.has(bucket));
    }
    case 'education': {
      const v = String(p.highestEducation ?? '').trim();
      return v && selected.has(v);
    }
    case 'membership': {
      if (selected.size === 0) return true;
      // `non_member` is a filter-only value (row role), not a Firestore membershipType.
      if (selected.has(ADVANCED_SEARCH_MEMBERSHIP_NON_MEMBER_FILTER) && row.role === 'nonMember') return true;
      if (row.role === 'nonMember') return false;
      const v = String(p.membershipType ?? '').trim();
      return v && selected.has(v);
    }
    default:
      return true;
  }
}

/**
 * Applies facet filters (OR within each facet, AND across facets).
 *
 * @param {PersonSearchRow[]} rows
 * @param {Record<string, Set<string>>} filterState
 * @returns {PersonSearchRow[]}
 */
export function applyPersonFilters(rows, filterState) {
  return rows.filter((row) =>
    PERSON_SEARCH_FACETS.every((facet) => {
      const set = filterState[facet];
      return matchesFacet(row, facet, set);
    }),
  );
}

/**
 * Case-insensitive substring match on **person** quick-search fields only: name, area of expertise,
 * SPSS position name (when `holdsSpssPosition` is set), and phone (digits-only substring when the
 * query has at least `ADVANCED_PERSON_TEXT_SEARCH_MIN_PHONE_DIGITS` normalized digits).
 *
 * @param {PersonSearchRow[]} rows
 * @param {string} query - Raw input; trimmed. Empty string returns `rows` unchanged.
 * @returns {PersonSearchRow[]} Filtered rows (same order as input).
 */
export function applyTextFilter(rows, query) {
  const raw = String(query ?? '').trim();
  if (!raw) return rows;

  const q = raw.toLowerCase();
  const qDigits = normalizePhoneDigits(raw);

  return rows.filter((row) => {
    const p = row.person || {};
    const positionSnippet =
      p.holdsSpssPosition && String(p.spssPositionName ?? '').trim()
        ? String(p.spssPositionName).trim()
        : '';
    const textHay = [p.name, p.areaOfExpertise, positionSnippet]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (textHay.includes(q)) return true;
    if (qDigits.length >= ADVANCED_PERSON_TEXT_SEARCH_MIN_PHONE_DIGITS) {
      const pDigits = normalizePhoneDigits(p.phone);
      if (pDigits.includes(qDigits)) return true;
    }
    return false;
  });
}

/**
 * Human-readable label for a stored facet value (chips and sidebar).
 *
 * @param {string} facet
 * @param {string} value - Stored filter key (e.g. `life_member`, `Ernakulam`, `A+`, or
 *   {@link ../constants/constants.js ADVANCED_SEARCH_MEMBERSHIP_NON_MEMBER_FILTER}).
 * @param {(k: string) => string} formatLabel - Typically {@link ../ui/ui-service.formatLabel}.
 * @returns {string}
 */
export function facetValueLabel(facet, value, formatLabel) {
  if (facet === 'age') {
    const labels = ADVANCED_MEMBER_SEARCH.AGE_BUCKET_LABELS;
    return labels && labels[value] ? labels[value] : value;
  }
  if (facet === 'membership' && value === ADVANCED_SEARCH_MEMBERSHIP_NON_MEMBER_FILTER) {
    return ADVANCED_MEMBER_SEARCH.BADGE_NON_MEMBER;
  }
  if (facet === 'sabha' || facet === 'bloodGroup') return value;
  return formatLabel(value);
}
