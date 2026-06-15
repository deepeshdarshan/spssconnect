/**
 * @fileoverview Registry of backup destination adapters.
 * @module backup-sync/backup-destination-registry
 */

import { googleSheetsDestination } from './services/google-sheets-destination.js';
import { BACKUP_SYNC } from './backup-sync-constants.js';

/** @type {Map<string, Object>} */
const destinations = new Map([
  [googleSheetsDestination.id, googleSheetsDestination],
]);

/**
 * Returns the destination adapter for the given ID.
 * @param {string} [destinationId]
 * @returns {Object}
 */
export function getDestination(destinationId = BACKUP_SYNC.DEFAULT_DESTINATION_ID) {
  const dest = destinations.get(destinationId);
  if (!dest) {
    throw new Error(`Unknown backup destination: ${destinationId}`);
  }
  return dest;
}

/**
 * Lists all registered destination adapters.
 * @returns {Array<Object>}
 */
export function listDestinations() {
  return Array.from(destinations.values());
}

/**
 * Registers an additional destination adapter (for future extensibility).
 * @param {Object} adapter
 */
export function registerDestination(adapter) {
  if (!adapter?.id) {
    throw new Error('Destination adapter must have an id');
  }
  destinations.set(adapter.id, adapter);
}
