import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './_helpers';

describe('argument handling', () => {
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

    const result = spawn(
      './flags.js',
      '--with',
      'value',
      '--engine',
      'node@18',
    );
    assert.equal(result.status, 0);
    const args = JSON.parse(result.stdout.toString().trim());
    assert.deepEqual(args, ['--with', 'value', '--engine', 'node@18']);
  });

  test('passes --help to target command, not nhx', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile(
      'help-test.js',
      'console.log(JSON.stringify(process.argv.slice(2)))',
    );

    const result = spawn('./help-test.js', '--help');
    assert.equal(result.status, 0);
    const args = JSON.parse(result.stdout.toString().trim());
    assert.deepEqual(args, ['--help']);
  });

  test('passes -h to target command, not nhx', (t) => {
    const { writeFile, spawn } = setup(t);
    writeFile(
      'h-test.js',
      'console.log(JSON.stringify(process.argv.slice(2)))',
    );

    const result = spawn('./h-test.js', '-h');
    assert.equal(result.status, 0);
    const args = JSON.parse(result.stdout.toString().trim());
    assert.deepEqual(args, ['-h']);
  });
});
