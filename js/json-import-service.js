/**
 * @fileoverview JSON import service — parse, validate, and batch-import records to Firestore.
 * @module json-import-service
 */

import { COLLECTIONS } from './constants.js';
import { batchWrite, getServerTimestamp } from './firestore-service.js';
import { getCurrentUser } from './auth-service.js';
import { showToast, showLoader, hideLoader } from './ui-service.js';

/**
 * Main entry point — reads JSON from paste area or file input, validates, and imports.
 * Called by the dashboard import button.
 * @returns {Promise<number>} Number of records successfully imported.
 */
export async function handleImport() {
  const statusEl = document.getElementById('importStatus');
  const setStatus = (msg, cls) => {
    if (statusEl) {
      statusEl.textContent = msg;
      statusEl.className = `align-self-center small text-${cls}`;
    }
  };

  try {
    const rawJSON = getJSONInput();
    if (!rawJSON) {
      setStatus('No JSON data provided.', 'danger');
      return 0;
    }

    const parsed = parseJSON(rawJSON);
    if (!parsed) {
      setStatus('Invalid JSON format.', 'danger');
      return 0;
    }

    const records = Array.isArray(parsed) ? parsed : [parsed];
    const { valid, invalid } = validateRecords(records);

    if (valid.length === 0) {
      setStatus(`All ${invalid.length} record(s) failed validation.`, 'danger');
      return 0;
    }

    if (invalid.length > 0) {
      setStatus(`${invalid.length} record(s) skipped (invalid). Importing ${valid.length}...`, 'warning');
    }

    showLoader(`Importing ${valid.length} record(s)...`);

    const enriched = enrichWithMetadata(valid);
    const count = await batchWrite(COLLECTIONS.MEMBER_DETAILS, enriched);

    hideLoader();
    setStatus(`Successfully imported ${count} record(s).`, 'success');
    showToast(`Imported ${count} record(s).`, 'success');
    clearInputs();

    return count;
  } catch (err) {
    hideLoader();
    console.error('Import failed:', err);
    setStatus('Import failed. Check console for details.', 'danger');
    showToast('Import failed.', 'error');
    return 0;
  }
}

/**
 * Reads JSON text from the paste textarea or the file input.
 * @returns {string|null} Raw JSON string or null.
 */
function getJSONInput() {
  const pasteArea = document.getElementById('jsonPasteArea');
  if (pasteArea?.value?.trim()) {
    return pasteArea.value.trim();
  }

  const fileInput = document.getElementById('jsonFileInput');
  if (fileInput?.files?.[0]) {
    return null;
  }

  return null;
}

/**
 * Handles the full import flow including file reading (async).
 * This is the version that handles the file input asynchronously.
 * Re-exports as main handler to be called from the dashboard.
 * @returns {Promise<number>}
 */
export async function handleImportWithFile() {
  const pasteArea = document.getElementById('jsonPasteArea');
  const fileInput = document.getElementById('jsonFileInput');

  let rawJSON = pasteArea?.value?.trim() || null;

  if (!rawJSON && fileInput?.files?.[0]) {
    rawJSON = await readFileAsText(fileInput.files[0]);
  }

  if (!rawJSON) {
    showToast('No JSON data provided. Paste JSON or select a file.', 'warning');
    return 0;
  }

  const statusEl = document.getElementById('importStatus');
  const setStatus = (msg, cls) => {
    if (statusEl) {
      statusEl.textContent = msg;
      statusEl.className = `align-self-center small text-${cls}`;
    }
  };

  const parsed = parseJSON(rawJSON);
  if (!parsed) {
    setStatus('Invalid JSON format.', 'danger');
    showToast('Invalid JSON format.', 'error');
    return 0;
  }

  const records = Array.isArray(parsed) ? parsed : [parsed];
  const { valid, invalid } = validateRecords(records);

  if (valid.length === 0) {
    setStatus(`All ${invalid.length} record(s) failed validation.`, 'danger');
    showToast('No valid records to import.', 'error');
    return 0;
  }

  if (invalid.length > 0) {
    setStatus(`${invalid.length} skipped. Importing ${valid.length}...`, 'warning');
  }

  showLoader(`Importing ${valid.length} record(s)...`);

  try {
    const enriched = enrichWithMetadata(valid);
    const count = await batchWrite(COLLECTIONS.MEMBER_DETAILS, enriched);
    hideLoader();
    setStatus(`Imported ${count} record(s) successfully.`, 'success');
    showToast(`Imported ${count} record(s).`, 'success');
    clearInputs();
    return count;
  } catch (err) {
    hideLoader();
    console.error('Batch write failed:', err);
    setStatus('Import failed.', 'danger');
    showToast('Import failed.', 'error');
    return 0;
  }
}

/* ================================================================== */
/*  Parsing                                                            */
/* ================================================================== */

/**
 * Safely parses a JSON string.
 * @param {string} input
 * @returns {Object|Array|null}
 */
export function parseJSON(input) {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

/**
 * Reads a File object as text.
 * @param {File} file
 * @returns {Promise<string>}
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/* ================================================================== */
/*  Validation                                                         */
/* ================================================================== */

/**
 * Validates an array of records against the expected Firestore schema.
 * @param {Array<Object>} records
 * @returns {{valid: Array<Object>, invalid: Array<{index: number, reason: string}>}}
 */
function validateRecords(records) {
  const valid = [];
  const invalid = [];

  records.forEach((record, index) => {
    const reason = validateSingleRecord(record);
    if (reason) {
      invalid.push({ index, reason });
    } else {
      valid.push(record);
    }
  });

  return { valid, invalid };
}

/**
 * Validates a single record object for required fields.
 * @param {Object} record
 * @returns {string|null} Error reason or null if valid.
 */
export function validateJSONStructure(record) {
  return validateSingleRecord(record);
}

/**
 * @param {Object} record
 * @returns {string|null}
 */
function validateSingleRecord(record) {
  if (!record || typeof record !== 'object') return 'Not an object';

  const pd = record.personalDetails;
  if (!pd || typeof pd !== 'object') return 'Missing personalDetails';
  if (!pd.name || typeof pd.name !== 'string') return 'Missing personalDetails.name';

  if (record.members && !Array.isArray(record.members)) return 'members must be an array';
  if (record.nonMembers && !Array.isArray(record.nonMembers)) return 'nonMembers must be an array';

  return null;
}

/* ================================================================== */
/*  Metadata Enrichment                                                */
/* ================================================================== */

/**
 * Adds metadata fields to each record before import.
 * @param {Array<Object>} records
 * @returns {Array<Object>}
 */
function enrichWithMetadata(records) {
  const user = getCurrentUser();
  const uid = user ? user.uid : 'import';
  const ts = getServerTimestamp();

  return records.map((record) => ({
    personalDetails: record.personalDetails || {},
    members: record.members || [],
    nonMembers: record.nonMembers || [],
    metadata: {
      createdAt: ts,
      createdBy: uid,
      updatedAt: ts,
    },
  }));
}

/** Clears the paste area and file input. */
function clearInputs() {
  const paste = document.getElementById('jsonPasteArea');
  const file = document.getElementById('jsonFileInput');
  if (paste) paste.value = '';
  if (file) file.value = '';
}
