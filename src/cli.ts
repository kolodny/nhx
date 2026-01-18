#!/usr/bin/env node

import { spawn } from 'child_process';
import { resolve } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';
import minimist from 'minimist';
import { runScript } from './script-runner.js';
import { executePackage } from './executor.js';

const EXTS = ['.js', '.ts', '.mjs', '.mts'];
const OUR_FLAGS = ['--help', '-h', '--run-postinstall', '--with', '--engine'];
const OUR_KEYS = ['_', 'help', 'h', 'run-postinstall', 'with', 'engine'];

const HELP = `
Usage: nhx [options] [target] [args...]

Options:
  --with <dep>       Add dependency (repeatable)
  --engine <spec>    Node version (e.g. "node@18")
  --run-postinstall  Allow postinstall scripts
  -h, --help         Show help

Examples:
  nhx -e 'console.log(1)'           # forward to node
  nhx ./script.js                   # run local file
  nhx cowsay hi                     # run npm package
  nhx --with=typescript tsc         # run tsc from typescript
  nhx --with=tsx --import tsx a.ts  # typescript
`;

const toArray = (x: any) => (x ? (Array.isArray(x) ? x : [x]) : []);
const isLocal = (t: string) =>
  t.startsWith('./') ||
  t.startsWith('/') ||
  t.startsWith('../') ||
  EXTS.some((e) => t.endsWith(e));
const findFile = (t: string) =>
  [t, ...EXTS.map((e) => t + e)].find(existsSync) || null;
const findMatches = (t: string) =>
  [t, ...EXTS.map((e) => t + e)].filter(existsSync);

const engineer = (engines: string[]) => {
  const map: Record<string, string> = {};
  for (const e of engines) {
    const [name, ver] = e.split('@');
    map[name] = ver;
  }
  return map;
};

function stripOurFlags(argv: string[]) {
  const result: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const isOurs = OUR_FLAGS.some((f) => arg === f || arg.startsWith(f + '='));
    if (isOurs) {
      const needsValue =
        !arg.includes('=') && ['--with', '--engine'].includes(arg);
      if (needsValue) i++;
    } else {
      result.push(arg);
    }
  }
  return result;
}

function extractFlags(parsed: minimist.ParsedArgs) {
  const result: string[] = [];
  for (const [k, v] of Object.entries(parsed)) {
    if (OUR_KEYS.includes(k)) continue;
    const flag = k.length === 1 ? `-${k}` : `--${k}`;
    if (v === true) result.push(flag);
    else if (v !== false && v !== undefined) result.push(flag, String(v));
  }
  return result;
}

async function runNode(
  args: string[],
  opts: { with: string[]; engine: string[] },
) {
  const hasOpts = opts.with.length || opts.engine.length;
  if (hasOpts)
    return runScript('__eval__', [], {
      withDeps: opts.with,
      nodeArgs: args,
      engines: opts.engine,
    });
  return new Promise<number>((res, rej) => {
    const child = spawn(process.execPath, args, { stdio: 'inherit' });
    child.on('exit', (c) => res(c || 0));
    child.on('error', rej);
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const parseOpts = {
    boolean: ['help', 'run-postinstall'],
    string: ['with', 'engine'],
    alias: { h: 'help' },
  };

  const startsWithFlag = argv.length === 0 || argv[0].startsWith('-');
  if (startsWithFlag) {
    const parsed = minimist(argv, parseOpts);
    if (parsed.help) return console.log(HELP);
    const noTarget = !parsed._.length;
    if (noTarget)
      process.exit(
        await runNode(stripOurFlags(argv), {
          with: toArray(parsed.with),
          engine: toArray(parsed.engine),
        }),
      );
  }

  const parsed = minimist(argv, { ...parseOpts, stopEarly: true });
  if (parsed.help) return console.log(HELP);

  const [target, ...args] = parsed._;
  const withDeps = toArray(parsed.with);
  const engines = toArray(parsed.engine);
  const opts = {
    with: withDeps,
    engines: engines,
    runPostinstall: parsed['run-postinstall'],
  };

  try {
    const hasWithDeps = withDeps.length > 0;
    const shouldCheckAmbiguity = !isLocal(target) && !hasWithDeps;
    if (shouldCheckAmbiguity) {
      const matches = findMatches(target);
      if (matches.length) {
        console.error(
          chalk.red(`Ambiguous: "${target}" matches: ${matches.join(', ')}`),
        );
        console.error(chalk.yellow('Use ./ for local, --with= for npm'));
        process.exit(1);
      }
    }

    if (isLocal(target)) {
      const file = findFile(target);
      if (!file) throw new Error(`File not found: ${target}`);
      const code = await runScript(resolve(file), args, {
        withDeps: opts.with,
        nodeArgs: extractFlags(parsed),
        engines: opts.engines,
      });
      process.exit(code);
    }

    // If --with is specified, first --with is the package, target is the command
    // Otherwise, target is the package (and also the command)
    const pkg = hasWithDeps ? withDeps[0] : target;
    const cmdArgs = hasWithDeps ? [target, ...args] : args;
    await executePackage(pkg, cmdArgs, { runPostinstall: opts.runPostinstall });
  } catch (e: any) {
    console.error(chalk.red(`Failed: ${e.message}`));
    process.exit(1);
  }
}

main();
