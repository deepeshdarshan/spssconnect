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
        i18n-service.js
        ...
    /ui
        ui-service.js
        admin-shell-nav.js
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

---

## Documentation Standards

Every exported function must contain JSDoc documentation.

**Example:**

```javascript
/**
 * Loads membership statistics for a given year.
 *
 * @param {number} year Selected year.
 * @returns {Promise<Array>} Membership statistics.
 */
async function loadMembershipStatistics(year) {
}
```

Documentation should explain:

- Purpose
- Parameters
- Return value
- Exceptions
- Important business rules

Do not generate undocumented public functions.

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

**Example:**

```javascript
export const MIN_YEAR = 2015;
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

- Large CSS files
- Inline styles

Keep styles modular.

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
- Functions documented
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
5. Add JSDoc documentation.
6. Keep code clean and maintainable.
7. Follow project conventions.
8. Prefer reusable solutions over feature-specific hacks.

If any file exceeds a reasonable size or contains multiple responsibilities, automatically split it into smaller modules.

Maintain long-term maintainability over short-term implementation speed.
