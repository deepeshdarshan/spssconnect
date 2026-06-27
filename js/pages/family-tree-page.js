/**
 * @fileoverview Family Relationship Tree page — loads household data and wires D3 renderer.
 * @module pages/family-tree-page
 */

import { FAMILY_TREE, FAMILY_TREE_ENABLE_FOCUS_NAVIGATION } from '../constants/family-tree.js';
import { MESSAGES, VIEW_PAGE_FROM_PARAM, resolveFamilyTreeBackNav } from '../constants/constants.js';
import { getMember } from '../services/member-service.js';
import {
  buildFamilyGraphFromRecord,
  countHouseholdMembership,
  isSingleMemberHousehold,
} from '../services/family-tree-graph-builder.js';
import { parseHouseholdIdFromUrl } from '../services/family-tree-focus.js';
import { FamilyTreeRenderer } from '../ui/family-tree-renderer.js';
import {
  buildFamilyTreePanelHtml,
  buildFamilyTreePanelPlaceholderHtml,
  openFamilyTreePanel,
  closeFamilyTreePanel,
} from '../ui/family-tree-panel-ui.js';
import { resolveFocusRelationshipLabel } from '../services/family-tree-focus.js';
import { formatHouseholdAddress } from '../services/member-person-search.js';
import { showToast, setLoaderMessage } from '../ui/ui-service.js';
import { canPerformAction } from '../services/permissions.js';
import * as Logger from '../utils/logger.js';

/** @type {FamilyTreeRenderer|null} */
let renderer = null;

/** @type {{ nodeId: string, node: import('../services/family-tree-graph-builder.js').FamilyGraphNode, focusId: string }|null} */
let lastPanelSelection = null;

/**
 * Applies static labels from constants to the page chrome.
 */
function applyStaticLabels() {
  const map = [
    ['familyTreePageTitle', FAMILY_TREE.PAGE_TITLE],
    ['familyTreePageSubtitle', FAMILY_TREE.PAGE_SUBTITLE],
    ['familyTreeLegendTitle', FAMILY_TREE.LEGEND_TITLE],
    ['familyTreeLegendToggleLabel', FAMILY_TREE.LEGEND_TOGGLE_LABEL],
    ['familyTreeHouseholdToggleLabel', FAMILY_TREE.HOUSEHOLD_TOGGLE_LABEL],
    ['familyTreeLegendMarriage', FAMILY_TREE.LEGEND_MARRIAGE],
    ['familyTreeLegendParent', FAMILY_TREE.LEGEND_PARENT_CHILD],
    ['familyTreeLegendOwner', FAMILY_TREE.LEGEND_OWNER],
    ['familyTreeLegendSpouse', FAMILY_TREE.LEGEND_SPOUSE],
    ['familyTreeLegendParentRole', FAMILY_TREE.LEGEND_PARENT],
    ['familyTreeLegendChild', FAMILY_TREE.LEGEND_CHILD],
    ['familyTreeLegendUnresolved', FAMILY_TREE.LEGEND_UNRESOLVED],
    ['familyTreePanelTitle', FAMILY_TREE.PANEL_TITLE],
    ['familyTreeCenterOwnerLabel', FAMILY_TREE.CENTER_OWNER],
  ];
  map.forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });
  syncFocusNavigationChrome();
}

/**
 * Shows or hides focus-navigation controls based on {@link FAMILY_TREE_ENABLE_FOCUS_NAVIGATION}.
 */
function syncFocusNavigationChrome() {
  document.querySelectorAll('[data-family-tree-action="center-owner"]').forEach((btn) => {
    btn.hidden = !FAMILY_TREE_ENABLE_FOCUS_NAVIGATION;
  });
}

/**
 * Sets the back link href and label from the `from` query param.
 *
 * @param {string|null|undefined} [recordId]
 */
function syncFamilyTreeBackNav(recordId) {
  const fromValue = new URLSearchParams(window.location.search).get(VIEW_PAGE_FROM_PARAM);
  const nav = resolveFamilyTreeBackNav(fromValue, recordId);
  const link = document.getElementById('familyTreeBackLink');
  const mobileLink = document.getElementById('familyTreeBackLinkMobile');
  const label = document.getElementById('familyTreeBackLabel');
  [link, mobileLink].forEach((el) => {
    if (!el) return;
    el.href = nav.href;
    el.setAttribute('aria-label', nav.ariaLabel);
  });
  if (label) label.textContent = nav.label;
}

/**
 * @param {string} key
 * @param {string} value
 */
