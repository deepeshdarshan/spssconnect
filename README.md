# SPSS Connect

Organizational data entry and management application built with vanilla JavaScript (ES6 modules), Firebase (Authentication + Firestore + Storage), and Bootstrap 5.

---

## Features

- **Role-Based Access Control** — Four roles: Super Admin, Admin, User, and Guest (unauthenticated) with granular page and action permissions
- **User Management** — Super Admin can create Admin/User accounts with assigned Pradeshika Sabha
- **Jilla Membership Details** — Super Admin can maintain year-wise membership statistics per Pradeshika Sabha (Firestore-backed)
- **Public Data Entry** — Anyone (including guests) can submit records without logging in
- **Localization** — English and Malayalam (`spss_locale`) on public flows (e.g. landing, create, success) with an EN/ML toggle where shown. **Signed-in** users get **English** UI on **view**, **create**, and **phone-check** (stored locale is left unchanged for guests). Guest **view** still follows locale + toggle.
- **Admin hub & directory** — `admin-dashboard.html` overview (counts, people breakdown, target achievement wired via helpers in `admin-dashboard-page.js`) and deep links; **statistics dashboard** (`statistics-dashboard.html`, Chart.js); **household directory** (`household-directory.html`) with search, welfare quick filters (health insurance, ration card), sort, pagination, and PDF/share actions on cards; **advanced member search** with facet filters, person cards (two-column grid on larger screens), quick search, and filtered PDF export
- **PDF Export** — Single record, Pradeshika Sabha-wise, and full dataset PDF downloads
- **Shareable Edit Links** — Unguessable URLs that allow record owners to edit their data without logging in
- **Photo Upload** — Firebase Storage upload (behind a feature flag, disabled by default)

---

## Pages

| Page | File | Access | Description |
|------|------|--------|-------------|
| Landing | `index.html` | Everyone | App branding, tagline, and "Get Started" button linking to data entry |
| Login | `login.html` | Everyone | Email/password login form for admins and users |
| Data Entry | `create.html` | Everyone | Comprehensive form for creating member records (guests: EN/ML toggle; signed-in: English UI) |
| View / Edit | `view.html` | Everyone | View a single record; admins can edit/delete; shared edit via URL (guests: locale + toggle; signed-in: English UI) |
| Success | `success.html` | Everyone | Post-creation page showing shareable edit link |
| Admin Dashboard | `admin-dashboard.html` | Admin, Super Admin | Hub: overview tiles (counts + people breakdown + target achievement via helpers in `admin-dashboard-page.js`), member shortcuts, administration tools (super admin). URL query `section`: `members` or `administration` |
| Statistics Dashboard | `statistics-dashboard.html` | Admin, Super Admin | Chart.js visual insights from member records (RBAC-scoped) |
| Household directory | `household-directory.html` | Admin, Super Admin, User | Household directory — search (house, owner, PIN, phone), welfare filters, sort, pagination, card grid, PDF export |
| Advanced Member Search | `advanced-member-search.html` | Admin, Super Admin, User | Facet filters + quick search on person fields; one card per person; two-column results grid (tablet+); filtered PDF export |
| Phone Number Lookup | `phone-check.html` | Admin, Super Admin, User (per permissions) | Verify a mobile number against existing records; signed-in layout uses admin shell when applicable |
| User Management | `user-management.html` | Super Admin | Create admin/user accounts and view registered users |
| Admin Contact Numbers | `admin-contacts.html` | Super Admin | Numbers shown on phone verification for existing members |
| Jilla Membership Details | `jilla-membership.html` | Super Admin | Year-wise LM, OM, Home, and Pushpakadhwani per Pradeshika Sabha; CSV and PDF export |
| Backup & Restore Center | `backup-restore-center.html` | Super Admin | Landing tiles for backup and restore flows |
| Backup (Sync) | `backup-sync.html` | Super Admin | Incremental Firestore → Google Sheets sync |
| Restore Center | `restore-center.html` | Super Admin | Sheet → Firestore analysis and restore |
| Backup Sync Center (legacy) | `backup-sync-center.html` | Super Admin | Redirects to Backup & Restore Center hub |

---

## Roles and Permissions

### Roles

| Role | Description |
|------|-------------|
| **Super Admin** | Full access to all pages and actions, sees all records regardless of Pradeshika Sabha |
| **Admin** | Manages records within their assigned Pradeshika Sabha; no access to user management |
| **User** | Authenticated user; can create records and view individual records |
| **Guest** | Unauthenticated visitor; can create records and view individual records via direct link |

### Page Access

