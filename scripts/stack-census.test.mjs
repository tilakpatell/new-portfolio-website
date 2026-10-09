import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { makeContext } from './health/context.mjs';
import { PAGES, census, packageOf, splice, stale, table } from './stack-census.mjs';

const TREE = fileURLToPath(new URL('./health/fixtures/tree/', import.meta.url));
const ctx = await makeContext(TREE);
const pkg = JSON.parse(await readFile(new URL('package.json', `file://${TREE}`), 'utf8'));

describe('the stack census', () => {
  it('maps a specifier to its package, and a local or built-in one to nothing', () => {
    expect(packageOf('three/examples/jsm/x.js')).toBe('three');
    expect(packageOf('@gltf-transform/core')).toBe('@gltf-transform/core');
    expect(packageOf('@gltf-transform/core/dist/x.js')).toBe('@gltf-transform/core');
    for (const s of ['./x', '../x', '/x', 'node:fs', 'virtual:pwa']) expect(packageOf(s)).toBeNull();
  });

  it('counts each file once per package, in every import form, comments left out', async () => {
    const c = await census(ctx);
    expect(c.get('three')).toEqual({ files: 1, where: ['src/world'] });
    expect(c.get('@gltf-transform/core').files).toBe(1);
    expect(c.has('node:fs')).toBe(false);
    expect(c.has('lonely')).toBe(false);
    expect([...c.keys()].some((k) => k.startsWith('.'))).toBe(false);
  });

  it('writes a row per package, most imported first, a dash for a package with no page', async () => {
    const rows = table(await census(ctx), pkg, { three: 'three.md' }).split('\n');
    expect(rows[0]).toBe('| package | version | page | files |');
    expect(rows.slice(2)).toEqual([
      '| `@gltf-transform/core` | 2.0.0 | — | 1 |',
      '| `three` | 1.0.0 | [three.md](three.md) | 1 |',
      '| `lonely` | 3.0.0 | — | 0 |',
      '| `vitest` | 4.0.0 | — | 0 |',
    ]);
  });

  it('splices between the markers and leaves the rest byte for byte', () => {
    const md = 'before\n<!-- census:start -->\nold\n<!-- census:end -->\nafter\n';
    expect(splice(md, 'new')).toBe('before\n<!-- census:start -->\nnew\n<!-- census:end -->\nafter\n');
    expect(() => splice('no markers', 'new')).toThrow(/census:start/);
  });

  it('says stale when the index’s block is not the fresh table', async () => {
    const md = await readFile(new URL('docs/stack/README.md', `file://${TREE}`), 'utf8');
    const fresh = table(await census(ctx), pkg, {});
    expect(stale(md, fresh)).toBe(true);
    expect(stale(splice(md, fresh), fresh)).toBe(false);
  });

  it('gives every package of the site’s own package.json a page', async () => {
    const own = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    const names = Object.keys({ ...own.dependencies, ...own.devDependencies });
    expect(names.filter((n) => !PAGES[n])).toEqual([]);
  });
});
