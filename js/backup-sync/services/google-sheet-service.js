/**
 * @fileoverview Unified Google Sheets API client (Apps Script web app).
 * @module backup-sync/services/google-sheet-service
 */

import { BACKUP_SYNC } from '../backup-sync-constants.js';
import * as Logger from '../../utils/logger.js';

/** Required column headers for restore validation */
export const REQUIRED_SHEET_COLUMNS = Object.freeze([
  'Record ID',
  'Role',
  'Name',
  'Phone',
  'Email',
  'Address',
]);

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
 * @param {Object} [extraParams]
 * @returns {Promise<Object>}
 */
export async function getSheetAction(action, extraParams = {}) {
  if (!isGoogleSheetsConfigured()) {
    throw new Error('Google Sheets API URL is not configured');
  }
  const url = buildUrl(BACKUP_SYNC.GOOGLE_SHEETS_API_URL, { action, ...extraParams });
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
export async function postSheetPayload(payload) {
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
    const data = await getSheetAction('getCount');
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
    const data = await getSheetAction('healthCheck');
    return data.success === true;
  } catch {
    return false;
  }
}

/**
 * Fetches the spreadsheet ID from Apps Script (for audit fields).
 * @returns {Promise<string|null>}
 */
export async function getSpreadsheetId() {
  if (!isGoogleSheetsConfigured()) return null;
  try {
    const data = await getSheetAction('getSpreadsheetId');
    return data.spreadsheetId || null;
  } catch {
    return null;
  }
}

/**
 * Validates that exported sheet data has required columns.
 * @param {string[]} headers
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateSheetHeaders(headers) {
  const headerSet = new Set((headers || []).map((h) => String(h).trim()));
  const missing = REQUIRED_SHEET_COLUMNS.filter((col) => !headerSet.has(col));
  return { valid: missing.length === 0, missing };
}

/**
 * Fetches all household records from Google Sheets for restore analysis.
 * @returns {Promise<{ records: Array<Object>, count: number, spreadsheetId: string|null, headers: string[] }>}
 */
export async function fetchAllSheetRecords() {
  const data = await getSheetAction('exportRecords');
  if (!data.success) {
    throw new Error(data.error || 'Failed to export sheet records');
  }
  if (data.headers) {
    const validation = validateSheetHeaders(data.headers);
    if (!validation.valid) {
      throw new Error(`Sheet is missing required column: ${validation.missing.join(', ')}`);
    }
  }
  return {
    records: Array.isArray(data.records) ? data.records : [],
    count: typeof data.count === 'number' ? data.count : (data.records || []).length,
    spreadsheetId: data.spreadsheetId || null,
    headers: data.headers || [],
  };
}
