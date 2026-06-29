# Firestore collection access by role

This document summarizes **Firestore security rules** enforced in [`firestore.rules`](../firestore.rules). It reflects the deployed rules, not only UI page permissions (`js/services/permissions.js`). When the two differ, **rules win** — the client may hide a page, but Firestore still blocks unauthorized reads and writes.

## Roles

| Role | Description |
|------|-------------|
| **Guest** | Not signed in (no Firebase Auth). Can use phone-check, create, and view share links. |
| **user** | Signed in; household directory and advanced search. |
| **admin** | Signed in; PS-scoped admin features (dashboard, delete household, statistics). |
| **super_admin** | Full organisation access (user management, backup/restore, jilla writes). |

**Read operations** in Firestore rules v2:

| Operation | Meaning |
|-----------|---------|
| **get** | Read one document when the document ID (path) is known. |
| **list** | Collection scans and queries (`getDocs`, `where`, `orderBy`, counts). |

Legend in tables below:

| Symbol | Meaning |
|--------|---------|
| Yes | Allowed |
| No | Denied |
| Own | Allowed only for `users/{request.auth.uid}` |
| Any | Allowed for any document in the collection (subject to other rule checks) |
| Cond. | Allowed only when extra conditions in rules are met (see notes) |

---

## Core collections

### `member_details`

Household records (owner, members, non-members, metadata). Document ID acts as a **share link token** for guest view.

| Operation | Guest | user | admin | super_admin | Notes |
|-----------|:-----:|:----:|:-----:|:-----------:|-------|
| get | Yes | Yes | Yes | Yes | e.g. `view?id=…` |
| list | No | Yes | Yes | Yes | Directory, search, dashboards, sync |
| create | Cond. | Cond. | Cond. | Cond. | Valid 10-digit owner phone |
| update | Cond. | Cond. | Cond. | Cond. | Valid phone; phone change rules + `member_ids` |
| delete | No | No | Yes | Yes | |

### `member_ids`

Maps owner phone (document ID) → `member_details` document ID.

| Operation | Guest | user | admin | super_admin | Notes |
|-----------|:-----:|:----:|:-----:|:-----------:|-------|
| get | Yes | Yes | Yes | Yes | Phone-check, duplicate check by known phone |
| list | No | No | Yes | Yes | e.g. query by `memberId` on household delete |
| create | Cond. | Cond. | Cond. | Cond. | Valid phone; free slot or super_admin restore |
| update | No | No | No | Cond. | Super_admin restore, or same `memberId` no-op |
| delete | No | No | Yes | Yes | Phone change / household delete |

### `users`

App login profiles (`email`, `role`, `pradeshikaSabha`, `createdAt`).

| Operation | Guest | user | admin | super_admin | Notes |
|-----------|:-----:|:----:|:-----:|:-----------:|-------|
| get | No | Own | Own | Any | Required on login (`fetchUserRole`) |
| list | No | No | No | Yes | User management page |
| create | No | Own | Own | Any | Super_admin creates accounts via admin UI |
| update | No | Own | Own | Any | |
| delete | No | No | No | Yes | User management delete |

### `admin_contacts`

Helpline numbers for phone-check (`primary` document).

| Operation | Guest | user | admin | super_admin | Notes |
|-----------|:-----:|:----:|:-----:|:-----------:|-------|
| get | Yes | Yes | Yes | Yes | Guest phone-check help row |
| list | No | No | Yes | Yes | Enumeration blocked for guests |
| create | No | No | No | Yes | Admin contacts page |
| update | No | No | No | Yes | |
| delete | No | No | No | Yes | |

### `jilla_membership_details`

Yearly Pradeshika Sabha targets (document ID = calendar year, e.g. `2026`).

| Operation | Guest | user | admin | super_admin | Notes |
|-----------|:-----:|:----:|:-----:|:-----------:|-------|
| get | No | No | Yes | Yes | Admin dashboard targets |
| list | No | No | Yes | Yes | |
| create | No | No | No | Yes | Jilla membership admin page |
| update | No | No | No | Yes | |
| delete | No | No | No | Yes | |

---

## Backup & Sync Center (`super_admin` only)

Aligned with `permissions.js` pages: `backup_restore_center`, `backup_sync`.

| Collection | get / list | create | update | delete | Guest | user | admin | super_admin |
|------------|:----------:|:------:|:------:|:------:|:-----:|:----:|:-----:|:-----------:|
| `sync_metadata` | — | — | — | — | No | No | No | Yes (read + write) |
| `sync_failures` | — | — | — | — | No | No | No | Yes (read + write) |
| `sync_history` | — | — | — | — | No | No | No | Yes (read + write) |

Rules use combined `read, write` for these collections (get, list, create, update, delete are equivalent for super_admin).

---

## Restore Center (`super_admin` only)

Aligned with `permissions.js` page: `restore_center`.

| Collection | Guest | user | admin | super_admin |
|------------|:-----:|:----:|:-----:|:-----------:|
| `restore_metadata` | No | No | No | Yes (read + write) |
| `restore_history` | No | No | No | Yes (read + write) |
| `restore_failures` | No | No | No | Yes (read + write) |
| `restore_snapshots` | No | No | No | Yes (read + write) |
| `restore_snapshots/{id}/households` | No | No | No | Yes (read + write) |

---

## Guest flows vs list access

Guests do **not** need collection **list** access. Supported guest paths use **get** (or create/update) on known IDs:

| Flow | Collections touched | Operation |
|------|---------------------|-----------|
| Phone check | `member_ids/{phone}` | get |
| Phone check (help numbers) | `admin_contacts/primary` | get |
| Create household | `member_details`, `member_ids` | create (+ transaction get) |
| View share link | `member_details/{id}` | get |
| Edit household (with link) | `member_details/{id}`, `member_ids` | update (+ transaction get) |

---

## Related docs

- [`firestore.rules`](../firestore.rules) — source of truth
- [`docs/backup-sync/security.md`](backup-sync/security.md) — backup/restore security notes
- [`README.md`](../README.md) — Firestore schema overview

When rules change, update this file and redeploy with:

```bash
firebase deploy --only firestore:rules
```

Smoke test (local emulator):

```bash
firebase emulators:exec --only firestore "node tests/firestore/member-details-list-rules.smoke.mjs"
```
