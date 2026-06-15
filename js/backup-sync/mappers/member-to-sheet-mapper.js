/**
 * @fileoverview Maps Firestore member_details documents to Google Sheets row payloads.
 * @module backup-sync/mappers/member-to-sheet-mapper
 */

/**
 * Normalizes enum-like values for spreadsheet display.
 * @param {string} value
 * @returns {string}
 */
function normalizeEnum(value) {
  if (!value) return '';
  return String(value).replace(/_/g, ' ');
}

/**
 * Converts a boolean or truthy value into a 'Yes' / 'No' string.
 * @param {boolean} flag
 * @returns {string}
 */
function toYesNoFromBool(flag) {
  return flag ? 'Yes' : 'No';
}

/**
 * Combines address parts into a single string for the spreadsheet.
 * @param {Object} addr - Address object from form/Firestore.
 * @returns {string}
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
 * @param {Object} pd - personalDetails (house owner).
 * @returns {Object|null}
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
    highestEducation: normalizeEnum(pd.highestEducation || ''),
    occupation: normalizeEnum(pd.occupation || ''),
    areaOfExpertise: pd.areaOfExpertise || '',
    healthInsurance: toYesNoFromBool(pd.healthInsurance),
    termInsurance: toYesNoFromBool(pd.termLifeInsurance),
    rationCardType: pd.rationCardType || '',
    address,
    membershipType: normalizeEnum(pd.membershipType || ''),
    holdsPosition: toYesNoFromBool(pd.holdsSpssPosition),
    position: pd.holdsSpssPosition ? (pd.spssPositionName || '') : '',
  };
}

/**
 * Builds a member row object for the spreadsheet API.
 * @param {Object} m - One member from members array.
 * @returns {Object|null}
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
    highestEducation: normalizeEnum(m.highestEducation || ''),
    occupation: normalizeEnum(m.occupation || ''),
    areaOfExpertise: m.areaOfExpertise || '',
    membershipType: normalizeEnum(m.membershipType || ''),
    holdsPosition: toYesNoFromBool(m.holdsSpssPosition),
    position: m.holdsSpssPosition ? (m.spssPositionName || '') : '',
    relationship: m.relationship || '',
    livingOutsideKerala: toYesNoFromBool(m.livingOutsideKerala),
    outsideReason: m.outsideReason || '',
  };
}

/**
 * Builds a non-member row object for the spreadsheet API.
 * @param {Object} nm - One non-member from nonMembers array.
 * @returns {Object|null}
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
    highestEducation: normalizeEnum(nm.highestEducation || ''),
    occupation: normalizeEnum(nm.occupation || ''),
    areaOfExpertise: nm.areaOfExpertise || '',
    relationship: nm.relationship || '',
    livingOutsideKerala: toYesNoFromBool(nm.livingOutsideKerala),
    outsideReason: nm.outsideReason || '',
    reasonForNoMembership: nm.reasonForNoMembership || '',
  };
}

/**
 * Builds the full JSON payload for a single household record.
 * @param {string} recordId - Firestore document ID.
 * @param {Object} memberDoc - member_details document data.
 * @returns {Object|null} Payload with pradeshikaSabha, recordId, head, members, nonMembers.
 */
export function mapMemberDocToSheetRecord(recordId, memberDoc) {
  if (!recordId || !memberDoc) return null;
  const pd = memberDoc.personalDetails || {};
  const pradeshikaSabha = pd.pradeshikaSabha || '';
  if (!pradeshikaSabha) return null;

  const head = buildHeadFromPersonalDetails(pd);
  if (!head) return null;

  const members = (memberDoc.members || []).map(buildMemberRow).filter(Boolean);
  const nonMembers = (memberDoc.nonMembers || []).map(buildNonMemberRow).filter(Boolean);

  return {
    recordId,
    pradeshikaSabha,
    head,
    members,
    nonMembers,
  };
}

/**
 * Maps an array of member_details documents to sheet records.
 * @param {Array<{ id: string } & Object>} memberDocs
 * @returns {Array<Object>}
 */
export function mapMemberDocsToSheetRecords(memberDocs) {
  return (memberDocs || [])
    .map((doc) => mapMemberDocToSheetRecord(doc.id, doc))
    .filter(Boolean);
}
