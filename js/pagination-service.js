/**
 * @fileoverview Pagination logic for slicing record arrays.
 * Pure functions — no DOM or Firebase dependency.
 * @module pagination-service
 */

import { PAGE_SIZE } from './constants.js';

/** @type {{currentPage: number, pageSize: number}} */
let state = {
  currentPage: 1,
  pageSize: PAGE_SIZE,
};

/**
 * Returns a page-sized slice of the records array.
 * @param {Array<Object>} records - Full (filtered/sorted) array.
 * @param {number} [page] - 1-based page number; defaults to current page.
 * @param {number} [pageSize] - Items per page; defaults to constants PAGE_SIZE.
 * @returns {Array<Object>} The slice for the requested page.
 */
export function paginate(records, page, pageSize) {
  const p = page || state.currentPage;
  const size = pageSize || state.pageSize;
  const start = (p - 1) * size;
  return records.slice(start, start + size);
}

/**
 * Computes the total number of pages for a given record count.
 * @param {number} totalRecords
 * @param {number} [pageSize]
 * @returns {number}
 */
export function getTotalPages(totalRecords, pageSize) {
  const size = pageSize || state.pageSize;
  return Math.max(1, Math.ceil(totalRecords / size));
}

/**
 * Returns the current pagination state.
 * @returns {{currentPage: number, pageSize: number}}
 */
export function getPaginationState() {
  return { ...state };
}

/**
 * Updates the pagination state.
 * @param {Partial<{currentPage: number, pageSize: number}>} updates
 */
export function setPaginationState(updates) {
  if (updates.currentPage != null) state.currentPage = updates.currentPage;
  if (updates.pageSize != null) state.pageSize = updates.pageSize;
}

/**
 * Resets current page to 1 (e.g. after a new search/sort).
 */
export function resetPage() {
  state.currentPage = 1;
}
