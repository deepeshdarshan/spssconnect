/**
 * @fileoverview Expand `member_details` Firestore documents into per-person rows and apply
 * client-side facet / text filters. No DOM and no Firebase I/O — safe for unit tests.
 *
 * Main exports: {@link expandToPersonRows}, {@link applyPersonFilters}, {@link applyTextFilter}.
 * @module member-person-search
 */

/** @typedef {'owner'|'member'|'nonMember'} PersonRole */

/**
 * One flattened row for search results (house owner, household member, or non-member).
 *
 * @typedef {Object} PersonSearchRow
 * @property {string} recordId - Firestore document id
 * @property {PersonRole} role
 * @property {number|null} memberIndex - Index in `members` or `nonMembers` when not owner
 * @property {Object} person - Person-level fields (name, phone, facets, …)
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
  'membership',
  'education',
]);

/**
 * Returns fresh mutable `Set`s for each facet (empty selection = no constraint for that facet).
 *
 * @returns {Record<string, Set<string>>} Keys: `sabha`, `occupation`, `bloodGroup`, `gender`, `membership`, `education`.
 */
export function createEmptyFilterState() {
  return {
    sabha: new Set(),
    occupation: new Set(),
    bloodGroup: new Set(),
    gender: new Set(),
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
 * Shapes house owner `personalDetails` like a `person` object for shared filter/display paths.
 *
 * @param {Object} pd - `personalDetails`
 * @returns {Object}
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
 * @param {PersonSearchRow} row
 * @param {string} facet - One of {@link PERSON_SEARCH_FACETS}.
 * @param {Set<string>} selected - Stored Firestore values for this facet; empty = no filter.
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
    case 'education': {
      const v = String(p.highestEducation ?? '').trim();
      return v && selected.has(v);
    }
    case 'membership': {
      if (selected.size === 0) return true;
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
 * When `membership` has any selection, non-member rows are excluded.
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
 * Case-insensitive substring match on name, house name, and address lines (not PIN).
 * @param {PersonSearchRow[]} rows
 * @param {string} query
 * @returns {PersonSearchRow[]}
 */
export function applyTextFilter(rows, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return rows;

  return rows.filter((row) => {
    const pd = row.householdPd || {};
    const p = row.person || {};
    const addr = pd.address || {};
    const hay = [
      p.name,
      pd.houseName,
      addr.address1,
      addr.address2,
      addr.place,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

/**
 * Human-readable label for a stored facet value (chips and sidebar).
 *
 * @param {string} facet
 * @param {string} value - Stored Firestore key (e.g. `life_member`, `Ernakulam`, `A+`).
 * @param {(k: string) => string} formatLabel - Typically {@link ../ui/ui-service.formatLabel}.
 * @returns {string}
 */
export function facetValueLabel(facet, value, formatLabel) {
  if (facet === 'sabha' || facet === 'bloodGroup') return value;
  return formatLabel(value);
}
