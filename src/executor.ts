import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';
import { getNodeVersionKey } from './inline-deps.js';

const CACHE = join(homedir(), '.nhx', 'store');

export async function executePackage(
  pkgSpec: string,
  args: string[] = [],
  opts: { runPostinstall?: boolean } = {},
): Promise<number> {
  const key = `pkg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const dir = join(CACHE, getNodeVersionKey(), key);
  await fs.mkdir(dir, { recursive: true });

  try {
    const pkgJson = JSON.stringify({
      name: 'nhx-exec',
      version: '1.0.0',
      private: true,
    });
    await fs.writeFile(join(dir, 'package.json'), pkgJson);
    await install(dir, pkgSpec, opts.runPostinstall || false);

    const bin = await findBin(dir, pkgSpec);
    if (!bin) throw new Error(`No executable found for ${pkgSpec}`);

    const code = await run(bin, args);
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    return code;
  } catch (e) {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    throw e;
  }
}

function install(cwd: string, pkg: string, postinstall: boolean) {
  const args = ['install', pkg, '--no-save', '--prefer-offline'];
  if (!postinstall) args.push('--ignore-scripts');

  return new Promise<void>((res, rej) => {
    const child = spawn('npm', args, { cwd, stdio: 'ignore' });
    child.on('close', (c) =>
      c === 0 ? res() : rej(new Error(`npm install failed for ${pkg}`)),
    );
    child.on('error', rej);
  });
}

async function findBin(dir: string, spec: string): Promise<string | null> {
  const nm = join(dir, 'node_modules');
  const isGit = /^(git\+|github:|gitlab:)/.test(spec);

  let pkgDir = '';
  let pkgName = '';

  if (isGit) {
    const entries = await fs.readdir(nm).catch(() => []);
    for (const e of entries) {
      const skip = e.startsWith('.') || e === '.bin';
      if (skip) continue;

      const d = join(nm, e);
      const isDir = (await fs.stat(d)).isDirectory();
      if (!isDir) continue;

      const p = JSON.parse(
        await fs.readFile(join(d, 'package.json'), 'utf-8').catch(() => '{}'),
      );
      if (p.bin) {
        pkgDir = d;
        pkgName = e;
        break;
      }
    }
    if (!pkgDir!) return null;
  } else {
    pkgName = spec.split('@').find((p) => p && !/^\d/.test(p)) || spec;
    pkgDir = join(nm, pkgName);
  }

  const p = JSON.parse(
    await fs.readFile(join(pkgDir, 'package.json'), 'utf-8').catch(() => '{}'),
  );
  if (!p.bin) return null;
  if (typeof p.bin === 'string') return join(pkgDir, p.bin);

  const name = pkgName.split('/').pop();
  if (name && p.bin[name]) return join(pkgDir, p.bin[name]);

  const first = Object.values(p.bin)[0];
  return typeof first === 'string' ? join(pkgDir, first) : null;
}

function run(bin: string, args: string[]) {
  return new Promise<number>((res, rej) => {
    const child = spawn(process.execPath, [bin, ...args], { stdio: 'inherit' });
    child.on('exit', (c) => res(c || 0));
    child.on('error', rej);
  });
}
