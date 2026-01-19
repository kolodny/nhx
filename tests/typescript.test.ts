import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { name } from '../package.json';
import { inline, setup } from './_helpers';

// Use enum which requires transpilation (not just type stripping)
const code = `
  enum Color { Red = 10, Green = 20, Blue = 30 };
  const c: Color = Color.Green;
  console.log(c);
`;

describe('typescript', () => {
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
