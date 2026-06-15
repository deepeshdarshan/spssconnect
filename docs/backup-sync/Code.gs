/**
 * SPSS Connect — Backup & Sync Center (Google Sheets destination)
 *
 * Setup:
 *   1. Set SPREADSHEET_ID below (from your sheet URL).
 *   2. Run testSpreadsheetConnection — check Executions log.
 *   3. Run setupBackupSheets — creates 7 Pradeshika Sabha tabs.
 *   4. Deploy → New deployment → Web app (Execute as: Me, Access: Anyone).
 *   5. Paste /exec URL into js/backup-sync/backup-sync-constants.js
 */

// From URL: https://docs.google.com/spreadsheets/d/PASTE_ID_HERE/edit
var SPREADSHEET_ID = '';

// Optional — must match BACKUP_SYNC.API_TOKEN in backup-sync-constants.js
var API_TOKEN = '';

/** Pradeshika Sabha tab names — must match Firestore personalDetails.pradeshikaSabha exactly */
var SABHA_NAMES = [
  'Ernakulam',
  'Edappally',
  'Tripunithura',
  'Chottanikkara',
  'Perumbavoor',
  'Aluva',
  'Panangad'
];

var HEADERS = [
  'Record ID',
  'Role',
  'House Name',
  'Name',
  'DOB',
  'Gender',
  'Phone',
  'Email',
  'Blood Group',
  'Highest Education',
  'Occupation',
  'Area of Expertise',
  'Health Insurance',
  'Term Insurance',
  'Ration Card Type',
  'Address',
  'Membership Type',
  'Holds Position',
  'Position',
  'Relationship',
  'Living Outside Kerala',
  'Outside Reason',
  'Reason for No Membership'
];

// —— Web App entry points ——————————————————————————————————————————————————

function doGet(e) {
  if (!validateToken_(e)) {
    return json_({ success: false, error: 'Unauthorized' });
  }

  var action = e && e.parameter ? e.parameter.action : '';

  if (action === 'healthCheck') {
    return json_({ success: true, message: 'OK' });
  }

  if (action === 'getCount') {
    return json_({ success: true, count: countHomes_() });
  }

  if (action === 'getSpreadsheetId') {
    return json_({ success: true, spreadsheetId: getSpreadsheet_().getId() });
  }

  if (action === 'exportRecords') {
    return json_(exportRecords_());
  }

  return json_({ success: false, error: 'Unknown action: ' + action });
}

function doPost(e) {
  if (!validateToken_(e)) {
    return json_({ success: false, error: 'Unauthorized' });
  }

  if (!e || !e.postData || !e.postData.contents) {
    return json_({ success: false, error: 'Missing POST body' });
  }

  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ success: false, error: 'Invalid JSON body' });
  }

  if (body.action === 'batchUpsert') {
    return json_(batchUpsert_(body.records || []));
  }

  return json_({ success: false, error: 'Unknown action' });
}

// —— One-time / diagnostic (run from script editor) —————————————————————————

/**
 * Run once to verify the script can open your spreadsheet.
 * View → Executions or Execution log for output.
 */
function testSpreadsheetConnection() {
  var ss = getSpreadsheet_();
  Logger.log('Spreadsheet name: ' + ss.getName());
  Logger.log('Spreadsheet ID: ' + ss.getId());
  Logger.log('Existing tabs: ' + ss.getSheets().map(function (s) { return s.getName(); }).join(', '));
}

/**
 * Run once to create all Pradeshika Sabha tabs and header rows.
 */
function setupBackupSheets() {
  var ss = getSpreadsheet_();
  Logger.log('Setting up backup tabs in: ' + ss.getName() + ' (' + ss.getId() + ')');

  SABHA_NAMES.forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      Logger.log('Created tab: ' + name);
    } else {
      Logger.log('Tab already exists: ' + name);
    }

    sheet.clear();
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  });

  var sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && ss.getSheets().length > 1) {
    var hasData = sheet1.getLastRow() > 1 || sheet1.getLastColumn() > 1;
    if (!hasData) {
      ss.deleteSheet(sheet1);
      Logger.log('Removed empty Sheet1');
    }
  }

  Logger.log('Done. Tabs: ' + ss.getSheets().map(function (s) { return s.getName(); }).join(', '));
}

// —— Batch upsert ———————————————————————————————————————————————————————————

function batchUpsert_(records) {
  var results = [];

  records.forEach(function (rec) {
    try {
      upsertHousehold_(rec);
      results.push({ recordId: rec.recordId, ok: true });
    } catch (err) {
      results.push({
        recordId: rec.recordId,
        ok: false,
        error: String(err.message || err)
      });
    }
  });

  return {
    success: true,
    processed: records.length,
    results: results
  };
}

function upsertHousehold_(rec) {
  if (!rec || !rec.recordId) {
    throw new Error('Missing recordId');
  }
  if (!rec.pradeshikaSabha) {
    throw new Error('Missing pradeshikaSabha');
  }
  if (!rec.head) {
    throw new Error('Missing head data');
  }

  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(rec.pradeshikaSabha);
  if (!sheet) {
    throw new Error('Tab not found: ' + rec.pradeshikaSabha + '. Run setupBackupSheets().');
  }

  ensureHeaderRow_(sheet);
  deleteRowsByRecordId_(sheet, rec.recordId);

  var rows = [];
  var houseName = rec.head.houseName || '';

  rows.push(personToRow_(rec.recordId, rec.head, houseName));

  (rec.members || []).forEach(function (member) {
    rows.push(personToRow_(rec.recordId, member, houseName));
  });

  (rec.nonMembers || []).forEach(function (nonMember) {
    rows.push(personToRow_(rec.recordId, nonMember, houseName));
  });

  if (rows.length > 0) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, HEADERS.length).setValues(rows);
  }
}

