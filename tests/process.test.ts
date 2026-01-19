import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { setup } from './_helpers';

describe('process', () => {
  test('process.argv[1] is the script path', (t) => {
    const { writeFile, spawn, cwd } = setup(t);
    writeFile('argv.js', 'console.log(process.argv[1])');

    const result = spawn('./argv.js');
    assert.equal(result.status, 0);
    const output = result.stdout.toString().trim();
    assert(output.endsWith('argv.js'), `Expected script path, got: ${output}`);
  });

  test('process.cwd() is preserved', (t) => {
    const { writeFile, spawn, cwd } = setup(t);
    writeFile('cwd.js', 'console.log(process.cwd())');

    const result = spawn('./cwd.js');
    assert.equal(result.status, 0);
    // Should be the test cwd, not some temp directory
    assert(result.stdout.toString().includes(cwd));
  });

  test('environment variables are preserved', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('env.js', 'console.log(process.env.PATH ? "has-path" : "no-path")');

    const result = spawn('./env.js');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('has-path'));
  });

  test('script receives arguments', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile('args.js', 'console.log(process.argv.slice(2).join(","))');

    const result = spawn('./args.js', 'one', 'two', 'three');
    assert.equal(result.status, 0);
    assert(result.stdout.toString().includes('one,two,three'));
  });
});
