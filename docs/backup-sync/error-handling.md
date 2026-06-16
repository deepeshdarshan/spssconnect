# Error handling strategy — Backup & Sync

Part of **Backup & Sync Center** — [index](./README.md) · [Project README](../../README.md).

## Per-record failures

When Apps Script returns `{ recordId, ok: false, error }` for a household:

1. Processing continues for remaining records in the batch and subsequent batches.
2. A document is written to `sync_failures` with `memberId`, `errorMessage`, `timestamp`.
3. `failedRecords` count on `sync_metadata` is updated after the run.

## Batch / network failures

If the entire HTTP request fails (timeout, 5xx, parse error):

- All records in that batch are logged to `sync_failures` with the batch error message.
- Sync continues with the next batch unless an unrecoverable orchestrator error occurs.

## Concurrency

- `sync_metadata.syncInProgress` prevents overlapping runs.
- UI disables Sync and Retry buttons while `syncRunning` is true.
- Stale locks older than `SYNC_LOCK_TIMEOUT_MS` (30 min) are auto-cleared.

## Configuration errors

| Condition | User-facing behavior |
|-----------|---------------------|
| `GOOGLE_SHEETS_API_URL` empty | Warning banner; buttons disabled |
| Sync while another run active | Toast: "A sync is already in progress" |
| Non-super-admin URL access | Redirect to admin dashboard |

## Retry path

**Retry Failed Records** loads unresolved `sync_failures`, fetches current `member_details` by ID, and re-sends only those homes. Successful retries set `resolved: true` on the failure document.

## Validation mismatch

After sync, Firestore home count is compared to Google Sheet home count. Mismatch shows a warning alert but does not roll back Firestore data (Firestore remains source of truth).

## Logging

- Console: `Logger.error` / `Logger.warn` in services
- UI: `showToast` for operator-visible outcomes
- Persistent: `sync_failures` + `sync_history` collections

## Recovery checklist

1. Fix Apps Script or sheet tab issues indicated in `errorMessage`.
2. Click **Retry Failed Records**.
3. If counts still mismatch, run a full incremental sync after resetting `lastSyncTimestamp` to epoch in Firestore (super_admin only, manual Firestore console operation).