function setFamilyTreeInfoField(key, value) {
  document.querySelectorAll(`[data-family-tree-info="${key}"]`).forEach((el) => {
    el.textContent = value;
  });
}

/**
 * @param {Object} record
 * @param {import('../services/family-tree-graph-builder.js').FamilyGraph} graph
 */
function renderPageHeader(record, graph) {
  const pd = record.personalDetails || {};
  const address = formatHouseholdAddress(pd) || pd.houseName || '—';
  const { members, nonMembers } = countHouseholdMembership(graph);

  setFamilyTreeInfoField('address', address);
  setFamilyTreeInfoField('owner', pd.name || '—');
  setFamilyTreeInfoField('sabha', pd.pradeshikaSabha || '—');
  setFamilyTreeInfoField('member-count', `${members} ${FAMILY_TREE.MEMBERS_SUFFIX}`);
  setFamilyTreeInfoField('non-member-count', `${nonMembers} ${FAMILY_TREE.NON_MEMBERS_SUFFIX}`);
}

/**
 * @param {import('../services/family-tree-graph-builder.js').FamilyGraph} graph
 */
function syncEmptyBanner(graph) {
  const banner = document.getElementById('familyTreeEmptyBanner');
  if (!banner) return;
  banner.classList.toggle('d-none', !isSingleMemberHousehold(graph));
}

/**
 * @param {HTMLElement} body
 */
function showPanelPlaceholder(body) {
  if (!body) return;
  body.innerHTML = buildFamilyTreePanelPlaceholderHtml();
}

/**
 * Closes the member panel and clears card selection.
 */
function closeMemberPanel() {
  const panel = document.getElementById('familyTreeDetailPanel');
  const body = document.getElementById('familyTreePanelBody');
  closeFamilyTreePanel(panel, body);
  renderer?.setSelectedNode(null);
}

/**
 * @param {string} nodeId
 * @param {import('../services/family-tree-graph-builder.js').FamilyGraphNode} node
 * @param {import('../services/family-tree-graph-builder.js').FamilyGraph} graph
 * @param {string} focusId
 * @param {boolean} canEdit
 */
function showMemberPanel(nodeId, node, graph, focusId, canEdit) {
  const panel = document.getElementById('familyTreeDetailPanel');
  const body = document.getElementById('familyTreePanelBody');
  if (!panel || !body) return;

  lastPanelSelection = { nodeId, node, focusId };

  const relationship = resolveFocusRelationshipLabel(node, focusId, graph);
  body.innerHTML = buildFamilyTreePanelHtml(node, relationship, {
    recordId: graph.recordId,
    focusId,
    canEdit,
  });

  bindPanelActions(panel, graph);
  openFamilyTreePanel(panel);
  renderer?.setSelectedNode(nodeId);
  document.getElementById('familyTreeMobileFab')?.classList.add('is-visible');
}

/**
 * @param {HTMLElement} panel
 * @param {import('../services/family-tree-graph-builder.js').FamilyGraph} graph
 */
function bindPanelActions(panel, graph) {
  if (!FAMILY_TREE_ENABLE_FOCUS_NAVIGATION) return;

  panel.querySelector('[data-family-tree-center]')?.addEventListener('click', (event) => {
    const btn = event.currentTarget;
    const targetId = btn?.getAttribute('data-family-tree-center');
    if (targetId) {
      renderer?.focusOn(targetId);
    }
  });
}

/**
 * @param {import('../services/family-tree-graph-builder.js').FamilyGraph} graph
 * @param {boolean} canEdit
 */
function bindToolbar(graph, canEdit) {
  document.querySelectorAll('[data-family-tree-action="zoom-in"]').forEach((btn) => {
    btn.addEventListener('click', () => renderer?.zoomBy(1.15));
  });
  document.querySelectorAll('[data-family-tree-action="zoom-out"]').forEach((btn) => {
    btn.addEventListener('click', () => renderer?.zoomBy(1 / 1.15));
  });
  document.querySelectorAll('[data-family-tree-action="center-owner"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (FAMILY_TREE_ENABLE_FOCUS_NAVIGATION) {
        renderer?.centerOnOwner();
      }
    });
  });
  document.querySelectorAll('[data-family-tree-action="fit-tree"]').forEach((btn) => {
    btn.addEventListener('click', () => renderer?.fitTree());
  });
}

/**
 * Binds legend and household popovers (mobile header + desktop legend control).
 */
