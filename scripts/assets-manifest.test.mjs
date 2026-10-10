import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assetManifest from './assets-manifest.mjs';
import { hashOf } from './assets-upload.mjs';

function project() {
  const root = mkdtempSync(join(tmpdir(), 'assets-man-'));
  mkdirSync(join(root, 'public/kit'), { recursive: true });
  mkdirSync(join(root, 'src/data'), { recursive: true });
  const buf = Buffer.alloc(70_000, 1);
  writeFileSync(join(root, 'public/kit/a.glb'), buf);
  const manifest = { 'kit/a.glb': { hash: hashOf(buf), bytes: 70_000 }, 'kit/b.glb': { hash: 'ffffffffffff', bytes: 1 } };
  writeFileSync(join(root, 'src/data/assets-manifest.json'), JSON.stringify(manifest));
  return { root, manifest };
}
const made = (root, base) => {
  const p = assetManifest();
  p.configResolved({ root, publicDir: join(root, 'public'), env: base ? { VITE_ASSET_BASE: base } : {} });
  return p;
};

describe('the manifest the build bundles', () => {
  it('with a base, holds only the entries whose file on disk has that hash', () => {
    const { root, manifest } = project();
    const out = made(root, 'https://bucket.test').load(join(root, 'src/data/assets-manifest.json'));
    expect(JSON.parse(out)).toEqual({ 'kit/a.glb': manifest['kit/a.glb'] });
  });

  it('without one, is empty, so the bundle carries nothing it will not use', () => {
    const { root } = project();
    expect(made(root, '').load(join(root, 'src/data/assets-manifest.json'))).toBe('{}');
  });

  it('leaves every other file to the other plugins', () => {
    const { root } = project();
    expect(made(root, 'https://bucket.test').load(join(root, 'src/data/modelCredits.json'))).toBeNull();
  });
});

describe('a check’s own manifest', () => {
  it('is read in place of the committed one when ASSET_MANIFEST names it', () => {
    const { root, manifest } = project();
    const other = join(root, 'other.json');
    writeFileSync(other, JSON.stringify({ 'kit/a.glb': manifest['kit/a.glb'] }));
    writeFileSync(join(root, 'src/data/assets-manifest.json'), '{}');
    process.env.ASSET_MANIFEST = other;
    try {
      expect(JSON.parse(made(root, 'https://bucket.test').load(join(root, 'src/data/assets-manifest.json')))).toEqual({ 'kit/a.glb': manifest['kit/a.glb'] });
    } finally {
      delete process.env.ASSET_MANIFEST;
    }
  });
});
