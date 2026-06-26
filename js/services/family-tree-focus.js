/**
 * @fileoverview Focused subtree extraction for interactive family tree navigation.
 * @module services/family-tree-focus
 */

import { FAMILY_TREE_NODE_ROLES } from '../constants/family-tree.js';

/**
 * @typedef {import('./family-tree-graph-builder.js').FamilyGraph} FamilyGraph
 * @typedef {import('./family-tree-graph-builder.js').FamilyGraphNode} FamilyGraphNode
 */

/**
 * @typedef {'parent-child' | 'marriage'} FamilyTreeLinkType
 */

/**
 * @typedef {Object} FamilyTreeLink
 * @property {string} id
 * @property {string} sourceId
 * @property {string} targetId
 * @property {FamilyTreeLinkType} type
 */

/**
 * @param {FamilyGraph} graph
 * @param {string} nodeId
 * @returns {boolean}
 */
export function isUnresolvedNode(graph, nodeId) {
  return (graph.unresolvedIds || []).includes(nodeId);
}

/**
 * Infers household parents for a child of the owner couple.
 *
 * @param {FamilyGraph} graph
 * @param {string} nodeId
 * @returns {string[]}
 */
function inferHouseholdParentIds(graph, nodeId) {
  const node = graph.nodes.get(nodeId);
  if (!node) return [];
  if (node.fatherId || node.motherId) {
    return [node.fatherId, node.motherId].filter(Boolean);
  }
  const owner = graph.nodes.get(graph.ownerId);
  if (!owner) return [];
  if (owner.childrenIds.includes(nodeId)) {
    const parents = [graph.ownerId];
    if (owner.spouseId) parents.push(owner.spouseId);
    return parents;
  }
  return [];
}

/**
 * Collects ids visible when a node is the tree focal point.
 *
 * @param {FamilyGraph} graph
 * @param {string} focusId
 * @returns {Set<string>}
 */
export function collectFocusedNodeIds(graph, focusId) {
  const focus = graph.nodes.get(focusId);
  const visible = new Set();
  if (!focus) return visible;

  visible.add(focusId);

  if (focus.fatherId) visible.add(focus.fatherId);
  if (focus.motherId) visible.add(focus.motherId);

  if (!focus.fatherId && !focus.motherId) {
    inferHouseholdParentIds(graph, focusId).forEach((id) => visible.add(id));
  }

  if (focus.spouseId) {
    visible.add(focus.spouseId);
    const spouse = graph.nodes.get(focus.spouseId);
    if (spouse?.fatherId) visible.add(spouse.fatherId);
    if (spouse?.motherId) visible.add(spouse.motherId);
  }

  focus.childrenIds.forEach((childId) => {
    visible.add(childId);
    const child = graph.nodes.get(childId);
    if (child?.spouseId) visible.add(child.spouseId);
    (child?.childrenIds || []).forEach((gcId) => visible.add(gcId));
  });

  (graph.unresolvedIds || []).forEach((id) => visible.add(id));

  return visible;
}

/**
 * Builds graph links for the focused view without distant relatives.
 *
 * @param {FamilyGraph} graph
 * @param {string} focusId
 * @param {Set<string>} visibleIds
 * @returns {FamilyTreeLink[]}
 */
export function buildFocusedLinks(graph, focusId, visibleIds) {
  /** @type {FamilyTreeLink[]} */
  const links = [];
  const focus = graph.nodes.get(focusId);
  if (!focus) return links;

  const pushLink = (sourceId, targetId, type) => {
    if (isUnresolvedNode(graph, sourceId) || isUnresolvedNode(graph, targetId)) return;
    if (!visibleIds.has(sourceId) || !visibleIds.has(targetId)) return;
    links.push({
      id: `${sourceId}->${targetId}:${type}`,
      sourceId,
      targetId,
      type,
    });
  };

  const pushParentCoupleLinks = (fatherId, motherId, childId) => {
    if (fatherId && motherId) {
      pushLink(fatherId, motherId, 'marriage');
      pushLink(fatherId, childId, 'parent-child');
    } else if (fatherId) {
      pushLink(fatherId, childId, 'parent-child');
    } else if (motherId) {
      pushLink(motherId, childId, 'parent-child');
    }
  };

  if (focus.fatherId || focus.motherId) {
    pushParentCoupleLinks(focus.fatherId, focus.motherId, focusId);
  } else {
    const inferred = inferHouseholdParentIds(graph, focusId);
    if (inferred.length === 2) {
      pushLink(inferred[0], inferred[1], 'marriage');
      pushLink(inferred[0], focusId, 'parent-child');
      pushLink(inferred[1], focusId, 'parent-child');
    } else if (inferred.length === 1) {
      pushLink(inferred[0], focusId, 'parent-child');
    }
  }

  if (focus.spouseId) {
    pushLink(focusId, focus.spouseId, 'marriage');
    const spouse = graph.nodes.get(focus.spouseId);
    if (spouse) {
      pushParentCoupleLinks(spouse.fatherId, spouse.motherId, focus.spouseId);
    }
  }

  focus.childrenIds.forEach((childId) => {
    if (!visibleIds.has(childId)) return;
    pushLink(focusId, childId, 'parent-child');
    const child = graph.nodes.get(childId);
    if (child?.spouseId) {
      pushLink(childId, child.spouseId, 'marriage');
    }
    (child?.childrenIds || []).forEach((gcId) => {
      if (visibleIds.has(gcId)) {
        pushLink(childId, gcId, 'parent-child');
      }
    });
  });

  return links;
}