| Page | Super Admin | Admin | User | Guest |
|------|:-----------:|:-----:|:----:|:-----:|
| Landing | Yes | Yes | Yes | Yes |
| Login | Yes | Yes | Yes | — |
| Data Entry | Yes | Yes | Yes | Yes |
| Success | Yes | Yes | Yes | Yes |
| View | Yes | Yes | Yes | Yes |
| Admin dashboard & member tools | Yes | Yes | Yes | — |
| User Management | Yes | — | — | — |
| Admin contacts / Jilla membership | Yes | — | — | — |
| Backup & Restore Center | Yes | — | — | — |

### Action Access

| Action | Super Admin | Admin | User | Guest |
|--------|:-----------:|:-----:|:----:|:-----:|
| Create record | Yes | Yes | Yes | Yes |
| Update record | Yes | Yes | — | — |
| Delete record | Yes | Yes | — | — |
| Export PDF | Yes | Yes | Yes | Yes |
| Share edit link | Yes | Yes | — | — |
| Manage users | Yes | — | — | — |

### Pradeshika Sabha Filtering

- **Super Admin** sees all records across all Pradeshika Sabhas
- **Admin** sees only records belonging to their assigned Pradeshika Sabha
- When Super Admin creates a user, they assign a Pradeshika Sabha to that user

---

## Data Entry Form Fields

### Personal Details (House Owner)

Fields are displayed in this order:

| # | Field | Type | Required | Notes |
|---|-------|------|:--------:|-------|
| 1 | Name | Text | Yes | |
| 2 | House Name | Text | Yes | |
| 3 | Date of Birth | Date | Yes | Cannot be in the future |
| 4 | Gender | Dropdown | Yes | Male, Female, Other |
| 5 | Phone | Tel (digits only) | Yes | 10 digits |
| 6 | Email | Email | No | Validated if provided |
| 7 | Blood Group | Dropdown | Yes | A+, A-, B+, B-, AB+, AB-, O+, O- |
| 8 | Highest Education | Dropdown | Yes | Below 10th, 10th, Plus Two, Diploma, Bachelor's, Master's, Doctorate, Professional, Other |
| 9 | Occupation | Dropdown | Yes | Central Govt, State Govt, Private Employee, Self-Employed, Kazhakam, Homemaker, Retired, Unemployed |
| 10 | Area of expertise (if any) | Text | No | Shown only after an occupation is selected; optional free text |
| 11 | Photo | File upload | No | Behind `ENABLE_PHOTO_UPLOAD` feature flag (disabled by default) |

### Membership Details

| # | Field | Type | Required | Notes |
|---|-------|------|:--------:|-------|
| 1 | Pradeshika Sabha | Dropdown | Yes | Ernakulam, Edappally, Tripunithura, Chottanikkara, Perumbavoor, Aluva, Panangad |
| 2 | Membership | Dropdown | Yes | Life Member, Ordinary Member |
| 3 | Do you hold any position in SPSS? | Dropdown | No | Yes / No |
| 4 | Position Name | Text | Conditional | Shown and required only when #3 is Yes |

### Address

| Field | Type | Required |
|-------|------|:--------:|
| Address Line 1 | Text | Yes |
| Address Line 2 | Text | No |
| Place | Text | Yes |
| PIN Code | Tel (digits only) | Yes (6 digits) |

### Family

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| Do you have health insurance for your family? | Radio (Yes/No) | No | Default: No |
| Do you have term/life insurance? | Radio (Yes/No) | No | Default: No |
| Ration Card Color | Dropdown | Yes | No Ration Card, White, Yellow, Blue, Pink |

### Member Details (Dynamic, repeatable)

Each member block contains:

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| Name | Text | Yes | |
| Date of Birth | Date | No | |
| Relationship to House Owner | Dropdown | No | Spouse, Son, Daughter, Father, Mother, Brother, Sister, Daughter-in-law, Son-in-law, Grandchild, Other |
| Membership | Dropdown | No | Life Member, Ordinary Member |
| Blood Group | Dropdown | No | |
| Phone | Tel (digits only) | No | Validated as 10 digits if provided |
| Email | Email | No | Validated if provided |
| Occupation | Dropdown | No | Includes Student option |
| Area of expertise (if any) | Text | No | Shown only after an occupation is selected; optional free text |
| Highest Education | Dropdown | No | |
| Do you hold any position in SPSS? | Dropdown | No | Yes / No |
| Position Name | Text | Conditional | Shown when above is Yes |
| Living outside Kerala? | Dropdown | No | Yes / No |
| Reason | Dropdown | Conditional | Shown when above is Yes; options: Job, Study |

### Non-Member Details (Dynamic, repeatable)

