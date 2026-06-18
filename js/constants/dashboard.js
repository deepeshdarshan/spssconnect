/**
 * @fileoverview Household directory page defaults for sort, pagination, and search.
 * @module constants/dashboard
 */

/** Dashboard defaults */
export const DASHBOARD_DEFAULTS = Object.freeze({
  SORT_FIELD: 'houseName',
  SORT_DIRECTION: 'asc',
  SEARCH_DEBOUNCE_MS: 300,
  TABLE_COLSPAN: 6,
  /** Default rows per page on the household directory table. */
  PAGE_SIZE: 25,
  /** Allowed page sizes for the household directory page size control. */
  PAGE_SIZE_OPTIONS: Object.freeze([10, 25, 50, 100]),
});
