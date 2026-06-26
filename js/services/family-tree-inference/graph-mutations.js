/**
 * @fileoverview Shared graph edge mutations for family tree inference.
 * @module services/family-tree-inference/graph-mutations
 */

/**
 * @typedef {import('../family-tree-graph-builder.js').FamilyGraphNode} FamilyGraphNode
 */

/**
 * Links two nodes as mutual spouses when not already linked.
 *
 * @param {string} aId
 * @param {string} bId
 * @param {Map<string, FamilyGraphNode>} nodes
 */
export function linkSpouse(aId, bId, nodes) {
  const a = nodes.get(aId);
  const b = nodes.get(bId);
  if (!a || !b) return;
  a.spouseId = bId;
  b.spouseId = aId;
}

/**
 * Adds a child reference on the parent when missing.
 *
 * @param {string} parentId
 * @param {string} childId
 * @param {Map<string, FamilyGraphNode>} nodes
 */
export function addChild(parentId, childId, nodes) {
  const parent = nodes.get(parentId);
  if (!parent || parent.childrenIds.includes(childId)) return;
  parent.childrenIds.push(childId);
}

/**
 * Sets parent ids on a child when not already assigned.
 *
 * @param {string} parentAId
 * @param {string|null} parentBId
 * @param {string} childId
 * @param {Map<string, FamilyGraphNode>} nodes
 */
export function assignParentsToChild(parentAId, parentBId, childId, nodes) {
  const child = nodes.get(childId);
  if (!child || child.fatherId || child.motherId) return;
  child.fatherId = parentAId;
  child.motherId = parentBId;
}

/**
 * Links owner parents as spouses when both are present.
 *
 * @param {Map<string, FamilyGraphNode>} nodes
 * @param {string} ownerId
 */
export function linkOwnerParentsIfBothPresent(nodes, ownerId) {
  const owner = nodes.get(ownerId);
  if (!owner?.fatherId || !owner.motherId) return;
  linkSpouse(owner.fatherId, owner.motherId, nodes);
}
