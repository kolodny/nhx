import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import {
  parseInlineDependencies,
  createPackageJson,
  getNodeVersionKey,
} from './inline-deps.js';
import { createHash } from 'crypto';
import semver from 'semver';

const CACHE = join(homedir(), '.nhx', 'script-cache');

// Check if a package exists in local node_modules (walking up from cwd)
function findLocalPackage(name: string): string | null {
  let dir = process.cwd();
  while (true) {
    const pkgPath = join(dir, 'node_modules', name);
    if (existsSync(pkgPath)) return pkgPath;
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const LOADER_FALLBACK = `
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const modules = __MODULES__;
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); } catch (e) {
    const isModule = e.code === 'ERR_MODULE_NOT_FOUND' && !/^[./]|^node:/.test(spec);
    if (isModule) try { return await next(spec, { ...ctx, parentURL: pathToFileURL(join(modules, '_')).href }); } catch {}
    throw e;
  }
}`;

// Loader that forces resolution from our installed modules first (for hard deps)
const LOADER_PRIORITY = `
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const modules = __MODULES__;
const hardDeps = __HARD_DEPS__;
export async function resolve(spec, ctx, next) {
  // For hard deps, always resolve from our installed modules first
  const pkgName = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
  if (hardDeps.includes(pkgName) && !/^[./]|^node:/.test(spec)) {
    try { return await next(spec, { ...ctx, parentURL: pathToFileURL(join(modules, '_')).href }); } catch {}
  }
  // Otherwise, try normal resolution, then fall back to our modules
  try { return await next(spec, ctx); } catch (e) {
    const isModule = e.code === 'ERR_MODULE_NOT_FOUND' && !/^[./]|^node:/.test(spec);
    if (isModule) try { return await next(spec, { ...ctx, parentURL: pathToFileURL(join(modules, '_')).href }); } catch {}
    throw e;
  }
}`;

// CJS preload script that patches Module._resolveFilename for hard deps
const CJS_PRELOAD = `
const Module = require('module');
const orig = Module._resolveFilename;
const modules = __MODULES__;
const hardDeps = __HARD_DEPS__;
Module._resolveFilename = function(req, parent, isMain, opts) {
  const name = req.startsWith('@') ? req.split('/').slice(0, 2).join('/') : req.split('/')[0];
  const isHard = hardDeps.includes(name) && !/^[./]|^node:/.test(req);
  if (isHard) {
    try { return orig.call(this, req, parent, isMain, { ...opts, paths: [modules, ...(opts?.paths || [])] }); } catch {}
  }
  return orig.call(this, req, parent, isMain, opts);
};`;

export interface RunScriptOptions {
  withDeps?: string[];
  nodeArgs?: string[];
  engines?: string[];
}

export async function runScript(
  scriptPath: string,
  args: string[] = [],
  opts: RunScriptOptions = {},
): Promise<number> {
  const isEval = scriptPath === '__eval__';
  const deps = isEval
    ? { dependencies: {}, devDependencies: {}, hasInlineDeps: false }
    : await parseInlineDependencies(scriptPath);

  // Track which deps are "soft" (no version, prefer local) vs "hard" (explicit version)
  const softDeps: string[] = [];
  const hardDeps: string[] = [];

  for (const dep of opts.withDeps || []) {
    const at = dep.lastIndexOf('@');
    const hasVersion = at > 0;
    const pkgName = hasVersion ? dep.slice(0, at) : dep;
    const version = hasVersion ? dep.slice(at + 1) : 'latest';
    deps.dependencies[pkgName] = version;
    deps.hasInlineDeps = true;
    if (hasVersion) {
      hardDeps.push(pkgName);
    } else {
      softDeps.push(pkgName);
    }
  }

  // convert --engines="node@18,other@1" to { node: "18", other: "1" }
  const engines = deps.engines ?? {};
  opts.engines?.map((e) => {
    const [name, ver] = e.split('@');
    engines[name] = ver;
  });
  if (!deps.hasInlineDeps)
    return exec(
      isEval ? '' : scriptPath,
      args,
      null,
      opts.nodeArgs || [],
      engines,
    );

  // Check which soft deps can be resolved locally
  const localModules: string[] = [];
  const depsToInstall: Record<string, string> = {};

  for (const [pkgName, version] of Object.entries(deps.dependencies)) {
    const isSoft = softDeps.includes(pkgName);
    const localPath = isSoft ? findLocalPackage(pkgName) : null;
    if (localPath) {
      // Use local package - add its parent node_modules to the path
      const nodeModulesDir = join(localPath, '..');
      if (!localModules.includes(nodeModulesDir))
        localModules.push(nodeModulesDir);
    } else {
      depsToInstall[pkgName] = version;
    }
  }

  // If all deps resolved locally, no need to install anything
  const needsInstall = Object.keys(depsToInstall).length > 0;
  let installedModules: string | null = null;

  if (needsInstall) {
    const depsKey = JSON.stringify({
      d: depsToInstall,
      v: deps.devDependencies,
    });
    const hash = createHash('sha256')
      .update(depsKey)
      .digest('hex')
      .slice(0, 12);
    const dir = join(CACHE, getNodeVersionKey(), hash);
    const cached = await fs.access(join(dir, 'node_modules')).then(
      () => true,
      () => false,
    );

    if (!cached) {
      await fs.mkdir(dir, { recursive: true });
      const installDeps = { ...deps, dependencies: depsToInstall };
      const pkg = createPackageJson(installDeps, basename(scriptPath));
      await fs.writeFile(
        join(dir, 'package.json'),
        JSON.stringify(pkg, null, 2),
      );
      await install(dir);
    }

    installedModules = join(dir, 'node_modules');
  }

  // Build NODE_PATH: installed modules first, then local modules
  const modulePaths = [installedModules, ...localModules].filter(
    Boolean,
  ) as string[];

  // If we have installed modules, use the loader
  if (installedModules) {
    const cacheDir = join(installedModules, '..');
    const hasHardDeps = hardDeps.length > 0;

    // ESM loader for import() resolution
    const loader = join(cacheDir, '_loader.mjs');
    const loaderCode = hasHardDeps
      ? LOADER_PRIORITY.replace(
          '__MODULES__',
          JSON.stringify(installedModules),
        ).replace('__HARD_DEPS__', JSON.stringify(hardDeps))
      : LOADER_FALLBACK.replace(
          '__MODULES__',
          JSON.stringify(installedModules),
        );
    await fs.writeFile(loader, loaderCode);

    const loaderArgs = ['--experimental-loader', loader];
    const constArgs = ['--no-warnings'];
    let allArgs = [...loaderArgs, ...constArgs];

    // For eval mode with hard deps, also use CJS preload to patch require()
    if (isEval && hasHardDeps) {
      const preload = join(cacheDir, '_preload.cjs');
      const preloadCode = CJS_PRELOAD.replace(
        '__MODULES__',
        JSON.stringify(installedModules),
      ).replace('__HARD_DEPS__', JSON.stringify(hardDeps));
      await fs.writeFile(preload, preloadCode);
      allArgs = ['-r', preload, ...allArgs];
    }

    allArgs = [...allArgs, ...(opts.nodeArgs || [])];
    const script = isEval ? '' : scriptPath;
    return exec(script, args, modulePaths.join(':'), allArgs, engines);
  }

  // Only local modules, no loader needed
  const script = isEval ? '' : scriptPath;
  return exec(
    script,
    args,
    modulePaths.join(':'),
    opts.nodeArgs || [],
    engines,
  );
}

async function install(cwd: string) {
  const pkg = JSON.parse(await fs.readFile(join(cwd, 'package.json'), 'utf-8'));
  const count = Object.keys(pkg.dependencies || {}).length;
  if (!count) return;

  return new Promise<void>((r, j) => {
    const args = ['install', '--prefer-offline', '--ignore-scripts'];
    const stdio = ['inherit' as const, 2, 2];
    const child = spawn('npm', args, { cwd, stdio });
    child.on('close', (c) => (!c ? r() : j(new Error('npm install failed'))));
    child.on('error', j);
  });
}

// Resolve engine spec to a version to use, or null to use current Node
function resolveNodeVersion(spec: string | undefined): string | null {
  if (!spec) return null;

  const currentVersion = process.version;

  // Check if it's a simple major version like "18" or "20"
  if (/^\d+$/.test(spec)) {
    // If current node matches this major version, use current
    if (semver.satisfies(currentVersion, `^${spec}`)) return null;
    return spec;
  }

  // It's a semver range like ">=12 <15" or "^18.0.0"
  const range = semver.validRange(spec);
  if (!range) {
    // Not a valid range, treat as literal version
    return spec;
  }

  // If current Node satisfies the range, use it
  if (semver.satisfies(currentVersion, range)) return null;

  // Use minVersion to find the minimum satisfying version, then use its major
  const minVer = semver.minVersion(range);
  if (minVer) return semver.major(minVer).toString();

  // Last resort: return the spec as-is and let npx handle it
  return spec;
}

async function exec(
  script: string,
  args: string[],
  modules: string | null,
  nodeArgs: string[],
  engines?: Record<string, string>,
): Promise<number> {
  const scriptArgs = script ? [script, ...args] : args;
  const finalArgs = [...nodeArgs, ...scriptArgs];

  const env = { ...process.env };

  if (modules) {
    env.NODE_PATH = env.NODE_PATH ? `${modules}:${env.NODE_PATH}` : modules;
  }

  const ver = resolveNodeVersion(engines?.node);
  return new Promise((res, rej) => {
    const child = ver
      ? spawn('npx', [`node@${ver}`, ...finalArgs], { stdio: 'inherit', env })
      : spawn(process.execPath, finalArgs, { stdio: 'inherit', env });
    child.on('exit', (c) => res(c || 0));
    child.on('error', rej);
  });
}
