# Firestore schema — Backup & Sync

Part of **Backup & Sync Center** — [index](./README.md) · [Project README](../../README.md).

## Existing: `member_details`

Timestamps used for incremental sync:

```javascript
{
  personalDetails: { /* ... */ },
  members: [],
  nonMembers: [],
  metadata: {
    createdAt: Timestamp,   // set on create
    createdBy: string,
    updatedAt: Timestamp    // refreshed on every update
  }
}
```

Incremental sync queries: `metadata.updatedAt > lastSyncTimestamp`.

---

## `sync_metadata/{destinationId}`

Document ID example: `google_sheets`

| Field | Type | Description |
|-------|------|-------------|
| `destinationId` | string | e.g. `google_sheets` |
| `lastSyncTimestamp` | Timestamp | High-water mark for incremental sync |
| `lastSyncBy` | string | Email or UID of last sync user |
| `totalSynced` | number | Cumulative successful homes synced |
| `pendingRecords` | number | Cached pending count (dashboard) |
| `failedRecords` | number | Unresolved failure count |
| `syncInProgress` | boolean | Concurrency lock |
| `syncStartedAt` | Timestamp \| null | Lock start time |
| `currentSyncStatus` | string | `idle` \| `in_progress` \| `completed` \| `failed` |
| `lastValidation` | object \| null | `{ firestoreCount, remoteCount, matched, checkedAt }` |

---

## `sync_failures/{autoId}`

| Field | Type | Description |
|-------|------|-------------|
| `memberId` | string | `member_details` document ID |
| `destinationId` | string | e.g. `google_sheets` |
| `errorMessage` | string | Failure reason |
| `timestamp` | Timestamp | When failure was logged |
| `resolved` | boolean | `true` after successful retry |
| `retryCount` | number | Retry attempts |

---

## `sync_history/{autoId}`

| Field | Type | Description |
|-------|------|-------------|
| `destinationId` | string | e.g. `google_sheets` |
| `startedAt` | Timestamp | Run start |
| `completedAt` | Timestamp | Run end |
| `durationMs` | number | Elapsed milliseconds |
| `totalRecords` | number | Homes in this run |
| `successCount` | number | Successful upserts |
| `failedCount` | number | Failed upserts |
| `triggeredBy` | string | User email or UID |
| `syncType` | string | `incremental` \| `retry` |

---

## Security rules

All three collections: **read/write super_admin only** (see root `firestore.rules`).
