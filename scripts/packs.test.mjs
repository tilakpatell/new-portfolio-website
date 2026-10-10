import { describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildManifest, chunksFrom, slugOf } from './packs.mjs';

const FIX = join(import.meta.dirname, 'fixtures/packs/site');
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

  it('list a file the bucket holds by its remote URL and the manifest’s hash, with its site path', async () => {
    const base = 'https://bucket.test/assets';
    const plain = await buildManifest(PACK, { dist: FIX, publicDir: FIX, chunksOf });
    const remote = (hash) => ({ base, manifest: { 'models/w/tree.glb': { hash, bytes: 5 } } });
    const m = await buildManifest(PACK, { dist: FIX, publicDir: FIX, chunksOf, remote: remote('aaaaaaaaaaaa') });
    const tree = plain.files.find((f) => f.url === '/models/w/tree.glb');
    expect(m.files.find((f) => f.local)).toEqual({ url: `${base}/aaaaaaaaaaaa/models/w/tree.glb`, bytes: tree.bytes, hash: 'aaaaaaaaaaaa', local: '/models/w/tree.glb' });
    expect(m.files.filter((f) => !f.local)).toEqual(plain.files.filter((f) => f.url !== '/models/w/tree.glb'));
    expect(m.bytes).toBe(plain.bytes);
    // (a new upload of the file is a new version, so an installed world updates)
    expect(m.v).not.toBe(plain.v);
    expect((await buildManifest(PACK, { dist: FIX, publicDir: FIX, chunksOf, remote: remote('bbbbbbbbbbbb') })).v).not.toBe(m.v);
    // and without a base, the bucket is not named
    expect(await buildManifest(PACK, { dist: FIX, publicDir: FIX, chunksOf, remote: { base: '', manifest: remote('a').manifest } })).toEqual(plain);
  });

  it('list a game-derived file the bucket alone holds (not in the checkout) from the manifest, only with a base', async () => {
    const base = 'https://bucket.test/site-assets';
    const manifest = { 'models/w/luke.glb': { hash: 'cccccccccccc', bytes: 4321 } };
    const m = await buildManifest(PACK, { dist: FIX, publicDir: FIX, chunksOf, remote: { base, manifest } });
    expect(m.files.find((f) => f.local === '/models/w/luke.glb')).toEqual({ url: `${base}/cccccccccccc/models/w/luke.glb`, bytes: 4321, hash: 'cccccccccccc', local: '/models/w/luke.glb', remoteOnly: true });
    const plain = await buildManifest(PACK, { dist: FIX, publicDir: FIX, chunksOf });
    expect(m.bytes).toBe(plain.bytes + 4321);
    expect((await buildManifest(PACK, { dist: FIX, publicDir: FIX, chunksOf, remote: { base: '', manifest } })).files.some((f) => f.url.includes('luke'))).toBe(false);
  });

  it('take a page’s chunks through static and dynamic imports', () => {
    const manifest = {
      'src/pages/W.jsx': { file: 'assets/W-abc.js', css: ['assets/W-abc.css'], imports: ['_three.js'], dynamicImports: ['src/w/scene.js'] },
      '_three.js': { file: 'assets/three-def.js' },
      'src/w/scene.js': { file: 'assets/scene-1.js', imports: ['_three.js'] },
      'src/pages/Other.jsx': { file: 'assets/Other-2.js' },
      'index.html': { file: 'assets/index-0.js', isEntry: true, dynamicImports: ['src/pages/Other.jsx', 'src/pages/W.jsx'] },
      'src/pages/Shared.jsx': { file: 'assets/Shared-3.js', imports: ['index.html'] },
    };
    expect(chunksFrom(manifest, ['src/pages/W.jsx']).sort()).toEqual(['/assets/W-abc.css', '/assets/W-abc.js', '/assets/scene-1.js', '/assets/three-def.js']);
    // the app's entry is taken, not the pages it can reach
    expect(chunksFrom(manifest, ['src/pages/Shared.jsx']).sort()).toEqual(['/assets/Shared-3.js', '/assets/index-0.js']);
  });

  it('name a pack by its route', () => {
    expect(slugOf('/earth')).toBe('earth');
    expect(slugOf('/dot-matrix/64')).toBe('dot-matrix-64');
  });
});
