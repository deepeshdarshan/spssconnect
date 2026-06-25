/**
 * @fileoverview Member detail side panel for the family tree page (mockup layout).
 * @module ui/family-tree-panel-ui
 */

import { FAMILY_TREE } from '../constants/family-tree.js';
import { escapeHtml, formatDOB, calcAgeYears, formatEnumLabel } from './ui-service.js';
import { buildFamilyTreePanelAvatarHtml } from './family-tree-card-ui.js';
import { normalizePhoneDigits, whatsappHref } from '../services/member-person-search.js';

/**
 * @typedef {import('../services/family-tree-graph-builder.js').FamilyGraphNode} FamilyGraphNode
 */

/**
 * @typedef {Object} FamilyTreePanelContext
 * @property {string} recordId
 * @property {string} focusId
 * @property {boolean} canEdit
 */

/**
 * @param {string} phone
 * @returns {string|null}
 */
function telHref(phone) {
  const d = normalizePhoneDigits(phone);
  if (d.length === 10) return `tel:+91${d}`;
  if (d.length === 11 && d.startsWith('0')) return `tel:+91${d.slice(1)}`;
  return null;
}

/**
 * @param {string} iconClass
 * @param {string} label
 * @param {string} value
 * @returns {string}
 */
function buildDetailRow(iconClass, label, value) {
  return `
    <div class="family-tree-panel__row">
      <span class="family-tree-panel__row-icon" aria-hidden="true"><i class="bi bi-${iconClass}"></i></span>
      <div class="family-tree-panel__row-text">
        <span class="family-tree-panel__row-label">${escapeHtml(label)}</span>
        <span class="family-tree-panel__row-value">${value}</span>
      </div>
    </div>`;
}

/**
 * @returns {string}
 */
export function buildFamilyTreePanelPlaceholderHtml() {
  return `
    <div class="family-tree-panel__placeholder">
      <i class="bi bi-diagram-3" aria-hidden="true"></i>
      <p>${escapeHtml(FAMILY_TREE.PANEL_PLACEHOLDER)}</p>
    </div>`;
}

/**
 * @param {FamilyGraphNode} node
 * @param {string} relationshipLabel
 * @param {FamilyTreePanelContext} context
 * @returns {string}
 */
export function buildFamilyTreePanelHtml(node, relationshipLabel, context) {
  const esc = escapeHtml;
  const name = node.name || '—';
  const phone = String(node.phone || '').trim();
  const tel = telHref(phone);
  const wa = whatsappHref(phone);
  const dob = formatDOB(node.dob);
  const age = calcAgeYears(node.dob);
  const ageLine = age !== '—' ? `${age} ${FAMILY_TREE.YEARS_SUFFIX}` : '—';
  const occupation = formatEnumLabel(node.occupation);
  const blood = formatEnumLabel(node.bloodGroup);
  const gender = formatEnumLabel(node.gender);
  const viewHref = `view?id=${esc(context.recordId)}`;
  const editHref = `view?id=${esc(context.recordId)}&edit=1`;

  const roleClass = (() => {
    if (node.isHouseOwner) return 'house_owner';
    const rel = relationshipLabel.toLowerCase();
    if (rel.includes('spouse')) return 'spouse';
    if (rel === 'father' || rel === 'mother' || rel === 'parent') return 'parent';
    return 'child';
  })();
  const pillClass = roleClass === 'house_owner'
    ? 'family-tree-panel__pill'
    : `family-tree-panel__pill family-tree-panel__pill--${roleClass}`;

  const callBtn = tel
    ? `<a href="${esc(tel)}" class="btn btn-outline-secondary btn-sm family-tree-panel__action"><i class="bi bi-telephone" aria-hidden="true"></i>${esc(FAMILY_TREE.PANEL_CALL)}</a>`
    : '';

  const waBtn = wa
    ? `<a href="${esc(wa)}" class="btn btn-outline-success btn-sm family-tree-panel__action" target="_blank" rel="noopener noreferrer"><i class="bi bi-whatsapp" aria-hidden="true"></i>${esc(FAMILY_TREE.PANEL_WHATSAPP)}</a>`
    : '';

  const editBtn = context.canEdit
    ? `<a href="${editHref}" class="btn btn-outline-secondary btn-sm family-tree-panel__action"><i class="bi bi-pencil" aria-hidden="true"></i>${esc(FAMILY_TREE.PANEL_EDIT_FAMILY)}</a>`
    : '';

  return `
    <div class="family-tree-panel__profile">
      <div class="family-tree-panel__avatar">${buildFamilyTreePanelAvatarHtml(node.name)}</div>
      <h3 class="family-tree-panel__name">${esc(name)}</h3>
      <span class="${pillClass}">${esc(relationshipLabel)}</span>
      <p class="family-tree-panel__meta-line">${esc(ageLine)}${gender !== '—' ? ` · ${esc(gender)}` : ''}</p>
    </div>
    <div class="family-tree-panel__details">
      ${buildDetailRow('calendar3', FAMILY_TREE.LABEL_BIRTHDAY, esc(dob))}
      ${buildDetailRow('telephone', FAMILY_TREE.LABEL_PHONE, phone ? esc(phone) : '—')}
      ${buildDetailRow('briefcase', FAMILY_TREE.LABEL_OCCUPATION, esc(occupation))}
      ${buildDetailRow('droplet', FAMILY_TREE.LABEL_BLOOD_GROUP, esc(blood))}
    </div>
    <div class="family-tree-panel__actions">
      <a href="${viewHref}" class="btn btn-primary family-tree-panel__action family-tree-panel__action--primary">
        <i class="bi bi-person" aria-hidden="true"></i>${esc(FAMILY_TREE.PANEL_VIEW_FULL)}
      </a>
      ${editBtn}
      <button type="button" class="btn btn-outline-secondary btn-sm family-tree-panel__action" data-family-tree-center="${esc(node.id)}">
        <i class="bi bi-bullseye" aria-hidden="true"></i>${esc(FAMILY_TREE.PANEL_CENTER_HERE)}
      </button>
      <div class="family-tree-panel__action-row">
        ${callBtn}
        ${waBtn}
      </div>
    </div>`;
}

/**
 * @param {HTMLElement} panelEl
 */
export function openFamilyTreePanel(panelEl) {
  if (!panelEl) return;
  panelEl.classList.add('has-member');
  panelEl.setAttribute('aria-hidden', 'false');
  if (window.matchMedia('(max-width: 991.98px)').matches) {
    document.body.classList.add('family-tree-panel-open');
  }
}

/**
 * @param {HTMLElement} panelEl
 */
export function closeFamilyTreePanel(panelEl, bodyEl) {
  if (!panelEl) return;
  panelEl.classList.remove('has-member');
  panelEl.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('family-tree-panel-open');
  if (bodyEl) {
    bodyEl.innerHTML = buildFamilyTreePanelPlaceholderHtml();
  }
}
