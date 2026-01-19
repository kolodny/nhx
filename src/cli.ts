#!/usr/bin/env node

import { resolve, join } from 'path';
import { existsSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import chalk from 'chalk';
import { runScript } from './script-runner.js';
import { executePackage } from './executor.js';

const EXT = ['.js', '.cjs', '.ts', '.mjs', '.mts'];

const HELP = `
Usage: nhx [options] [target] [args...]

Options:
  --with <dep>       Add dependency (repeatable)
  --engine <spec>    Node version (e.g. "node:18", "node:>=18 <20")
  --run-postinstall  Allow postinstall scripts
  -h, --help         Show help

Examples:
  nhx -e 'console.log(1)'           # forward to node
  nhx ./script.js                   # run local file
  nhx cowsay hi                     # run npm package
  nhx --with=typescript tsc         # run tsc from typescript
  nhx --with=tsx --import tsx a.ts  # typescript
  curl ... | nhx -                  # run from stdin
`;

const isLocal = (t: string) => /^\.{0,2}\//.test(t);

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk);

  const content = Buffer.concat(chunks).toString('utf8');
  const dir = mkdtempSync(join(tmpdir(), 'nhx-'));
  const file = join(dir, 'script.mts');
  writeFileSync(file, content);
  return file;
}

const findFile = (t: string) => [t, ...EXT.map((e) => t + e)].find(existsSync);
const matches = (t: string) => [t, ...EXT.map((e) => t + e)].filter(existsSync);

// Parse nhx-specific flags from argv (can be interleaved with node flags)
// All nhx flags must appear before the target - after target, everything is passed through
function parseNhxArgs(argv: string[]) {
  const withDeps: string[] = [];
  const engines: string[] = [];
  let help = false;
  let runPostinstall = false;
  const rest: string[] = [];
  let foundTarget = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    // Check if this looks like a target (not a flag)
    if (!arg.startsWith('-')) foundTarget = true;

    if (foundTarget) rest.push(arg);
    else if (arg === '-h' || arg === '--help') help = true;
    else if (arg === '--run-postinstall') runPostinstall = true;
    else if (arg === '--with' && i + 1 < argv.length) withDeps.push(argv[++i]);
    else if (arg.startsWith('--with=')) withDeps.push(arg.slice(7));
    else if (arg === '--engine' && i + 1 < argv.length) engines.push(argv[++i]);
    else if (arg.startsWith('--engine=')) engines.push(arg.slice(9));
    else rest.push(arg);
  }
  return { withDeps, engines, help, runPostinstall, rest };
}

// Split rest into nodeArgs, target, and scriptArgs
function splitArgs(rest: string[]): {
  nodeArgs: string[];
  target: string | undefined;
  args: string[];
} {
  const nodeArgs: string[] = [];
  let i = 0;
  // Collect node flags until we hit something that looks like a target
  while (i < rest.length) {
    const arg = rest[i];
    if (!arg.startsWith('-')) break; // found target
    nodeArgs.push(arg);
    i++;
    // If this flag takes a value, include it
    if (i < rest.length && !rest[i].startsWith('-')) {
      nodeArgs.push(rest[i]);
      i++;
    }
  }
  const target = rest[i];
  const args = rest.slice(i + 1);
  return { nodeArgs, target, args };
}

async function main() {
  const argv = process.argv.slice(2);
  const { withDeps, engines, help, runPostinstall, rest } = parseNhxArgs(argv);
  const { nodeArgs, target, args } = splitArgs(rest);

  // No target = forward to node (handles -e, -p, --version, etc.)
  if (!target) {
    if (help) return console.log(HELP);
    process.exit(await runScript(null, args, { withDeps, nodeArgs, engines }));
  }

  try {
    // Check for ambiguity (bare name that matches local file)
    if (!isLocal(target) && !withDeps.length) {
      const matched = matches(target);
      if (matched.length) {
        console.error(
          chalk.red(`Ambiguous: "${target}" matches: ${matched.join(', ')}`),
        );
        console.error(chalk.yellow('Use ./ for local, --with= for npm'));
        process.exit(1);
      }
    }

    const opts = { withDeps, nodeArgs, engines };
    // Stdin
    if (target === '-') {
      const file = await readStdin();
      process.exit(await runScript(file, args, opts));
    }

    // Local file
    if (isLocal(target)) {
      const file = findFile(target);
      if (!file) throw new Error(`File not found: ${target}`);
      process.exit(await runScript(resolve(file), args, opts));
    }

    // NPM package
    const pkg = withDeps.length ? withDeps[0] : target;
    const binName = withDeps.length ? target : undefined;
    await executePackage(pkg, args, { runPostinstall, binName });
  } catch (e: any) {
    console.error(chalk.red(`Failed: ${e.message}`));
    process.exit(1);
  }
}

main();
