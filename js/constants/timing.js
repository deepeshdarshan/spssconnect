/**
 * @fileoverview UI timing values (debounce, toast duration, etc.).
 * @module constants/timing
 */

/** Timing defaults (ms) */
export const TIMING = Object.freeze({
  REDIRECT_DELAY: 1000,
  /** Minimum full-page loader display after manual logout before redirect to login. */
  LOGOUT_REDIRECT_DELAY_MS: 2000,
});
