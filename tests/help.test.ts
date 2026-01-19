import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './_helpers';

describe('help', () => {
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
});
