/**
 * @fileoverview Positions nodes for the focused family tree view.
 * @module ui/family-tree-layout
 */

import { FAMILY_TREE_LAYOUT, FAMILY_TREE_ROW_STEP } from '../constants/family-tree.js';

/**
 * @typedef {import('../services/family-tree-graph-builder.js').FamilyGraph} FamilyGraph
 */

/**
 * @typedef {Object} LayoutPosition
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} UnresolvedSectionLayout
 * @property {number} headerY
 * @property {number} nodesY
 * @property {number} centerX
 */

/**
 * @typedef {Object} FamilyTreeLayoutResult
 * @property {Map<string, LayoutPosition>} positions
 * @property {number} width
 * @property {number} height
 * @property {number} minX
 * @property {number} minY
 * @property {UnresolvedSectionLayout|null} unresolvedSection
 */

const {
  NODE_WIDTH,
  NODE_HEIGHT,
  HORIZONTAL_GAP,
  MARRIAGE_GAP,
  INTER_ROW_GAP,
} = FAMILY_TREE_LAYOUT;

/** Vertical gap between main tree and unresolved section (px). */
const UNRESOLVED_SECTION_GAP = INTER_ROW_GAP * 2;

/** Approximate height reserved for unresolved section header text (px). */
const UNRESOLVED_HEADER_HEIGHT = 56;

/**
 * Horizontal footprint of a child column (without trailing gap).
 *
 * @param {boolean} hasSpouse
 * @returns {number}
 */
function childUnitSpan(hasSpouse) {
  if (hasSpouse) {
    return NODE_WIDTH * 2 + MARRIAGE_GAP;
  }
  return NODE_WIDTH;
}

/**
 * Places a row of node ids centered on `centerX`.
 *
 * @param {string[]} ids
 * @param {number} centerX
 * @param {number} y
 * @param {Map<string, LayoutPosition>} positions
 */
function placeRowCentered(ids, centerX, y, positions) {
  if (ids.length === 0) return;
  const unit = NODE_WIDTH + HORIZONTAL_GAP;
  const total = ids.length * unit - HORIZONTAL_GAP;
  let x = centerX - total / 2 + NODE_WIDTH / 2;
  ids.forEach((id) => {
    positions.set(id, { x, y });
    x += unit;
  });
}

/**
 * Places a focal person and optional spouse on the same row.
 *
 * @param {string} focusId
 * @param {string|null} spouseId
 * @param {number} centerX
 * @param {number} y
 * @param {Map<string, LayoutPosition>} positions
 */
function placeFocusCouple(focusId, spouseId, centerX, y, positions) {
  if (spouseId) {
    const half = (NODE_WIDTH + MARRIAGE_GAP) / 2;
    positions.set(focusId, { x: centerX - half, y });
    positions.set(spouseId, { x: centerX + half, y });
    return;
  }
  positions.set(focusId, { x: centerX, y });
}

/**
 * Places father and mother side by side on one row above their child.
 *
 * @param {string|null} fatherId
 * @param {string|null} motherId
 * @param {number} centerX
 * @param {number} y
 * @param {Map<string, LayoutPosition>} positions
 */
function placeParentCouple(fatherId, motherId, centerX, y, positions) {
  if (fatherId && motherId) {
    placeFocusCouple(fatherId, motherId, centerX, y, positions);
    return;
  }
  if (fatherId) {
    positions.set(fatherId, { x: centerX, y });
  }
  if (motherId) {
    positions.set(motherId, { x: centerX, y });
  }
}

/**
 * Places a child unit (child + optional spouse) in a children row.
 *
 * @param {string} childId
 * @param {string|null} spouseId
 * @param {number} unitCenterX
 * @param {number} y
 * @param {Map<string, LayoutPosition>} positions
 */
function placeChildUnit(childId, spouseId, unitCenterX, y, positions) {
  if (spouseId) {
    const half = (NODE_WIDTH + MARRIAGE_GAP) / 2;
    positions.set(childId, { x: unitCenterX - half, y });
    positions.set(spouseId, { x: unitCenterX + half, y });
    return;
  }
  positions.set(childId, { x: unitCenterX, y });
}

