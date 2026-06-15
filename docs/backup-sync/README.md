# Backup & Sync Center

Incremental backup of Firestore `member_details` to Google Sheets, with audit history, failure retry, count validation, and a **Restore Center** for manual Sheet → Firestore recovery.

## Overview

- **Source of truth:** Firestore `member_details`
- **Backup destination (v1):** Google Sheets via Google Apps Script web app
- **Access:** Super Admin only (client RBAC + Firestore security rules)
- **Sync model:** Incremental — only homes where `metadata.updatedAt > lastSyncTimestamp`
- **Restore:** Manual only — see [restore-flow.md](./restore-flow.md)

## Navigation

| Page | URL | Purpose |
|------|-----|---------|
| Hub | `backup-restore-center` | Landing tiles |
| Backup | `backup-sync` | Incremental sync |
| Restore | `restore-center` | Analysis + restore |

Legacy URL `backup-sync-center` redirects to the hub.

## Sync flow

```mermaid
sequenceDiagram
  participant UI as BackupSyncPage
  participant Orch as SyncOrchestrator
  participant FS as Firestore
  participant Meta as sync_metadata
  participant Dest as GoogleSheetsDestination
  participant GAS as AppsScript

  UI->>Orch: startSync(user)
  Orch->>Meta: read syncInProgress
  alt sync already running
    Orch-->>UI: abort with message
  end
  Orch->>Meta: set syncInProgress=true
  Orch->>FS: count member_details
  Orch->>Dest: getRemoteRecordCount
  Orch->>Meta: read lastSyncTimestamp
  Orch->>FS: query metadata.updatedAt > lastSync
  loop each batch of N records
    Orch->>Dest: upsertBatch
    Dest->>GAS: POST batchUpsert
    GAS-->>Dest: JSON result
  Orch->>Meta: update totals / lastSync
  Orch->>FS: append sync_history
  Orch->>Meta: syncInProgress=false
  Orch-->>UI: summary + validation
```

## Configuration

Edit [`js/backup-sync/backup-sync-constants.js`](../js/backup-sync/backup-sync-constants.js):

```javascript
export const BACKUP_SYNC = Object.freeze({
  GOOGLE_SHEETS_API_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
  API_TOKEN: '', // optional shared secret
  DEFAULT_DESTINATION_ID: 'google_sheets',
  BATCH_SIZE: 25,
  SYNC_LOCK_TIMEOUT_MS: 30 * 60 * 1000,
  HISTORY_LIMIT: 10,
});
```

## Firestore index

Create a composite index in Firebase Console:

- **Collection:** `member_details`
- **Fields:** `metadata.updatedAt` Ascending

Required for incremental `where('metadata.updatedAt', '>', timestamp)` queries with `orderBy`.

## Known limitations (v1)

- **Deletes:** Removing a home from Firestore does not remove rows from Google Sheets. Incremental sync only covers create/update via `metadata.updatedAt`.
- **Client-side orchestration:** Large syncs run in the browser; keep `BATCH_SIZE` moderate for Apps Script execution limits.

## Folder structure

```
backup-restore-center.html    # landing hub
backup-sync.html              # backup page
restore-center.html           # restore page
backup-sync-center.html       # redirect to hub
js/backup-sync/
  backup-sync-constants.js
  mappers/
    member-to-sheet-mapper.js
    sheet-to-member-mapper.js
  services/
    google-sheet-service.js
    member-backup-sync-service.js
    restore-service.js
    restore-analysis-service.js
    restore-metadata-service.js
    restore-history-service.js
    restore-failures-service.js
    snapshot-service.js
    ...
js/pages/
  backup-restore-center-page.js
  backup-sync-page.js
  restore-center-page.js
docs/backup-sync/
```

## Related docs

- [Firestore schema](./firestore-schema.md)
- [Restore schema](./restore-schema.md)
- [Restore flow](./restore-flow.md)
- [Google Apps Script](./google-apps-script.md)
- [Security](./security.md)
- [Error handling](./error-handling.md)
