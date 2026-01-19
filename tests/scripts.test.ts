import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { inline, setup } from './_helpers';

describe('scripts', () => {
  test('runs script without dependencies', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('simple.js', `console.log('hello world')`);

    const result = spawn('./simple.js');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('hello world'));
  });

  test('runs script with inline dependencies', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile(
      'with-deps.mjs',
      `${inline({ dependencies: { semver: '^7.5.4' } })}
        import semver from 'semver';
        console.log('version: ' + semver.valid('1.2.3'));
      `,
    );

    const result = spawn('./with-deps');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('1.2.3'));
  });

  test('runs script with --with flag', (t) => {
    const { writeFile, spawn } = setup(t);

    writeFile(
      'with-flag.mjs',
      `
        import semver from 'semver';
        console.log('valid: ' + semver.valid('2.0.0'));
      `,
    );

    const result = spawn('--with=semver', './with-flag');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('2.0.0'));
  });

  test('npm install output goes to stderr, not stdout', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('script.js', `console.log('OUTPUT')`);

    const result = spawn(`--with=is-odd@3.0.1`, './script');
    assert.equal(result.status, 0);

    const stdout = result.stdout.toString();
    assert.equal(stdout.trim(), 'OUTPUT', `stdout should only be script output, got: ${stdout}`);
    assert(!stdout.includes('added'), `npm output should not be in stdout`);
  });

  test('__dirname works in .js (CJS)', (t) => {
    const { writeFile, spawn, cwd } = setup(t, { type: 'commonjs' });

    writeFile('main.js', `console.log('dirname:', __dirname);`);

    const result = spawn('./main');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes(cwd));
  });

  test('import.meta.dirname works in .mjs (ESM)', (t) => {
    const { writeFile, spawn, cwd } = setup(t, { type: 'module' });

    writeFile(
      'esm-dirname.js',
      `console.log('dirname:', import.meta.dirname);`,
    );

    const result = spawn('./esm-dirname');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes(cwd));
  });
});
