---
name: Sticky filter button
overview: "Fix the mobile Advanced Member Search filter control so it stays pinned below the admin shell (hamburger line) while scrolling long results, by giving `position: sticky` a tall enough grid containing block—preferably pure CSS (no scroll listeners), with minimal HTML reshuffle."
todos:
  - id: html-wrap-grid
    content: Wrap right-column mobile stack in `.advanced-search-mobile-results-grid` and flatten sticky + hint + toolbar…pagination as grid-ready siblings in advanced-member-search.html
    status: completed
  - id: css-grid-sticky
    content: Add max-width lg grid + grid-row 1/-1 sticky + full-width rows + pointer-events in 10-member-advanced-search.css; reset display:block at lg+; remove obsolete mobile-filter-bar grid hacks
    status: completed
  - id: manual-test
    content: Manually test <992px scroll, tap-through on toolbar, chips hidden/shown, desktop lg unchanged
    status: completed
isProject: false
---

# Sticky filter button (Advanced Member Search)

## Root cause

[`10-member-advanced-search.css`](css/partials/styles/10-member-advanced-search.css) already sets `position: sticky` on `.advanced-search-open-filters-sticky` (lines 513–522). Sticky positioning is **clipped by the element’s ancestors**: the button’s wrapper lives inside [`.advanced-search-mobile-filter-bar`](advanced-member-search.html) (lines 181–196), which is only **one row tall**. Once that row has scrolled far enough, the sticky box must scroll away with it. That matches “scrolls out of the viewport with the rest of the content” while the hint row layout still behaves as designed.

The mobile shell inset [`--admin-shell-menu-inset-top`](css/partials/admin/04-admin-shell-mobile-drawer.css) is already the right vertical anchor to align with the fixed hamburger.

## Recommended approach: CSS grid + same `sticky` (no JS)

Extend the **grid containing block** so the sticky item’s grid area spans from the top of the results stack through the bottom of the column (implicit rows), while keeping the **hint** only in the first row beside the button.

```mermaid
flowchart TB
  subgraph grid [advanced-search-mobile-results-grid max-width lg]
    col1[col1 auto]
    col2[col2 minmax 0 1fr)]
    sticky[open-filters-sticky grid-row 1 / -1 col1 sticky top]
    hint[hint grid-row 1 col2]
    main[toolbar chips results pagination grid-column 1 / -1]
  end
  sticky --- col1
  hint --- col2
  main --- col1
  main --- col2
```

### 1. HTML — [`advanced-member-search.html`](advanced-member-search.html)

- Introduce a wrapper **around** the mobile filter row **and** everything below it in the right column that should share one scroll “scope” for the sticky button, e.g. `.advanced-search-mobile-results-grid`.
- **Move** (not duplicate) these nodes inside that wrapper in document order:
  - Current `.advanced-search-mobile-filter-bar` (or split into grid children — see below).
  - `.advanced-search-results-toolbar`
  - `#filterChipsRow`, `#membershipFilterHint`, `#advancedSearchResults`, `.advanced-search-results-pagination`
- Flatten the mobile filter row for grid placement: make **three** direct grid children at the top of the wrapper (order matters):
  1. `.advanced-search-open-filters-sticky` + button (keep `d-lg-none` on this subtree if you prefer class on wrapper).
  2. `#advancedSearchMobileFiltersHint` (or keep a thin row wrapper **only** if needed for a11y; prefer siblings for simpler grid).
  3. Then toolbar, chips, hint block, results, pagination as subsequent siblings.

Practical minimal diff: replace the single `.advanced-search-mobile-filter-bar` container with the new **outer** `.advanced-search-mobile-results-grid` and keep the hint + sticky as **first two children** (or sticky then hint), then the existing toolbar block, etc. Remove the old inner wrapper if it no longer adds value.

### 2. CSS — [`css/partials/styles/10-member-advanced-search.css`](css/partials/styles/10-member-advanced-search.css)

Only under `@media (max-width: 991.98px)`:

- Target `.advanced-search-mobile-results-grid` with `display: grid`, `grid-template-columns: auto minmax(0, 1fr)`, horizontal `gap` consistent with current `gap-2` (~`0.5rem`), `align-items: start`.
- **Sticky column cell spans all rows:** `.advanced-search-open-filters-sticky` gets `grid-column: 1`, `grid-row: 1 / -1`, `align-self: start`, keep existing `position: sticky`, `top: var(--admin-shell-menu-inset-top, …)`, `z-index` as today.
- **Hint:** `grid-column: 2`, `grid-row: 1`, `min-width: 0` (reuse / move rules from `.advanced-search-mobile-filters-hint`).
- **Full-width rows:** `.advanced-search-results-toolbar`, `#filterChipsRow`, `#membershipFilterHint`, `#advancedSearchResults`, `.advanced-search-results-pagination` → `grid-column: 1 / -1`.

**Overlap / hit-testing:** the sticky item’s grid cell covers column 1 for **all** rows; row 2+ in column 1 overlaps the left strip of full-width blocks. Mirror the pattern used elsewhere for “floating” controls:

- `pointer-events: none` on `.advanced-search-open-filters-sticky`
- `pointer-events: auto` on `.advanced-search-open-filters-btn`

so taps pass through the empty part of the tall cell to toolbar/results underneath.

At `@media (min-width: 992px)`:

- `.advanced-search-mobile-results-grid { display: block; }` (or `revert`) so desktop layout is unchanged; sticky/hint nodes stay `d-lg-none` as today.

**Cleanup:** remove or narrow the old `.advanced-search-mobile-filter-bar.d-flex { display: grid !important; … }` rules if the bar no longer exists or no longer needs the flex→grid workaround.

### 3. JavaScript — [`js/pages/member-advanced-search-page.js`](js/pages/member-advanced-search-page.js)

No changes required for behavior if the DOM/CSS fix is sufficient (IDs used by `initAdvancedMemberSearch` stay stable).

### 4. Verification

- **Viewport:** `<992px` only (sticky control is `d-lg-none`).
- Scroll: header scrolls away; filter button pins with top inset matching hamburger row; hint scrolls away with content (unchanged product behavior per existing CSS comments).
- **Tap-through:** toolbar count / page size on the left still receive taps where the sticky cell is empty.
- **Resize / rotate:** grid columns reflow; button stays in column 1.
- **Long / short results:** sticky holds through pagination; returns to natural position when scrolling back to top (no JS = no jump from state toggles).

## Fallback (only if grid overlap causes unacceptable issues)

Use **IntersectionObserver + `position: fixed`** on the button with a **sentinel** node and a **min-height placeholder** on the wrapper to avoid layout shift, updating `left`/`width` on `resize`. Prefer the grid approach first to stay consistent with the codebase’s CSS-first shell.
