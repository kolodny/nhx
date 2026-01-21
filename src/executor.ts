import { promises as fs, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { getNodeVersionKey } from './inline-deps';
import { npmInstall } from './install';

const CACHE = join(homedir(), '.nhx');

export async function executePackage(
  pkgSpec: string,
  args: string[] = [],
  opts: { runPostinstall?: boolean; binName?: string } = {},
): Promise<number> {
  // Normalize bare package names: "cowsay" -> "cowsay@*"
  // Leave alone: versioned ("pkg@1.0"), scoped ("@scope/pkg"), URLs, git specs, file paths
  const isBare = /^[a-z][\w.-]*$/i.test(pkgSpec);
  const normalized = isBare ? `${pkgSpec}@*` : pkgSpec;

  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 12);
  const dir = join(CACHE, getNodeVersionKey(), hash);
  const modules = join(dir, 'node_modules');

  if (!existsSync(modules)) {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(join(dir, 'package.json'), '{"name":"x","private":true}');
    await fs.writeFile(join(dir, '_meta.json'), JSON.stringify({ pkg: normalized }, null, 2));
    await npmInstall({ cwd: dir, pkg: normalized, postinstall: opts.runPostinstall });
  }

  const bin = await findBin(dir, pkgSpec, opts.binName);
  if (!bin) throw new Error(`No executable found for ${pkgSpec}`);
  return run(bin, args);
}

async function findBin(dir: string, spec: string, binName?: string): Promise<string | null> {
  const nm = join(dir, 'node_modules');

  // Extract package name from spec (handles @scope/pkg@version)
  const match = spec.match(/^(@?[^@]+)/);
  const pkgName = match?.[1] || spec;
  let pkgDir = join(nm, pkgName);

  // If not found, scan node_modules for a package with a bin (handles git/URL specs)
  if (!existsSync(pkgDir)) {
    const entries = await fs.readdir(nm).catch(() => []);
    for (const e of entries) {
      if (e.startsWith('.') || e === '.bin') continue;
      const d = join(nm, e);
      if (!(await fs.stat(d)).isDirectory()) continue;
      const p = JSON.parse(await fs.readFile(join(d, 'package.json'), 'utf-8').catch(() => '{}'));
      if (p.bin) {
        pkgDir = d;
        break;
      }
    }
  }
  if (!existsSync(pkgDir)) return null;

  const p = JSON.parse(
    await fs.readFile(join(pkgDir, 'package.json'), 'utf-8').catch(() => '{}'),
  );
  if (!p.bin) return null;
  if (typeof p.bin === 'string') return join(pkgDir, p.bin);

  // If a specific bin name was requested, use it
  if (binName && p.bin[binName]) return join(pkgDir, p.bin[binName]);

  // Try matching bin name to package name (handles @scope/pkg -> pkg)
  const name = (p.name || pkgName).split('/').pop();
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
