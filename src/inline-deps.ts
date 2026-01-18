import { promises as fs } from 'fs';
import JSON5 from 'json5';

export interface ParsedDeps {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  engines?: Record<string, string>;
  hasInlineDeps: boolean;
}

const BASE = { dependencies: {}, devDependencies: {} };
const EMPTY: ParsedDeps = { ...BASE, hasInlineDeps: false };

function parseContent(content: string): ParsedDeps {
  const shebang = content.startsWith('#!');
  const lines = content.split('\n').slice(shebang ? 1 : 0);
  const starts = lines.join('\n').trim().startsWith('/*/ // <package>');
  if (!starts) return EMPTY;
  const ends = lines.findIndex((l) => l.trim().startsWith('/*/ // </package>'));
  if (ends === -1) return EMPTY;

  try {
    const cfg = JSON5.parse(lines.slice(1, ends).join('\n'));
    return { ...BASE, ...cfg, hasInlineDeps: true };
  } catch (e: any) {
    throw new Error(`Failed to parse inline deps: ${e.message}`);
  }
}

export const parseInlineDependencies = async (path: string) =>
  parseContent(await fs.readFile(path, 'utf-8'));
export const getNodeVersionKey = () =>
  `node-${process.versions.node.split('.').slice(0, 2).join('.')}`;
export const createPackageJson = (d: ParsedDeps, name = 'script') => ({
  name,
  version: '1.0.0',
  type: 'module',
  dependencies: d.dependencies,
  devDependencies: d.devDependencies,
});
