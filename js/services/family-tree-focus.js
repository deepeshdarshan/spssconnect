/**
 * @fileoverview Focused subtree extraction for interactive family tree navigation.
 * @module services/family-tree-focus
 */

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

  if (focus.spouseId) visible.add(focus.spouseId);

  focus.childrenIds.forEach((childId) => {
    visible.add(childId);
    const child = graph.nodes.get(childId);
    if (child?.spouseId) visible.add(child.spouseId);
    (child?.childrenIds || []).forEach((gcId) => visible.add(gcId));
  });

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
    if (!visibleIds.has(sourceId) || !visibleIds.has(targetId)) return;
    links.push({
      id: `${sourceId}->${targetId}:${type}`,
      sourceId,
      targetId,
      type,
    });
  };

  if (focus.fatherId && focus.motherId) {
    pushLink(focus.fatherId, focus.motherId, 'parent-child');
    pushLink(focus.motherId, focusId, 'parent-child');
  } else if (focus.fatherId) {
    pushLink(focus.fatherId, focusId, 'parent-child');
  } else if (focus.motherId) {
    pushLink(focus.motherId, focusId, 'parent-child');
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
  if (node.isHouseOwner) return 'house_owner';
  const focus = graph.nodes.get(focusId);
  if (!focus) return 'member';

  if (node.id === focus.fatherId || node.id === focus.motherId) return 'parent';
  if (node.id === focus.spouseId) return 'spouse';

  const isChildSpouse = focus.childrenIds.some((cid) => graph.nodes.get(cid)?.spouseId === node.id);
  if (isChildSpouse) return 'spouse';

  if (focus.childrenIds.includes(node.id)) return 'child';

  const isGrandchild = focus.childrenIds.some((cid) => {
    const child = graph.nodes.get(cid);
    return (child?.childrenIds || []).includes(node.id);
  });
  if (isGrandchild) return 'child';

  if (node.id === focusId) return 'member';
  return 'member';
}

/**
 * @typedef {Object} FamilyFocusView
 * @property {string} focusId
 * @property {Set<string>} nodeIds
 * @property {FamilyTreeLink[]} links
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
  return { focusId: safeFocusId, nodeIds, links };
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
