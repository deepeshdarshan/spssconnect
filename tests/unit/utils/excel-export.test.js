/**
 * @fileoverview Unit tests for js/utils/excel-export.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertHasExports } from '../../setup/module-test-utils.js';

const MODULE = '../../../js/utils/excel-export.js';

describe('js/utils/excel-export.js', () => {
  it('loads and exposes exports', async () => {
    const mod = await import(MODULE);
    assertHasExports(mod, ['computeColumnWidths', 'downloadXlsx']);
  });

  describe('computeColumnWidths', () => {
    it('sizes columns to the longest header or value plus padding', async () => {
      const { computeColumnWidths } = await import(MODULE);
      assert.deepEqual(
        computeColumnWidths(['#', 'House Name'], [[1, 'Pushpakam'], [2, 'Sree Nilayam House']]),
        [6, 20],
      );
    });

    it('caps very long values', async () => {
      const { computeColumnWidths } = await import(MODULE);
      assert.deepEqual(computeColumnWidths(['Address'], [['x'.repeat(200)]]), [60]);
    });

    it('treats missing cells as empty', async () => {
      const { computeColumnWidths } = await import(MODULE);
      assert.deepEqual(computeColumnWidths(['Phone'], [[null], []]), [7]);
    });
  });
});