Same as Member Details except:
- No Membership dropdown
- No SPSS Position fields
- Additional field: **Reason for No Membership** (text input)

---

## Firestore Schema

### Collection: `member_details`

```json
{
  "personalDetails": {
    "name": "string",
    "houseName": "string",
    "dob": "string (YYYY-MM-DD)",
    "gender": "male | female | other",
    "phone": "string (10 digits)",
    "email": "string",
    "bloodGroup": "string",
    "occupation": "string",
    "areaOfExpertise": "string",
    "highestEducation": "string",
    "photoURL": "string (URL)",
    "pradeshikaSabha": "string",
    "membershipType": "life_member | ordinary_member",
    "holdsSpssPosition": "boolean",
    "spssPositionName": "string",
    "address": {
      "address1": "string",
      "address2": "string",
      "place": "string",
      "pin": "string (6 digits)"
    },
    "healthInsurance": "boolean",
    "termLifeInsurance": "boolean",
    "rationCardType": "none | white | yellow | blue | pink"
  },
  "members": [
    {
      "name": "string",
      "dob": "string",
      "relationship": "string",
      "membershipType": "string",
      "bloodGroup": "string",
      "phone": "string",
      "email": "string",
      "highestEducation": "string",
      "occupation": "string",
      "areaOfExpertise": "string",
      "holdsSpssPosition": "boolean",
      "spssPositionName": "string",
      "livingOutsideKerala": "boolean",
      "outsideReason": "job | study | ''"
    }
  ],
  "nonMembers": [
    {
      "name": "string",
      "dob": "string",
      "relationship": "string",
      "bloodGroup": "string",
      "phone": "string",
      "email": "string",
      "highestEducation": "string",
      "occupation": "string",
      "reasonForNoMembership": "string",
      "livingOutsideKerala": "boolean",
      "outsideReason": "job | study | ''"
    }
  ],
  "metadata": {
    "createdAt": "Firestore Timestamp",
    "createdBy": "string (UID or 'anonymous')",
    "updatedAt": "Firestore Timestamp"
  }
}
```

### Collection: `users`

```json
{
  "email": "string",
  "role": "super_admin | admin | user",
  "pradeshikaSabha": "string",
  "createdAt": "string (ISO 8601)"
}
```

### Collection: `jilla_membership_details`

Document ID: calendar year as string (e.g. `2026`). Row totals and footer sums are not stored; they are computed in the app.

```json
{
  "year": 2026,
  "lastUpdated": "Firestore Timestamp",
  "updatedBy": "string (email)",
  "membershipDetails": [
    {
      "psCode": "string",
      "psName": "string",
      "lifeMembers": "number",
      "ordinaryMembers": "number",
      "home": "number",
      "pushpakadhwani": "number"
    }
  ]
}
```

---

## Firestore Security Rules

```
member_details:
  - create, read, update: public (document ID acts as access token)
  - delete: authenticated admin or super_admin only

users:
  - read: own document, or super_admin can read all
  - create, update: own document, or super_admin can create/update any
  - delete: never

jilla_membership_details:
  - read, write: super_admin only
```

---

## Dashboard Features

### Household directory (`household-directory.html`)

- **Search** — Debounced (300ms) client-side: house name, house owner name, PIN, and phone (text or digit substring)
- **Welfare filters** — Optional quick filters for family health insurance and ration card type (in addition to Pradeshika Sabha scope)
- **Sort** — Sort by house owner name, Pradeshika Sabha, house name, or address (A → Z)
- **Pagination** — Page size dropdown (10, 25, 50, 100 rows; default 25) with numbered page navigation
- **Cards** — Two-column grid on larger breakpoints; address, owner email, flat PDF + Share actions where enabled
- **PDF Export** — Three modes:
  - Full Dataset PDF (all visible records)
  - By Pradeshika Sabha (filtered by a selected sabha)
  - Single Member PDF (from the view page)
- **Record Actions** — Click a name to view; admin/super_admin can edit, delete, and share records
- **Sabha Filtering** — Admins automatically see only their assigned sabha's records

### Advanced member search (`advanced-member-search.html`)

- **Layout** — Filters in sidebar (desktop) / offcanvas (mobile); **results** in a **two-column card grid** from `768px` up, single column on smaller viewports
- **Quick search** — Debounced; matches **name**, **area of expertise**, **SPSS position** (when the person holds a position and a name is stored), and **phone** (normalized digit substring; minimum digit length is defined in `js/services/member-person-search.js`)
- **Facets** — Pradeshika Sabha, occupation, blood group, gender, membership, education; active filters shown as removable chips
- **Cards** — Occupation with optional expertise (single line + icon), SPSS position line (bold), DOB/age with icons, address, sabha, contacts, link to household view
- **Empty state** — Centered “no records” panel with icons (`buildResultsEmptyStateHtml` in `js/ui/member-result-card-ui.js`, styles in `css/partials/styles/13-results-empty-state.css`)
- **PDF** — Export the **current filtered** person list from the toolbar (same filter set as on screen)

