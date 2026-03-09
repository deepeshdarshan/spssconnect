/**
 * @fileoverview Google Sheets backup for family registration data.
 * Firebase is the source of truth; this module writes to Sheets only after successful
 * Firebase operations. All spreadsheet API responses are logged to the console only,
 * never shown in the UI.
 * @module sheets-backup-service
 */

import { ENABLE_SPREADSHEET_SYNC, SPREADSHEET_API_URL } from './constants.js';

/**
 * Combines address parts into a single string for the spreadsheet.
 * @param {Object} addr - Address object from form/Firestore.
 * @param {string} [addr.address1] - Line 1 (or addressLine1).
 * @param {string} [addr.address2] - Line 2 (or addressLine2).
 * @param {string} [addr.place] - Place/locality.
 * @param {string} [addr.pin] - PIN code.
 * @returns {string} Combined address string, e.g. "Line 1, Line 2, Place - PIN".
 * @sideeffects None.
 */
export function combineAddress(addr) {
  if (!addr || typeof addr !== 'object') return '';
  const a1 = addr.address1 || addr.addressLine1 || '';
  const a2 = addr.address2 || addr.addressLine2 || '';
  const place = addr.place || '';
  const pin = addr.pin || '';
  const parts = [a1, a2].filter(Boolean);
  if (place || pin) parts.push(`${place}${place && pin ? ' - ' : ''}${pin}`);
  return parts.join(', ').trim();
}

/**
 * Builds the head object for the spreadsheet API from app personalDetails.
 * @param {Object} pd - personalDetails (house owner) from app form/Firestore.
 * @returns {Object} head object with role, houseName, name, dob, gender, phone, email, etc.
 * @sideeffects None.
 */
function buildHeadFromPersonalDetails(pd) {
  if (!pd) return null;
  const address = combineAddress(pd.address || {});
  return {
    role: 'head',
    houseName: pd.houseName || '',
    name: pd.name || '',
    dob: pd.dob || '',
    gender: pd.gender || '',
    phone: pd.phone || '',
    email: pd.email || '',
    bloodGroup: pd.bloodGroup || '',
    highestEducation: pd.highestEducation || '',
    occupation: pd.occupation || '',
    areaOfExpertise: pd.areaOfExpertise || '',
    healthInsurance: Boolean(pd.healthInsurance),
    termInsurance: Boolean(pd.termLifeInsurance),
    rationCardType: pd.rationCardType || '',
    address,
    membershipType: pd.membershipType || '',
    holdsPosition: Boolean(pd.holdsSpssPosition),
    position: pd.holdsSpssPosition ? (pd.spssPositionName || '') : '',
  };
}

/**
 * Builds a member row object for the spreadsheet API from app member entry.
 * @param {Object} m - One member from app members array.
 * @returns {Object} Member object with role, name, dob, gender, relationship, etc.
 * @sideeffects None.
 */
function buildMemberRow(m) {
  if (!m) return null;
  return {
    role: 'member',
    name: m.name || '',
    dob: m.dob || '',
    gender: m.gender || '',
    phone: m.phone || '',
    email: m.email || '',
    bloodGroup: m.bloodGroup || '',
    highestEducation: m.highestEducation || '',
    occupation: m.occupation || '',
    areaOfExpertise: m.areaOfExpertise || '',
    membershipType: m.membershipType || '',
    holdsPosition: Boolean(m.holdsSpssPosition),
    position: m.holdsSpssPosition ? (m.spssPositionName || '') : '',
    relationship: m.relationship || '',
    livingOutsideKerala: Boolean(m.livingOutsideKerala),
    outsideReason: m.outsideReason || '',
  };
}

/**
 * Builds a non-member row object for the spreadsheet API from app nonMember entry.
 * @param {Object} nm - One non-member from app nonMembers array.
 * @returns {Object} Non-member object with role, name, dob, relationship, reasonForNoMembership, etc.
 * @sideeffects None.
 */
function buildNonMemberRow(nm) {
  if (!nm) return null;
  return {
    role: 'non-member',
    name: nm.name || '',
    dob: nm.dob || '',
    gender: nm.gender || '',
    phone: nm.phone || '',
    email: nm.email || '',
    bloodGroup: nm.bloodGroup || '',
    highestEducation: nm.highestEducation || '',
    occupation: nm.occupation || '',
    areaOfExpertise: nm.areaOfExpertise || '',
    relationship: nm.relationship || '',
    livingOutsideKerala: Boolean(nm.livingOutsideKerala),
    outsideReason: nm.outsideReason || '',
    reasonForNoMembership: nm.reasonForNoMembership || '',
  };
}

/**
 * Builds the full JSON payload expected by the Google Apps Script API.
 * @param {string} recordId - Family record ID (e.g. Firebase document ID).
 * @param {Object} formData - App form data: { personalDetails, members, nonMembers }.
 * @param {string} pradeshikaSabha - Sabha name; determines which sheet tab is written.
 * @returns {Object} Payload with action, pradeshikaSabha, recordId, head, members, nonMembers.
 * @sideeffects None.
 */
