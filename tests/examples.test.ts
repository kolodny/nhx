import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(__dirname, '..', 'examples');

describe('examples', () => {
  test('example files exist', () => {
    const files = readdirSync(examplesDir);
    assert(files.includes('simple-fetch.js'));
    assert(files.includes('typescript-example.ts'));
  });

  test('examples use correct inline format', () => {
    const fetchScript = readFileSync(
      join(examplesDir, 'simple-fetch.js'),
      'utf-8',
    );
    assert(fetchScript.includes('/*/ // <package>'));
    assert(fetchScript.includes('dependencies'));

    const tsScript = readFileSync(
      join(examplesDir, 'typescript-example.ts'),
      'utf-8',
    );
    assert(tsScript.includes('/*/ // <package>'));
  });
});
