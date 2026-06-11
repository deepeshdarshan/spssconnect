/**
 * @fileoverview Input validation for Jilla membership grid cells (no DOM).
 * @module validation/jilla-membership-validation
 */

/**
 * Parses a membership table integer cell (whole number, non-negative).
 *
 * @param {string} raw - Raw input text.
 * @returns {{ valid: boolean, value?: number, message?: string }}
 */
export function parseMembershipInt(raw) {
  const s = String(raw ?? '').trim();
  if (s === '') return { valid: true, value: 0 };
  if (!/^\d+$/.test(s)) {
    return { valid: false, message: 'Use a whole number (0 or positive). No decimals or letters.' };
  }
  if (s.length > 12) {
    return { valid: false, message: 'Number is too large.' };
  }
  const value = parseInt(s, 10);
  if (value < 0 || !Number.isFinite(value)) {
    return { valid: false, message: 'Invalid number.' };
  }
  return { valid: true, value };
}
