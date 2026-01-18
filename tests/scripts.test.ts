import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { name } from '../package.json';
import { inline, setup } from './helpers';

describe('scripts', () => {
  test('runs script without dependencies', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('simple.js', `console.log('hello world')`);

    const result = spawn('simple.js');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('hello world'));
  });

  test('runs script with inline dependencies', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile(
      'with-deps.mjs',
      `${inline({ dependencies: { semver: '^7.5.4' } })}
        import semver from 'semver';
        console.log('version:', semver.valid('1.2.3'));
      `,
    );

    const result = spawn('./with-deps');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('1.2.3'));
  });

  test('runs script with --with flag', (t) => {
    const { writeFile, spawn } = setup(t);

    writeFile(
      `with-flag.mjs`,
      `import semver from 'semver';\nconsole.log('valid:', semver.valid('2.0.0'));`,
    );

    const result = spawn('--with=semver', './with-flag');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('2.0.0'));
  });

  test('npm install output goes to stderr, not stdout', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('script.js', `console.log('OUTPUT')`);

    // Use a unique package version to avoid cache hits
    const result = spawn(`--with=is-odd@3.0.1`, './script');
    assert.equal(result.status, 0);

    const stdout = result.stdout.toString();

    // stdout should only contain our script output
    assert.equal(stdout.trim(), 'OUTPUT', `stdout should only be script output, got: ${stdout}`);
    // npm install output (if any) should be in stderr, not stdout
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

  test('runs script with --engine flag', (t) => {
    const { writeFile, spawn } = setup(t);

    writeFile('engine.js', `console.log(process.version)`);

    const result = spawn('--engine=node@18', './engine');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().startsWith('v18'));
  });

  test('runs script with inline engine spec', (t) => {
    const { writeFile, spawn } = setup(t);

    writeFile(
      'inline-engine.js',
      `${inline({ engines: { node: '18' } })}console.log(process.version);`,
    );

    const result = spawn('inline-engine.js');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().startsWith('v18'));
  });

  test('uses current node when semver range is satisfied', (t) => {
    const { writeFile, spawn } = setup(t);

    // Use a very wide range that will definitely include the current node
    writeFile(
      'semver-satisfied.js',
      `${inline({ engines: { node: '>=14' } })}console.log(process.version);`,
    );

    const result = spawn('semver-satisfied.js');
    assert.equal(result.status, 0);
    // Should use current node since range is satisfied (not download a different version)
    // The output should match the current node version
    const output = result.stdout.toString().trim();
    assert(output.startsWith('v'), `Expected version string, got: ${output}`);
    // Verify it didn't download node@14 specifically - it should use current node
    assert(!output.startsWith('v14.'), `Should use current node, not download v14`);
  });

  test('downloads different node when semver range not satisfied', (t) => {
    const { writeFile, spawn } = setup(t);

    writeFile(
      'semver-download.js',
      `${inline({ engines: { node: '>=18 <19' } })}console.log(process.version);`,
    );

    const result = spawn('semver-download.js');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().startsWith('v18'));
  });

  test('handles caret semver range', (t) => {
    const { writeFile, spawn } = setup(t);

    writeFile(
      'caret-range.js',
      `${inline({ engines: { node: '^18.0.0' } })}console.log(process.version);`,
    );

    const result = spawn('caret-range.js');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().startsWith('v18'));
  });

  test.describe(() => {
    // Use enum which requires transpilation (not just type stripping)
    const code = `
      enum Color { Red = 10, Green = 20, Blue = 30 };
      const c: Color = Color.Green;
      console.log(c);
    `;
    test('TypeScript with enums fails without tsx', (t) => {
      const { writeFile, spawn } = setup(t);

      writeFile('typescript.ts', code);

      const result = spawn('./typescript');
      assert.notEqual(result.status, 0);
    });

    test('TypeScript with enums works with --with=tsx --import tsx', (t) => {
      const { writeFile, spawn } = setup(t);

      writeFile('typescript.ts', code);

      const result = spawn('--with=tsx', '--import=tsx', './typescript');
      assert.equal(result.status, 0);
      assert(result.stdout.toString().includes('20'));
    });

    test('TypeScript works with inline tsx dependency', (t) => {
      const { writeFile, spawn } = setup(t);
      writeFile(
        'typescript.ts',
        `${inline({ dependencies: { tsx: '^4.7.0' } })}${code}`,
      );

      const result = spawn('--import', 'tsx', './typescript');
      assert.equal(result.status, 0);
      assert(result.stdout.toString().includes('20'));
    });

    test('shebang style: --with=tsx --import tsx', (t) => {
      const { writeFile, cwd } = setup(t);

      writeFile(
        'shebang1.ts',
        `#!/usr/bin/env -S npx ${name} --with=tsx --import tsx\n${code}`,
      );
      const script = `${cwd}/shebang1.ts`;
      spawnSync('chmod', ['+x', script]);

      const result = spawnSync(script);
      assert.equal(result.status, 0);
      assert(result.stdout.toString().includes('20'));
    });

    test('shebang style: --import tsx with inline deps', (t) => {
      const { writeFile, cwd } = setup(t);

      writeFile(
        'shebang2.ts',
        `#!/usr/bin/env -S npx ${name} --import tsx
          ${inline({ dependencies: { tsx: '^4.7.0' } })}
          ${code}
        `,
      );
      const script = `${cwd}/shebang2.ts`;
      spawnSync('chmod', ['+x', script]);

      const result = spawnSync(script);

      assert.equal(result.status, 0);
      assert(result.stdout.toString().includes('20'));
    });
  });
});
