import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn as spawnAsync } from 'node:child_process';

describe('stdin', () => {
  test('runs script from stdin via dash', { timeout: 15000 }, async () => {
    const result = await new Promise<{
      stdout: string;
      stderr: string;
      code: number | null;
    }>((resolve) => {
      const child = spawnAsync('npx', ['nhx', '-']);
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (d) => (stdout += d));
      child.stderr?.on('data', (d) => (stderr += d));
      child.stdin?.write('console.log("stdin-works")\n');
      child.stdin?.end();
      child.on('close', (code) => resolve({ stdout, stderr, code }));
    });

    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
    assert(result.stdout.includes('stdin-works'));
  });
});
