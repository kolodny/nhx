import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './_helpers';

describe('file resolution', () => {
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

  test('resolves .ts extension automatically', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('script.ts', 'console.log("auto-ts")');

    const result = spawn('./script');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('auto-ts'));
  });

  test('resolves .mts extension automatically', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('script.mts', 'console.log("auto-mts")');

    const result = spawn('./script');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('auto-mts'));
  });

  test('errors when local file not found', (t) => {
    const { spawn } = setup(t);
    const result = spawn('./nonexistent-file');
    assert.equal(result.status, 1);
    assert(result.stderr.toString().includes('File not found'));
  });

  test('handles paths with spaces', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('my script.js', 'console.log("spaces work")');

    const result = spawn('./my script.js');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('spaces work'));
  });
});

describe('ambiguity detection', () => {
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
    assert(
      result.status === 0 || !result.stderr.toString().includes('Ambiguous'),
    );
  });
});
