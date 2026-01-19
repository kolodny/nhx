import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { inline, setup } from './_helpers';

describe('engine specification', () => {
  test('runs with different node version via --engine', (t) => {
    const { spawn } = setup(t);
    const result = spawn('--engine=node:18', '-p', 'process.version');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().startsWith('v18'));
  });

  test('runs script with --engine flag', (t) => {
    const { writeFile, spawn } = setup(t);

    writeFile('engine.js', `console.log(process.version)`);

    const result = spawn('--engine=node:18', './engine');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().startsWith('v18'));
  });

  test('runs script with inline engine spec', (t) => {
    const { writeFile, spawn } = setup(t);

    writeFile(
      'inline-engine.js',
      `${inline({ engines: { node: '18' } })}console.log(process.version);`,
    );

    const result = spawn('./inline-engine.js');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().startsWith('v18'));
  });

  test('uses current node when semver range is satisfied', (t) => {
    const { writeFile, spawn } = setup(t);

    writeFile(
      'semver-satisfied.js',
      `${inline({ engines: { node: '>=14' } })}console.log(process.version);`,
    );

    const result = spawn('./semver-satisfied.js');
    assert.equal(result.status, 0);
    const output = result.stdout.toString().trim();
    assert(output.startsWith('v'), `Expected version string, got: ${output}`);
    assert(!output.startsWith('v14.'), `Should use current node, not download v14`);
  });

  test('downloads different node when semver range not satisfied', (t) => {
    const { writeFile, spawn } = setup(t);

    writeFile(
      'semver-download.js',
      `${inline({ engines: { node: '>=18 <19' } })}console.log(process.version);`,
    );

    const result = spawn('./semver-download.js');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().startsWith('v18'));
  });

  test('handles caret semver range', (t) => {
    const { writeFile, spawn } = setup(t);

    writeFile(
      'caret-range.js',
      `${inline({ engines: { node: '^18.0.0' } })}console.log(process.version);`,
    );

    const result = spawn('./caret-range.js');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().startsWith('v18'));
  });

  test('caches dependencies per target node version', (t) => {
    const { writeFile, spawn } = setup(t);

    // Same script with deps, run with different engine versions
    // Should use separate cache dirs to avoid compatibility issues
    writeFile(
      'cache-test.mjs',
      `${inline({ dependencies: { semver: '^7.5.4' } })}
        import semver from 'semver';
        console.log('v' + process.versions.node.split('.')[0] + ' ' + semver.valid('1.0.0'));
      `,
    );

    // Run with node 18
    const r1 = spawn('--engine=node:18', './cache-test.mjs');
    assert.equal(r1.status, 0);
    assert(r1.stdout.toString().includes('v18'));

    // Run with node 20 - should use different cache
    const r2 = spawn('--engine=node:20', './cache-test.mjs');
    assert.equal(r2.status, 0);
    assert(r2.stdout.toString().includes('v20'));
  });
});
