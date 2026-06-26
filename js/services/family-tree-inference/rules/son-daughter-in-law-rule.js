/**
 * @fileoverview Infers son ↔ daughter-in-law when exactly one son and one daughter-in-law exist.
 * @module services/family-tree-inference/rules/son-daughter-in-law-rule
 */

import { linkSpouse } from '../graph-mutations.js';
import { CONFIDENCE_INFERRED } from '../inference-confidence.js';

/** @type {import('../inference-context.js').InferenceRule} */
export const SonDaughterInLawRule = {
  name: 'SonDaughterInLawRule',
  apply(ctx) {
    const sons = ctx.getOwnerChildrenByRelationship(['son']);
    const daughterInLaws = ctx.getNodeIdsByRelationship('daughter_in_law')
      .filter((id) => !ctx.hasSpouseLink(id));

    if (sons.length !== 1 || daughterInLaws.length !== 1) return;

    const sonId = sons[0];
    const dilId = daughterInLaws[0];
    linkSpouse(sonId, dilId, ctx.nodes);

    ctx.recordInference(dilId, {
      confidence: CONFIDENCE_INFERRED,
      ruleName: SonDaughterInLawRule.name,
      edgeType: 'marriage',
    });
  },
};
