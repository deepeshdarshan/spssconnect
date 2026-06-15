/**
 * @fileoverview Google Sheets destination adapter — HTTP calls to Apps Script.
 * @module backup-sync/services/google-sheets-destination
 */

import { DESTINATION_IDS } from '../backup-sync-constants.js';
import { mapMemberDocsToSheetRecords } from '../mappers/member-to-sheet-mapper.js';
import {
  isGoogleSheetsConfigured,
  getRemoteRecordCount,
  healthCheck,
  postSheetPayload,
} from './google-sheet-service.js';
import * as Logger from '../../utils/logger.js';

export { isGoogleSheetsConfigured, getRemoteRecordCount, healthCheck };

/**
 * @typedef {Object} BatchUpsertResult
 * @property {string[]} successIds
 * @property {Array<{ memberId: string, errorMessage: string }>} failures
 */

/**
 * Upserts a batch of member documents to Google Sheets.
 * @param {Array<Object>} memberDocs - Raw member_details documents with id.
 * @returns {Promise<BatchUpsertResult>}
 */
export async function upsertBatch(memberDocs) {
  const records = mapMemberDocsToSheetRecords(memberDocs);
  if (records.length === 0) {
    return { successIds: [], failures: [] };
  }

  try {
    const data = await postSheetPayload({ action: 'batchUpsert', records });
    return parseBatchResult(data, records);
  } catch (err) {
    Logger.error('upsertBatch failed:', err);
    const message = err.message || 'Batch upsert failed';
    return {
      successIds: [],
      failures: records.map((r) => ({ memberId: r.recordId, errorMessage: message })),
    };
  }
}

/**
 * Retries specific member documents (same as upsertBatch).
 * @param {Array<Object>} memberDocs
 * @returns {Promise<BatchUpsertResult>}
 */
export async function retryRecords(memberDocs) {
  return upsertBatch(memberDocs);
}

/**
 * Parses Apps Script batch response into success/failure lists.
 * @param {Object} data
 * @param {Array<Object>} records
 * @returns {BatchUpsertResult}
 */
function parseBatchResult(data, records) {
  const successIds = [];
  const failures = [];

  if (Array.isArray(data.results)) {
    for (const result of data.results) {
      if (result.ok) {
        successIds.push(result.recordId);
      } else {
        failures.push({
          memberId: result.recordId,
          errorMessage: result.error || 'Unknown sheet error',
        });
      }
    }
    return { successIds, failures };
  }

  if (data.success) {
    return { successIds: records.map((r) => r.recordId), failures: [] };
  }

  const message = data.error || 'Batch upsert rejected';
  return {
    successIds: [],
    failures: records.map((r) => ({ memberId: r.recordId, errorMessage: message })),
  };
}

/** Google Sheets destination adapter descriptor for the registry. */
export const googleSheetsDestination = {
  id: DESTINATION_IDS.GOOGLE_SHEETS,
  label: 'Google Sheets',
  getRemoteRecordCount,
  upsertBatch,
  retryRecords,
  isConfigured: isGoogleSheetsConfigured,
};
