import { describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildManifest, chunksFrom, slugOf } from './packs.mjs';

const FIX = join(import.meta.dirname, 'fixtures/packs/dist');
const PACK = { id: '/w', urls: ['/models/w/plane.glb'], globs: ['/models/w/*.glb'] };
const chunksOf = () => ['/assets/W-abc.js', '/assets/W-abc.css'];

describe('the pack manifests', () => {
  it('list each file once with its size and hash, and the sum', async () => {
    const m = await buildManifest(PACK, { dist: FIX, publicDir: FIX, chunksOf });
    expect(m.id).toBe('/w');
    expect(m.files.map((f) => f.url)).toEqual(['/assets/W-abc.css', '/assets/W-abc.js', '/models/w/plane.glb', '/models/w/tree.glb']);
    expect(m.bytes).toBe(m.files.reduce((s, f) => s + f.bytes, 0));
    expect(m.files[2]).toMatchObject({ bytes: 5, hash: expect.stringMatching(/^[0-9a-f]{16}$/) });
  });

  it('have a version that holds across builds and moves when a file changes', async () => {
    const a = await buildManifest(PACK, { dist: FIX, publicDir: FIX, chunksOf });
    const b = await buildManifest(PACK, { dist: FIX, publicDir: FIX, chunksOf });
    expect(b.v).toBe(a.v);
    const tmp = mkdtempSync(join(tmpdir(), 'packs-'));
    try {
      cpSync(FIX, tmp, { recursive: true });
      writeFileSync(join(tmp, 'models/w/tree.glb'), 'glb-cc');
      const c = await buildManifest(PACK, { dist: tmp, publicDir: tmp, chunksOf });
      expect(c.bytes).toBe(a.bytes);
      expect(c.v).not.toBe(a.v);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('take a page’s chunks through static and dynamic imports', () => {
    const manifest = {
      'src/pages/W.jsx': { file: 'assets/W-abc.js', css: ['assets/W-abc.css'], imports: ['_three.js'], dynamicImports: ['src/w/scene.js'] },
      '_three.js': { file: 'assets/three-def.js' },
      'src/w/scene.js': { file: 'assets/scene-1.js', imports: ['_three.js'] },
      'src/pages/Other.jsx': { file: 'assets/Other-2.js' },
    };
    expect(chunksFrom(manifest, ['src/pages/W.jsx']).sort()).toEqual(['/assets/W-abc.css', '/assets/W-abc.js', '/assets/scene-1.js', '/assets/three-def.js']);
  });

  it('name a pack by its route', () => {
    expect(slugOf('/earth')).toBe('earth');
    expect(slugOf('/dot-matrix/64')).toBe('dot-matrix-64');
  });
});
