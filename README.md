# SPSS Connect

Organizational data entry and management application built with vanilla JavaScript (ES6 modules), Firebase (Authentication + Firestore + Storage), and Bootstrap 5.

---

## Features

- **Authentication** — Email/password login and registration with role-based access (Admin / User)
- **Data Entry Form** — Comprehensive form for house owner details, dynamic member/non-member sections, photo upload
- **Localization** — English and Malayalam support on the data entry page with live toggle
- **Dashboard** — Searchable, sortable, paginated table of all records (admin only)
- **PDF Export** — Single record, Pradeshika Sabha-wise, and full dataset PDF downloads
- **JSON Import** — Paste or upload JSON to bulk-import records (admin only)
- **Dual Photo Upload** — Firebase Storage and Cloudinary upload support

---

## Setup Instructions

### 1. Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Enable **Authentication** → **Email/Password** sign-in method.
3. Create a **Cloud Firestore** database (start in test mode, then deploy rules).
4. Enable **Firebase Storage** (if using Firebase for photo uploads).
5. In **Project Settings** → **General** → **Your apps**, register a web app and copy the config object.

### 2. Configure Firebase

Open `js/firebase-config.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};
```

### 3. Configure Cloudinary (Optional)

If using Cloudinary for photo uploads, open `js/constants.js` and replace:

```js
export const CLOUDINARY_CONFIG = Object.freeze({
  CLOUD_NAME: 'YOUR_CLOUD_NAME',
  UPLOAD_PRESET: 'YOUR_UPLOAD_PRESET',
});
```

Create an unsigned upload preset in your [Cloudinary Console](https://cloudinary.com/console/settings/upload).

### 4. Deploy Firestore Security Rules

Install the Firebase CLI and deploy the rules:

```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # Select your project, use firestore.rules
firebase deploy --only firestore:rules
```

Or copy the contents of `firestore.rules` into the Firebase Console → Firestore → Rules tab.

### 5. Set Admin Role

After registering a user, go to Firebase Console → Firestore → `users` collection → find the user document → change `role` from `"user"` to `"admin"`.

### 6. Run Locally

This project uses no build tools. Serve the files with any static HTTP server:

```bash
# Using Python
python3 -m http.server 8080

# Using Node.js (npx)
npx serve .

# Using VS Code
# Install "Live Server" extension and click "Go Live"
```

Then open `http://localhost:8080` in your browser.

---

## Project Structure

```
├── index.html                  Login / Register page
├── dashboard.html              Admin dashboard (search, sort, paginate, export, import)
├── create.html                 Data entry form (EN/ML toggle)
├── view.html                   View / Edit / Delete a single record
├── css/
│   └── styles.css              Custom styles (Bootstrap 5 overlay)
├── js/
│   ├── constants.js            App-wide constants (collections, dropdowns, roles, routes)
│   ├── firebase-config.js      Firebase initialization
│   ├── auth-service.js         Authentication (login, register, logout, roles)
│   ├── app-init.js             Auth guard, role routing, page bootstrap
│   ├── firestore-service.js    Generic Firestore CRUD operations
│   ├── storage-service.js      Firebase Storage upload
│   ├── cloudinary-service.js   Cloudinary unsigned upload
│   ├── member-service.js       Business logic for member_details collection
│   ├── form-handler.js         Form binding, dynamic sections, photo upload, submission
│   ├── validation-service.js   Field and form validation
│   ├── i18n-service.js         Locale switching engine
│   ├── locales/
│   │   ├── en.js               English translations
│   │   └── ml.js               Malayalam translations
│   ├── dashboard-service.js    Dashboard rendering and orchestration
│   ├── search-service.js       Client-side search (pure functions)
│   ├── sort-service.js         Client-side sort (pure functions)
│   ├── pagination-service.js   Pagination state and slicing
│   ├── pdf-service.js          PDF generation (html2pdf.js)
│   ├── json-import-service.js  JSON paste/upload, validate, batch import
│   ├── view-service.js         View/Edit page rendering and actions
│   └── ui-service.js           Shared UI helpers (toasts, loaders, dialogs)
└── firestore.rules             Firestore security rules
```

---

## Architecture

- **Single Responsibility Principle** — Each module has one clear responsibility
- **ES6 Modules** — No global variables; all imports/exports are explicit
- **Separation of Concerns** — UI rendering, Firebase logic, validation, localization, search/sort/pagination, and PDF generation are all in separate modules
- **Constants Management** — All magic strings, dropdown values, and configuration are centralized in `constants.js`
- **i18n** — Translation keys on DOM elements (`data-i18n`), locale files export flat key-value objects, i18n-service walks the DOM to apply translations

---

## Firestore Document Schema

```json
{
  "personalDetails": {
    "name": "string",
    "dob": "string (YYYY-MM-DD)",
    "houseName": "string",
    "gender": "male | female | other",
    "pradeshikaSabha": "string",
    "photoURL": "string (URL)",
    "bloodGroup": "string",
    "occupation": "string",
    "membershipType": "life_member | ordinary_member",
    "highestEducation": "string",
    "address": {
      "address1": "string",
      "address2": "string",
      "street": "string",
      "place": "string",
      "pin": "string (6 digits)"
    },
    "spssPosition": "string",
    "healthInsurance": "boolean",
    "familyOutside": "boolean",
    "familyOutsideReason": "studying | job | ''"
  },
  "members": [
    {
      "name": "string",
      "dob": "string",
      "membershipType": "string",
      "bloodGroup": "string",
      "phone": "string",
      "email": "string",
      "highestEducation": "string",
      "occupation": "string"
    }
  ],
  "nonMembers": [
    {
      "...same as members": "...",
      "reasonForNoMembership": "string"
    }
  ],
  "metadata": {
    "createdAt": "Firestore Timestamp",
    "createdBy": "string (UID)",
    "updatedAt": "Firestore Timestamp"
  }
}
```

---

## Roles

| Role  | Can Create | Can View All | Can Edit | Can Delete | Can Import | Can Export |
|-------|-----------|-------------|---------|-----------|-----------|-----------|
| User  | Yes       | No          | No      | No        | No        | No        |
| Admin | Yes       | Yes         | Yes     | Yes       | Yes       | Yes       |

---

## License

Internal use only — SPSS Connect.
