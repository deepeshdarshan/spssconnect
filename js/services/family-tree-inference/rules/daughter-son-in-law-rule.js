/**
 * @fileoverview Infers daughter ↔ son-in-law when exactly one daughter and one son-in-law exist.
 * @module services/family-tree-inference/rules/daughter-son-in-law-rule
 */

import { linkSpouse } from '../graph-mutations.js';
import { CONFIDENCE_INFERRED } from '../inference-confidence.js';

/** @type {import('../inference-context.js').InferenceRule} */
export const DaughterSonInLawRule = {
  name: 'DaughterSonInLawRule',
  apply(ctx) {
    const daughters = ctx.getOwnerChildrenByRelationship(['daughter']);
    const sonInLaws = ctx.getNodeIdsByRelationship('son_in_law')
      .filter((id) => !ctx.hasSpouseLink(id));

    if (daughters.length !== 1 || sonInLaws.length !== 1) return;

    const daughterId = daughters[0];
    const silId = sonInLaws[0];
    linkSpouse(daughterId, silId, ctx.nodes);

    ctx.recordInference(silId, {
      confidence: CONFIDENCE_INFERRED,
      ruleName: DaughterSonInLawRule.name,
      edgeType: 'marriage',
    });
  },
};
