/**
 * @fileoverview Helpers for module smoke tests and export assertions.
 */

import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const SETUP_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SETUP_DIR, '..', '..');

/**
 * @param {string} importPath Path relative to the calling test file.
 * @returns {Promise<Record<string, unknown>>}
 */
export async function importModule(importPath) {
  const resolved = join(dirname(fileURLToPath(import.meta.url)), importPath);
  const href = `${pathToFileURL(resolved).href}?t=${Date.now()}`;
  return import(href);
}

/**
 * Resolves a path under `js/` from the project root for use in test imports.
 *
 * @param {string} jsRelativePath e.g. `utils/logger.js`
 * @param {string} testDir Absolute path to the test file directory
 * @returns {string} Relative import path from test file to source module
 */
export function jsImportPath(jsRelativePath, testDir) {
  const sourceAbs = join(PROJECT_ROOT, 'js', jsRelativePath);
  let rel = relative(testDir, sourceAbs);
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

/**
 * @param {Record<string, unknown>} mod
 * @returns {string[]}
 */
export function listExportNames(mod) {
  const names = Object.keys(mod).filter((k) => k !== 'default');
  if (mod.default !== undefined) names.push('default');
  return names.sort();
}

/**
 * @param {Record<string, unknown>} mod
 * @param {string[]} expectedNames
 */
export function assertHasExports(mod, expectedNames) {
  for (const name of expectedNames) {
    if (name === 'default') {
      assert.notEqual(mod.default, undefined, 'expected default export');
    } else {
      assert.notEqual(mod[name], undefined, `expected export: ${name}`);
    }
  }
}

/**
 * @param {Record<string, unknown>} mod
 */
export function assertModuleLoads(mod) {
  const names = listExportNames(mod);
  assert.ok(names.length > 0, 'module should export at least one binding');
}

/**
 * Reads a source file and extracts likely export names for documentation-style assertions.
 *
 * @param {string} jsRelativePath Path under `js/`
 * @returns {string[]}
 */
export function detectExportNames(jsRelativePath) {
  const source = readFileSync(join(PROJECT_ROOT, 'js', jsRelativePath), 'utf8');
  const names = new Set();

  const patterns = [
    /export\s+(?:async\s+)?function\s+(\w+)/g,
    /export\s+const\s+(\w+)/g,
    /export\s+class\s+(\w+)/g,
    /export\s+enum\s+(\w+)/g,
    /export\s+type\s+(\w+)/g,
    /export\s*\{\s*([^}]+)\s*\}/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      if (pattern.source.includes('([^}]+)')) {
        match[1].split(',').forEach((part) => {
          const trimmed = part.trim().split(/\s+as\s+/)[0].trim();
          if (trimmed && /^\w+$/.test(trimmed)) names.add(trimmed);
        });
      } else {
        names.add(match[1]);
      }
    }
  }

  if (/export\s+default/.test(source)) names.add('default');
  return [...names].sort();
}
