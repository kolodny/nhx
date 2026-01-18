import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setup } from './helpers';

describe('local dependency resolution', () => {
  test('--with=pkg (no version) uses local package if available', (t) => {
    const { spawn, cwd } = setup(t);

    // Create a fake local package
    const nodeModules = path.join(cwd, 'node_modules', 'test-pkg');
    fs.mkdirSync(nodeModules, { recursive: true });
    fs.writeFileSync(
      path.join(nodeModules, 'package.json'),
      JSON.stringify({ name: 'test-pkg', version: '1.0.0' }),
    );
    fs.writeFileSync(
      path.join(nodeModules, 'index.js'),
      `module.exports = { version: '1.0.0' };`,
    );

    const result = spawn('--with=test-pkg', '-p', "require('test-pkg').version");

    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    // Should use local version 1.0.0
    assert(result.stdout.toString().includes('1.0.0'));
  });

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
    assert(!version.includes('5.0.0'), `Expected latest semver, got ${version}`);
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
});