/**
 * Resolves the display relationship label for a node in the current focus context.
 *
 * @param {FamilyGraphNode} node
 * @param {string} focusId
 * @param {FamilyGraph} graph
 * @returns {string}
 */
export function resolveFocusRelationshipLabel(node, focusId, graph) {
  if (isUnresolvedNode(graph, node.id)) {
    return formatRelationshipKey(node.relationshipToOwner) || 'Member';
  }

  if (node.isHouseOwner) return 'House Owner';
  if (node.id === focusId) {
    const rel = node.relationshipToOwner;
    if (rel) return formatRelationshipKey(rel);
    return 'Member';
  }

  const focus = graph.nodes.get(focusId);
  if (!focus) return 'Member';

  if (node.id === focus.fatherId) return 'Father';
  if (node.id === focus.motherId) return 'Mother';
  if (node.id === focus.spouseId) return 'Spouse';

  const spouse = focus.spouseId ? graph.nodes.get(focus.spouseId) : null;
  if (spouse?.fatherId === node.id) return 'Father-in-law';
  if (spouse?.motherId === node.id) return 'Mother-in-law';

  if (focus.childrenIds.includes(node.id)) {
    return formatRelationshipKey(node.relationshipToOwner) || 'Child';
  }

  const parentChild = focus.childrenIds.find((cid) => {
    const child = graph.nodes.get(cid);
    return child?.spouseId === node.id;
  });
  if (parentChild) return 'Spouse';

  const grandchildParent = focus.childrenIds.find((cid) => {
    const child = graph.nodes.get(cid);
    return (child?.childrenIds || []).includes(node.id);
  });
  if (grandchildParent) return 'Grandchild';

  return formatRelationshipKey(node.relationshipToOwner) || 'Member';
}

/**
 * @param {string|null|undefined} key
 * @returns {string}
 */
function formatRelationshipKey(key) {
  const k = String(key ?? '').trim();
  if (!k) return '';
  return k
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Determines the visual role token for node styling.
 *
 * @param {FamilyGraphNode} node
 * @param {string} focusId
 * @param {FamilyGraph} graph
 * @returns {string}
 */
export function resolveNodeVisualRole(node, focusId, graph) {
  if (isUnresolvedNode(graph, node.id)) {
    return FAMILY_TREE_NODE_ROLES.UNRESOLVED;
  }

  if (node.isHouseOwner) return FAMILY_TREE_NODE_ROLES.HOUSE_OWNER;
  const focus = graph.nodes.get(focusId);
  if (!focus) return FAMILY_TREE_NODE_ROLES.MEMBER;

  if (node.id === focus.fatherId || node.id === focus.motherId) return FAMILY_TREE_NODE_ROLES.PARENT;

  const spouse = focus.spouseId ? graph.nodes.get(focus.spouseId) : null;
  if (spouse && (node.id === spouse.fatherId || node.id === spouse.motherId)) {
    return FAMILY_TREE_NODE_ROLES.PARENT;
  }

  if (node.id === focus.spouseId) return FAMILY_TREE_NODE_ROLES.SPOUSE;

  const isChildSpouse = focus.childrenIds.some((cid) => graph.nodes.get(cid)?.spouseId === node.id);
  if (isChildSpouse) return FAMILY_TREE_NODE_ROLES.SPOUSE;

  if (focus.childrenIds.includes(node.id)) return FAMILY_TREE_NODE_ROLES.CHILD;

  const isGrandchild = focus.childrenIds.some((cid) => {
    const child = graph.nodes.get(cid);
    return (child?.childrenIds || []).includes(node.id);
  });
  if (isGrandchild) return FAMILY_TREE_NODE_ROLES.CHILD;

  if (node.id === focusId) return FAMILY_TREE_NODE_ROLES.MEMBER;
  return FAMILY_TREE_NODE_ROLES.MEMBER;
}

/**
 * @typedef {Object} FamilyFocusView
 * @property {string} focusId
 * @property {Set<string>} nodeIds
 * @property {FamilyTreeLink[]} links
 * @property {string[]} unresolvedIds
 */

/**
 * Builds the focused subgraph for rendering.
 *
 * @param {FamilyGraph} graph
 * @param {string} focusId
 * @returns {FamilyFocusView}
 */
export function buildFamilyFocusView(graph, focusId) {
  const safeFocusId = graph.nodes.has(focusId) ? focusId : graph.ownerId;
  const nodeIds = collectFocusedNodeIds(graph, safeFocusId);
  const links = buildFocusedLinks(graph, safeFocusId, nodeIds);
  const unresolvedIds = (graph.unresolvedIds || []).filter((id) => nodeIds.has(id));
  return { focusId: safeFocusId, nodeIds, links, unresolvedIds };
}

/**
 * Parses household id from query string or `/households/{id}/family-tree` pathname.
 *
 * @returns {string|null}
 */
export function parseHouseholdIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('id');
  if (fromQuery) return fromQuery.trim();

  const match = window.location.pathname.match(/\/households\/([^/]+)\/family-tree\/?$/i);
  if (match?.[1]) return decodeURIComponent(match[1]);

  return null;
}
