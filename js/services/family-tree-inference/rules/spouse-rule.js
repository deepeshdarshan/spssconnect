/**
 * @fileoverview Resolves explicit spouse and primary kin relationships from stored data.
 * @module services/family-tree-inference/rules/spouse-rule
 */

import { normalizeRelationshipKey } from '../../family-tree-graph-builder.js';
import {
  linkSpouse,
  addChild,
  assignParentsToChild,
  linkOwnerParentsIfBothPresent,
} from '../graph-mutations.js';
import { CONFIDENCE_EXPLICIT } from '../inference-confidence.js';

/** @type {import('../inference-context.js').InferenceRule} */
export const SpouseRule = {
  name: 'SpouseRule',
  apply(ctx) {
    const owner = ctx.getOwner();
    if (!owner) return;

    for (const [id, node] of ctx.nodes) {
      if (id === ctx.ownerId) continue;
      const rel = normalizeRelationshipKey(node.relationshipToOwner);
      if (!rel || !ctx.isSupportedRelationship(rel)) continue;

      switch (rel) {
        case 'father':
          if (!owner.fatherId) owner.fatherId = id;
          addChild(id, ctx.ownerId, ctx.nodes);
          ctx.recordInference(id, {
            confidence: CONFIDENCE_EXPLICIT,
            ruleName: SpouseRule.name,
            edgeType: 'parent-child',
          });
          break;
        case 'mother':
          if (!owner.motherId) owner.motherId = id;
          addChild(id, ctx.ownerId, ctx.nodes);
          ctx.recordInference(id, {
            confidence: CONFIDENCE_EXPLICIT,
            ruleName: SpouseRule.name,
            edgeType: 'parent-child',
          });
          break;
        case 'spouse':
          linkSpouse(ctx.ownerId, id, ctx.nodes);
          ctx.recordInference(id, {
            confidence: CONFIDENCE_EXPLICIT,
            ruleName: SpouseRule.name,
            edgeType: 'marriage',
          });
          break;
        case 'son':
        case 'daughter':
          addChild(ctx.ownerId, id, ctx.nodes);
          assignParentsToChild(ctx.ownerId, owner.spouseId, id, ctx.nodes);
          ctx.recordInference(id, {
            confidence: CONFIDENCE_EXPLICIT,
            ruleName: SpouseRule.name,
            edgeType: 'parent-child',
          });
          break;
        default:
          break;
      }
    }

    linkOwnerParentsIfBothPresent(ctx.nodes, ctx.ownerId);
  },
};
