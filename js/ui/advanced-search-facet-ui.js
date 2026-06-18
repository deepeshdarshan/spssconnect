/**
 * @fileoverview Shared HTML and DOM helpers for advanced-search-style facet filter panels.
 * Consumed by {@link ../pages/member-advanced-search-page.js} and {@link ../pages/dashboard-service.js}.
 * @module advanced-search-facet-ui
 */

import { escapeHtml } from './ui-service.js';

/**
 * @param {Object} options
 * @param {string} options.facet - Facet key stored in `data-facet`.
 * @param {string} options.value - Stored filter value in `data-value`.
 * @param {string} options.label - Visible checkbox label.
 * @param {string} options.inputId - Unique DOM id for the checkbox input.
 * @param {boolean} [options.checked=false]
 * @returns {string} HTML snippet for one custom facet checkbox.
 */
export function buildFacetCheckboxHtml({ facet, value, label, inputId, checked = false }) {
  const esc = escapeHtml;
  const checkedAttr = checked ? 'checked' : '';
  return `
    <label class="advanced-search-facet-check" for="${esc(inputId)}">
      <input class="advanced-search-facet-input" type="checkbox"
        id="${esc(inputId)}" data-facet="${esc(facet)}" data-value="${esc(value)}" ${checkedAttr}>
      <span class="advanced-search-facet-check__box" aria-hidden="true">
        <i class="bi bi-check-lg advanced-search-facet-check__tick"></i>
      </span>
      <span class="advanced-search-facet-check__label">${esc(label)}</span>
    </label>`;
}

/**
 * @param {Object} options
 * @param {string} options.title - Section heading text.
 * @param {string} options.facet - Facet key for `data-facet` on the section.
 * @param {Array<string>} options.valueKeys - Checkbox values in display order.
 * @param {(value: string) => string} options.labelFn - Maps each value key to a label.
 * @param {number} options.idOffset - Starting index for stable checkbox id suffixes.
 * @param {string} [options.inputIdPrefix='facet'] - Prefix for generated checkbox ids.
 * @param {string} [options.facetIcon='bi-sliders'] - Bootstrap Icons class on the section title.
 * @param {string} [options.extraClass=''] - Optional extra class on the section root.
 * @param {(facet: string, value: string) => boolean} [options.isValueChecked] - Whether a value is selected.
 * @returns {{ html: string, nextId: number }}
 */
export function buildFacetSectionHtml({
  title,
  facet,
  valueKeys,
  labelFn,
  idOffset,
  inputIdPrefix = 'facet',
  facetIcon = 'bi-sliders',
  extraClass = '',
  isValueChecked = () => false,
}) {
  let n = idOffset;
  const body = valueKeys.map((val) => {
    n += 1;
    const inputId = `${inputIdPrefix}_${facet}_${n}`;
    return buildFacetCheckboxHtml({
      facet,
      value: val,
      label: labelFn(val),
      inputId,
      checked: isValueChecked(facet, val),
    });
  }).join('');
  const esc = escapeHtml;
  const classAttr = extraClass ? ` ${esc(extraClass)}` : '';
  return {
    html: `
      <section class="advanced-search-facet-group${classAttr}" data-facet="${esc(facet)}">
        <h3 class="advanced-search-facet-group__title">
          <i class="bi ${esc(facetIcon)}" aria-hidden="true"></i>
          <span>${esc(title)}</span>
        </h3>
        <div class="advanced-search-facet-group__list">
          ${body}
        </div>
      </section>`,
    nextId: n,
  };
}

/**
 * @param {Object} options
 * @param {string} options.facet
 * @param {string} options.value
 * @param {string} options.label - Full chip label (typically "Section: value").
 * @returns {string}
 */
export function buildFilterChipButtonHtml({ facet, value, label }) {
  const esc = escapeHtml;
  return `
    <button type="button" class="advanced-search-chip"
      data-chip-facet="${esc(facet)}" data-chip-value="${esc(value)}" title="Remove filter">
      <span>${esc(label)}</span>
      <i class="bi bi-x-lg" aria-hidden="true"></i>
    </button>`;
}

/**
 * @param {Object} options
 * @param {string} options.chipButtonsHtml - Concatenated chip button snippets.
 * @param {string} options.activePrefix - e.g. "Active filters:".
 * @param {string} options.clearAllLabel
 * @param {string} options.clearChipsButtonId - DOM id for inline clear-all control.
 * @returns {string}
 */
export function buildFilterChipsRowHtml({
  chipButtonsHtml,
  activePrefix,
  clearAllLabel,
  clearChipsButtonId,
}) {
  const esc = escapeHtml;
  return `
    <div class="advanced-search-chips__row">
      <span class="advanced-search-chips__prefix">${esc(activePrefix)}</span>
      ${chipButtonsHtml}
      <button type="button" class="advanced-search-chips__clear" id="${esc(clearChipsButtonId)}">${esc(clearAllLabel)}</button>
    </div>`;
}

/**
 * Syncs facet checkbox `checked` state from a `Record<string, Set<string>>` filter map.
 *
 * @param {ParentNode|null|undefined} container - Root that contains `.advanced-search-facet-input` elements.
 * @param {Record<string, Set<string>>} filterState
 */
export function syncFacetCheckboxesFromState(container, filterState) {
  if (!container) return;
  container.querySelectorAll('.advanced-search-facet-input').forEach((el) => {
    const facet = el.getAttribute('data-facet');
    const value = el.getAttribute('data-value');
    if (!facet || value == null) return;
    const set = filterState[facet];
    el.checked = Boolean(set && set.has(value));
  });
}

/**
 * Below Bootstrap `md`, hides the filter offcanvas after clear-all.
 *
 * @param {string} offcanvasElementId - DOM id of the offcanvas root.
 */
export function dismissFiltersOffcanvasOnMobile(offcanvasElementId) {
  if (!globalThis.matchMedia('(max-width: 767.98px)').matches) return;
  const el = document.getElementById(offcanvasElementId);
  const Offcanvas = globalThis.bootstrap?.Offcanvas;
  if (!el || !Offcanvas) return;
  Offcanvas.getInstance(el)?.hide();
}

/**
 * Wires debounced quick-search input and optional clear button.
 *
 * @param {Object} options
 * @param {HTMLInputElement|null|undefined} options.inputEl
 * @param {HTMLButtonElement|null|undefined} options.clearBtnEl
 * @param {number} options.debounceMs
 * @param {() => void} options.onQueryChange - Called after debounced input or immediate clear.
 */
export function bindDebouncedQuickSearchField({ inputEl, clearBtnEl, debounceMs, onQueryChange }) {
  if (!inputEl) return;

  const syncClearVisibility = () => {
    if (clearBtnEl) clearBtnEl.hidden = !inputEl.value;
  };

  let textTimer;
  inputEl.addEventListener('input', () => {
    syncClearVisibility();
    clearTimeout(textTimer);
    textTimer = setTimeout(onQueryChange, debounceMs);
  });

  clearBtnEl?.addEventListener('click', () => {
    inputEl.value = '';
    syncClearVisibility();
    inputEl.focus();
    onQueryChange();
  });

  syncClearVisibility();
}