function bindFamilyTreePopovers() {
  /** @type {Array<{ id: string, action: string, ariaLabel: string }>} */
  const configs = [
    { id: 'familyTreeLegendPopover', action: 'legend-toggle', ariaLabel: FAMILY_TREE.LEGEND_TOGGLE_ARIA },
    { id: 'familyTreeHouseholdPopover', action: 'household-toggle', ariaLabel: FAMILY_TREE.HOUSEHOLD_TOGGLE_ARIA },
  ];

  const entries = configs
    .map((config) => ({
      ...config,
      popover: document.getElementById(config.id),
      toggles: [...document.querySelectorAll(`[data-family-tree-action="${config.action}"]`)],
    }))
    .filter((entry) => entry.popover && entry.toggles.length > 0);

  if (entries.length === 0) return;

  const closeEntry = (entry) => {
    entry.popover.hidden = true;
    entry.toggles.forEach((toggle) => toggle.setAttribute('aria-expanded', 'false'));
  };

  const closeAll = () => entries.forEach(closeEntry);

  entries.forEach((entry) => {
    entry.toggles.forEach((toggle) => {
      toggle.setAttribute('aria-label', entry.ariaLabel);
      toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = !entry.popover.hidden;
        closeAll();
        if (!isOpen) {
          entry.popover.hidden = false;
          entry.toggles.forEach((btn) => btn.setAttribute('aria-expanded', 'true'));
        }
      });
    });
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    entries.forEach((entry) => {
      if (entry.popover.hidden) return;
      if (entry.popover.contains(target)) return;
      if (entry.toggles.some((toggle) => toggle.contains(target))) return;
      closeEntry(entry);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAll();
  });
}

/**
 * @param {string} message
 */
function renderErrorState(message) {
  const canvas = document.getElementById('familyTreeCanvas');
  if (canvas) {
    canvas.innerHTML = `<div class="family-tree-error" role="alert"><p>${message}</p></div>`;
  }
}

/**
 * @param {boolean} admin
 * @returns {Promise<void>}
 */
export async function initFamilyTreePage(admin) {
  applyStaticLabels();
  setLoaderMessage(FAMILY_TREE.LOADING_MESSAGE);

  const recordId = parseHouseholdIdFromUrl();
  syncFamilyTreeBackNav(recordId);

  const panelBody = document.getElementById('familyTreePanelBody');
  showPanelPlaceholder(panelBody);

  if (!recordId) {
    renderErrorState(MESSAGES.NO_RECORD_ID);
    return;
  }

  try {
    const record = await getMember(recordId);
    if (!record) {
      renderErrorState(MESSAGES.RECORD_NOT_FOUND);
      return;
    }

    const graph = buildFamilyGraphFromRecord({ ...record, id: recordId });
    renderPageHeader(record, graph);
    syncEmptyBanner(graph);

    const canvas = document.getElementById('familyTreeCanvas');
    if (!canvas) return;

    const canEdit = admin && canPerformAction('update');
    let currentFocusId = graph.ownerId;

    renderer = new FamilyTreeRenderer({
      containerEl: canvas,
      graph,
      initialFocusId: graph.ownerId,
      onNodeSelect: (nodeId, node) => {
        if (FAMILY_TREE_ENABLE_FOCUS_NAVIGATION) {
          renderer?.focusOn(nodeId);
          currentFocusId = nodeId;
        }
        showMemberPanel(nodeId, node, graph, currentFocusId, canEdit);
      },
      onFocusChange: (nodeId) => {
        currentFocusId = nodeId;
      },
    });

    bindToolbar(graph, canEdit);
    bindFamilyTreePopovers();

    const panel = document.getElementById('familyTreeDetailPanel');
    panel?.querySelector('[data-family-tree-panel-close]')?.addEventListener('click', () => {
      closeMemberPanel();
    });

    document.getElementById('familyTreeMobileFab')?.addEventListener('click', () => {
      if (panel?.classList.contains('has-member')) {
        closeMemberPanel();
      } else if (lastPanelSelection) {
        const { nodeId, node, focusId } = lastPanelSelection;
        showMemberPanel(nodeId, node, graph, focusId, canEdit);
      }
    });
  } catch (err) {
    Logger.error('Family tree page failed:', err);
    const isPermission = err?.code === 'permission-denied';
    renderErrorState(isPermission ? MESSAGES.PERMISSION_DENIED : MESSAGES.RECORD_LOAD_FAIL);
    showToast(isPermission ? MESSAGES.PERMISSION_DENIED : MESSAGES.RECORD_LOAD_FAIL, 'error');
  }
}
