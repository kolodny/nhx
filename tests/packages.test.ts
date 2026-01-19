import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './_helpers';

describe('package execution', () => {
  test('executes npm package directly', (t) => {
    const { spawn } = setup(t);
    const result = spawn('cowsay', 'hello');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('hello'));
  });

  test('executes package with --with flag', (t) => {
    const { spawn } = setup(t);
    const result = spawn('--with=cowsay', 'cowsay', 'test');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('test'));
  });

  test('caches bare package name', (t) => {
    const { spawn } = setup(t);
    spawn('cowsay', 'first');
    const result = spawn('cowsay', 'cached');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('cached'));
  });
});

describe('package spec formats', () => {
  test('bare package name (cowsay)', (t) => {
    const { spawn } = setup(t);
    const result = spawn('cowsay', 'bare');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('bare'));
  });

  test('versioned package (cowsay@1.6.0)', (t) => {
    const { spawn } = setup(t);
    const result = spawn('cowsay@1.6.0', 'versioned');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('versioned'));
  });

  test('scoped package (@anthropic-ai/claude-code)', (t) => {
    const { spawn } = setup(t);
    const result = spawn('@anthropic-ai/claude-code', '--version');
    assert(result.status === 0 || result.stderr.toString().includes('install'));
  });

  test('scoped package with version (@anthropic-ai/claude-code@0.2.57)', (t) => {
    const { spawn } = setup(t);
    const result = spawn('@anthropic-ai/claude-code@0.2.57', '--version');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('0.2.57'));
  });

  test('github: shorthand', (t) => {
    const { spawn } = setup(t);
    const result = spawn('github:piuccio/cowsay', 'github-short');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('github-short'));
  });

  test('git+https URL', (t) => {
    const { spawn } = setup(t);
    const result = spawn('git+https://github.com/piuccio/cowsay.git', 'git-https');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('git-https'));
  });

  test('--with=github: shorthand', (t) => {
    const { spawn } = setup(t);
    const result = spawn('--with=github:piuccio/cowsay', 'cowsay', 'git-test');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('git-test'));
  });
});