export function buildSpreadsheetPayload(recordId, formData, pradeshikaSabha) {
  if (!recordId || !formData || !pradeshikaSabha) return null;
  const head = buildHeadFromPersonalDetails(formData.personalDetails);
  const members = (formData.members || []).map(buildMemberRow).filter(Boolean);
  const nonMembers = (formData.nonMembers || []).map(buildNonMemberRow).filter(Boolean);
  return {
    action: 'save',
    pradeshikaSabha,
    recordId,
    head,
    members,
    nonMembers,
  };
}

/**
 * Builds the update payload (same shape as save; API uses action to replace rows).
 * @param {string} recordId - Family record ID.
 * @param {Object} formData - App form data.
 * @param {string} pradeshikaSabha - Sabha name.
 * @returns {Object} Payload with action: 'update', pradeshikaSabha, recordId, head, members, nonMembers.
 * @sideeffects None.
 */
export function buildSpreadsheetUpdatePayload(recordId, formData, pradeshikaSabha) {
  const payload = buildSpreadsheetPayload(recordId, formData, pradeshikaSabha);
  if (!payload) return null;
  payload.action = 'update';
  return payload;
}

/**
 * Sends a payload to the Google Apps Script API via POST.
 * Uses `no-cors` mode so the browser will not block the request due to missing
 * CORS headers from Apps Script. The response is opaque; we only log that the
 * request was sent, without inspecting the body.
 * @param {Object} payload - Full request body (action, pradeshikaSabha, recordId, head, members, nonMembers).
 * @returns {Promise<void>} Resolves when the request is fired; errors are logged.
 * @sideeffects Network request; console.log of opaque response type.
 */
export async function sendToSpreadsheetApi(payload) {
  try {
    const res = await fetch(SPREADSHEET_API_URL, {
      method: 'POST',
      mode: 'no-cors',
      // Use a \"simple\" content type to avoid CORS preflight; body is still JSON string.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    console.log('Spreadsheet request sent (no-cors), response type:', res.type);
  } catch (err) {
    console.error('Spreadsheet request failed:', err);
  }
}

/**
 * Saves a new family to the spreadsheet (action: save).
 * Only runs if ENABLE_SPREADSHEET_SYNC is true. Response logged to console only.
 * @param {string} recordId - Firebase document ID (saved record).
 * @param {Object} formData - App form data after successful Firebase create.
 * @returns {Promise<void>} Resolves when request completes; errors are logged, not thrown to UI.
 * @sideeffects Optional fetch; console.log of response.
 */
export async function saveToSpreadsheet(recordId, formData) {
  if (!ENABLE_SPREADSHEET_SYNC) return;
  const pd = formData?.personalDetails || {};
  const pradeshikaSabha = pd.pradeshikaSabha || '';
  if (!pradeshikaSabha) {
    console.warn('Spreadsheet sync skipped: pradeshikaSabha missing');
    return;
  }
  const payload = buildSpreadsheetPayload(recordId, formData, pradeshikaSabha);
  if (!payload || !payload.head) {
    console.warn('Spreadsheet sync skipped: invalid payload');
    return;
  }
  try {
    await sendToSpreadsheetApi(payload);
  } catch (err) {
    console.error('Spreadsheet save request failed:', err);
  }
}

/**
 * Updates an existing family in the spreadsheet (action: update).
 * Replaces all rows for this recordId with the new head/members/nonMembers.
 * @param {string} recordId - Firebase document ID.
 * @param {Object} formData - App form data after successful Firebase update.
 * @returns {Promise<void>} Resolves when request completes; errors logged only.
 * @sideeffects Optional fetch; console.log of response.
 */
export async function updateInSpreadsheet(recordId, formData) {
  if (!ENABLE_SPREADSHEET_SYNC) return;
  const pd = formData?.personalDetails || {};
  const pradeshikaSabha = pd.pradeshikaSabha || '';
  if (!pradeshikaSabha) {
    console.warn('Spreadsheet sync skipped: pradeshikaSabha missing');
    return;
  }
  const payload = buildSpreadsheetUpdatePayload(recordId, formData, pradeshikaSabha);
  if (!payload || !payload.head) {
    console.warn('Spreadsheet sync skipped: invalid payload');
    return;
  }
  try {
    await sendToSpreadsheetApi(payload);
  } catch (err) {
    console.error('Spreadsheet update request failed:', err);
  }
}

/**
 * Deletes all rows for a family from the spreadsheet (action: delete).
 * @param {string} recordId - Firebase document ID (family to remove).
 * @param {string} pradeshikaSabha - Sabha name (determines sheet tab).
 * @returns {Promise<void>} Resolves when request completes; errors logged only.
 * @sideeffects Optional fetch; console.log of response.
 */
export async function deleteFromSpreadsheet(recordId, pradeshikaSabha) {
  if (!ENABLE_SPREADSHEET_SYNC) return;
  if (!recordId || !pradeshikaSabha) {
    console.warn('Spreadsheet delete skipped: recordId or pradeshikaSabha missing');
    return;
  }
  const payload = {
    action: 'delete',
    pradeshikaSabha,
    recordId,
  };
  try {
    await sendToSpreadsheetApi(payload);
  } catch (err) {
    console.error('Spreadsheet delete request failed:', err);
  }
}
