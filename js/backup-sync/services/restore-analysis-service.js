/**
 * @fileoverview Compares Firestore member_details with Google Sheet backup data.
 * @module backup-sync/services/restore-analysis-service
 */

import { getAllMembers } from '../../services/member-service.js';
import { fetchAllSheetRecords, isGoogleSheetsConfigured } from './google-sheet-service.js';
import {
  mapSheetRecordToMemberDoc,
  normalizeHouseholdForCompare,
  diffHouseholdFields,
  buildRecordPreview,
  validateSheetRecord,
} from '../mappers/sheet-to-member-mapper.js';
import { saveAnalysisResult } from './restore-metadata-service.js';
import { BACKUP_SYNC, RESTORE_MODE } from '../backup-sync-constants.js';

/**
 * @typedef {Object} RestoreAnalysisResult
 * @property {number} firestoreCount
 * @property {number} sheetCount
 * @property {Array<Object>} missingInFirestore
 * @property {Array<Object>} modified
 * @property {Array<Object>} extraInFirestore
 * @property {Array<Object>} invalidSheetRecords
 * @property {string|null} sourceSheetId
 */

/**
 * Builds a keyed map of Firestore households normalized for comparison.
 * @param {Array<Object>} members
 * @returns {Map<string, Object>}
 */
function buildFirestoreMap(members) {
  const map = new Map();
  for (const m of members) {
    const id = m.id || m._docId;
    if (!id) continue;
    const { id: _i, _docId, metadata, ...data } = m;
    map.set(id, normalizeHouseholdForCompare(data));
  }
  return map;
}

/**
 * Builds a keyed map of sheet households mapped to member_details shape.
 * @param {Array<Object>} sheetRecords
 * @returns {{ map: Map<string, Object>, invalid: Array<Object>, rawDocs: Map<string, Object> }}
 */
function buildSheetMap(sheetRecords) {
  const map = new Map();
  const rawDocs = new Map();
  const invalid = [];

  for (const rec of sheetRecords) {
    const validation = validateSheetRecord(rec);
    if (!validation.valid) {
      invalid.push({ recordId: rec.recordId || '—', error: validation.error });
      continue;
    }
    const memberDoc = mapSheetRecordToMemberDoc(rec);
    if (!memberDoc) {
      invalid.push({ recordId: rec.recordId, error: 'Failed to map sheet record' });
      continue;
    }
    map.set(rec.recordId, normalizeHouseholdForCompare(memberDoc));
    rawDocs.set(rec.recordId, memberDoc);
  }

  return { map, invalid, rawDocs };
}

/**
 * Compares Firestore with Google Sheet and returns a detailed analysis summary.
 *
 * @param {string} [destinationId]
 * @param {{ persist?: boolean }} [options] - When `persist` is true (default), saves summary to restore_metadata.
 * @returns {Promise<RestoreAnalysisResult>}
 * @throws {Error} When Google Sheets is not configured or export fails.
 */
export async function analyzeRestore(
  destinationId = BACKUP_SYNC.DEFAULT_DESTINATION_ID,
  options = {},
) {
  const { persist = true } = options;
  if (!isGoogleSheetsConfigured()) {
    throw new Error('Google Sheets backup is not configured.');
  }

  const [firestoreMembers, sheetExport] = await Promise.all([
    getAllMembers(),
    fetchAllSheetRecords(),
  ]);

  const fsMap = buildFirestoreMap(firestoreMembers);
  const { map: sheetMap, invalid, rawDocs } = buildSheetMap(sheetExport.records);

  const missingInFirestore = [];
  const modified = [];
  const extraInFirestore = [];

  for (const [recordId, sheetNorm] of sheetMap.entries()) {
    const fsNorm = fsMap.get(recordId);
    if (!fsNorm) {
      const raw = rawDocs.get(recordId);
      missingInFirestore.push(buildRecordPreview(recordId, raw));
    } else if (JSON.stringify(fsNorm) !== JSON.stringify(sheetNorm)) {
      modified.push({
        recordId,
        fields: diffHouseholdFields(fsNorm, sheetNorm),
        preview: buildRecordPreview(recordId, rawDocs.get(recordId)).preview,
      });
    }
  }

  for (const [recordId, fsNorm] of fsMap.entries()) {
    if (!sheetMap.has(recordId)) {
      extraInFirestore.push(buildRecordPreview(recordId, fsNorm));
    }
  }

  const result = {
    firestoreCount: fsMap.size,
    sheetCount: sheetMap.size,
    missingInFirestore,
    modified,
    extraInFirestore,
    invalidSheetRecords: invalid,
    sourceSheetId: sheetExport.spreadsheetId,
  };

  if (persist) {
    await saveAnalysisResult(destinationId, {
      firestoreCount: result.firestoreCount,
      sheetCount: result.sheetCount,
      missingCount: missingInFirestore.length,
      modifiedCount: modified.length,
      extraCount: extraInFirestore.length,
      invalidCount: invalid.length,
    });
  }

  return result;
}

/**
 * Builds restore preview counts from analysis and selected mode.
 * @param {RestoreAnalysisResult} analysis
 * @param {string} mode - missing_only | full
 * @param {boolean} deleteOrphans
 * @returns {{ toCreate: string[], toUpdate: string[], toDelete: string[] }}
 */
export function buildRestorePreview(analysis, mode, deleteOrphans) {
  const toCreate = analysis.missingInFirestore.map((r) => r.recordId);

  if (mode === RESTORE_MODE.MISSING_ONLY) {
    return { toCreate, toUpdate: [], toDelete: [] };
  }

  const toUpdate = analysis.modified.map((r) => r.recordId);
  const toDelete = deleteOrphans
    ? analysis.extraInFirestore.map((r) => r.recordId)
    : [];

  return { toCreate, toUpdate, toDelete };
}

/**
 * Runs a lightweight post-restore validation (count comparison).
 * @returns {Promise<{ firestoreCount: number, sheetCount: number, matched: boolean, missingCount: number }>}
 */
export async function validateAfterRestore() {
  const analysis = await analyzeRestore(BACKUP_SYNC.DEFAULT_DESTINATION_ID, { persist: false });
  return {
    firestoreCount: analysis.firestoreCount,
    sheetCount: analysis.sheetCount,
    matched: analysis.firestoreCount === analysis.sheetCount
      && analysis.missingInFirestore.length === 0,
    missingCount: analysis.missingInFirestore.length,
  };
}
