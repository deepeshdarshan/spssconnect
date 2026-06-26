/**
 * @fileoverview Mutable state container for the family tree inference rule engine.
 * @module services/family-tree-inference/inference-context
 */

import { normalizeRelationshipKey } from '../family-tree-graph-builder.js';
import { FAMILY_TREE_SUPPORTED_RELATIONSHIPS } from '../../constants/family-tree.js';

/**
 * @typedef {import('../family-tree-graph-builder.js').FamilyGraphNode} FamilyGraphNode
 */

/**
 * @typedef {Object} InferenceMeta
 * @property {number} confidence
 * @property {string} ruleName
 * @property {string} [edgeType]
 */

/**
 * @typedef {Object} InferenceRule
 * @property {string} name
 * @property {(ctx: InferenceContext) => void} apply
 */

const SUPPORTED = new Set(FAMILY_TREE_SUPPORTED_RELATIONSHIPS);

/**
 * Holds graph nodes and inference metadata for sequential rule execution.
 */
export class InferenceContext {
  /**
   * @param {Map<string, FamilyGraphNode>} nodes
   * @param {string} ownerId
   */
  constructor(nodes, ownerId) {
    this.nodes = nodes;
    this.ownerId = ownerId;
    /** @type {Map<string, InferenceMeta>} */
    this.inferenceMeta = new Map();
    /** @type {string[]} */
    this.unresolvedIds = [];
  }

  /**
   * @returns {FamilyGraphNode|undefined}
   */
  getOwner() {
    return this.nodes.get(this.ownerId);
  }

  /**
   * @param {string} nodeId
   * @param {InferenceMeta} meta
   */
  recordInference(nodeId, meta) {
    this.inferenceMeta.set(nodeId, meta);
  }

  /**
   * @param {string|string[]} relKeys
   * @returns {string[]}
   */
  getNodeIdsByRelationship(relKeys) {
    const wanted = new Set(
      (Array.isArray(relKeys) ? relKeys : [relKeys]).map((k) => normalizeRelationshipKey(k)),
    );
    const ids = [];
    for (const [id, node] of this.nodes) {
      if (id === this.ownerId) continue;
      const rel = normalizeRelationshipKey(node.relationshipToOwner);
      if (wanted.has(rel)) ids.push(id);
    }
    return ids;
  }

  /**
   * Returns owner child ids whose stored relationship matches any given key.
   *
   * @param {string[]} relKeys
   * @returns {string[]}
   */
  getOwnerChildrenByRelationship(relKeys) {
    const owner = this.getOwner();
    if (!owner) return [];
    const wanted = new Set(relKeys.map((k) => normalizeRelationshipKey(k)));
    return owner.childrenIds.filter((cid) => {
      const rel = normalizeRelationshipKey(this.nodes.get(cid)?.relationshipToOwner);
      return wanted.has(rel);
    });
  }

  /**
   * @param {string} nodeId
   * @returns {boolean}
   */
  hasSpouseLink(nodeId) {
    const node = this.nodes.get(nodeId);
    return Boolean(node?.spouseId);
  }

  /**
   * @param {string} relKey
   * @returns {boolean}
   */
  isSupportedRelationship(relKey) {
    return SUPPORTED.has(normalizeRelationshipKey(relKey));
  }

  /**
   * Collects node ids reachable from the house owner through resolved graph edges.
   *
   * @returns {Set<string>}
   */
  collectResolvedNodeIds() {
    const resolved = new Set([this.ownerId]);
    const queue = [this.ownerId];

    while (queue.length > 0) {
      const id = queue.shift();
      const node = this.nodes.get(id);
      if (!node) continue;

      const linked = [
        node.spouseId,
        node.fatherId,
        node.motherId,
        ...node.childrenIds,
      ].filter((nid) => nid && this.nodes.has(nid));

      for (const nid of linked) {
        if (!resolved.has(nid)) {
          resolved.add(nid);
          queue.push(nid);
        }
      }
    }

    return resolved;
  }
}
