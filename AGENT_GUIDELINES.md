# Project Development Guidelines

You are working on an HTML, JavaScript, Bootstrap, and Firebase Firestore application.

Before implementing any feature, review and follow the guidelines below.

---

## General Principles

Always prioritize:

- Readability
- Maintainability
- Simplicity
- Reusability
- Scalability

Avoid quick fixes that introduce technical debt.

Follow clean code principles at all times.

---

## Single Responsibility Principle (SRP)

Every JavaScript function must have one clear responsibility.

**Bad Example:**

```javascript
function loadUsers() {
    // fetch users
    // validate data
    // render table
    // calculate totals
    // update UI
}
```

**Good Example:**

```javascript
loadUsers();
validateUsers();
calculateTotals();
renderUsersTable();
updateSummaryCards();
```

**Requirements:**

- Functions should generally remain under 30-40 lines.
- If a function becomes lengthy, automatically refactor it into smaller functions.
- Each function should perform one logical task only.
- Avoid "God Functions."

---

## JavaScript File Organization

If a JavaScript file grows too large:

Create additional files.

Organize files by responsibility.

**Example:**

```
/js
    /services
        auth-service.js
        firebase-config.js
        firestore-service.js
        member-service.js
        member-person-search.js
        pagination-service.js
        users-service.js
        i18n-service.js
        ...
    /ui
        ui-service.js
        admin-shell-nav.js
        admin-shell-mobile-drawer.js
        pagination-nav-ui.js
        role-ui-sync.js   (pre-paint role classes from sessionStorage; classic script)

    /validation
        validation-service.js
        jilla-membership-validation.js

    /utils
        logger.js
        target-achievement-utils.js

    /constants
        constants.js

    /pages
        user-management.js
        dashboard-service.js
        admin-dashboard-page.js
        member-advanced-search-page.js
        form-handler.js
        ...

    /form
        (registration form submodules)

    /admin-stats
        (statistics charts and calculators)

    /locales
        en.js
        ml.js

    app-init.js
```

Avoid creating large monolithic JS files.

### Admin dashboard overview module (`js/pages/admin-dashboard-page.js`)

The welcome **overview** on `admin-dashboard.html` (registered homes/people tiles, people breakdown, target achievement analysis, and related empty states) is wired in `admin-dashboard-page.js`. Keep orchestration thin and push logic into **small internal helpers** so each function stays single-purpose:

| Area | Exported entry | Typical internal helpers (non-exhaustive) |
|------|----------------|-------------------------------------------|
| Home / people counts + Jilla targets | `loadMemberCountForOverview` | `setOverviewCountTilesLoading`, `clearOverviewCountTiles`, `fetchOverviewCountsSuperAdmin`, `fetchOverviewCountsPsAdmin`, `applyOverviewCountResults` |
| People tile breakdown (stacked bar + metrics) | (used by loader above) | `setOverviewPeopleBreakdown`, `buildOverviewPeopleBreakdownPanel` |
| Target achievement grid | `loadTargetAchievementOverview` | `configureTargetAchievementYearNote`, `resetTargetAchievementOverviewShell`, `resolveTargetAchievementDisplayedKeys`, `showTargetAchievementEmpty`, `buildTargetAchievementBlocksHtml` |

Pure numeric / sabha-key logic for targets vs actuals also lives in `js/utils/target-achievement-utils.js` and `js/admin-stats/` calculators where appropriate; the page module should **coordinate** Firestore + RBAC filtering + DOM, not reimplement merge/aggregate rules.

When extending these flows, add or adjust the **focused helper** (or a shared util) rather than growing the exported loader into a “god function.”

---

## Documentation Standards

Use **detailed JSDoc** (and short inline comments only where logic is non-obvious) so future readers and agents understand intent without re-tracing the code.

### Functions

- **Exported functions** (and any function that is part of the module’s public API) must have full JSDoc: summary, `@param`, `@returns`, `@throws` when applicable, and notes on side effects (DOM, Firestore, global state).
- **Non-exported functions** that encode non-trivial rules, algorithms, or Firestore shapes should also be documented; trivial one-liners do not need JSDoc if the name is sufficient.
- Prefer `@typedef` / object shapes in JSDoc when passing structured data so callers know the contract.

