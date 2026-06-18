/**
 * @fileoverview Pure household-directory filter state and pipeline (no DOM).
 * Facet UI lives in {@link ../ui/advanced-search-facet-ui.js}; page wiring in
 * {@link ../pages/dashboard-service.js}.
 * @module household-directory-filter-service
 */

import {
  searchMembers,
  filterMembersBySabhaSet,
  filterMembersByRationCardSet,
  filterMembersByHealthInsuranceSet,
  filterMembersByHouseholdComposition,
} from './search-service.js';
import { HOUSEHOLD_DIRECTORY } from '../constants/constants.js';
import { formatLabel } from '../ui/ui-service.js';

/** Facet keys rendered on the household directory filter panel (order = chip iteration order). */
export const HOUSEHOLD_DIRECTORY_FACETS = Object.freeze([
  'sabha',
  'rationCard',
  'healthInsurance',
  'householdComposition',
]);

/**
 * @typedef {Object} HouseholdDirectoryFilterState
 * @property {Set<string>} sabha - Super-admin only; `personalDetails.pradeshikaSabha` values.
 * @property {Set<string>} rationCard - `personalDetails.rationCardType` keys (`none` when unset).
 * @property {Set<string>} healthInsurance - `'yes'` / `'no'`.
 * @property {Set<string>} householdComposition - `'members'` / `'nonMembers'`.
 */

/**
 * @returns {HouseholdDirectoryFilterState}
 */
export function createEmptyHouseholdFilterState() {
  return {
    sabha: new Set(),
    rationCard: new Set(),
    healthInsurance: new Set(),
    householdComposition: new Set(),
  };
}

/**
 * Human-readable label for a facet value in chips and UI copy.
 *
 * @param {string} facet - One of {@link HOUSEHOLD_DIRECTORY_FACETS}.
 * @param {string} value - Stored filter value for the facet.
 * @returns {string}
 */
export function householdFacetValueLabel(facet, value) {
  if (facet === 'sabha') return value;
  if (facet === 'rationCard') return formatLabel(value);
  if (facet === 'healthInsurance') {
    return HOUSEHOLD_DIRECTORY.HEALTH_INSURANCE_LABELS[value] || value;
  }
  if (facet === 'householdComposition') {
    return HOUSEHOLD_DIRECTORY.HOUSEHOLD_COMPOSITION_LABELS[value] || value;
  }
  return value;
}

/**
 * Applies quick search and all household facet filters (OR within each facet, AND across facets).
 *
 * @param {Array<Object>} records - Scoped `member_details` documents.
 * @param {string} query - Quick-search text from the filter sidebar.
 * @param {HouseholdDirectoryFilterState} filterState
 * @returns {Array<Object>} Filtered records (unsorted).
 */
export function applyHouseholdDirectoryFilters(records, query, filterState) {
  let filtered = searchMembers(records, query);
  filtered = filterMembersBySabhaSet(filtered, filterState.sabha);
  filtered = filterMembersByRationCardSet(filtered, filterState.rationCard);
  filtered = filterMembersByHealthInsuranceSet(filtered, filterState.healthInsurance);
  filtered = filterMembersByHouseholdComposition(filtered, filterState.householdComposition);
  return filtered;
}
