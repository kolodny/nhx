import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setup, inline } from './_helpers';

describe('local dependency resolution', () => {
  test('--with=pkg@latest always fetches latest from npm', (t) => {
    const { spawn, cwd } = setup(t);

    // Create a fake local semver with old version
    const nodeModules = path.join(cwd, 'node_modules', 'semver');
    fs.mkdirSync(nodeModules, { recursive: true });
    fs.writeFileSync(
      path.join(nodeModules, 'package.json'),
      JSON.stringify({ name: 'semver', version: '5.0.0' }),
    );
    fs.writeFileSync(
      path.join(nodeModules, 'index.js'),
      `module.exports = { version: '5.0.0' };`,
    );

    const result = spawn(
      '--with=semver@latest',
      '-p',
      "require('semver/package.json').version",
    );

    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const version = result.stdout.toString().trim();
    // Should NOT be 5.0.0 (the local fake version), should be actual latest (7.x)
    assert(
      !version.includes('5.0.0'),
      `Expected latest semver, got ${version}`,
    );
    assert(version.startsWith('7.'), `Expected semver 7.x, got ${version}`);
  });

  test('--with=pkg@version fetches specific version from npm', (t) => {
    const { spawn, cwd } = setup(t);

    // Create a fake local semver with old version
    const nodeModules = path.join(cwd, 'node_modules', 'semver');
    fs.mkdirSync(nodeModules, { recursive: true });
    fs.writeFileSync(
      path.join(nodeModules, 'package.json'),
      JSON.stringify({ name: 'semver', version: '5.0.0' }),
    );
    fs.writeFileSync(
      path.join(nodeModules, 'index.js'),
      `module.exports = { version: '5.0.0' };`,
    );

    const result = spawn(
      '--with=semver@7.5.0',
      '-p',
      "require('semver/package.json').version",
    );

    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const version = result.stdout.toString().trim();
    // Should be exactly 7.5.0
    assert.equal(version, '7.5.0', `Expected 7.5.0, got ${version}`);
  });

  test('--with=pkg (no version) falls back to npm if not installed locally', (t) => {
    const { spawn } = setup(t);

    const result = spawn(
      '--with=semver',
      '-p',
      "require('semver/package.json').version",
    );

    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const version = result.stdout.toString().trim();
    // Should fetch from npm (latest 7.x)
    assert(
      version.startsWith('7.'),
      `Expected semver 7.x from npm, got ${version}`,
    );
  });

  test('ESM loader falls back to local node_modules for packages not in inline deps', (t) => {
    const { writeFile, spawn, cwd } = setup(t);

    // Create a local-only package in node_modules (NOT in inline deps)
    const localPkg = path.join(cwd, 'node_modules', 'local-only-pkg');
    fs.mkdirSync(localPkg, { recursive: true });
    fs.writeFileSync(
      path.join(localPkg, 'package.json'),
      JSON.stringify({
        name: 'local-only-pkg',
        version: '1.0.0',
        type: 'module',
      }),
    );
    fs.writeFileSync(
      path.join(localPkg, 'index.js'),
      'export const localValue = "from-local";',
    );

    // Create a script with inline deps (semver from npm) that also imports the local-only package
    // The inline deps trigger the ESM loader; local-only-pkg must resolve via fallback
    writeFile(
      'test.mjs',
      `${inline({ dependencies: { semver: '^7' } })}
import semver from 'semver';
import { localValue } from 'local-only-pkg';
console.log('semver:', semver.valid('1.0.0'), 'local:', localValue);
`,
    );

    const result = spawn('./test.mjs');
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const output = result.stdout.toString();
    assert(
      output.includes('semver: 1.0.0'),
      `Expected semver output, got: ${output}`,
    );
    assert(
      output.includes('local: from-local'),
      `Expected local package output, got: ${output}`,
    );
  });
});
