// The 2017 heroes' files held to their caps: on disk (a native hero's, the
// game's own KTX2 maps fetched light cut first: 16 MB plain, 5 MB light,
// 64 MB ultra, scripts/lib/bf2017-caps.mjs; a published one's
// bytes from the manifest, src/data/galaxyAssets.json) and on
// the GPU (its texture contract: 256 MB a world on desktop, 128 MB on a
// phone, so a hero's textures at most a quarter of high's and an eighth of
// the phone's, a duel of two and the world's own still inside). Measured
// from the files themselves (lib/glbTextures.js), as RGBA8 with mips, a
// KTX2 map at a byte a texel; a file in the bucket and not on disk had its
// textures measured by the import that made it.
// (docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md, section 6)
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { glbTextures } from '../../../lib/glbTextures';
import { FULL_CAPS, NATIVE_CAPS } from '../../../../scripts/lib/bf2017-caps.mjs';
import { FULL_SHARE } from '../../../lib/three/walrusCuts';
import { MANIFEST, bytesOf, readManifest } from '../../../../scripts/lib/asset-manifest.mjs';
import { CREW, fileOf } from './crewList';

const MB = 1048576;
const at = (path) => new URL(`../../../../public${path}`, import.meta.url);
const CAPS = {
  plain: { bytes: NATIVE_CAPS.plain, gpu: 64 * MB },
  lod1: { bytes: NATIVE_CAPS.lod1, gpu: 16 * MB },
  ultra: { bytes: NATIVE_CAPS.ultra, gpu: 512 * MB },
};
const publicDir = new URL('../../../../public', import.meta.url).pathname;
const manifest = readManifest(new URL(`../../../../${MANIFEST}`, import.meta.url).pathname);
const published = (url) => Boolean(manifest[url.replace(/^\/+/, '')]);
const cutsOf = (url) => ({ plain: url, lod1: url.replace(/\.glb$/, '.lod1.glb'), ultra: url.replace(/\.glb$/, '.ultra.glb') });
const heroes = Object.entries(CREW).filter(([, c]) => c.rig === 'walrus' && !c.full);

describe('the 2017 heroes’ files', () => {
  it('has heroes to hold to them', () => expect(heroes.length).toBeGreaterThan(0));

  for (const [kind, c] of heroes)
    it(`keeps ${kind}’s cuts under their caps, on disk and on the GPU`, () => {
      for (const [cut, url] of Object.entries(cutsOf(fileOf(c)))) {
        const here = existsSync(at(url));
        if (cut !== 'plain' && !here && !published(url)) continue;
        const bytes = bytesOf(url, { publicDir, manifest });
        expect(bytes, `${kind} ${cut}: ${(bytes / MB).toFixed(1)} MB`).toBeLessThanOrEqual(CAPS[cut].bytes);
        if (!here) continue;
        const { gpuBytes } = glbTextures(readFileSync(at(url)));
        expect(gpuBytes, `${kind} ${cut}: ${(gpuBytes / MB).toFixed(0)} MB of textures`).toBeLessThanOrEqual(CAPS[cut].gpu);
      }
    });
});

// The cast at full fidelity (phase 2, scripts/bf2017-import.mjs --full):
// the plain cut is the game's LOD0 with its own KTX2 maps (from the bucket,
// FULL_CAPS's 64 MB), told to the page's ledger by its row's fullMB (GPU)
// and fullDL (download), which at least ultra's share must admit
// (walrusCuts.js's FULL_SHARE); its light cut colour 1024 and the rest 512
// (2.5 MB, 64 MB of textures: decoded to RGBA8, a hothtrooper's six
// materials are 50 MB; a figure on a phone's level draws only this one);
// the far one 150 KB.
const cast = Object.entries(CREW).filter(([, c]) => c.full);
describe('the 2017 cast’s files', () => {
  it('has a cast to hold to them', () => expect(cast.length).toBeGreaterThan(0));

  for (const [kind, c] of cast)
    it(`keeps ${kind}’s three cuts under their caps`, () => {
      const url = fileOf(c);
      const plain = bytesOf(url, { publicDir, manifest });
      expect(plain, `${kind} plain: ${(plain / MB).toFixed(1)} MB`).toBeLessThanOrEqual(FULL_CAPS.plain);
      expect(c.fullDL, `${kind}: fullDL`).toBe(Math.ceil(plain / MB));
      expect(c.fullMB, `${kind}: fullMB`).toBeGreaterThan(0);
      expect(c.fullMB).toBeLessThanOrEqual(FULL_SHARE.ultra.gpu);
      expect(c.fullDL).toBeLessThanOrEqual(FULL_SHARE.ultra.download);
      if (existsSync(at(url))) expect(Math.abs(glbTextures(readFileSync(at(url))).gpuBytes / MB - c.fullMB)).toBeLessThanOrEqual(1);
      expect(c.lod, `${kind}: a light cut`).toBe(true);
      const lod1 = url.replace(/\.glb$/, '.lod1.glb');
      expect(bytesOf(lod1, { publicDir, manifest })).toBeLessThanOrEqual(FULL_CAPS.lod1);
      expect(glbTextures(readFileSync(at(lod1))).gpuBytes).toBeLessThanOrEqual(64 * MB);
      // (a far cut on disk is in its row, and under its cap)
      const far = url.replace(/\.glb$/, '.far.glb');
      expect(existsSync(at(far)), `${kind}: a far cut on disk, the row says ${Boolean(c.far)}`).toBe(Boolean(c.far));
      if (c.far) expect(bytesOf(far, { publicDir, manifest })).toBeLessThanOrEqual(FULL_CAPS.far);
    });
});
