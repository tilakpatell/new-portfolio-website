// What every metric gets: the repo root, the source files, and a cached
// reader. Built once a run (scripts/health.mjs) or once a test, on a
// fixture tree.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const SRC_EXT = /\.(js|jsx|mjs)$/;
const SKIP = new Set(['node_modules', 'dist', '.git', 'lab', '.claude', '.agents', 'fixtures']);

export async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) await walk(p, out);
    else if (SRC_EXT.test(entry.name)) out.push(p);
  }
  return out;
}

export async function makeContext(root, { dirs = ['src', 'scripts'] } = {}) {
  const cache = new Map();
  const read = async (p) => {
    if (!cache.has(p)) cache.set(p, readFile(p, 'utf8'));
    return cache.get(p);
  };
  const byDir = {};
  for (const d of dirs) byDir[d] = (await walk(join(root, d)).catch(() => [])).sort();
  return {
    root,
    src: byDir.src ?? [],
    scripts: byDir.scripts ?? [],
    read,
    rel: (p) => relative(root, p).split('\\').join('/'),
  };
}

// The shared shape: detail worst first, at most 25 rows. A metric whose worst
// isn't its biggest n (cycles: the shortest loop first) passes ordered, and
// its own order stands.
export const metric = ({ id, label, unit, detail = [], value = detail.length, note, ordered = false }) => ({
  id,
  label,
  value,
  unit,
  better: 'lower',
  detail: (ordered ? detail : [...detail].sort((a, b) => b.n - a.n)).slice(0, 25),
  ...(note ? { note } : {}),
});
