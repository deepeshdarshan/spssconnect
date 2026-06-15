# Restore flow

Manual Google Sheet → Firestore recovery for Super Admins.

## Overview

- **Primary key:** Record ID (Firestore `member_details` document ID)
- **Comparison unit:** Household (head + members + non-members)
- **No automatic reverse sync** — restore is explicit only

## Flow

```mermaid
sequenceDiagram
  participant UI as RestorePage
  participant Analysis as RestoreAnalysisService
  participant FS as Firestore
  participant GAS as AppsScript
  participant Snap as SnapshotService
  participant Orch as RestoreService

  UI->>Analysis: Analyze Restore
  Analysis->>FS: loadAll member_details
  Analysis->>GAS: exportRecords
  Analysis-->>UI: comparison summary

  UI->>Orch: Execute Restore (mode + preview)
  Orch->>Snap: createPreRestoreSnapshot
  loop each batch
    Orch->>FS: CREATE / UPDATE / DELETE
  end
  Orch->>Analysis: validateAfterRestore
  Orch->>FS: append restore_history
  Orch-->>UI: summary + validation
```

## Restore modes

| Mode | CREATE | UPDATE | DELETE |
|------|--------|--------|--------|
| Missing Only | Yes | No | No |
| Full | Yes | Yes | Optional orphans |

## Rollback

- Snapshot taken **before** any restore writes
- Rollback re-applies pre-restore Firestore state from `restore_snapshots/{jobId}/households`
- Does **not** revert Google Sheet
- Retention: 30 days (configurable in `RESTORE_CONFIG.SNAPSHOT_RETENTION_DAYS`)

## Apps Script

Deploy updated `Code.gs` with `exportRecords` and `getSpreadsheetId` GET actions before using restore.

## Related

- [Restore schema](./restore-schema.md)
- [Google Apps Script](./google-apps-script.md)
- [Security](./security.md)