**Example:**

```javascript
/**
 * Loads membership statistics for a given year.
 *
 * @param {number} year Selected calendar year.
 * @returns {Promise<Array<MembershipStatRow>>} Rows for charts and tables.
 * @throws {Error} When Firestore is unavailable or the query fails.
 */
async function loadMembershipStatistics(year) {
}
```

Documentation for functions should explain:

- Purpose and when to use it
- Parameters (types and meaning)
- Return value (including empty or error cases)
- Exceptions and failure modes
- Important business rules and assumptions

Do not leave public or widely reused functions undocumented.

### Constants and configuration

- **Named constants** (`export const …`, enums, magic numbers moved to constants) should have a JSDoc line or block above each constant (or a short block above a **cohesive group**) describing what the value represents, valid ranges, units, and any coupling to Firestore field names, API contracts, or UI.
- Obvious literals after extraction (e.g. `MAX_PAGE_SIZE = 50`) still warrant a one-line JSDoc if the *why* is not obvious from the name alone.
- **Objects used as maps or config** (e.g. chart colors, route keys) should document keys and expected consumers in a file-level or object-level JSDoc block.

**Example:**

```javascript
/** Minimum membership year supported in reports (legacy data starts here). */
export const MIN_YEAR = 2015;

/**
 * Firestore collection id for jilla membership documents.
 * Must stay in sync with security rules and any Cloud Functions.
 */
export const COLLECTION_MEMBERSHIP = "jilla_membership_details";
```

### Files and complex logic

- Large or non-obvious modules may use a brief **file-level** `/** @file … */` or leading block describing responsibilities and main exports.
- Use **inline comments** sparingly for non-obvious control flow, workarounds, or domain rules that names and JSDoc cannot express; avoid narrating what the code already says line by line.

---

## Naming Conventions

Use meaningful names.

**Good:**

```javascript
calculateMembershipAchievement()
renderStatisticsTable()
loadMembershipTargets()
```

**Bad:**

```javascript
doStuff()
load()
test()
temp()
```

Variable names must clearly communicate intent.

---

## Avoid Duplication

Follow DRY principles.

If similar code appears more than once:

- Extract into reusable helper functions.
- Move shared logic into utility modules.

Never duplicate business logic.

---

## UI Architecture

Separate:

- Data access
- Business logic
- UI rendering
- Event handling

**Example:**

- MembershipService → Firestore access
- MembershipCalculator → Calculations
- MembershipRenderer → HTML rendering
- MembershipPage → Event wiring

---

## Firestore Guidelines

Never access Firestore directly from UI rendering code.

Create dedicated service layers.

**Example:**

```javascript
MembershipService.loadYear(year);
MembershipService.saveYear(data);
```

Firestore logic belongs only in service files.

---

## HTML Standards

Keep HTML clean.

**Avoid:**

- Inline JavaScript
- Inline event handlers
- Excessive nesting

**Bad:**

```html
<button onclick="saveData()">
```

**Good:**

```javascript
button.addEventListener("click", saveData);
```

---

## Bootstrap Standards

Use Bootstrap utilities whenever possible.

Avoid excessive custom CSS.

**Prefer:**

- Bootstrap Cards
- Bootstrap Tables
- Bootstrap Modals
- Bootstrap Forms
- Bootstrap Grid System

**Ensure:**

- Mobile responsiveness
- Tablet responsiveness
- Desktop responsiveness

---

## Validation Standards

Validation must be separated from UI code.

**Example:**

```javascript
MembershipValidator.validateRow(row);
```

Validation should:

- Return validation results
- Return error messages
- Not manipulate UI directly

---

## Error Handling

Never swallow errors.

**Bad:**

```javascript
catch (e) {}
```

**Good:**

```javascript
catch (error) {
    console.error(error);
    showErrorMessage(error);
}
```

Provide meaningful error messages to users.

---

