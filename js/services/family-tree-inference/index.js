/**
 * @fileoverview Sequential rule engine for family relationship inference.
 * @module services/family-tree-inference
 */

import { InferenceContext } from './inference-context.js';
import { HouseOwnerRule } from './rules/house-owner-rule.js';
import { SpouseRule } from './rules/spouse-rule.js';
import { SonDaughterInLawRule } from './rules/son-daughter-in-law-rule.js';
import { DaughterSonInLawRule } from './rules/daughter-son-in-law-rule.js';
import { FatherInLawRule } from './rules/father-in-law-rule.js';
import { MotherInLawRule } from './rules/mother-in-law-rule.js';
import { GrandchildrenRule } from './rules/grandchildren-rule.js';
import { UnresolvedMembersRule } from './rules/unresolved-members-rule.js';

/**
 * @typedef {import('../family-tree-graph-builder.js').FamilyGraphNode} FamilyGraphNode
 * @typedef {import('./inference-context.js').InferenceMeta} InferenceMeta
 */

/** @type {import('./inference-context.js').InferenceRule[]} */
const INFERENCE_RULES = [
  HouseOwnerRule,
  SpouseRule,
  SonDaughterInLawRule,
  DaughterSonInLawRule,
  FatherInLawRule,
  MotherInLawRule,
  GrandchildrenRule,
  UnresolvedMembersRule,
];

/** @type {Map<string, object>} */
const engineCache = new Map();

/**
 * @typedef {Object} InferenceEngineResult
 * @property {Map<string, InferenceMeta>} inferenceMeta
 * @property {string[]} unresolvedIds
 */

/**
 * Runs all inference rules sequentially against the household graph nodes.
 *
 * @param {Map<string, FamilyGraphNode>} nodes
 * @param {string} ownerId
 * @returns {InferenceEngineResult}
 */
export function runInferenceEngine(nodes, ownerId) {
  const ctx = new InferenceContext(nodes, ownerId);
  INFERENCE_RULES.forEach((rule) => rule.apply(ctx));
  return {
    inferenceMeta: ctx.inferenceMeta,
    unresolvedIds: ctx.unresolvedIds,
  };
}

/**
 * Clears the session cache for family graph inference results.
 *
 * @param {string} [recordId] - When omitted, clears the entire cache.
 */
export function clearInferenceCache(recordId) {
  if (recordId) {
    engineCache.delete(recordId);
    return;
  }
  engineCache.clear();
}

/**
 * @param {string} recordId
 * @returns {object|undefined}
 */
export function getCachedFamilyGraph(recordId) {
  return engineCache.get(recordId);
}

/**
 * @param {string} recordId
 * @param {object} graph
 */
export function cacheFamilyGraph(recordId, graph) {
  engineCache.set(recordId, graph);
}

export { INFERENCE_RULES };
