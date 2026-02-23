# SPSS Connect

Organizational data entry and management application built with vanilla JavaScript (ES6 modules), Firebase (Authentication + Firestore + Storage), and Bootstrap 5.

---

## Features

- **Role-Based Access Control** — Four roles: Super Admin, Admin, User, and Guest (unauthenticated) with granular page and action permissions
- **User Management** — Super Admin can create Admin/User accounts with assigned Pradeshika Sabha
- **Public Data Entry** — Anyone (including guests) can submit records without logging in
- **Localization** — English and Malayalam support with live toggle on the data entry and success pages
- **Dashboard** — Searchable, sortable, paginated table with Pradeshika Sabha-based filtering
- **PDF Export** — Single record, Pradeshika Sabha-wise, and full dataset PDF downloads
- **JSON Import** — Paste or upload JSON to bulk-import records (Super Admin only)
- **Shareable Edit Links** — Unguessable URLs that allow record owners to edit their data without logging in
- **Photo Upload** — Firebase Storage upload (behind a feature flag, disabled by default)

---

## Pages

| Page | File | Access | Description |
|------|------|--------|-------------|
| Landing | `index.html` | Everyone | App branding, tagline, and "Get Started" button linking to data entry |
| Login | `login.html` | Everyone | Email/password login form for admins and users |
| Data Entry | `create.html` | Everyone | Comprehensive form for creating member records (EN/ML toggle) |
| View / Edit | `view.html` | Everyone | View a single record; admins can edit/delete; shared edit via URL |
| Success | `success.html` | Everyone | Post-creation page showing shareable edit link |
| Dashboard | `dashboard.html` | Admin, Super Admin | Record management table with search, sort, pagination, PDF export |
| JSON Import | `import.html` | Super Admin | Paste or upload JSON for bulk record import |
| User Management | `user-management.html` | Super Admin | Create admin/user accounts and view registered users |

---

## Roles and Permissions

### Roles

| Role | Description |
|------|-------------|
| **Super Admin** | Full access to all pages and actions, sees all records regardless of Pradeshika Sabha |
| **Admin** | Manages records within their assigned Pradeshika Sabha; no access to import or user management |
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
| Dashboard | Yes | Yes | — | — |
| JSON Import | Yes | — | — | — |
| User Management | Yes | — | — | — |

### Action Access

| Action | Super Admin | Admin | User | Guest |
|--------|:-----------:|:-----:|:----:|:-----:|
| Create record | Yes | Yes | Yes | Yes |
| Update record | Yes | Yes | — | — |
| Delete record | Yes | Yes | — | — |
| Export PDF | Yes | Yes | Yes | Yes |
| Share edit link | Yes | Yes | — | — |
| Import JSON | Yes | — | — | — |
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
| 10 | Area of Expertise | Text | Conditional | Shown when Occupation is Central Govt, State Govt, Private Employee, or Self-Employed |
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
| Area of Expertise | Text | Conditional | Shown when Occupation is Central Govt, State Govt, Private Employee, or Self-Employed |
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
```

---

## Dashboard Features

- **Search** — Debounced (300ms) client-side search across name, house name, sabha, blood group, education, occupation, and member/non-member names
- **Sort** — Sortable columns: Name, Pradeshika Sabha, Blood Group, Education (ascending/descending)
- **Pagination** — 10 records per page with previous/next navigation
- **PDF Export** — Three modes:
  - Full Dataset PDF (all visible records)
  - By Pradeshika Sabha (filtered by a selected sabha)
  - Single Member PDF (from the view page)
- **Record Actions** — Click a name to view; admin/super_admin can edit, delete, and share records
- **Sabha Filtering** — Admins automatically see only their assigned sabha's records

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

Open `js/firebase-config.js` and replace the placeholder values:

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

This project uses no build tools. Serve the files with any static HTTP server:

```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve .

# VS Code — install "Live Server" extension and click "Go Live"
```

Open `http://localhost:8080` in your browser.

---

## Project Structure

```
├── index.html                  Landing page
├── login.html                  Login page
├── create.html                 Data entry form (EN/ML)
├── view.html                   View / Edit / Delete a single record
├── success.html                Post-creation success page with shareable link
├── dashboard.html              Admin dashboard
├── import.html                 JSON import page (Super Admin)
├── user-management.html        User management page (Super Admin)
├── firestore.rules             Firestore security rules
├── assets/
│   └── logo.png                App logo
├── css/
│   └── styles.css              Custom styles (saffron theme, Bootstrap 5 overlay)
└── js/
    ├── constants.js            App-wide constants, dropdown options, feature flags, messages
    ├── firebase-config.js      Firebase initialization and config export
    ├── auth-service.js         Authentication, role caching, admin user creation
    ├── permissions.js           Centralized RBAC (page/action permissions per role)
    ├── app-init.js             Auth guard, role routing, page bootstrap
    ├── firestore-service.js    Generic Firestore CRUD and batch operations
    ├── storage-service.js      Firebase Storage upload
    ├── cloudinary-service.js   Cloudinary unsigned upload (optional)
    ├── member-service.js       Business logic for member_details collection
    ├── form-handler.js         Form binding, dynamic sections, data collection, submission
    ├── validation-service.js   Field validators and full form validation
    ├── i18n-service.js         Locale switching engine
    ├── locales/
    │   ├── en.js               English translations
    │   └── ml.js               Malayalam translations
    ├── dashboard-service.js    Dashboard rendering and orchestration
    ├── search-service.js       Client-side search (pure functions)
    ├── sort-service.js         Client-side sorting (pure functions)
    ├── pagination-service.js   Pagination state and slicing
    ├── pdf-service.js          PDF generation via html2pdf.js
    ├── json-import-service.js  JSON parse, validate, and batch import
    ├── import-page.js          Import page initialization
    ├── view-service.js         View/Edit page rendering and action bindings
    ├── user-management.js      User creation form and user list
    └── ui-service.js           Shared UI helpers (toasts, loaders, dialogs, formatting)
```

---

## Architecture

- **Single Responsibility Principle** — Each module has one clear responsibility
- **ES6 Modules** — No global variables; all imports/exports are explicit via `importmap`
- **Separation of Concerns** — UI rendering, Firebase logic, validation, localization, search/sort/pagination, and PDF generation are all in separate modules
- **Centralized Constants** — All dropdown options, feature flags, messages, timing values, and auth error maps are in `constants.js`
- **Centralized RBAC** — `permissions.js` defines a single map controlling page access and action visibility per role
- **Firestore-Based Roles** — User roles are stored in the Firestore `users` collection and cached client-side at bootstrap
- **i18n** — Translation keys on DOM elements (`data-i18n`), locale files export flat key-value objects, i18n-service walks the DOM to apply translations
- **XSS Prevention** — All dynamic content is escaped via `escapeHtml()` before DOM insertion

---

## Feature Flags

| Flag | File | Default | Description |
|------|------|---------|-------------|
| `ENABLE_PHOTO_UPLOAD` | `constants.js` | `false` | Enables the photo upload section in create/edit forms |

---

## License

Internal use only — SPSS Connect.