function personToRow_(recordId, person, houseName) {
  person = person || {};
  var isHead = person.role === 'head';

  return [
    recordId,
    person.role || '',
    isHead ? (houseName || '') : '',
    person.name || '',
    person.dob || '',
    person.gender || '',
    person.phone || '',
    person.email || '',
    person.bloodGroup || '',
    person.highestEducation || '',
    person.occupation || '',
    person.areaOfExpertise || '',
    isHead ? (person.healthInsurance || '') : '',
    isHead ? (person.termInsurance || '') : '',
    isHead ? (person.rationCardType || '') : '',
    isHead ? (person.address || '') : '',
    person.membershipType || '',
    person.holdsPosition || '',
    person.position || '',
    person.relationship || '',
    person.livingOutsideKerala || '',
    person.outsideReason || '',
    person.reasonForNoMembership || ''
  ];
}

function deleteRowsByRecordId_(sheet, recordId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return;
  }

  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var rowsToDelete = [];

  for (var i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]) === String(recordId)) {
      rowsToDelete.push(i + 2);
    }
  }

  rowsToDelete.forEach(function (rowNum) {
    sheet.deleteRow(rowNum);
  });
}

function countHomes_() {
  var ss = getSpreadsheet_();
  var ids = {};

  SABHA_NAMES.forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      return;
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return;
    }

    var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    values.forEach(function (row) {
      var id = String(row[0] || '').trim();
      if (id) {
        ids[id] = true;
      }
    });
  });

  return Object.keys(ids).length;
}

/**
 * Validates header row against expected HEADERS array.
 * @param {string[]} actualHeaders
 * @returns {{ valid: boolean, missing: string[] }}
 */
function validateHeaders_(actualHeaders) {
  var required = ['Record ID', 'Role', 'Name', 'Phone', 'Email', 'Address'];
  var headerSet = {};
  (actualHeaders || []).forEach(function (h) {
    headerSet[String(h).trim()] = true;
  });
  var missing = required.filter(function (col) {
    return !headerSet[col];
  });
  return { valid: missing.length === 0, missing: missing };
}

/**
 * Exports all household records grouped by Record ID across sabha tabs.
 * @returns {Object}
 */
function exportRecords_() {
  var ss = getSpreadsheet_();
  var spreadsheetId = ss.getId();
  var grouped = {};
  var headers = HEADERS.slice();

  SABHA_NAMES.forEach(function (sabhaName) {
    var sheet = ss.getSheetByName(sabhaName);
    if (!sheet) {
      return;
    }

    ensureHeaderRow_(sheet);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return;
    }

    var sheetHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    var headerCheck = validateHeaders_(sheetHeaders);
    if (!headerCheck.valid) {
      return {
        success: false,
        error: 'Missing column: ' + headerCheck.missing.join(', ') + ' (tab: ' + sabhaName + ')'
      };
    }

    var values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    values.forEach(function (row) {
      var recordId = String(row[0] || '').trim();
      if (!recordId) {
        return;
      }

      var person = rowToPerson_(row);
      if (!grouped[recordId]) {
        grouped[recordId] = {
          recordId: recordId,
          pradeshikaSabha: sabhaName,
          head: null,
          members: [],
          nonMembers: []
        };
      }

      var role = String(person.role || '').toLowerCase();
      if (role === 'head') {
        grouped[recordId].head = person;
      } else if (role === 'member') {
        grouped[recordId].members.push(person);
      } else if (role === 'non-member' || role === 'nonmember') {
        grouped[recordId].nonMembers.push(person);
      }
    });
  });

  var records = Object.keys(grouped).map(function (id) {
    return grouped[id];
  }).filter(function (rec) {
    return rec.head !== null;
  });

  return {
    success: true,
    spreadsheetId: spreadsheetId,
    headers: headers,
    records: records,
    count: records.length
  };
}

/**
 * Converts a sheet row array to a person object for API export.
 * @param {Array} row
 * @returns {Object}
 */
function rowToPerson_(row) {
  return {
    role: String(row[1] || '').toLowerCase(),
    houseName: String(row[2] || ''),
    name: String(row[3] || ''),
    dob: String(row[4] || ''),
    gender: String(row[5] || ''),
    phone: String(row[6] || ''),
    email: String(row[7] || ''),
    bloodGroup: String(row[8] || ''),
    highestEducation: String(row[9] || ''),
    occupation: String(row[10] || ''),
    areaOfExpertise: String(row[11] || ''),
    healthInsurance: String(row[12] || ''),
    termInsurance: String(row[13] || ''),
    rationCardType: String(row[14] || ''),
    address: String(row[15] || ''),
    membershipType: String(row[16] || ''),
    holdsPosition: String(row[17] || ''),
    position: String(row[18] || ''),
    relationship: String(row[19] || ''),
    livingOutsideKerala: String(row[20] || ''),
    outsideReason: String(row[21] || ''),
    reasonForNoMembership: String(row[22] || '')
  };
}

function ensureHeaderRow_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
}

// —— Helpers ———————————————————————————————————————————————————————————————

function getSpreadsheet_() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }

  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      return active;
    }
  } catch (e) {
    // Script may not be container-bound when run from editor
  }

  throw new Error(
    'No spreadsheet found. Set SPREADSHEET_ID at the top of Code.gs to your Google Sheet ID.'
  );
}

function validateToken_(e) {
  if (!API_TOKEN) {
    return true;
  }
  if (e && e.parameter && e.parameter.token === API_TOKEN) {
    return true;
  }
  return false;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
