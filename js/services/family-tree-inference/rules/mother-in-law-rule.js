/**
 * @fileoverview Infers mother-in-law → spouse parent link when unambiguous.
 * @module services/family-tree-inference/rules/mother-in-law-rule
 */

import { addChild, linkSpouse } from '../graph-mutations.js';
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
export const MotherInLawRule = {
  name: 'MotherInLawRule',
  apply(ctx) {
    const spouseId = getOwnerSpouseId(ctx);
    if (!spouseId) return;

    const spouse = ctx.nodes.get(spouseId);
    if (!spouse || spouse.motherId) return;

    const motherInLaws = ctx.getNodeIdsByRelationship('mother_in_law');
    if (motherInLaws.length !== 1) return;

    const milId = motherInLaws[0];
    spouse.motherId = milId;
    addChild(milId, spouseId, ctx.nodes);

    ctx.recordInference(milId, {
      confidence: CONFIDENCE_INFERRED,
      ruleName: MotherInLawRule.name,
      edgeType: 'parent-child',
    });

    if (spouse.fatherId && spouse.motherId) {
      linkSpouse(spouse.fatherId, spouse.motherId, ctx.nodes);
    }
  },
};
