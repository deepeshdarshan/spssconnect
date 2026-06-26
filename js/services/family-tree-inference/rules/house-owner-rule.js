/**
 * @fileoverview Marks the house owner as the inference root.
 * @module services/family-tree-inference/rules/house-owner-rule
 */

import { CONFIDENCE_EXPLICIT } from '../inference-confidence.js';

/** @type {import('../inference-context.js').InferenceRule} */
export const HouseOwnerRule = {
  name: 'HouseOwnerRule',
  apply(ctx) {
    const owner = ctx.getOwner();
    if (!owner) return;
    ctx.recordInference(ctx.ownerId, {
      confidence: CONFIDENCE_EXPLICIT,
      ruleName: HouseOwnerRule.name,
      edgeType: 'root',
    });
  },
};
