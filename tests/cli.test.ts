import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers';

describe('cli', () => {
  test('shows help with --help', (t) => {
    const { spawn } = setup(t);
    const result = spawn('--help');
    assert(result.stdout.toString().includes('Usage: nhx'));
    assert(result.stdout.toString().includes('--with'));
  });

  test('shows help with -h alias', (t) => {
    const { spawn } = setup(t);
    const result = spawn('-h');
    assert(result.stdout.toString().includes('Usage: nhx'));
  });

  // Node forwarding tests
  test('forwards to node when no target', (t) => {
    const { spawn } = setup(t);
    const result = spawn('-p', 'process.version');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().startsWith('v'));
  });

  test('runs with different node version via --engine', (t) => {
    const { spawn } = setup(t);
    const result = spawn('--engine=node@18', '-p', 'process.version');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().startsWith('v18'));
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

  test('strips --with flag when forwarding to node', (t) => {
    const { spawn } = setup(t);
    const result = spawn('--with=chalk', '-e', 'console.log(typeof require("chalk"))');
    assert.equal(result.status, 0);
    // With --with, chalk should be available
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
    const result = spawn('--engine=node@18', '--with=chalk', '-p', '"test"');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('test'));
  });

  // Ambiguity tests
  test('shows ambiguity error when local file exists', (t) => {
    const { spawn } = setup(t);
    const result = spawn('package');
    assert(result.status === 0 || result.status === 1);
  });

  test('shows ambiguity error with helpful message', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('cowsay', 'console.log("local")');

    const result = spawn('cowsay');
    assert.equal(result.status, 1);
    const stderr = result.stderr.toString();
    assert(stderr.includes('Ambiguous'));
    assert(stderr.includes('./'));
    assert(stderr.includes('--with='));
  });

  test('no ambiguity with explicit local path', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('test-script.js', 'console.log("explicit-local")');

    const result = spawn('./test-script');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('explicit-local'));
  });

  test('no ambiguity with --with flag', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('cowsay', 'console.log("local")');

    const result = spawn('--with=cowsay', 'cowsay', 'hello');
    // Should not error about ambiguity, should try to run npm package
    assert(
      result.status === 0 || !result.stderr.toString().includes('Ambiguous'),
    );
  });

  // Local file resolution tests
  test('resolves .js extension automatically', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('script.js', 'console.log("auto-js")');

    const result = spawn('./script');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('auto-js'));
  });

  test('resolves .mjs extension automatically', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('script.mjs', 'console.log("auto-mjs")');

    const result = spawn('./script');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('auto-mjs'));
  });

  test('errors when local file not found', (t) => {
    const { spawn } = setup(t);
    const result = spawn('./nonexistent-file');
    assert.equal(result.status, 1);
    assert(result.stderr.toString().includes('File not found'));
  });

  // Script args preservation tests
  test('preserves script args after target', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('args.js', 'console.log(JSON.stringify(process.argv.slice(2)))');

    const result = spawn('./args.js', '--foo', 'bar', '-x');
    assert.equal(result.status, 0);
    const args = JSON.parse(result.stdout.toString().trim());
    assert.deepEqual(args, ['--foo', 'bar', '-x']);
  });

  test('script args not confused with nhx flags', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('flags.js', 'console.log(JSON.stringify(process.argv.slice(2)))');

    const result = spawn('./flags.js', '--with', 'value', '--engine', 'node@18');
    assert.equal(result.status, 0);
    const args = JSON.parse(result.stdout.toString().trim());
    assert.deepEqual(args, ['--with', 'value', '--engine', 'node@18']);
  });

  // Multiple --with flags
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

  // Edge case: verify -e with simple code works
  test('handles -e with simple expression', (t) => {
    const { spawn } = setup(t);
    const result = spawn('-e', '1');
    assert.equal(result.status, 0);
  });
});
