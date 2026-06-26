/**
 * @fileoverview Infers grandchild parent when exactly one eligible son/daughter child exists.
 * @module services/family-tree-inference/rules/grandchildren-rule
 */

import { addChild, assignParentsToChild } from '../graph-mutations.js';
import { CONFIDENCE_INFERRED } from '../inference-confidence.js';

/** @type {import('../inference-context.js').InferenceRule} */
export const GrandchildrenRule = {
  name: 'GrandchildrenRule',
  apply(ctx) {
    const eligibleChildren = ctx.getOwnerChildrenByRelationship(['son', 'daughter']);
    if (eligibleChildren.length !== 1) return;

    const parentId = eligibleChildren[0];
    const parent = ctx.nodes.get(parentId);
    const grandchildIds = ctx.getNodeIdsByRelationship('grandchild');

    grandchildIds.forEach((gcId) => {
      addChild(parentId, gcId, ctx.nodes);
      assignParentsToChild(parentId, parent?.spouseId ?? null, gcId, ctx.nodes);
      ctx.recordInference(gcId, {
        confidence: CONFIDENCE_INFERRED,
        ruleName: GrandchildrenRule.name,
        edgeType: 'parent-child',
      });
    });
  },
};
