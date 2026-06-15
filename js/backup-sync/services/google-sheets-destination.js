/**
 * @fileoverview Google Sheets destination adapter — HTTP calls to Apps Script.
 * @module backup-sync/services/google-sheets-destination
 */

import { BACKUP_SYNC, DESTINATION_IDS } from '../backup-sync-constants.js';
import { mapMemberDocsToSheetRecords } from '../mappers/member-to-sheet-mapper.js';
import * as Logger from '../../utils/logger.js';

/**
 * @typedef {Object} BatchUpsertResult
 * @property {string[]} successIds
 * @property {Array<{ memberId: string, errorMessage: string }>} failures
 */

/**
 * Returns whether the Google Sheets API URL is configured.
 * @returns {boolean}
 */
export function isGoogleSheetsConfigured() {
  return Boolean(BACKUP_SYNC.GOOGLE_SHEETS_API_URL);
}

/**
 * Builds request headers for Apps Script API calls.
 * @returns {Object}
 */
function buildHeaders() {
  return { 'Content-Type': 'text/plain;charset=utf-8' };
}

/**
 * Appends optional API token to a URL as query param.
 * @param {string} baseUrl
 * @param {Object} [params]
 * @returns {string}
 */
function buildUrl(baseUrl, params = {}) {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  });
  if (BACKUP_SYNC.API_TOKEN) {
    url.searchParams.set('token', BACKUP_SYNC.API_TOKEN);
  }
  return url.toString();
}

/**
 * Parses JSON response from Apps Script, with fallback for non-JSON errors.
 * @param {Response} res
 * @returns {Promise<Object>}
 */
async function parseJsonResponse(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || `HTTP ${res.status}`);
  }
}

/**
 * GET action against the Apps Script web app.
 * @param {string} action
 * @returns {Promise<Object>}
 */
async function getAction(action) {
  if (!isGoogleSheetsConfigured()) {
    throw new Error('Google Sheets API URL is not configured');
  }
  const url = buildUrl(BACKUP_SYNC.GOOGLE_SHEETS_API_URL, { action });
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Sheets API ${action} failed: HTTP ${res.status}`);
  }
  return parseJsonResponse(res);
}

/**
 * POST JSON payload to the Apps Script web app.
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
async function postPayload(payload) {
  if (!isGoogleSheetsConfigured()) {
    throw new Error('Google Sheets API URL is not configured');
  }
  const url = buildUrl(BACKUP_SYNC.GOOGLE_SHEETS_API_URL);
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Sheets API POST failed: HTTP ${res.status}`);
  }
  return parseJsonResponse(res);
}

/**
 * Returns total home record count from the Google Sheet.
 * @returns {Promise<number|null>} Null when URL not configured.
 */
export async function getRemoteRecordCount() {
  if (!isGoogleSheetsConfigured()) return null;
  try {
    const data = await getAction('getCount');
    return typeof data.count === 'number' ? data.count : Number(data.count) || 0;
  } catch (err) {
    Logger.error('getRemoteRecordCount failed:', err);
    throw err;
  }
}

/**
 * Verifies Apps Script connectivity.
 * @returns {Promise<boolean>}
 */
export async function healthCheck() {
  if (!isGoogleSheetsConfigured()) return false;
  try {
    const data = await getAction('healthCheck');
    return data.success === true;
  } catch {
    return false;
  }
}

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
    const data = await postPayload({ action: 'batchUpsert', records });
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
