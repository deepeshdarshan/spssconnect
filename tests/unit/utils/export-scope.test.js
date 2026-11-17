/**
 * @fileoverview Unit tests for js/utils/export-scope.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertHasExports } from '../../setup/module-test-utils.js';

const MODULE = '../../../js/utils/export-scope.js';

describe('js/utils/export-scope.js', () => {
  it('loads and exposes exports', async () => {
    const mod = await import(MODULE);
    assertHasExports(mod, ['buildExportFilename', 'buildExportSubtitle', 'resolveExportSabha']);
  });

  describe('resolveExportSabha', () => {
    it('uses the only selected sabha for super admins', async () => {
      const { resolveExportSabha } = await import(MODULE);
      assert.equal(resolveExportSabha({ selectedSabhas: new Set(['Edappally']), superAdmin: true }), 'Edappally');
    });

    it('returns null for super admins with none or several sabhas selected', async () => {
      const { resolveExportSabha } = await import(MODULE);
      assert.equal(resolveExportSabha({ selectedSabhas: new Set(), superAdmin: true }), null);
      assert.equal(resolveExportSabha({ selectedSabhas: new Set(['Aluva', 'Edappally']), superAdmin: true }), null);
    });

    it('uses the profile sabha for PS admins regardless of filters', async () => {
      const { resolveExportSabha } = await import(MODULE);
      assert.equal(resolveExportSabha({ selectedSabhas: new Set(), superAdmin: false, userSabha: 'Aluva' }), 'Aluva');
      assert.equal(resolveExportSabha({ superAdmin: false, userSabha: null }), null);
    });
  });

  describe('buildExportSubtitle', () => {
    it('names the sabha or falls back to the jilla', async () => {
      const { buildExportSubtitle } = await import(MODULE);
      assert.equal(buildExportSubtitle('Edappally'), 'EDAPPALLY PRADESHIKA SABHA');
      assert.equal(buildExportSubtitle(null), 'ERNAKULAM JILLA');
    });
  });

  describe('buildExportFilename', () => {
    it('appends a lowercase sabha slug when scoped', async () => {
      const { buildExportFilename } = await import(MODULE);
      assert.equal(buildExportFilename('spss_household_directory', 'Edappally', '.pdf'), 'spss_household_directory_edappally.pdf');
      assert.equal(buildExportFilename('spss_advanced_search', 'North Paravur', '.xlsx'), 'spss_advanced_search_north_paravur.xlsx');
    });

    it('omits the suffix when not scoped', async () => {
      const { buildExportFilename } = await import(MODULE);
      assert.equal(buildExportFilename('spss_household_directory', null, '.xlsx'), 'spss_household_directory.xlsx');
    });
  });
});
