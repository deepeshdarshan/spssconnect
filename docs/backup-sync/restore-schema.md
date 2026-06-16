# Restore — Firestore schema

Part of **Restore Center** — [index](./README.md) · [Project README](../../README.md).

Restore Center collections (super_admin only via `firestore.rules`).

## `restore_metadata/{destinationId}`

Document ID matches backup destination (e.g. `google_sheets`).

| Field | Type | Purpose |
|-------|------|---------|
| `destinationId` | string | Destination identifier |
| `lastRestoreAt` | Timestamp | Last completed restore |
| `lastRestoreBy` | string | Operator email/UID |
| `lastRestoreStatus` | string | `idle` \| `in_progress` \| `completed` \| `failed` |
| `restoreInProgress` | boolean | Concurrency lock |
| `restoreStartedAt` | Timestamp | Lock start time |
| `lastAnalysis` | object | Latest analyze summary counts |
| `lastValidation` | object | Post-restore count validation |

## `restore_history/{autoId}`

| Field | Type | Purpose |
|-------|------|---------|
| `restoreJobId` | string | Job ID (matches snapshot doc) |
| `snapshotId` | string | Snapshot reference |
| `startedAt` | Timestamp | Run start |
| `completedAt` | Timestamp | Run end |
| `durationMs` | number | Elapsed milliseconds |
| `totalProcessed` | number | Households processed |
| `createdCount` | number | CREATE operations |
| `updatedCount` | number | UPDATE operations |
| `deletedCount` | number | DELETE operations |
| `failedCount` | number | Failed operations |
| `restoreMode` | string | `missing_only` \| `full` \| `rollback` |
| `deleteOrphansEnabled` | boolean | Whether orphan delete was enabled |
| `triggeredBy` | string | Operator |
| `sourceSheetId` | string | Google Sheet ID |
| `status` | string | `completed` \| `failed` |
| `restoreType` | string | `restore` \| `rollback` |

## `restore_failures/{autoId}`

| Field | Type | Purpose |
|-------|------|---------|
| `memberId` | string | Household Record ID |
| `operationType` | string | `CREATE` \| `UPDATE` \| `DELETE` |
| `errorMessage` | string | Failure reason |
| `timestamp` | Timestamp | When logged |
| `restoreJobId` | string | Parent restore job |

## `restore_snapshots/{restoreJobId}`

| Field | Type | Purpose |
|-------|------|---------|
| `restoreJobId` | string | Job identifier |
| `createdAt` | Timestamp | Snapshot time |
| `triggeredBy` | string | Operator |
| `mode` | string | Restore mode used |
| `recordIds` | string[] | Affected Record IDs |

### Subcollection `households/{recordId}`

| Field | Type | Purpose |
|-------|------|---------|
| `recordId` | string | Household doc ID |
| `existed` | boolean | Whether doc existed before restore |
| `data` | object \| null | Full `member_details` doc before mutation |
