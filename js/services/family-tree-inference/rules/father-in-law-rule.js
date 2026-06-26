/**
 * @fileoverview Infers father-in-law → spouse parent link when unambiguous.
 * @module services/family-tree-inference/rules/father-in-law-rule
 */

import { addChild } from '../graph-mutations.js';
import { CONFIDENCE_INFERRED } from '../inference-confidence.js';

/**
 * @param {import('../inference-context.js').InferenceContext} ctx
 * @returns {string|null}
 */
function getOwnerSpouseId(ctx) {
  const owner = ctx.getOwner();
  if (!owner?.spouseId) return null;
  return owner.spouseId;
}

/** @type {import('../inference-context.js').InferenceRule} */
export const FatherInLawRule = {
  name: 'FatherInLawRule',
  apply(ctx) {
    const spouseId = getOwnerSpouseId(ctx);
    if (!spouseId) return;

    const spouse = ctx.nodes.get(spouseId);
    if (!spouse || spouse.fatherId) return;

    const fatherInLaws = ctx.getNodeIdsByRelationship('father_in_law');
    if (fatherInLaws.length !== 1) return;

    const filId = fatherInLaws[0];
    spouse.fatherId = filId;
    addChild(filId, spouseId, ctx.nodes);

    ctx.recordInference(filId, {
      confidence: CONFIDENCE_INFERRED,
      ruleName: FatherInLawRule.name,
      edgeType: 'parent-child',
    });
  },
};
