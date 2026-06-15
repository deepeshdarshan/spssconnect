# Security considerations — Backup & Sync

## Access control

| Layer | Enforcement |
|-------|-------------|
| Navigation | `super-admin-only` CSS class — hidden for admin/user roles |
| Page routing | `canAccessPage('backup_sync_center')` in `app-init.js` — super_admin only |
| Page guard | `isSuperAdmin()` redirect in `backup-sync-center-page.js` |
| Firestore | Rules on `sync_metadata`, `sync_failures`, `sync_history` — super_admin read/write |

## Secrets

- **Apps Script URL:** Treat as a capability URL. Anyone with the URL can invoke the script if deployment is "Anyone". Use `BACKUP_SYNC.API_TOKEN` and validate in Apps Script `doGet`/`doPost`.
- **Do not commit** production tokens or private sheet IDs to public repos if the repository is shared.

## Data exposure

- `sync_failures` stores `memberId` and `errorMessage` only — no full household PII.
- `sync_history` stores counts and `triggeredBy` (email) for audit.
- Member payload data is sent to Google Sheets only during sync batches, over HTTPS.

## Firebase App Check

App Check (reCAPTCHA v3) remains enabled in `firebase-config.js` and protects Firestore access from unauthorized clients.

## Audit trail

Every sync run appends to `sync_history` with `triggeredBy`, timestamps, and success/failure counts. `sync_metadata.lastSyncBy` records the last operator.

## Recommendations

1. Restrict Apps Script deployment to a dedicated backup Google account.
2. Share the backup Sheet only with trusted administrators.
3. Rotate `API_TOKEN` if the Web App URL is exposed.
4. Review `sync_failures` periodically and investigate recurring `memberId` errors.
