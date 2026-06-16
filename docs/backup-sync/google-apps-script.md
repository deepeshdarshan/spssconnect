# Google Apps Script integration

Part of **Backup & Sync Center** — [index](./README.md) · [Project README](../../README.md).

Deploy a Web App bound to your backup Google Sheet. The SPSS Connect frontend calls this URL configured in `BACKUP_SYNC.GOOGLE_SHEETS_API_URL`.

## Deployment

1. Open the target Google Sheet → **Extensions → Apps Script**
2. Paste the reference code below
3. Set `SPREADSHEET_ID` and optional `API_TOKEN`
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the `/exec` URL into `js/backup-sync/backup-sync-constants.js`

## API contract

### GET `?action=getCount&token=...`

**Response:**

```json
{ "success": true, "count": 450 }
```

Counts unique `recordId` values across all Pradeshika Sabha tabs (one row per person; homes counted by distinct `recordId` in column A or dedicated home ID column).

### GET `?action=healthCheck&token=...`

**Response:**

```json
{ "success": true, "message": "OK" }
```

### GET `?action=getSpreadsheetId&token=...`

**Response:**

```json
{ "success": true, "spreadsheetId": "1abc..." }
```

### GET `?action=exportRecords&token=...`

Exports all household records grouped by Record ID for restore analysis.

**Response:**

```json
{
  "success": true,
  "spreadsheetId": "1abc...",
  "headers": ["Record ID", "Role", "..."],
  "count": 450,
  "records": [
    {
      "recordId": "abc123",
      "pradeshikaSabha": "Aluva",
      "head": { "role": "head", "name": "...", "phone": "..." },
      "members": [],
      "nonMembers": []
    }
  ]
}
```

Returns `{ "success": false, "error": "Missing column: Record ID (tab: Ernakulam)" }` if headers are invalid.

### POST `batchUpsert`

**Request body:**

```json
{
  "action": "batchUpsert",
  "records": [
    {
      "recordId": "abc123",
      "pradeshikaSabha": "Aluva",
      "head": { "role": "head", "name": "...", "phone": "..." },
      "members": [],
      "nonMembers": []
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "processed": 1,
  "results": [
    { "recordId": "abc123", "ok": true },
    { "recordId": "xyz", "ok": false, "error": "Missing pradeshikaSabha tab" }
  ]
}
```

## Reference Apps Script (skeleton)

```javascript
const SPREADSHEET_ID = 'YOUR_SHEET_ID';
const API_TOKEN = ''; // optional; must match BACKUP_SYNC.API_TOKEN

function doGet(e) {
  if (!validateToken_(e)) {
    return json_({ success: false, error: 'Unauthorized' });
  }
  const action = e.parameter.action;
  if (action === 'getCount') {
    return json_({ success: true, count: countHomes_() });
  }
  if (action === 'healthCheck') {
    return json_({ success: true, message: 'OK' });
  }
  return json_({ success: false, error: 'Unknown action' });
}

function doPost(e) {
  if (!validateToken_(e)) {
    return json_({ success: false, error: 'Unauthorized' });
  }
  const body = JSON.parse(e.postData.contents);
  if (body.action === 'batchUpsert') {
    return json_(batchUpsert_(body.records || []));
  }
  return json_({ success: false, error: 'Unknown action' });
}

function validateToken_(e) {
  if (!API_TOKEN) return true;
  const token = e.parameter.token || JSON.parse(e.postData?.contents || '{}').token;
  return token === API_TOKEN;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function countHomes_() {
  // Implement: count distinct recordId across sabha tabs
  return 0;
}

function batchUpsert_(records) {
  const results = [];
  records.forEach((rec) => {
    try {
      upsertHousehold_(rec);
      results.push({ recordId: rec.recordId, ok: true });
    } catch (err) {
      results.push({ recordId: rec.recordId, ok: false, error: String(err.message || err) });
    }
  });
  return { success: true, processed: records.length, results };
}

function upsertHousehold_(rec) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(rec.pradeshikaSabha);
  if (!sheet) throw new Error('Tab not found: ' + rec.pradeshikaSabha);
  // Delete existing rows for recordId, then append head + members + nonMembers rows
}
```

Adapt `upsertHousehold_` to match your existing sheet column layout from the previous per-record sync.

## CORS note

The Backup & Sync Center uses standard `fetch` and expects readable JSON responses. Deploy the Web App with public access. If the browser blocks CORS, redeploy or use a GET-based health check first to verify connectivity.
