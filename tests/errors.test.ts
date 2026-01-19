import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './_helpers';

describe('error handling', () => {
  test('errors on non-existent npm package', (t) => {
    const { spawn } = setup(t);
    const result = spawn('this-package-definitely-does-not-exist-12345');
    assert.notEqual(result.status, 0);
    assert(result.stderr.toString().includes('Failed'));
  });

  test('errors on package without bin', (t) => {
    const { spawn } = setup(t);
    // lodash has no bin entry
    const result = spawn('lodash');
    assert.notEqual(result.status, 0);
    assert(result.stderr.toString().includes('No executable'));
  });

  test('errors on invalid --engine spec', (t) => {
    const { spawn } = setup(t);
    // node@999 doesn't exist
    const result = spawn('--engine=node:999', '-p', '1');
    assert.notEqual(result.status, 0);
  });
});
