/**
 * @fileoverview Client-side idle timeout for authenticated sessions.
 * Persists last-activity time to localStorage so full page loads share one idle clock;
 * other tabs refresh the timestamp via the `storage` event listener.
 * @module session-idle-timeout
 */

import { SESSION_IDLE_TIMEOUT_MS, SESSION_ACTIVITY_STORAGE_KEY } from '../constants/constants.js';

/**
 * How often to compare wall clock to the stored last-activity value (ms).
 * Shorter intervals tighten worst-case delay after the 15-minute boundary.
 */
const IDLE_POLL_INTERVAL_MS = 15000;

/**
 * Minimum time between writes of the same activity burst to localStorage (ms).
 * Reduces churn while keeping idle detection within a small margin of the configured timeout.
 */
const ACTIVITY_PERSIST_THROTTLE_MS = 5000;

/** @type {ReturnType<typeof setInterval>|null} */
let pollTimerId = null;

/** @type {ReturnType<typeof setTimeout>|null} */
let persistThrottleTimerId = null;

/** @type {(() => void) | null} */
let idleExpiredHandler = null;

/**
 * Reads the persisted last-activity timestamp, if any.
 * @returns {number|null} Epoch ms, or null when missing or invalid.
 */
function readStoredActivityMs() {
  try {
    const raw = localStorage.getItem(SESSION_ACTIVITY_STORAGE_KEY);
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * Removes the persisted activity timestamp (call on sign-out).
 * @returns {void}
 */
export function clearSessionActivityRecord() {
  try {
    localStorage.removeItem(SESSION_ACTIVITY_STORAGE_KEY);
  } catch {
    /* private mode / quota */
  }
}

/**
 * Persists "now" as the last user activity time.
 * @returns {void}
 */
export function touchSessionActivityRecordNow() {
  try {
    localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(Date.now()));
  } catch {
    /* private mode / quota */
  }
}

/**
 * Returns whether the stored last-activity time exceeds {@link SESSION_IDLE_TIMEOUT_MS}.
 * Missing storage is treated as not expired (bootstrap will refresh the stamp).
 *
 * @returns {boolean} True when storage indicates the idle limit has been crossed.
 */
export function isSessionIdleExpiredByStoredActivity() {
  const ts = readStoredActivityMs();
  if (ts === null) return false;
  return Date.now() - ts > SESSION_IDLE_TIMEOUT_MS;
}

/**
 * Schedules a throttled persist of the current time as last activity.
 * @returns {void}
 */
function scheduleThrottledPersist() {
  if (persistThrottleTimerId !== null) return;
  persistThrottleTimerId = window.setTimeout(() => {
    persistThrottleTimerId = null;
    touchSessionActivityRecordNow();
  }, ACTIVITY_PERSIST_THROTTLE_MS);
}

/**
 * Invokes the idle handler when storage indicates the session is past the idle limit.
 * @returns {void}
 */
function pollIdleExpiry() {
  if (!idleExpiredHandler) return;
  if (!isSessionIdleExpiredByStoredActivity()) return;
  const fn = idleExpiredHandler;
  stopSessionIdleMonitor();
  fn();
}

/**
 * User input: refresh activity (throttled write).
 * @returns {void}
 */
function onUserActivity() {
  scheduleThrottledPersist();
}

/**
 * When the tab becomes visible, re-check idle immediately (e.g. after laptop sleep).
 * @returns {void}
 */
function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    pollIdleExpiry();
  }
}

/**
 * Another tab updated last-activity; local poll will read the new value on next tick.
 * @param {StorageEvent} e
 * @returns {void}
 */
function onStorage(e) {
  if (e.storageArea !== localStorage) return;
  if (e.key !== SESSION_ACTIVITY_STORAGE_KEY) return;
  pollIdleExpiry();
}

const ACTIVITY_EVENTS = /** @type {const} */ (['mousedown', 'keydown', 'scroll', 'touchstart', 'wheel']);

/** @type {Readonly<{ passive: true }>} */
const PASSIVE_LISTENER_OPTIONS = Object.freeze({ passive: true });

/**
 * Subscribes to user activity and a timer; calls `onIdleExpired` once when idle exceeds the limit.
 * Clears any prior subscription. Writes an immediate activity stamp on start.
 *
 * @param {() => void} onIdleExpired - Sync notifier; caller may kick async work without awaiting.
 * @returns {void}
 */
export function startSessionIdleMonitor(onIdleExpired) {
  stopSessionIdleMonitor();
  idleExpiredHandler = onIdleExpired;
  touchSessionActivityRecordNow();

  pollTimerId = window.setInterval(pollIdleExpiry, IDLE_POLL_INTERVAL_MS);

  ACTIVITY_EVENTS.forEach((type) => {
    window.addEventListener(type, onUserActivity, PASSIVE_LISTENER_OPTIONS);
  });
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('storage', onStorage);
}

/**
 * Tears down listeners and timers started by {@link startSessionIdleMonitor}.
 * @returns {void}
 */
export function stopSessionIdleMonitor() {
  if (pollTimerId !== null) {
    window.clearInterval(pollTimerId);
    pollTimerId = null;
  }
  if (persistThrottleTimerId !== null) {
    window.clearTimeout(persistThrottleTimerId);
    persistThrottleTimerId = null;
  }
  idleExpiredHandler = null;

  ACTIVITY_EVENTS.forEach((type) => {
    window.removeEventListener(type, onUserActivity, PASSIVE_LISTENER_OPTIONS);
  });
  document.removeEventListener('visibilitychange', onVisibilityChange);
  window.removeEventListener('storage', onStorage);
}
