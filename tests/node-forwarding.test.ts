import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './_helpers';

describe('node forwarding', () => {
  test('forwards to node when no target', (t) => {
    const { spawn } = setup(t);
    const result = spawn('-p', 'process.version');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().startsWith('v'));
  });

  test('forwards -e to node', (t) => {
    const { spawn } = setup(t);
    const result = spawn('-e', 'console.log("hello")');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('hello'));
  });

  test('forwards --eval to node', (t) => {
    const { spawn } = setup(t);
    const result = spawn('--eval', 'console.log("eval-test")');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('eval-test'));
  });

  test('forwards --check to node', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('valid.js', 'const x = 1;');

    const result = spawn('--check', './valid');
    assert.equal(result.status, 0);
  });

  test('forwards --version to node', (t) => {
    const { spawn } = setup(t);
    const result = spawn('--version');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().startsWith('v'));
  });

  test('handles -e with simple expression', (t) => {
    const { spawn } = setup(t);
    const result = spawn('-e', '1');
    assert.equal(result.status, 0);
  });

  test('strips --with flag when forwarding to node', (t) => {
    const { spawn } = setup(t);
    const result = spawn(
      '--with=chalk',
      '-e',
      'console.log(typeof require("chalk"))',
    );
    assert.equal(result.status, 0);
    assert(
      result.stdout.toString().includes('object') ||
        result.stdout.toString().includes('function'),
    );
  });

  test('passes --import flag through to node', (t) => {
    const { spawn } = setup(t);
    const result = spawn('--import', 'node:path', '-p', 'process.version');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().startsWith('v'));
  });

  test('strips --run-postinstall flag when forwarding to node', (t) => {
    const { spawn } = setup(t);
    const result = spawn('--run-postinstall', '-p', '42');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('42'));
  });

  test('handles multiple nhx flags before node flags', (t) => {
    const { spawn } = setup(t);
    const result = spawn('--engine=node:18', '--with=chalk', '-p', '"test"');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('test'));
  });

  test('handles multiple --with flags', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile(
      'multi.mjs',
      `
      import chalk from 'chalk';
      import _ from 'lodash';
      console.log('both-loaded');
    `,
    );

    const result = spawn('--with=chalk', '--with=lodash', './multi.mjs');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('both-loaded'));
  });
});
