import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { TestContext } from 'node:test';
import { spawnSync } from 'node:child_process';

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

  const execPath = process.execPath;
  const cli = path.join(dirname, '../dist/cli.js');
  const spawn = (...a: string[]) => spawnSync(execPath, [cli, ...a], { cwd });

  if (pkg) writeJson('package.json', { name: hash, ...pkg });

  return { writeFile, writeJson, spawn, cwd };
};

export const startServer = (t: TestContext, files: Record<string, string>) => {
  return new Promise<string>((resolve) => {
    const server = http.createServer((req, res) => {
      const file = files[req.url || '/'];
      res.end(file ?? 'Not found');
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      t.after(() => server.close());
      resolve(`http://127.0.0.1:${addr.port}`);
    });
  });
};
