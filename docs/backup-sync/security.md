# Security considerations — Backup & Restore Center

Part of **Backup & Restore Center** — [index](./README.md) · [Project README](../../README.md).

## Access control

| Layer | Enforcement |
|-------|-------------|
| Navigation | `super-admin-only` CSS class on nav group — hidden for admin/user roles (display rules in `css/partials/styles/08-rbac-responsive.css`; when combining with flex layouts see [AGENT_GUIDELINES.md](../../AGENT_GUIDELINES.md) CSS Guidelines) |
| Page routing | `canAccessPage()` for `backup_restore_center`, `backup_sync`, `restore_center` — super_admin only |
| Page guard | `isSuperAdmin()` redirect in all three page controllers |
| Firestore | Rules on sync and restore collections — super_admin read/write |

### Protected collections

**Backup:** `sync_metadata`, `sync_failures`, `sync_history`

**Restore:** `restore_metadata`, `restore_history`, `restore_failures`, `restore_snapshots` (+ `households` subcollection)

## Secrets

- **Apps Script URL:** Treat as a capability URL. Anyone with the URL can invoke the script if deployment is "Anyone". Use `BACKUP_SYNC.API_TOKEN` and validate in Apps Script `doGet`/`doPost`.
- **Do not commit** production tokens or private sheet IDs to public repos if the repository is shared.

## Data exposure

- Failure collections store `memberId` and `errorMessage` only — no full household PII in failure logs.
- History collections store counts and `triggeredBy` (email) for audit.
- **Restore snapshots** store full pre-restore `member_details` documents — super_admin only; retention limited to 30 days by default.
- Member payload data is sent to Google Sheets only during sync batches, over HTTPS.

## Restore-specific safeguards

- Restore never runs automatically — explicit Super Admin action required.
- Pre-restore analysis is read-only (no Firestore writes except `restore_metadata.lastAnalysis`).
- Pre-execute snapshot required; restore aborts if snapshot fails.
- Full restore with orphan delete requires additional confirmation modal.
- Rollback is manual from restore history only.

## Firebase App Check

App Check (reCAPTCHA v3) remains enabled in `firebase-config.js` and protects Firestore access from unauthorized clients.

## Audit trail

- Every sync run appends to `sync_history` with `triggeredBy`, timestamps, and counts.
- Every restore/rollback appends to `restore_history` with mode, counts, and `sourceSheetId`.

## Recommendations

1. Restrict Apps Script deployment to a dedicated backup Google account.
2. Share the backup Sheet only with trusted administrators.
3. Rotate `API_TOKEN` if the Web App URL is exposed.
4. Review `sync_failures` and `restore_failures` periodically.
5. Deploy updated `Code.gs` with `exportRecords` before enabling restore in production.
