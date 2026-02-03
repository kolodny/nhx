import { promises as fs, existsSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import semver from 'semver';
import {
  parseInlineDependencies,
  createPackageJson,
  getNodeVersionKey,
} from './inline-deps';
import { npmInstall } from './install';

const CACHE = join(homedir(), '.nhx');

// ESM loader - resolves from cache before local node_modules
const ESM_LOADER = (modules: string) => `
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const modules = ${JSON.stringify(modules)};
export async function resolve(spec, ctx, next) {
  if (/^[./#]|^node:/.test(spec)) return next(spec, ctx);
  const orig = ctx.parentURL;
  try { return await next(spec, { ...ctx, parentURL: pathToFileURL(join(modules, '_')).href }); }
  catch { return next(spec, { ...ctx, parentURL: orig }); }
}`;

// CJS loader - patches require to check cache first
const CJS_LOADER = (modules: string) => `
const Module = require('module');
const path = require('path');
const fs = require('fs');
const modules = ${JSON.stringify(modules)};
const orig = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  if (!/^[./#]/.test(request) && !request.startsWith('node:')) {
    const cached = path.join(modules, request);
    try {
      if (fs.existsSync(cached)) return orig.call(this, request, { ...parent, paths: [modules] }, isMain, options);
    } catch {}
  }
  return orig.call(this, request, parent, isMain, options);
};`;

export interface RunScriptOptions {
  withDeps?: string[];
  nodeArgs?: string[];
  engines?: string[];
}

export async function runScript(
  script: string | null,
  args: string[] = [],
  opts: RunScriptOptions = {},
): Promise<number> {
  const deps = script
    ? await parseInlineDependencies(script)
    : { dependencies: {}, devDependencies: {}, hasInlineDeps: false };

  for (const dep of opts.withDeps || []) {
    const at = dep.lastIndexOf('@');
    const hasVer = at > 0;
    const name = hasVer ? dep.slice(0, at) : dep;
    let ver = hasVer ? dep.slice(at + 1) : '*';
    // Resolve @latest to actual version for deterministic cache key
    if (ver === 'latest') {
      const resolved = await getLatestVersion(name);
      if (resolved) ver = resolved;
    }
    deps.dependencies[name] = ver;
    deps.hasInlineDeps = true;
  }

  const engines = deps.engines ?? {};
  opts.engines?.forEach((e) => {
    const [name, ver] = e.split(':');
    if (name && ver) engines[name] = ver;
  });

  const nodeArgs = opts.nodeArgs || [];
  if (!deps.hasInlineDeps) return exec(script, args, null, nodeArgs, engines);

  const targetNode = getTargetNodeMajor(engines?.node);

  // Install deps to cache
  const hashInput = { d: deps.dependencies, v: deps.devDependencies };
  const json = JSON.stringify(hashInput);
  const hash = createHash('sha256').update(json).digest('hex').slice(0, 12);
  const dir = join(CACHE, getNodeVersionKey(targetNode), hash);
  const modules = join(dir, 'node_modules');

  if (!existsSync(modules)) {
    await fs.mkdir(dir, { recursive: true });
    const pkg = createPackageJson(deps, script ? basename(script) : 'eval');
    await fs.writeFile(join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
    const meta = JSON.stringify(hashInput, null, 2);
    await fs.writeFile(join(dir, '_meta.json'), meta);
    await npmInstall({ cwd: dir });
  }

  const esmLoader = join(dir, '_loader.mjs');
  const cjsLoader = join(dir, '_loader.cjs');
  await fs.writeFile(esmLoader, ESM_LOADER(modules));
  await fs.writeFile(cjsLoader, CJS_LOADER(modules));

  const loaderArgs = [
    '--experimental-loader',
    esmLoader,
    '--require',
    cjsLoader,
    '--no-warnings',
  ];
  return exec(script, args, modules, [...loaderArgs, ...nodeArgs], engines);
}

// Get latest version of a package from npm registry
async function getLatestVersion(pkg: string): Promise<string | null> {
  return new Promise((res) => {
    const child = spawn('npm', ['view', pkg, 'version'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('close', (c) => res(c === 0 ? out.trim() : null));
    child.on('error', () => res(null));
  });
}

function resolveNodeVersion(spec?: string): string | null {
  if (!spec) return null;
  const cur = process.version;
  if (/^\d+$/.test(spec))
    return semver.satisfies(cur, `^${spec}`) ? null : spec;
  const range = semver.validRange(spec);
  if (!range) return spec;
  if (semver.satisfies(cur, range)) return null;
  const min = semver.minVersion(range);
  return min ? semver.major(min).toString() : spec;
}

// Get target node major version for cache key
// Returns the major version string (e.g., "18") or undefined to use current
function getTargetNodeMajor(spec?: string): string | undefined {
  if (!spec) return undefined;
  // Simple major version: "18" -> "18"
  if (/^\d+$/.test(spec)) return spec;
  // Semver range: ">=18" -> extract min version's major
  const range = semver.validRange(spec);
  if (range) {
    const min = semver.minVersion(range);
    if (min) return semver.major(min).toString();
  }
  // Fallback: try to extract leading digits
  const match = spec.match(/^(\d+)/);
  return match ? match[1] : undefined;
}

async function exec(
  script: string | null,
  args: string[],
  modules: string | null,
  nodeArgs: string[],
  engines?: Record<string, string>,
): Promise<number> {
  const finalArgs = [...nodeArgs, ...(script ? [script, ...args] : args)];
  const env = { ...process.env };
  if (modules) {
    env.NODE_PATH = modules + (env.NODE_PATH ? `:${env.NODE_PATH}` : '');
  }

  const ver = resolveNodeVersion(engines?.node);
  const cmd = ver
    ? ['npx', ['-y', `node@${ver}`, ...finalArgs]]
    : [process.execPath, finalArgs];

  return new Promise((res, rej) => {
    const opts = { stdio: 'inherit' as const, env };
    const child = spawn(cmd[0] as string, cmd[1] as string[], opts);
    child.on('exit', (c) => res(c || 0));
    child.on('error', rej);
  });
}
