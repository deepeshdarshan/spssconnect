/**
 * @fileoverview Shared helpers for family tree and other unit tests.
 */

import { buildFamilyGraphFromRecord } from '../../js/services/family-tree-graph-builder.js';
import { clearInferenceCache } from '../../js/services/family-tree-inference/index.js';

export { clearInferenceCache };

/**
 * @param {Object[]} members
 * @param {Object[]} [nonMembers]
 * @returns {import('../../js/services/family-tree-graph-builder.js').FamilyGraph}
 */
export function buildTestGraph(members = [], nonMembers = []) {
  clearInferenceCache();
  return buildFamilyGraphFromRecord({
    id: `test-${Date.now()}-${Math.random()}`,
    personalDetails: { name: 'House Owner' },
    members,
    nonMembers,
  });
}

/**
 * @param {import('../../js/services/family-tree-graph-builder.js').FamilyGraph} graph
 * @returns {number}
 */
export function totalNodeCount(graph) {
  return graph.nodes.size;
}

/**
 * @param {import('../../js/services/family-tree-graph-builder.js').FamilyGraph} graph
 * @returns {number}
 */
export function accountedMemberCount(graph) {
  const resolved = new Set([graph.ownerId]);
  graph.unresolvedIds.forEach((id) => resolved.add(id));
  for (const id of graph.nodes.keys()) {
    if (id === graph.ownerId) continue;
    const node = graph.nodes.get(id);
    const linked = Boolean(
      node?.spouseId
      || node?.fatherId
      || node?.motherId
      || (node?.childrenIds?.length ?? 0) > 0
      || [...graph.nodes.values()].some((n) =>
        n.spouseId === id || n.fatherId === id || n.motherId === id || n.childrenIds.includes(id)),
    );
    if (linked) resolved.add(id);
  }
  return resolved.size;
}
