/**
 * @fileoverview Builds an in-memory family graph with explicit relationship IDs from a household record.
 * @module services/family-tree-graph-builder
 */

import {
  runInferenceEngine,
  getCachedFamilyGraph,
  cacheFamilyGraph,
} from './family-tree-inference/index.js';

/** Canonical graph node id for the house owner. */
export const OWNER_NODE_ID = 'owner';

/**
 * @typedef {Object} FamilyGraphNode
 * @property {string} memberId
 * @property {string} id
 * @property {boolean} isHouseOwner
 * @property {string} personType - `owner` | `member` | `non_member`
 * @property {string|null} relationshipToOwner - Stored enum key relative to house owner.
 * @property {string|null} fatherId
 * @property {string|null} motherId
 * @property {string|null} spouseId
 * @property {string[]} childrenIds
 * @property {string} [name]
 * @property {string} [dob]
 * @property {string} [phone]
 * @property {string} [email]
 * @property {string} [occupation]
 * @property {string} [areaOfExpertise]
 * @property {string} [bloodGroup]
 * @property {string} [photoURL]
 * @property {string} [membershipType]
 * @property {boolean} [holdsSpssPosition]
 * @property {string} [spssPositionName]
 */

/**
 * @typedef {import('./family-tree-inference/inference-context.js').InferenceMeta} InferenceMeta
 */

/**
 * @typedef {Object} FamilyGraph
 * @property {Map<string, FamilyGraphNode>} nodes
 * @property {string} ownerId
 * @property {string} recordId
 * @property {string[]} unresolvedIds
 * @property {Map<string, InferenceMeta>} inferenceMeta
 */

/**
 * Normalizes a stored relationship enum key.
 *
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function normalizeRelationshipKey(value) {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Creates a graph node from person fields.
 *
 * @param {Object} fields
 * @returns {FamilyGraphNode}
 */
function createGraphNode(fields) {
  return {
    memberId: fields.id,
    id: fields.id,
    isHouseOwner: Boolean(fields.isHouseOwner),
    personType: fields.personType || 'member',
    relationshipToOwner: fields.relationshipToOwner ?? null,
    fatherId: null,
    motherId: null,
    spouseId: null,
    childrenIds: [],
    name: fields.name || '',
    dob: fields.dob || '',
    phone: fields.phone || '',
    email: fields.email || '',
    occupation: fields.occupation || '',
    areaOfExpertise: fields.areaOfExpertise || '',
    bloodGroup: fields.bloodGroup || '',
    gender: fields.gender || '',
    photoURL: fields.photoURL || '',
    membershipType: fields.membershipType || '',
    holdsSpssPosition: Boolean(fields.holdsSpssPosition),
    spssPositionName: fields.spssPositionName || '',
  };
}

/**
 * Builds household nodes from a Firestore record without running inference.
 *
 * @param {Object} record
 * @returns {Map<string, FamilyGraphNode>}
 */
function createNodesFromRecord(record) {
  const nodes = new Map();
  const pd = record.personalDetails || {};

  nodes.set(OWNER_NODE_ID, createGraphNode({
    id: OWNER_NODE_ID,
    isHouseOwner: true,
    personType: 'owner',
    relationshipToOwner: null,
    name: pd.name,
    dob: pd.dob,
    phone: pd.phone,
    email: pd.email,
    occupation: pd.occupation,
    areaOfExpertise: pd.areaOfExpertise,
    bloodGroup: pd.bloodGroup,
    gender: pd.gender,
    photoURL: pd.photoURL,
    membershipType: pd.membershipType,
    holdsSpssPosition: pd.holdsSpssPosition,
    spssPositionName: pd.spssPositionName,
  }));

  (record.members || []).forEach((person, index) => {
    const id = `member_${index}`;
    nodes.set(id, createGraphNode({
      id,
      personType: 'member',
      relationshipToOwner: person.relationship,
      ...person,
    }));
  });

  (record.nonMembers || []).forEach((person, index) => {
    const id = `nonmember_${index}`;
    nodes.set(id, createGraphNode({
      id,
      personType: 'non_member',
      relationshipToOwner: person.relationship,
      ...person,
    }));
  });

  return nodes;
}

/**
 * Builds a family graph from a `member_details` record.
 *
 * @param {Object} record - Firestore document with `id`, `personalDetails`, `members`, `nonMembers`.
 * @returns {FamilyGraph}
 */
export function buildFamilyGraphFromRecord(record) {
  const recordId = record.id || '';
  const cached = recordId ? getCachedFamilyGraph(recordId) : undefined;
  if (cached) return /** @type {FamilyGraph} */ (cached);

  const nodes = createNodesFromRecord(record);
  const { inferenceMeta, unresolvedIds } = runInferenceEngine(nodes, OWNER_NODE_ID);

  const graph = {
    nodes,
    ownerId: OWNER_NODE_ID,
    recordId,
    unresolvedIds,
    inferenceMeta,
  };

  if (recordId) {
    cacheFamilyGraph(recordId, graph);
  }

  return graph;
}

/**
 * Counts household members (owner + `members`) and non-members separately.
 *
 * @param {FamilyGraph} graph
 * @returns {{ members: number, nonMembers: number }}
 */
export function countHouseholdMembership(graph) {
  let members = 0;
  let nonMembers = 0;
  for (const node of graph.nodes.values()) {
    if (node.personType === 'non_member') {
      nonMembers += 1;
    } else {
      members += 1;
    }
  }
  return { members, nonMembers };
}

/**
 * Returns true when only the house owner exists in the graph.
 *
 * @param {FamilyGraph} graph
 * @returns {boolean}
 */
export function isSingleMemberHousehold(graph) {
  return graph.nodes.size <= 1;
}
