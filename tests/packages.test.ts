import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers';

describe('packages', () => {
  test('executes npm package directly', (t) => {
    const { spawn } = setup(t);
    const result = spawn('cowsay', 'hello');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('hello'));
  });

  test('executes package with --with flag (command from package)', (t) => {
    const { spawn } = setup(t);
    const result = spawn('--with=cowsay', 'cowsay', 'test');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('test'));
  });

  test('executes package from git URL', (t) => {
    const { spawn } = setup(t);
    const result = spawn('--with=github:piuccio/cowsay', 'cowsay', 'git-test');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('git-test'));
  });
});
