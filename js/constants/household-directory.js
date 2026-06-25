/**
 * @fileoverview UI copy for the household directory page (`household-directory.html`).
 * @module constants/household-directory
 */

import { ADVANCED_SEARCH_MEMBERSHIP_NON_MEMBER_FILTER } from './advanced-member-search.js';

/**
 * Checkbox value order for the household directory Membership facet (`householdComposition` in filter state).
 * Uses the same `non_member` sentinel as advanced member search (not a Firestore `membershipType`).
 */
export const HOUSEHOLD_DIRECTORY_MEMBERSHIP_FILTER_KEYS = Object.freeze([
  'ordinary_member',
  'life_member',
  ADVANCED_SEARCH_MEMBERSHIP_NON_MEMBER_FILTER,
]);

/**
 * UI copy for the household directory page (`household-directory.html`).
 * Consumed by {@link ../pages/dashboard-service.js}, {@link ../ui/household-card-ui.js},
 * and {@link ../services/household-directory-filter-service.js}.
 */
export const HOUSEHOLD_DIRECTORY = Object.freeze({
  PAGE_SUBTITLE:
    'Browse and filter households in your scope. Search, sort, export to PDF, and open records for viewing or editing.',
  FILTER_PANEL_TITLE: 'Household Filters',
  FILTER_PANEL_SUBTITLE: 'Narrow the household list using the options below.',
  QUICK_SEARCH_LABEL: 'Quick search',
  /** Instructional sub-text under the quick search label (input has no placeholder). */
  QUICK_SEARCH_HINT: 'Please search by house name, owner name, PIN, or phone…',
  CLEAR_ALL_FILTERS_LABEL: 'Clear all filters',
  FILTER_BUTTON_LABEL: 'Filters',
  SORT_FIELD_LABEL: 'Sort by',
  /** Sort `<select>` options; keys match {@link ./dashboard.js DASHBOARD_DEFAULTS} `SORT_FIELD` values. */
  SORT_FIELD_OPTIONS: Object.freeze({
    name: 'House Owner Name',
    pradeshikaSabha: 'Pradeshika Sabha',
    houseName: 'House Name',
    address: 'Address',
  }),
  FACET_SECTION_TITLES: Object.freeze({
    sabha: 'Pradeshika Sabha',
    rationCard: 'Ration card color',
    healthInsurance: 'Family health insurance',
    householdComposition: 'Membership',
  }),
  HEALTH_INSURANCE_LABELS: Object.freeze({
    yes: 'Yes',
    no: 'No',
  }),
  /**
   * Labels for {@link HOUSEHOLD_DIRECTORY_MEMBERSHIP_FILTER_KEYS} (household directory Membership facet).
   */
  MEMBERSHIP_FILTER_LABELS: Object.freeze({
    ordinary_member: 'Ordinary Member',
    life_member: 'Life Member',
    non_member: 'Non-Member',
  }),
  CHIPS_ACTIVE_PREFIX: 'Active filters:',
  CHIPS_CLEAR_ALL: 'Clear all',
  MOBILE_FILTERS_HELP: 'Tap to open filters',
  LOADING_MESSAGE: 'Loading household directory…',
  RESULTS_COUNT_PREFIX: 'Showing',
  RESULTS_UNIT: 'House',
  RESULTS_UNIT_PLURAL: 'Houses',
  STRETCHED_LINK_ARIA_BASE: 'View household record',
  STRETCHED_LINK_ARIA_NAME_PREFIX: ' for ',
  ACTION_VIEW: 'View household',
  ACTION_EDIT: 'Edit household',
  ACTION_DELETE: 'Delete household',
  ACTION_PDF: 'Download household PDF',
  ACTION_SHARE: 'Copy share link',
  ACTION_FAMILY_TREE: 'Open family relationship tree',
  ACTION_MORE: 'More actions',
  MEMBERS_LABEL: 'Members',
  NON_MEMBERS_LABEL: 'Non-members',
});