### Phone number lookup (`phone-check.html`)

- **Signed-in** — English UI; admin shell layout when opened from the nav (lookup panel vertically centered in the main column on wide screens)
- **Guests** — Stored EN/ML preference + language toggle; help-line numbers when configured

---

## Shareable Edit Links

When an admin views a record, a **Share** button copies an unguessable URL to the clipboard:

```
https://your-domain.com/view?id={documentId}&edit=share
```

This link allows anyone (including unauthenticated users) to edit that specific record. The Firestore document ID serves as the access token — IDs are auto-generated and not sequential, making them effectively unguessable.

After a guest creates a record, they are redirected to the **Success page** which displays this shareable link and prompts them to save it. Admin/Super Admin users are redirected to the dashboard instead.

---

## Setup Instructions

### 1. Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Enable **Authentication** > **Email/Password** sign-in method.
3. Create a **Cloud Firestore** database.
4. Enable **Firebase Storage** (if using photo uploads).
5. In **Project Settings** > **General** > **Your apps**, register a web app and copy the config object.

### 2. Configure Firebase

Open `js/services/firebase-config.js` and replace the placeholder values:

```js
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};
```

### 3. Deploy Firestore Security Rules

```bash
npm install -g firebase-tools
firebase login
firebase init firestore
firebase deploy --only firestore:rules
```

Or paste the contents of `firestore.rules` into Firebase Console > Firestore > Rules.

### 4. Create the Super Admin

1. Use the Firebase Console to manually create the first user in Authentication.
2. In Firestore, create a document in the `users` collection with the user's UID as the document ID:
   ```json
   {
     "email": "your-email@example.com",
     "role": "super_admin",
     "pradeshikaSabha": "",
     "createdAt": "2025-01-01T00:00:00.000Z"
   }
   ```
3. The Super Admin can then log in and create additional Admin/User accounts from the User Management page.

### 5. Run Locally

This project uses no build tools for the app itself. Serve the files with any static HTTP server:

```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve .

# VS Code — install "Live Server" extension and click "Go Live"
```

Open `http://localhost:8080` in your browser.

### 6. Run Tests

Unit tests use Node’s built-in test runner (no browser required for most suites). See **[tests/README.md](./tests/README.md)** for full conventions.

```bash
npm install          # once — devDependencies only
npm run test:unit    # ~220 tests across js/ modules
npm test             # all unit tests (same as test:unit)
```

**Clean URLs:** If your production host maps paths such as `/user-management` to `user-management.html` (without the `.html` suffix), add the same mapping for `/jilla-membership` → `jilla-membership.html`.

---

## Project Structure

```
├── index.html                  Landing page
├── login.html                  Login page
├── create.html                 Data entry form (EN/ML)
├── view.html                   View / Edit / Delete a single record
├── success.html                Post-creation success page with shareable link
├── admin-dashboard.html        Admin hub (overview, member/admin sections)
├── statistics-dashboard.html   Statistics charts (Chart.js)
├── household-directory.html    Household directory (search, sort, pagination, PDF export)
├── member-management.html      Legacy URL → redirects to household-directory
├── advanced-member-search.html Advanced member search
├── phone-check.html            Phone number lookup (admin shell)
├── user-management.html        User accounts (Super Admin)
├── admin-contacts.html         Verification help numbers (Super Admin)
├── jilla-membership.html       Jilla membership statistics by year (Super Admin)
├── backup-restore-center.html  Backup / restore hub (Super Admin)
├── backup-sync.html            Incremental backup to Sheets (Super Admin)
├── restore-center.html         Restore from Sheets (Super Admin)
├── backup-sync-center.html     Legacy URL → redirects to backup-restore-center
├── firestore.rules             Firestore security rules
├── package.json                npm scripts (test runner); devDependencies only
├── tests/                      Centralized unit tests (see tests/README.md)
│   ├── setup/                  Shared helpers, browser mocks, test generator
│   └── unit/                   Mirrors js/ — one *.test.js per source module
├── assets/
│   └── app-logo.png                App logo
├── css/
│   ├── styles.css              Aggregator: global theme + RBAC (`partials/styles/`, cascade order matters)
│   ├── admin-dashboard.css     Aggregator: admin shell, overview, backup/restore, hub tiles (`partials/admin/` 01–07, except 03 on stats page)
│   ├── admin-statistics.css    Statistics dashboard (`statistics-dashboard.html`; imports partial 03)
│   └── partials/
│       ├── styles/             Tokens, layout, forms, tables, **08-rbac-responsive.css**, **13-results-empty-state.css** (grid empty states), …
│       └── admin/              Layout/nav, main column & overview, statistics panel, mobile drawer, backup/restore, **07** hub link gradients
└── js/
    ├── app-init.js             Auth guard, role routing, page bootstrap
    ├── constants/
    │   └── constants.js        App-wide constants, dropdown options, feature flags, messages
    ├── services/               Data access, Firebase, auth, permissions, i18n, **member-person-search.js** (advanced search row model + filters)
    ├── pages/                  Page orchestration (dashboard, forms, view, admin hubs). Admin hub: `admin-dashboard-page.js` uses small helpers for welcome overview (counts, people breakdown, target achievement) — see **AGENT_GUIDELINES.md** → *Admin dashboard overview module*.
    ├── ui/                     Shared DOM helpers (toasts, loaders, admin shell nav, **member-result-card-ui.js** — card rows, empty states, contact pills)
    ├── utils/                  Logger, pure helpers (e.g. target vs achievement)
    ├── validation/             Form and domain validators
    ├── form/                   Registration form submodules (bindings, submit, photo, …)
    ├── admin-stats/            Admin statistics charts and calculators
    └── locales/
        ├── en.js               English translations
        └── ml.js               Malayalam translations
```

