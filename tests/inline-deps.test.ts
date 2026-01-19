import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { name } from '../package.json';
import { inline, setup } from './_helpers';

describe('inline dependency parsing', () => {
  test('parses JSON5 format (trailing commas)', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile(
      'json5.mjs',
      `/*/ // <package>
{
  dependencies: {
    "semver": "^7.5.4",
  },
}
/*/ // </package>
import semver from 'semver';
console.log(semver.valid('1.0.0'));
`,
    );

    const result = spawn('./json5.mjs');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('1.0.0'));
  });

  test('parses JSON5 format (unquoted keys)', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile(
      'unquoted.mjs',
      `/*/ // <package>
{ dependencies: { semver: "^7.5.4" } }
/*/ // </package>
import semver from 'semver';
console.log(semver.valid('2.0.0'));
`,
    );

    const result = spawn('./unquoted.mjs');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('2.0.0'));
  });

  test('handles shebang before package block', (t) => {
    const { writeFile, spawn, cwd } = setup(t);

    writeFile(
      'shebang.mjs',
      `#!/usr/bin/env -S npx ${name}
/*/ // <package>
{ dependencies: { semver: "^7.5.4" } }
/*/ // </package>
import semver from 'semver';
console.log(semver.valid('3.0.0'));
`,
    );

    spawnSync('chmod', ['+x', `${cwd}/shebang.mjs`]);
    const result = spawn('./shebang.mjs');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('3.0.0'));
  });

  test('ignores files without package block', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('no-deps.js', 'console.log("no deps needed")');

    const result = spawn('./no-deps.js');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('no deps needed'));
  });

  test('errors on malformed JSON in package block', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile(
      'malformed.mjs',
      `/*/ // <package>
{ this is not valid json at all
/*/ // </package>
console.log('hi');
`,
    );

    const result = spawn('./malformed.mjs');
    assert.notEqual(result.status, 0);
    assert(result.stderr.toString().includes('Failed'));
  });

  test('supports devDependencies', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile(
      'dev-deps.mjs',
      `${inline({ devDependencies: { semver: '^7.5.4' } })}
import semver from 'semver';
console.log('dev:', semver.valid('4.0.0'));
`,
    );

    const result = spawn('./dev-deps.mjs');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('4.0.0'));
  });
});
