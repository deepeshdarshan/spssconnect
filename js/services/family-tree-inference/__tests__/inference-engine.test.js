/**
 * @fileoverview Unit tests for the family tree inference engine.
 * Run with: node --test js/services/family-tree-inference/__tests__/inference-engine.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildFamilyGraphFromRecord, OWNER_NODE_ID } from '../../family-tree-graph-builder.js';
import { clearInferenceCache } from '../index.js';

/**
 * @param {Object[]} members
 * @param {Object[]} [nonMembers]
 * @returns {import('../../family-tree-graph-builder.js').FamilyGraph}
 */
function buildTestGraph(members = [], nonMembers = []) {
  clearInferenceCache();
  return buildFamilyGraphFromRecord({
    id: `test-${Date.now()}-${Math.random()}`,
    personalDetails: { name: 'House Owner' },
    members,
    nonMembers,
  });
}

/**
 * @param {import('../../family-tree-graph-builder.js').FamilyGraph} graph
 * @returns {number}
 */
function totalNodeCount(graph) {
  return graph.nodes.size;
}

/**
 * @param {import('../../family-tree-graph-builder.js').FamilyGraph} graph
 * @returns {number}
 */
function accountedMemberCount(graph) {
  const resolved = new Set([graph.ownerId]);
  graph.unresolvedIds.forEach((id) => resolved.add(id));
  for (const id of graph.nodes.keys()) {
    if (id === graph.ownerId) continue;
    const node = graph.nodes.get(id);
    const linked = Boolean(
      node?.spouseId
      || node?.fatherId
      || node?.motherId
      || (node?.childrenIds?.length ?? 0) > 0
      || [...graph.nodes.values()].some((n) =>
        n.spouseId === id || n.fatherId === id || n.motherId === id || n.childrenIds.includes(id)),
    );
    if (linked) resolved.add(id);
  }
  return resolved.size;
}

describe('Family tree inference engine', () => {
  it('infers son ↔ daughter-in-law when only one son exists', () => {
    const graph = buildTestGraph([
      { name: 'Arun', relationship: 'son' },
      { name: 'Meera', relationship: 'daughter_in_law' },
    ]);

    const son = graph.nodes.get('member_0');
    const dil = graph.nodes.get('member_1');

    assert.equal(son?.spouseId, 'member_1');
    assert.equal(dil?.spouseId, 'member_0');
    assert.ok(!graph.unresolvedIds.includes('member_1'));
  });

  it('infers daughter ↔ son-in-law when only one daughter exists', () => {
    const graph = buildTestGraph([
      { name: 'Anjali', relationship: 'daughter' },
      { name: 'Rajesh', relationship: 'son_in_law' },
    ]);

    const daughter = graph.nodes.get('member_0');
    const sil = graph.nodes.get('member_1');

    assert.equal(daughter?.spouseId, 'member_1');
    assert.equal(sil?.spouseId, 'member_0');
    assert.ok(!graph.unresolvedIds.includes('member_1'));
  });

  it('does not infer daughter-in-law when two sons exist', () => {
    const graph = buildTestGraph([
      { name: 'Arun', relationship: 'son' },
      { name: 'Ravi', relationship: 'son' },
      { name: 'Meera', relationship: 'daughter_in_law' },
    ]);

    const dil = graph.nodes.get('member_2');
    assert.equal(dil?.spouseId, null);
    assert.ok(graph.unresolvedIds.includes('member_2'));
  });

  it('does not infer when two sons and two daughters-in-law exist', () => {
    const graph = buildTestGraph([
      { name: 'Arun', relationship: 'son' },
      { name: 'Ravi', relationship: 'son' },
      { name: 'Meera', relationship: 'daughter_in_law' },
      { name: 'Lakshmi', relationship: 'daughter_in_law' },
    ]);

    assert.ok(graph.unresolvedIds.includes('member_2'));
    assert.ok(graph.unresolvedIds.includes('member_3'));
    assert.equal(graph.nodes.get('member_2')?.spouseId, null);
    assert.equal(graph.nodes.get('member_3')?.spouseId, null);
  });

  it('does not infer grandchild parent when two sons exist', () => {
    const graph = buildTestGraph([
      { name: 'Arun', relationship: 'son' },
      { name: 'Ravi', relationship: 'son' },
      { name: 'Aditya', relationship: 'grandchild' },
    ]);

    const gc = graph.nodes.get('member_2');
    assert.equal(gc?.fatherId, null);
    assert.ok(graph.unresolvedIds.includes('member_2'));
  });

  it('does not infer grandchildren when son and daughter both exist', () => {
    const graph = buildTestGraph([
      { name: 'Arun', relationship: 'son' },
      { name: 'Anjali', relationship: 'daughter' },
      { name: 'Aditya', relationship: 'grandchild' },
    ]);

    assert.ok(graph.unresolvedIds.includes('member_2'));
  });

  it('infers grandchildren beneath sole son after daughter-in-law link', () => {
    const graph = buildTestGraph([
      { name: 'Arun', relationship: 'son' },
      { name: 'Meera', relationship: 'daughter_in_law' },
      { name: 'Aditya', relationship: 'grandchild' },
      { name: 'Anika', relationship: 'grandchild' },
    ]);

    const son = graph.nodes.get('member_0');
    assert.ok(son?.childrenIds.includes('member_2'));
    assert.ok(son?.childrenIds.includes('member_3'));
    assert.ok(!graph.unresolvedIds.includes('member_2'));
    assert.ok(!graph.unresolvedIds.includes('member_3'));
  });

  it('infers father-in-law as spouse parent when unambiguous', () => {
    const graph = buildTestGraph([
      { name: 'Spouse', relationship: 'spouse' },
      { name: 'FIL', relationship: 'father_in_law' },
    ]);

    const spouse = graph.nodes.get('member_0');
    assert.equal(spouse?.fatherId, 'member_1');
    assert.ok(!graph.unresolvedIds.includes('member_1'));
  });

  it('infers mother-in-law as spouse parent when unambiguous', () => {
    const graph = buildTestGraph([
      { name: 'Spouse', relationship: 'spouse' },
      { name: 'MIL', relationship: 'mother_in_law' },
    ]);

    const spouse = graph.nodes.get('member_0');
    assert.equal(spouse?.motherId, 'member_1');
    assert.ok(!graph.unresolvedIds.includes('member_1'));
  });

  it('keeps house owner as root and every member accounted for', () => {
    const graph = buildTestGraph([
      { name: 'Arun', relationship: 'son' },
      { name: 'Ravi', relationship: 'son' },
      { name: 'Meera', relationship: 'daughter_in_law' },
      { name: 'Brother', relationship: 'brother' },
    ]);

    assert.equal(graph.ownerId, OWNER_NODE_ID);
    assert.equal(accountedMemberCount(graph), totalNodeCount(graph));
    assert.ok(graph.unresolvedIds.includes('member_2'));
    assert.ok(graph.unresolvedIds.includes('member_3'));
  });

  it('caches graph per record id within session', () => {
    clearInferenceCache();
    const record = {
      id: 'cache-test-record',
      personalDetails: { name: 'Owner' },
      members: [{ name: 'Son', relationship: 'son' }],
    };

    const first = buildFamilyGraphFromRecord(record);
    const second = buildFamilyGraphFromRecord(record);
    assert.equal(first, second);
    clearInferenceCache('cache-test-record');
  });
});
