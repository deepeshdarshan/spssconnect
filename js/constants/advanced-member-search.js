/**
 * @fileoverview UI copy, age bucket ids, and membership facet keys for the advanced member search page.
 * @module constants/advanced-member-search
 */

import { MEMBER_COUNT_UNIT } from './pdf-export.js';
import { MEMBERSHIP_OPTIONS } from './member-options.js';

/**
 * UI copy for the advanced member search page (`advanced-member-search.html`).
 *
 * - `FACET_SECTION_TITLES` and {@link ADVANCED_SEARCH_AGE_BUCKET_IDS} keys must match filter state keys in
 *   {@link ../services/member-person-search.js PERSON_SEARCH_FACETS}.
 * - {@link ADVANCED_SEARCH_MEMBERSHIP_FILTER_KEYS} drives the membership facet checkboxes; life/ordinary keys
 *   mirror {@link ./member-options.js MEMBERSHIP_OPTIONS}; `non_member` is filter-only (see
 *   {@link ADVANCED_SEARCH_MEMBERSHIP_NON_MEMBER_FILTER}).
 * - Result cards show the Pradeshika Sabha **value** only (no facet title on the card).
 * - `LOADING_MESSAGE` is passed to {@link ../ui/ui-service.js setLoaderMessage} during page init.
 * - Results count and stretched-link aria strings are consumed by
 *   {@link ../pages/member-advanced-search-page.js}.
 * - `MOBILE_FILTERS_HELP` is shown beside the funnel control below the `lg` breakpoint and is
 *   applied to that control’s `aria-label` from {@link ../pages/member-advanced-search-page.js}.
 */

/** Age bucket ids for the advanced search sidebar (order = display order). Must match {@link ADVANCED_MEMBER_SEARCH} `AGE_BUCKET_LABELS`. */
export const ADVANCED_SEARCH_AGE_BUCKET_IDS = Object.freeze([
  '0-12',
  '13-17',
  '18-25',
  '26-35',
  '36-45',
  '46-55',
  '56-65',
  '66+',
  'unknown',
]);

/**
 * Advanced-search membership facet value for household non-members (not a Firestore `membershipType`).
 * Matched against {@link ../services/member-person-search.js PersonSearchRow.role} `nonMember`.
 * Must stay in sync with membership facet matching in {@link ../services/member-person-search.js}.
 */
export const ADVANCED_SEARCH_MEMBERSHIP_NON_MEMBER_FILTER = 'non_member';

/**
 * Membership facet checkbox values in display order (advanced member search sidebar).
 * Life and ordinary keys are derived from {@link ./member-options.js MEMBERSHIP_OPTIONS}.
 */
export const ADVANCED_SEARCH_MEMBERSHIP_FILTER_KEYS = Object.freeze([
  ...Object.keys(MEMBERSHIP_OPTIONS),
  ADVANCED_SEARCH_MEMBERSHIP_NON_MEMBER_FILTER,
]);

const ADVANCED_SEARCH_AGE_BUCKET_LABELS = Object.freeze({
  '0-12': '0–12 years',
  '13-17': '13–17 years',
  '18-25': '18–25 years',
  '26-35': '26–35 years',
  '36-45': '36–45 years',
  '46-55': '46–55 years',
  '56-65': '56–65 years',
  '66+': '66 years and above',
  unknown: 'Other',
});

export const ADVANCED_MEMBER_SEARCH = Object.freeze({
  FACET_SECTION_TITLES: Object.freeze({
    sabha: 'Pradeshika Sabha',
    occupation: 'Occupation',
    bloodGroup: 'Blood group',
    gender: 'Gender',
    age: 'Age',
    membership: 'Membership',
    education: 'Education',
  }),
  /** Display labels for {@link ADVANCED_SEARCH_AGE_BUCKET_IDS} (advanced search age facet). */
  AGE_BUCKET_LABELS: ADVANCED_SEARCH_AGE_BUCKET_LABELS,
  CHIPS_ACTIVE_PREFIX: 'Active filters:',
  CHIPS_CLEAR_ALL: 'Clear all',
  /**
   * Short label next to the mobile funnel button so the offcanvas filter entry point is obvious
   * without relying on the icon alone.
   */
  MOBILE_FILTERS_HELP: 'Tap to open filters',
  /** Card and PDF label for house owner and household member rows. */
  BADGE_MEMBER: 'Member',
  BADGE_NON_MEMBER: 'Non-member',
  /** Toolbar / header button label for filtered-results PDF export (matches household directory). */
  PDF_EXPORT_BUTTON: 'Export PDF',
  /** Title line on advanced search PDF exports. */
  PDF_TITLE: 'Advanced search results',
  /** Section heading above the SPSS-position quick filter on advanced member search. */
  HOLDS_SPSS_POSITION_QUICK_FILTER_HEADING: 'SPSS position',
  /**
   * Quick filter checkbox label (advanced search sidebar): restrict to people who answered Yes to
   * holding an SPSS position (`personalDetails` / member `holdsSpssPosition`).
   */
  HOLDS_SPSS_POSITION_QUICK_FILTER:
    'Members holding any position',
  /** Full-page loading popup (filters + Firestore load) via {@link ../ui/ui-service.js setLoaderMessage}. */
  LOADING_MESSAGE: 'Loading advanced search…',
  /** Prefix for `#advancedSearchRecordCount` (e.g. "Showing 12 members"). */
  RESULTS_COUNT_PREFIX: 'Showing',
  /** Singular unit after the numeric total in the results count line. */
  RESULTS_UNIT_MEMBER: MEMBER_COUNT_UNIT.SINGULAR,
  /** Plural unit after the numeric total in the results count line. */
  RESULTS_UNIT_MEMBERS: MEMBER_COUNT_UNIT.PLURAL,
  /** Base `aria-label` for the card stretched link to the view page; name is appended with `STRETCHED_LINK_ARIA_NAME_PREFIX` when known. */
  STRETCHED_LINK_ARIA_BASE: 'View household record',
  /** Joiner between `STRETCHED_LINK_ARIA_BASE` and the person name when the name is known. */
  STRETCHED_LINK_ARIA_NAME_PREFIX: ' for ',
});