/**
 * Places spouse parent nodes above the spouse column.
 *
 * @param {FamilyGraph} graph
 * @param {string} spouseId
 * @param {number} focusY
 * @param {Map<string, LayoutPosition>} positions
 */
function placeSpouseParents(graph, spouseId, focusY, positions) {
  const spouse = graph.nodes.get(spouseId);
  const spousePos = positions.get(spouseId);
  if (!spouse || !spousePos) return;

  const spouseCenterX = spousePos.x;
  const parentsY = focusY - FAMILY_TREE_ROW_STEP;

  placeParentCouple(
    spouse.fatherId || null,
    spouse.motherId || null,
    spouseCenterX,
    parentsY,
    positions,
  );
}

/**
 * Computes layout bounds from positioned nodes.
 *
 * @param {Map<string, LayoutPosition>} positions
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
 */
function computeBounds(positions) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  positions.forEach(({ x, y }) => {
    minX = Math.min(minX, x - NODE_WIDTH / 2);
    maxX = Math.max(maxX, x + NODE_WIDTH / 2);
    minY = Math.min(minY, y - NODE_HEIGHT / 2);
    maxY = Math.max(maxY, y + NODE_HEIGHT / 2);
  });

  if (!Number.isFinite(minX)) {
    return { minX: 0, maxX: NODE_WIDTH, minY: 0, maxY: NODE_HEIGHT };
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Shifts a layout position into positive SVG space.
 *
 * @param {LayoutPosition} pos
 * @param {FamilyTreeLayoutResult} layout
 * @returns {LayoutPosition}
 */
export function toCanvasPosition(pos, layout) {
  return {
    x: pos.x - layout.minX,
    y: pos.y - layout.minY,
  };
}

/**
 * Positions unresolved member cards in a horizontal row below the main tree.
 *
 * @param {string[]} unresolvedIds
 * @param {number} centerX
 * @param {number} nodesY
 * @param {Map<string, LayoutPosition>} positions
 */
export function layoutUnresolvedNodes(unresolvedIds, centerX, nodesY, positions) {
  placeRowCentered(unresolvedIds, centerX, nodesY, positions);
}

/**
 * Lays out nodes for the current focus view.
 *
 * @param {FamilyGraph} graph
 * @param {string} focusId
 * @param {Set<string>} visibleIds
 * @param {string[]} [unresolvedIds=[]]
 * @returns {FamilyTreeLayoutResult}
 */
export function layoutFamilyFocusView(graph, focusId, visibleIds, unresolvedIds = []) {
  const positions = new Map();
  const focus = graph.nodes.get(focusId);
  if (!focus) {
    return {
      positions,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      minX: 0,
      minY: 0,
      unresolvedSection: null,
    };
  }

  const centerX = 0;
  const focusY = 0;

  const fatherVisible = focus.fatherId && visibleIds.has(focus.fatherId) ? focus.fatherId : null;
  const motherVisible = focus.motherId && visibleIds.has(focus.motherId) ? focus.motherId : null;
  placeParentCouple(fatherVisible, motherVisible, centerX, focusY - FAMILY_TREE_ROW_STEP, positions);

  const spouseVisible = focus.spouseId && visibleIds.has(focus.spouseId) ? focus.spouseId : null;
  placeFocusCouple(focusId, spouseVisible, centerX, focusY, positions);

  if (spouseVisible) {
    placeSpouseParents(graph, spouseVisible, focusY, positions);
  }

  const childUnits = focus.childrenIds
    .filter((id) => visibleIds.has(id))
    .map((childId) => {
      const child = graph.nodes.get(childId);
      const spouseId = child?.spouseId && visibleIds.has(child.spouseId) ? child.spouseId : null;
      return { childId, spouseId };
    });

  const childrenY = focusY + FAMILY_TREE_ROW_STEP;
  const contentWidth = childUnits.reduce(
    (sum, unit) => sum + childUnitSpan(Boolean(unit.spouseId)),
    0,
  ) + Math.max(0, childUnits.length - 1) * HORIZONTAL_GAP;

  let cursorX = centerX - contentWidth / 2;

  childUnits.forEach(({ childId, spouseId }) => {
    const span = childUnitSpan(Boolean(spouseId));
    const unitCenterX = cursorX + span / 2;
    placeChildUnit(childId, spouseId, unitCenterX, childrenY, positions);

    const child = graph.nodes.get(childId);
    const grandkids = (child?.childrenIds || []).filter((id) => visibleIds.has(id));
    if (grandkids.length > 0) {
      placeRowCentered(grandkids, unitCenterX, childrenY + FAMILY_TREE_ROW_STEP, positions);
    }

    cursorX += span + HORIZONTAL_GAP;
  });

  /** @type {UnresolvedSectionLayout|null} */
  let unresolvedSection = null;

  if (unresolvedIds.length > 0) {
    const mainBounds = computeBounds(positions);
    const sectionTop = mainBounds.maxY + UNRESOLVED_SECTION_GAP;
    const headerY = sectionTop + UNRESOLVED_HEADER_HEIGHT / 2;
    const nodesY = sectionTop + UNRESOLVED_HEADER_HEIGHT + NODE_HEIGHT / 2;

    layoutUnresolvedNodes(unresolvedIds, centerX, nodesY, positions);
    unresolvedSection = { headerY, nodesY, centerX };
  }

  const bounds = computeBounds(positions);
  const padding = 56;
  const width = bounds.maxX - bounds.minX + padding * 2;
  const height = bounds.maxY - bounds.minY + padding * 2;

  return {
    positions,
    width: Math.max(width, NODE_WIDTH + padding * 2),
    height: Math.max(height, NODE_HEIGHT + padding * 2),
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    unresolvedSection,
  };
}

/**
 * Anchor on the bottom edge of a node card.
 *
 * @param {LayoutPosition} pos
 * @returns {{ x: number, y: number }}
 */
function bottomAnchor(pos) {
  return { x: pos.x, y: pos.y + NODE_HEIGHT / 2 };
}

/**
 * Anchor on the top edge of a node card.
 *
 * @param {LayoutPosition} pos
 * @returns {{ x: number, y: number }}
 */
function topAnchor(pos) {
  return { x: pos.x, y: pos.y - NODE_HEIGHT / 2 };
}

/**
 * Anchor at the vertical centre of a node card (for marriage connectors).
 *
 * @param {LayoutPosition} pos
 * @returns {{ x: number, y: number }}
 */
function centerAnchor(pos) {
  return { x: pos.x, y: pos.y };
}

/**
 * @typedef {Object} BuildLinkPathOptions
 * @property {'bottom' | 'center'} [sourceAnchor='bottom'] Use centre for couple junction (marriage line).
 */

/**
 * Builds an orthogonal SVG path between two layout points (canvas coordinates).
 *
 * @param {LayoutPosition} source
 * @param {LayoutPosition} target
 * @param {'parent-child' | 'marriage'} type
 * @param {BuildLinkPathOptions} [options]
 * @returns {string}
 */
export function buildLinkPath(source, target, type, options = {}) {
  if (type === 'marriage') {
    const a = centerAnchor(source);
    const b = centerAnchor(target);
    return `M${a.x},${a.y}H${b.x}`;
  }

  const childTop = topAnchor(target);
  const sourceAnchor = options.sourceAnchor === 'center' ? centerAnchor(source) : bottomAnchor(source);
  const parentEdgeY = options.sourceAnchor === 'center'
    ? source.y + NODE_HEIGHT / 2
    : sourceAnchor.y;
  const busY = (parentEdgeY + childTop.y) / 2;
  return `M${sourceAnchor.x},${sourceAnchor.y}V${busY}H${childTop.x}V${childTop.y}`;
}