## Logging

Use centralized logging helpers.

**Example:**

```javascript
Logger.info();
Logger.warn();
Logger.error();
```

Avoid random `console.log` statements.

Remove debugging logs before final implementation.

---

## Constants

Do not hardcode values.

Create constants files.

Document each constant or group as described in **Documentation Standards → Constants and configuration** (JSDoc with enough detail that names plus comments explain Firestore, UI, and business meaning).

**Example:**

```javascript
/** Minimum membership year supported in reports (legacy data starts here). */
export const MIN_YEAR = 2015;

/**
 * Firestore collection id for jilla membership documents.
 * Must stay in sync with security rules and any Cloud Functions.
 */
export const COLLECTION_MEMBERSHIP = "jilla_membership_details";
```

---

## Statistics & Calculations

All calculations must be placed in dedicated calculator modules.

**Example:**

```javascript
MembershipCalculator.calculateAchievement();
MembershipCalculator.calculateTotals();
MembershipCalculator.calculateRanking();
```

Do not mix calculations with rendering logic.

---

## Table Rendering

Create reusable table utilities.

**Avoid repeating** sorting, filtering, pagination, and export logic across pages.

---

## CSS Guidelines

**Prefer:**

- Bootstrap utilities
- Reusable component classes

**Avoid:**

- Large monolithic stylesheets (split under `css/partials/`; `styles.css` / `admin-dashboard.css` are **aggregators** that `@import` partials in cascade order)
- Inline styles

Keep styles modular. Each partial should start with a short `@file` banner (purpose, HTML consumers). Prefer commenting **selector blocks** and non-obvious rules rather than every declaration.

**Empty result grids** — Household directory and advanced member search share the `.spss-results-empty` pattern: markup from `buildResultsEmptyStateHtml` in `js/ui/member-result-card-ui.js`, layout/styling in `css/partials/styles/13-results-empty-state.css` (imported after household directory card styles in `styles.css`). The root uses `grid-column: 1 / -1` so the panel spans multi-column card grids.

### RBAC visibility classes and flex/grid shells

`css/partials/styles/08-rbac-responsive.css` applies `display: … !important` to `.auth-only`, `.admin-only`, and `.super-admin-only` when the matching `body.is-*` class is present. In particular, `body.is-super-admin div.super-admin-only { display: block !important; }` will override a flex header on the **same** element (e.g. `.dashboard-header.super-admin-only`), breaking horizontal icon + title layout.

**Do:** gate inner content, use a non-`div` shell if appropriate, or add a **documented** scoped exception next to those RBAC rules (see the `.dashboard-header` override in `08-rbac-responsive.css`). **Do not** rely on a distant partial to “fight” RBAC without a comment tying the two files together.

---

## Performance Guidelines

Minimize Firestore reads.

**Avoid:**

- Repeated queries
- Duplicate network calls

Cache data where appropriate.

Batch updates when possible.

---

## Security Guidelines

Always enforce role validation.

Never rely solely on UI visibility.

Validate permissions before:

- Read operations
- Update operations
- Delete operations

---

## Code Review Checklist

Before completing any feature:

- Single Responsibility Principle followed
- Functions and constants documented (JSDoc / detail per Documentation Standards)
- No duplicated code
- No inline JavaScript
- Responsive UI
- Proper validation
- Proper error handling
- Firestore access separated
- Business logic separated
- Reusable components created
- Constants extracted
- No unnecessary code
- Meaningful naming
- Mobile-friendly layout

---

## Agent Instructions

If implementing a new feature:

1. Analyze existing architecture.
2. Reuse existing utilities where possible.
3. Create new modules if responsibilities differ.
4. Refactor large files when necessary.
5. Add JSDoc and constant documentation in line with Documentation Standards (functions, constants, non-trivial internals).
6. Keep code clean and maintainable.
7. Follow project conventions.
8. Prefer reusable solutions over feature-specific hacks.

If any file exceeds a reasonable size or contains multiple responsibilities, automatically split it into smaller modules.

Maintain long-term maintainability over short-term implementation speed.