---

## Architecture

- **Admin dashboard welcome overview** — `js/pages/admin-dashboard-page.js` loads overview tiles and target-achievement blocks via focused internal helpers (`loadMemberCountForOverview`, `loadTargetAchievementOverview`, people-breakdown builders, etc.). Structure and naming are documented in **AGENT_GUIDELINES.md** under *Admin dashboard overview module*.
- **Single Responsibility Principle** — Each module has one clear responsibility
- **ES6 Modules** — No global variables; all imports/exports are explicit via `importmap`
- **Separation of Concerns** — UI rendering, Firebase logic, validation, localization, search/sort/pagination, member-person expansion/filters (`js/services/member-person-search.js`), and PDF generation are in separate modules
- **Centralized Constants** — All dropdown options, feature flags, messages, timing values, and auth error maps are in `js/constants/constants.js`
- **Centralized RBAC** — `js/services/permissions.js` defines a single map controlling page access and action visibility per role
- **Firestore-Based Roles** — User roles are stored in the Firestore `users` collection and cached client-side at bootstrap
- **i18n** — Translation keys on DOM elements (`data-i18n`), locale files export flat key-value objects; `js/services/i18n-service.js` walks the DOM to apply translations. Signed-in **view / create / phone-check** call `initI18n({ ignoreStoredLocale: true })` so admin copy stays English while `spss_locale` remains for guests.
- **View / create layout** — On viewports `≥768px`, the main `container-fluid` on **view** and **create** uses a max width so long forms stay readable (`css/partials/admin/01-layout-nav-crosspage.css`).
- **Testing** — Pure logic modules have unit tests under `tests/unit/` (mirrors `js/`). Run `npm run test:unit`. Behavioral tests use positive / negative / edge `describe` groups. Firebase-bound modules use static export checks in Node. See `tests/README.md`.

---

## Testing

| Command | Purpose |
|---------|---------|
| `npm run test:unit` | Run all unit tests (~220) |
| `npm test` | Same as `test:unit` |
| `npm run test:generate` | Regenerate scaffolds after adding `js/` modules |

Tests live in `tests/` (not colocated `__tests__` folders). Production code under `js/` is unchanged. Full conventions: **[tests/README.md](./tests/README.md)**.

---

## Feature Flags

| Flag | File | Default | Description |
|------|------|---------|-------------|
| `ENABLE_PHOTO_UPLOAD` | `js/constants/constants.js` | `false` | Enables the photo upload section in create/edit forms |

---

## Documentation

| Document | Purpose |
|----------|---------|
| [AGENT_GUIDELINES.md](./AGENT_GUIDELINES.md) | Coding standards for HTML, CSS, JS, Firebase, and reviews |
| [tests/README.md](./tests/README.md) | Unit test layout, conventions, and npm scripts |
| [docs/backup-sync/README.md](./docs/backup-sync/README.md) | Backup & Sync Center and Restore Center (index) |
| [docs/backup-sync/](./docs/backup-sync/) | Supporting docs: Firestore schema, restore flow, Apps Script API, security, errors |

---

## License

Internal use only — SPSS Connect.
