/**
 * @fileoverview Marks household members that could not be placed in the resolved tree.
 * @module services/family-tree-inference/rules/unresolved-members-rule
 */

import { CONFIDENCE_UNRESOLVED } from '../inference-confidence.js';

/** @type {import('../inference-context.js').InferenceRule} */
export const UnresolvedMembersRule = {
  name: 'UnresolvedMembersRule',
  apply(ctx) {
    const resolved = ctx.collectResolvedNodeIds();
    const unresolved = [];

    for (const id of ctx.nodes.keys()) {
      if (resolved.has(id)) continue;
      unresolved.push(id);
      ctx.recordInference(id, {
        confidence: CONFIDENCE_UNRESOLVED,
        ruleName: UnresolvedMembersRule.name,
        edgeType: 'unresolved',
      });
    }

    ctx.unresolvedIds = unresolved;
  },
};
