import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { TestContext } from 'node:test';
import { spawnSync } from 'node:child_process';
import { name } from '../package.json';

type Pkg = Partial<{
  name: string;
  type: 'module' | 'commonjs';
  engines: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}>;

const pre = `/*/ // <package>\n`;
const post = `\n/*/ // </package>\n\n`;
export const inline = (pkg: Pkg) => `${pre}${JSON.stringify(pkg)}${post}`;

export const setup = (t: TestContext, pkg?: Pkg) => {
  const hash = createHash('sha1').update(t.name).digest('hex').slice(0, 8);
  const dirname = import.meta?.dirname ?? __dirname;
  const cwd = path.join(dirname, `_test_${hash}`);
  fs.mkdirSync(cwd, { recursive: true });
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));

  const writeFile = (file: string, content: string) => {
    fs.writeFileSync(path.join(cwd, file), content);
  };
  const writeJson = (file: string, json: Record<string, unknown>) => {
    writeFile(file, JSON.stringify(json, null, 2));
  };

  const spawn = (...a: string[]) => spawnSync('npx', [name, ...a], { cwd });

  if (pkg) writeJson('package.json', { name: hash, ...pkg });

  return { writeFile, writeJson, spawn, cwd };
};
