/**
 * @fileoverview HTML builders for family tree node cards and panel avatars (initials only).
 * @module family-tree-card-ui
 */

import { escapeHtml, calcAgeYears } from './ui-service.js';
import { getMemberAvatarInitials, getMemberAvatarSwatchIndex } from '../utils/member-avatar-initials.js';
import { FAMILY_TREE } from '../constants/family-tree.js';

/**
 * @typedef {import('../services/family-tree-graph-builder.js').FamilyGraphNode} FamilyGraphNode
 */

/**
 * Resolves the small role icon class for a tree card corner badge.
 *
 * @param {FamilyGraphNode} node
 * @returns {string} Bootstrap Icons class name (without `bi` prefix).
 */
export function resolveTreeRoleIcon(node) {
  if (node.isHouseOwner) return 'star-fill';
  const gender = String(node.gender || '').toLowerCase();
  if (gender === 'female') return 'gender-female';
  if (gender === 'male') return 'gender-male';
  return 'person-fill';
}

/**
 * Builds initials avatar markup (same rules as advanced member search).
 *
 * @param {string} [name]
 * @returns {string}
 */
export function buildTreeInitialsAvatarHtml(name) {
  const initials = escapeHtml(getMemberAvatarInitials(name));
  const swatch = getMemberAvatarSwatchIndex(String(name ?? '').trim() || initials);
  return `<span class="family-tree-card__initials family-tree-card__initials--swatch-${swatch}">${initials}</span>`;
}

/**
 * Builds a single family tree node card for D3 foreignObject HTML.
 *
 * @param {Object} options
 * @param {FamilyGraphNode} options.node
 * @param {string} options.relationshipLabel
 * @param {string} options.role - CSS role modifier (`house_owner`, `spouse`, `child`, etc.).
 * @param {boolean} [options.selected=false]
 * @returns {string}
 */
export function buildFamilyTreeNodeCardHtml({ node, relationshipLabel, role, selected = false }) {
  const name = escapeHtml(node.name || '—');
  const rel = escapeHtml(relationshipLabel || 'Member');
  const age = calcAgeYears(node.dob);
  const ageHtml = age !== '—'
    ? `<p class="family-tree-card__age">${escapeHtml(age)} ${escapeHtml(FAMILY_TREE.YEARS_SUFFIX)}</p>`
    : '';

  const roleIcon = resolveTreeRoleIcon(node);
  const selectedClass = selected ? ' is-selected' : '';

  return `<div class="family-tree-card family-tree-card--${escapeHtml(role)}${selectedClass}" data-node-id="${escapeHtml(node.id)}">
    <span class="family-tree-card__role-icon" aria-hidden="true"><i class="bi bi-${roleIcon}"></i></span>
    <div class="family-tree-card__avatar">${buildTreeInitialsAvatarHtml(node.name)}</div>
    <p class="family-tree-card__name">${name}</p>
    <span class="family-tree-card__relationship">${rel}</span>
    ${ageHtml}
  </div>`;
}

/**
 * Large initials avatar for the member details panel.
 *
 * @param {string} [name]
 * @returns {string}
 */
export function buildFamilyTreePanelAvatarHtml(name) {
  const initials = escapeHtml(getMemberAvatarInitials(name));
  const swatch = getMemberAvatarSwatchIndex(String(name ?? '').trim() || initials);
  return `<div class="family-tree-panel__avatar-inner family-tree-panel__avatar-inner--swatch-${swatch}">${initials}</div>`;
}
