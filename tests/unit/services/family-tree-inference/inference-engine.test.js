/**
 * @fileoverview Unit tests for the family tree inference engine.
 * Run with: npm test or npm run test:unit
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildFamilyGraphFromRecord, OWNER_NODE_ID } from '../../../../js/services/family-tree-graph-builder.js';
import {
  buildTestGraph,
  totalNodeCount,
  accountedMemberCount,
  clearInferenceCache,
} from '../../../setup/test-utils.js';

describe('Family tree inference engine', () => {
  describe('positive cases', () => {
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

    it('links explicit spouse relationship from stored data', () => {
      const graph = buildTestGraph([
        { name: 'Wife', relationship: 'spouse' },
      ]);

      const spouse = graph.nodes.get('member_0');
      assert.equal(spouse?.spouseId, OWNER_NODE_ID);
      assert.equal(graph.nodes.get(OWNER_NODE_ID)?.spouseId, 'member_0');
    });

    it('links explicit father and mother on owner', () => {
      const graph = buildTestGraph([
        { name: 'Father', relationship: 'father' },
        { name: 'Mother', relationship: 'mother' },
      ]);

      const owner = graph.nodes.get(OWNER_NODE_ID);
      assert.equal(owner?.fatherId, 'member_0');
      assert.equal(owner?.motherId, 'member_1');

      const father = graph.nodes.get('member_0');
      const mother = graph.nodes.get('member_1');
      assert.equal(father?.spouseId, 'member_1');
      assert.equal(mother?.spouseId, 'member_0');
    });
  });

  describe('negative cases', () => {
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

    it('does not infer son-in-law when two daughters exist', () => {
      const graph = buildTestGraph([
        { name: 'Anjali', relationship: 'daughter' },
        { name: 'Priya', relationship: 'daughter' },
        { name: 'Raj', relationship: 'son_in_law' },
      ]);

      assert.equal(graph.nodes.get('member_2')?.spouseId, null);
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
  });

  describe('edge cases', () => {
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

    it('builds owner-only graph with no unresolved members', () => {
      const graph = buildTestGraph([]);
      assert.equal(graph.ownerId, OWNER_NODE_ID);
      assert.equal(graph.nodes.size, 1);
      assert.deepEqual(graph.unresolvedIds, []);
    });

    it('includes non-members without breaking inference', () => {
      const graph = buildTestGraph(
        [{ name: 'Son', relationship: 'son' }],
        [{ name: 'Guest', relationship: 'friend' }],
      );
      assert.ok(graph.nodes.has('nonmember_0'));
      assert.equal(graph.nodes.get('member_0')?.personType, 'member');
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
});
