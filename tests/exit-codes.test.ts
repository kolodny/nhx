import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './_helpers';

describe('exit codes', () => {
  test('preserves zero exit code', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('exit-zero.js', 'process.exit(0)');

    const result = spawn('./exit-zero.js');
    assert.equal(result.status, 0);
  });

  test('preserves non-zero exit code', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('exit-one.js', 'process.exit(1)');

    const result = spawn('./exit-one.js');
    assert.equal(result.status, 1);
  });

  test('preserves arbitrary exit code', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('exit-42.js', 'process.exit(42)');

    const result = spawn('./exit-42.js');
    assert.equal(result.status, 42);
  });

  test('exit code from syntax error is non-zero', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('syntax-error.js', 'const x = {');

    const result = spawn('./syntax-error.js');
    assert.notEqual(result.status, 0);
  });

  test('exit code from thrown error is non-zero', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('throw.js', 'throw new Error("test")');

    const result = spawn('./throw.js');
    assert.notEqual(result.status, 0);
  });
});
