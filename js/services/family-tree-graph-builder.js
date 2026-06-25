/**
 * @fileoverview Builds an in-memory family graph with explicit relationship IDs from a household record.
 * @module services/family-tree-graph-builder
 */

import { FAMILY_TREE_SUPPORTED_RELATIONSHIPS } from '../constants/family-tree.js';

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
 * @typedef {Object} FamilyGraph
 * @property {Map<string, FamilyGraphNode>} nodes
 * @property {string} ownerId
 * @property {string} recordId
 */

const SUPPORTED = new Set(FAMILY_TREE_SUPPORTED_RELATIONSHIPS);

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
 * Links two nodes as mutual spouses when not already linked.
 *
 * @param {string} aId
 * @param {string} bId
 * @param {Map<string, FamilyGraphNode>} nodes
 */
function linkSpouse(aId, bId, nodes) {
  const a = nodes.get(aId);
  const b = nodes.get(bId);
  if (!a || !b) return;
  a.spouseId = bId;
  b.spouseId = aId;
}

/**
 * Adds a child reference on the parent when missing.
 *
 * @param {string} parentId
 * @param {string} childId
 * @param {Map<string, FamilyGraphNode>} nodes
 */
function addChild(parentId, childId, nodes) {
  const parent = nodes.get(parentId);
  if (!parent || parent.childrenIds.includes(childId)) return;
  parent.childrenIds.push(childId);
}

/**
 * Sets parent ids on a child when household parents are the owner couple.
 *
 * @param {string} parentAId
 * @param {string|null} parentBId
 * @param {string} childId
 * @param {Map<string, FamilyGraphNode>} nodes
 */
function assignParentsToChild(parentAId, parentBId, childId, nodes) {
  const child = nodes.get(childId);
  if (!child || child.fatherId || child.motherId) return;
  child.fatherId = parentAId;
  child.motherId = parentBId;
}

/**
 * Returns son/daughter child ids for a household owner node.
 *
 * @param {FamilyGraphNode} owner
 * @param {Map<string, FamilyGraphNode>} nodes
 * @returns {string[]}
 */
function getSonDaughterChildIds(owner, nodes) {
  return owner.childrenIds.filter((cid) => {
    const rel = normalizeRelationshipKey(nodes.get(cid)?.relationshipToOwner);
    return rel === 'son' || rel === 'daughter';
  });
}

/**
 * Picks the first child whose relationship matches any of the given keys.
 *
 * @param {FamilyGraphNode} owner
 * @param {Map<string, FamilyGraphNode>} nodes
 * @param {string[]} relKeys
 * @returns {string|null}
 */
function findFirstChildByRelationship(owner, nodes, relKeys) {
  const wanted = new Set(relKeys);
  const match = owner.childrenIds.find((cid) => {
    const rel = normalizeRelationshipKey(nodes.get(cid)?.relationshipToOwner);
    return wanted.has(rel);
  });
  return match ?? null;
}

/**
 * Resolves explicit fatherId / motherId / spouseId / childrenIds from relationship-to-owner fields.
 *
 * @param {Map<string, FamilyGraphNode>} nodes
 * @param {string} ownerId
 */
function resolvePrimaryRelationships(nodes, ownerId) {
  const owner = nodes.get(ownerId);
  if (!owner) return;

  for (const [id, node] of nodes) {
    if (id === ownerId) continue;
    const rel = normalizeRelationshipKey(node.relationshipToOwner);
    if (!rel || !SUPPORTED.has(rel)) continue;

    switch (rel) {
      case 'father':
        if (!owner.fatherId) owner.fatherId = id;
        addChild(id, ownerId, nodes);
        break;
      case 'mother':
        if (!owner.motherId) owner.motherId = id;
        addChild(id, ownerId, nodes);
        break;
      case 'spouse':
        linkSpouse(ownerId, id, nodes);
        break;
      case 'son':
      case 'daughter':
        addChild(ownerId, id, nodes);
        assignParentsToChild(ownerId, owner.spouseId, id, nodes);
        break;
      default:
        break;
    }
  }
}

/**
 * Second pass — depends on children being registered in pass one.
 *
 * @param {Map<string, FamilyGraphNode>} nodes
 * @param {string} ownerId
 */
function resolveDerivedRelationships(nodes, ownerId) {
  const owner = nodes.get(ownerId);
  if (!owner) return;

  for (const [id, node] of nodes) {
    if (id === ownerId) continue;
    const rel = normalizeRelationshipKey(node.relationshipToOwner);

    switch (rel) {
      case 'grandchild': {
        const parentCandidates = getSonDaughterChildIds(owner, nodes);
        if (parentCandidates.length === 0) break;
        const parentId = parentCandidates[0];
        addChild(parentId, id, nodes);
        const parent = nodes.get(parentId);
        assignParentsToChild(parentId, parent?.spouseId ?? null, id, nodes);
        break;
      }
      case 'son_in_law': {
        const sonId = findFirstChildByRelationship(owner, nodes, ['son']);
        if (sonId) linkSpouse(sonId, id, nodes);
        break;
      }
      case 'daughter_in_law': {
        const daughterId = findFirstChildByRelationship(owner, nodes, ['daughter']);
        if (daughterId) linkSpouse(daughterId, id, nodes);
        break;
      }
      default:
        break;
    }
  }

  if (owner.fatherId && owner.motherId) {
    linkSpouse(owner.fatherId, owner.motherId, nodes);
  }
}

/**
 * Resolves all relationship ids from stored relationship-to-owner fields.
 *
 * @param {Map<string, FamilyGraphNode>} nodes
 * @param {string} ownerId
 */
function resolveRelationships(nodes, ownerId) {
  resolvePrimaryRelationships(nodes, ownerId);
  resolveDerivedRelationships(nodes, ownerId);
}

/**
 * Builds a family graph from a `member_details` record.
 *
 * @param {Object} record - Firestore document with `id`, `personalDetails`, `members`, `nonMembers`.
 * @returns {FamilyGraph}
 */
export function buildFamilyGraphFromRecord(record) {
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

  resolveRelationships(nodes, OWNER_NODE_ID);

  return {
    nodes,
    ownerId: OWNER_NODE_ID,
    recordId: record.id,
  };
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
