import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { inline, setup } from './_helpers';

describe('imports', () => {
  test('relative import works in ESM', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('helper.mjs', 'export const msg = "from helper";');
    writeFile(
      'main.mjs',
      'import { msg } from "./helper.mjs"; console.log(msg);',
    );

    const result = spawn('./main.mjs');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('from helper'));
  });

  test('relative require works in CJS', (t) => {
    const { writeFile, spawn } = setup(t, { type: 'commonjs' });
    writeFile('helper.js', 'module.exports = { msg: "from cjs helper" };');
    writeFile(
      'main.js',
      'const { msg } = require("./helper"); console.log(msg);',
    );

    const result = spawn('./main.js');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('from cjs helper'));
  });

  test('relative import works with inline deps', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('util.mjs', 'export const add = (a, b) => a + b;');
    writeFile(
      'with-deps.mjs',
      `${inline({ dependencies: { semver: '^7.5.4' } })}
        import { add } from './util.mjs';
        import semver from 'semver';
        console.log('sum: ' + add(1, 2) + ' semver: ' + semver.valid('1.0.0'));
      `,
    );

    const result = spawn('./with-deps.mjs');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('sum: 3'));
    assert(result.stdout.toString().includes('semver: 1.0.0'));
  });

  test('node: protocol imports work', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile(
      'node-proto.mjs',
      `
        import { join } from 'node:path';
        console.log(join('a', 'b'));
      `,
    );

    const result = spawn('./node-proto.mjs');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('a'));
  });
});
