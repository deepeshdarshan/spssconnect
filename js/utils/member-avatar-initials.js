/**
 * @file Utilities for member list “initials in a circle” placeholders (advanced search cards, etc.).
 * Initials rules match product spec: multi-word names use up to two leading initials; short whole
 * names use two characters; colors are stable per name string (hash → swatch index), not random per paint.
 */

/**
 * Count of distinct avatar background swatches in the UI stylesheet.
 *
 * Valid range: positive integer; must equal the number of `.advanced-search-card__initials--swatch-*`
 * rules in `css/partials/styles/10-member-advanced-search.css` and match the modulo range used by
 * {@link getMemberAvatarSwatchIndex} in this module.
 *
 * @type {number}
 */
export const MEMBER_AVATAR_SWATCH_COUNT = 10;

/**
 * First character of a name token, uppercased for Latin scripts (`toLocaleUpperCase`), with fallback
 * to the raw first code unit when uppercase yields empty.
 *
 * @param {string} token - Single whitespace-delimited fragment of a display name.
 * @returns {string} One character or empty string when `token` is empty after trim.
 */
function firstInitialChar(token) {
  const t = String(token ?? '').trim();
  if (!t) return '';
  const seg = t[0];
  const up = seg.toLocaleUpperCase();
  return up || seg;
}

/**
 * Builds 1–2 uppercase letters for avatar placeholders.
 *
 * Rules:
 * - If the trimmed name is shorter than three characters, use up to two characters from the name
 *   (e.g. `"Jo"` → `"JO"`, `"J"` → `"J"`).
 * - If there are two or more whitespace-separated parts, use the first letter of each of the
 *   first two parts (e.g. `"Abhirami B M"` → `"AB"`).
 * - If there is a single part and the name is at least three characters long, use the first two
 *   letters of that part (e.g. `"John"` → `"JO"`).
 * - Empty / whitespace-only input returns `"?"`.
 *
 * @param {string|undefined|null} rawName - Display name as stored on the person record.
 * @returns {string} Uppercase initials for UI (never empty; `"?"` when nothing usable exists).
 */
export function getMemberAvatarInitials(rawName) {
  const name = String(rawName ?? '').trim();
  if (!name) return '?';
  if (name.length < 3) {
    return name.slice(0, 2).toLocaleUpperCase();
  }

  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    const parts = [];
    for (let i = 0; i < Math.min(2, tokens.length); i += 1) {
      const c = firstInitialChar(tokens[i]);
      if (c) parts.push(c);
    }
    const joined = parts.join('').toLocaleUpperCase().slice(0, 2);
    return joined || '?';
  }

  const word = tokens[0] || name;
  return word.slice(0, 2).toLocaleUpperCase();
}

/**
 * Stable swatch index in `0 .. MEMBER_AVATAR_SWATCH_COUNT - 1` derived from `seed` so the same
 * string always maps to the same color across re-renders.
 *
 * @param {string} seed - Typically the trimmed display name (same string as used for initials).
 * @returns {number} Non-negative integer less than {@link MEMBER_AVATAR_SWATCH_COUNT}.
 */
export function getMemberAvatarSwatchIndex(seed) {
  const s = String(seed ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(h) % MEMBER_AVATAR_SWATCH_COUNT;
  return idx;
}
