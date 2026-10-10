// The 2017 heroes' files held to their caps: on disk (the pipeline design's
// 4 MB for a hero, 2.5 MB for a light cut, 24 MB for an ultra one) and on
// the GPU (its texture contract: 256 MB a world on desktop, 128 MB on a
// phone, so a hero's textures at most a quarter of high's and an eighth of
// the phone's, a duel of two and the world's own still inside). Measured
// from the files themselves (lib/glbTextures.js), as RGBA8 with mips.
// (docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md, section 6)
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { glbTextures } from '../../../lib/glbTextures';
import { CREW, fileOf } from './crewList';

const MB = 1048576;
const at = (path) => new URL(`../../../../public${path}`, import.meta.url);
const CAPS = {
  plain: { bytes: 4 * MB, gpu: 64 * MB },
  lod1: { bytes: 2.5 * MB, gpu: 16 * MB },
  ultra: { bytes: 24 * MB, gpu: 512 * MB },
};
const cutsOf = (url) => ({ plain: url, lod1: url.replace(/\.glb$/, '.lod1.glb'), ultra: url.replace(/\.glb$/, '.ultra.glb') });
const heroes = Object.entries(CREW).filter(([, c]) => c.rig === 'walrus');

describe('the 2017 heroes’ files', () => {
  it('has heroes to hold to them', () => expect(heroes.length).toBeGreaterThan(0));

  for (const [kind, c] of heroes)
    it(`keeps ${kind}’s cuts under their caps, on disk and on the GPU`, () => {
      for (const [cut, url] of Object.entries(cutsOf(fileOf(c)))) {
        if (cut !== 'plain' && !existsSync(at(url))) continue;
        const bytes = statSync(at(url)).size;
        const { gpuBytes } = glbTextures(readFileSync(at(url)));
        expect(bytes, `${kind} ${cut}: ${(bytes / MB).toFixed(1)} MB`).toBeLessThanOrEqual(CAPS[cut].bytes);
        expect(gpuBytes, `${kind} ${cut}: ${(gpuBytes / MB).toFixed(0)} MB of textures`).toBeLessThanOrEqual(CAPS[cut].gpu);
      }
    });
});
