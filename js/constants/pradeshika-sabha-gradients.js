/**
 * @fileoverview Canonical gradient color pairs for Pradeshika Sabha tiles (overview grid,
 * birthday dashboard accordion). Keys must match `PRADESHIKA_SABHA_OPTIONS` naming.
 * @module constants/pradeshika-sabha-gradients
 */

/**
 * Two-stop hex gradients per Pradeshika Sabha display name.
 *
 * @type {Readonly<Record<string, readonly [string, string]>>}
 */
export const SABHA_TILE_GRADIENTS = Object.freeze({
  Ernakulam: ['#c95b14', '#9e3f08'],
  Edappally: ['#0d6efd', '#0a4bad'],
  Tripunithura: ['#7c3aed', '#5b21b6'],
  Chottanikkara: ['#db2777', '#9d174d'],
  Perumbavoor: ['#0d9488', '#0f766e'],
  Aluva: ['#d97706', '#b45309'],
  Panangad: ['#16a34a', '#15803d'],
});

/** Neutral fallback when a stored sabha name does not match a known key. */
const SABHA_GRADIENT_FALLBACK = Object.freeze(['#6b7280', '#4b5563']);

/**
 * Resolves gradient hex pair for a sabha tile, or neutral gray if unknown.
 *
 * @param {string} sabhaName Display name (e.g. `Ernakulam`).
 * @returns {readonly [string, string]} Two `#RRGGBB` colors for CSS `linear-gradient`.
 */
export function sabhaGradientPair(sabhaName) {
  const pair = SABHA_TILE_GRADIENTS[sabhaName];
  return pair || SABHA_GRADIENT_FALLBACK;
}

/**
 * Full CSS `linear-gradient` value for a Pradeshika Sabha header/tile.
 *
 * @param {string} sabhaName Display name.
 * @returns {string} e.g. `linear-gradient(135deg, #c95b14 0%, #9e3f08 100%)`
 */
export function sabhaGradientCss(sabhaName) {
  const [from, to] = sabhaGradientPair(sabhaName);
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}
