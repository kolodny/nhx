import { execSync, spawn } from 'child_process';
import { dirname, join } from 'path';

const npmPath = join(dirname(process.execPath), 'npm');

const getRegistry = () => {
  try {
    return execSync(`"${npmPath}" config get registry`).toString().trim();
  } catch {
    return '';
  }
};

export async function npmInstall(opts: {
  cwd: string;
  pkg?: string;
  postinstall?: boolean;
}): Promise<void> {
  const { cwd, pkg, postinstall } = opts;

  const args = pkg ? ['install', pkg, '--no-save'] : ['install'];
  if (!postinstall) args.push('--ignore-scripts');

  const env = { ...process.env };
  if (!env.NPM_CONFIG_REGISTRY) {
    const registry = getRegistry();
    if (registry) env.NPM_CONFIG_REGISTRY = registry;
  }

  const run = (extra: string[], silent = false) => {
    return new Promise<boolean>((res) => {
      const stdio = silent ? ('ignore' as const) : ['inherit' as const, 2, 2];
      const child = spawn(npmPath, [...args, ...extra], { cwd, env, stdio });
      child.on('close', (c) => res(c === 0));
      child.on('error', () => res(false));
    });
  };

  // Try offline first (silent), fall back to network
  if (await run(['--offline'], true)) return;
  if (await run(['--prefer-offline'])) return;
  throw new Error(`npm install failed${pkg ? ` for ${pkg}` : ''}`);
}
