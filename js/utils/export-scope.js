/**
 * @fileoverview Pradeshika Sabha scoping for PDF / Excel exports: letterhead subtitle and file names.
 * @module utils/export-scope
 */

import { ORG_SUBTITLE } from '../constants/app-branding.js';

/**
 * The single Pradeshika Sabha an export covers, or null when it spans the whole jilla.
 * Super admins scope by selecting exactly one sabha in the filters; PS admins are always scoped to their own sabha.
 *
 * @param {Object} opts
 * @param {Iterable<string>} [opts.selectedSabhas] - Values of the sabha filter facet.
 * @param {boolean} opts.superAdmin
 * @param {string|null} [opts.userSabha] - Current user's profile sabha.
 * @returns {string|null}
 */
export function resolveExportSabha({ selectedSabhas, superAdmin, userSabha }) {
  if (!superAdmin) return String(userSabha ?? '').trim() || null;
  const selected = Array.from(selectedSabhas ?? []);
  return selected.length === 1 ? String(selected[0]).trim() || null : null;
}

/**
 * Letterhead subtitle, e.g. `EDAPPALLY PRADESHIKA SABHA`, falling back to the jilla name.
 *
 * @param {string|null} sabha
 * @returns {string}
 */
export function buildExportSubtitle(sabha) {
  return sabha ? `${sabha.toUpperCase()} PRADESHIKA SABHA` : ORG_SUBTITLE;
}

/**
 * Lowercase export file name, e.g. `spss_household_directory_edappally.pdf`.
 *
 * @param {string} baseName - e.g. `spss_household_directory`.
 * @param {string|null} sabha
 * @param {string} extension - e.g. `.pdf` or `.xlsx`.
 * @returns {string}
 */
export function buildExportFilename(baseName, sabha, extension) {
  const slug = String(sabha ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${baseName}${slug ? `_${slug}` : ''}${extension}`;
}
