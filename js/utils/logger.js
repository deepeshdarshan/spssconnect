/**
 * @fileoverview Centralized logging for SPSS Connect (wraps console with a stable prefix).
 * Debug level is suppressed unless `localStorage.spss_debug_logs` is set to `1`.
 * @module utils/logger
 */

const PREFIX = '[SPSS]';

/**
 * @returns {boolean}
 */
function debugEnabled() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('spss_debug_logs') === '1';
  } catch {
    return false;
  }
}

/**
 * @param {...unknown} args
 */
export function debug(...args) {
  if (!debugEnabled()) return;
  console.debug(PREFIX, ...args);
}

/**
 * @param {...unknown} args
 */
export function info(...args) {
  console.info(PREFIX, ...args);
}

/**
 * @param {...unknown} args
 */
export function warn(...args) {
  console.warn(PREFIX, ...args);
}

/**
 * @param {...unknown} args
 */
export function error(...args) {
  console.error(PREFIX, ...args);
}
