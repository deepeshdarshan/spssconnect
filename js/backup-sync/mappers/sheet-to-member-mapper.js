/**
 * @fileoverview Maps Google Sheets household payloads back to Firestore member_details shape.
 * @module backup-sync/mappers/sheet-to-member-mapper
 */

/**
 * Converts display enum back to Firestore key (e.g. "life member" → life_member).
 * @param {string} value
 * @returns {string}
 */
export function denormalizeEnum(value) {
  if (!value) return '';
  return String(value).trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Parses Yes/No spreadsheet values to boolean.
 * @param {string} value
 * @returns {boolean}
 */
export function parseYesNo(value) {
  return String(value || '').trim().toLowerCase() === 'yes';
}

/**
 * Best-effort parse of combined address string into Firestore address object.
 * @param {string} addressStr
 * @returns {Object}
 */
export function parseAddress(addressStr) {
  const raw = String(addressStr || '').trim();
  if (!raw) {
    return { address1: '', address2: '', place: '', pin: '' };
  }
  const pinMatch = raw.match(/\b(\d{6})\b/);
  const pin = pinMatch ? pinMatch[1] : '';
  let remainder = raw;
  if (pin) {
    remainder = raw.replace(pin, '').replace(/\s*-\s*$/, '').trim();
  }
  const parts = remainder.split(',').map((p) => p.trim()).filter(Boolean);
  const place = parts.length > 1 ? parts[parts.length - 1] : '';
  const address1 = parts[0] || '';
  const address2 = parts.length > 2 ? parts.slice(1, -1).join(', ') : (parts.length === 2 ? '' : '');
  return { address1, address2, place, pin };
}

/**
 * Maps a sheet person row object to personalDetails (house owner).
 * @param {Object} head - Sheet head row object.
 * @returns {Object}
 */
function mapHeadToPersonalDetails(head) {
  const address = parseAddress(head.address || '');
  return {
    name: head.name || '',
    houseName: head.houseName || '',
    dob: head.dob || '',
    gender: denormalizeEnum(head.gender),
    pradeshikaSabha: head.pradeshikaSabha || '',
    phone: head.phone || '',
    email: head.email || '',
    bloodGroup: head.bloodGroup || '',
    occupation: denormalizeEnum(head.occupation),
    areaOfExpertise: head.areaOfExpertise || '',
    highestEducation: denormalizeEnum(head.highestEducation),
    membershipType: denormalizeEnum(head.membershipType),
    photoURL: '',
    holdsSpssPosition: parseYesNo(head.holdsPosition),
    spssPositionName: head.position || '',
    healthInsurance: parseYesNo(head.healthInsurance),
    termLifeInsurance: parseYesNo(head.termInsurance),
    rationCardType: denormalizeEnum(head.rationCardType) || 'none',
    address,
  };
}

/**
 * Maps a sheet member row to a Firestore members[] entry.
 * @param {Object} row
 * @returns {Object}
 */
function mapMemberRow(row) {
  return {
    name: row.name || '',
    dob: row.dob || '',
    gender: denormalizeEnum(row.gender),
    relationship: denormalizeEnum(row.relationship),
    membershipType: denormalizeEnum(row.membershipType),
    bloodGroup: row.bloodGroup || '',
    phone: row.phone || '',
    email: row.email || '',
    highestEducation: denormalizeEnum(row.highestEducation),
    occupation: denormalizeEnum(row.occupation),
    areaOfExpertise: row.areaOfExpertise || '',
    holdsSpssPosition: parseYesNo(row.holdsPosition),
    spssPositionName: row.position || '',
    livingOutsideKerala: parseYesNo(row.livingOutsideKerala),
    outsideReason: denormalizeEnum(row.outsideReason),
  };
}

/**
 * Maps a sheet non-member row to a Firestore nonMembers[] entry.
 * @param {Object} row
 * @returns {Object}
 */
function mapNonMemberRow(row) {
  return {
    name: row.name || '',
    dob: row.dob || '',
    gender: denormalizeEnum(row.gender),
    relationship: denormalizeEnum(row.relationship),
    bloodGroup: row.bloodGroup || '',
    phone: row.phone || '',
    email: row.email || '',
    highestEducation: denormalizeEnum(row.highestEducation),
    occupation: denormalizeEnum(row.occupation),
    areaOfExpertise: row.areaOfExpertise || '',
    livingOutsideKerala: parseYesNo(row.livingOutsideKerala),
    outsideReason: denormalizeEnum(row.outsideReason),
    reasonForNoMembership: row.reasonForNoMembership || '',
  };
}

/**
 * Validates a sheet household record before mapping.
 * @param {Object} record
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateSheetRecord(record) {
  if (!record?.recordId) {
    return { valid: false, error: 'Missing recordId' };
  }
  if (!record.pradeshikaSabha) {
    return { valid: false, error: 'Missing pradeshikaSabha' };
  }
  if (!record.head) {
    return { valid: false, error: 'Missing head row' };
  }
  return { valid: true };
}

/**
 * Maps a sheet household JSON payload to Firestore member_details document data.
 * @param {Object} record - { recordId, pradeshikaSabha, head, members, nonMembers }
 * @returns {Object|null} { personalDetails, members, nonMembers }
 */
export function mapSheetRecordToMemberDoc(record) {
  const validation = validateSheetRecord(record);
  if (!validation.valid) return null;

  const head = { ...record.head, pradeshikaSabha: record.pradeshikaSabha };
  const personalDetails = mapHeadToPersonalDetails(head);
  const members = (record.members || []).map(mapMemberRow);
  const nonMembers = (record.nonMembers || []).map(mapNonMemberRow);

  return { personalDetails, members, nonMembers };
}

/**
 * Sorts array entries for stable comparison.
 * @param {Array<Object>} arr
 * @returns {Array<Object>}
 */
function sortPeople(arr) {
  return [...(arr || [])].sort((a, b) => {
    const na = `${a.name || ''}|${a.relationship || ''}`;
    const nb = `${b.name || ''}|${b.relationship || ''}`;
    return na.localeCompare(nb);
  });
}

/**
 * Produces a canonical household object for equality comparison (strips metadata).
 * @param {Object} memberDoc - Firestore member_details data or mapped sheet doc.
 * @returns {Object}
 */
export function normalizeHouseholdForCompare(memberDoc) {
  if (!memberDoc) return {};
  const pd = memberDoc.personalDetails || {};
  return {
    personalDetails: {
      name: pd.name || '',
      houseName: pd.houseName || '',
      dob: pd.dob || '',
      gender: pd.gender || '',
      pradeshikaSabha: pd.pradeshikaSabha || '',
      phone: pd.phone || '',
      email: pd.email || '',
      bloodGroup: pd.bloodGroup || '',
      occupation: pd.occupation || '',
      areaOfExpertise: pd.areaOfExpertise || '',
      highestEducation: pd.highestEducation || '',
      membershipType: pd.membershipType || '',
      holdsSpssPosition: Boolean(pd.holdsSpssPosition),
      spssPositionName: pd.spssPositionName || '',
      healthInsurance: Boolean(pd.healthInsurance),
      termLifeInsurance: Boolean(pd.termLifeInsurance),
      rationCardType: pd.rationCardType || 'none',
      address: pd.address || {},
    },
    members: sortPeople(memberDoc.members),
    nonMembers: sortPeople(memberDoc.nonMembers),
  };
}

/**
 * Returns top-level field names that differ between two normalized households.
 * @param {Object} a
 * @param {Object} b
 * @returns {string[]}
 */
export function diffHouseholdFields(a, b) {
  const fields = [];
  if (JSON.stringify(a.personalDetails) !== JSON.stringify(b.personalDetails)) {
    fields.push('personalDetails');
  }
  if (JSON.stringify(a.members) !== JSON.stringify(b.members)) {
    fields.push('members');
  }
  if (JSON.stringify(a.nonMembers) !== JSON.stringify(b.nonMembers)) {
    fields.push('nonMembers');
  }
  return fields;
}

/**
 * Builds a short preview object for UI display.
 * @param {string} recordId
 * @param {Object} memberDoc
 * @returns {{ recordId: string, preview: { name: string, phone: string, sabha: string } }}
 */
export function buildRecordPreview(recordId, memberDoc) {
  const pd = memberDoc?.personalDetails || {};
  return {
    recordId,
    preview: {
      name: pd.name || '—',
      phone: pd.phone || '—',
      sabha: pd.pradeshikaSabha || '—',
    },
  };
}
