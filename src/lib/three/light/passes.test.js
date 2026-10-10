import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { buildChain } from './passes';
import { createVolumetrics } from './volumetrics';
import { passesFor } from './post';
import hoth from './fixtures/hoth.ve.json';

// Every kind builds into a node graph in Node (no GPU: the graph is made,
// not compiled); the browser half is scripts/light-fixture.mjs.
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
const light = new THREE.DirectionalLight();
light.castShadow = true;
const lut = new THREE.Data3DTexture(new Uint8Array(4 * 8 * 8 * 8), 8, 8, 8);
const renderer = { isWebGPURenderer: true };
// (SMAANode loads its two lookup pictures through Image; Node has none)
globalThis.Image ??= class {
  addEventListener() {}
  set src(v) {
    this._src = v;
  }
};

describe('buildChain', () => {
  for (const tier of ['ultra', 'high', 'mid', 'low']) {
    it(`builds ${tier}’s chain`, async () => {
      const passes = passesFor(tier, hoth.sunny, 'webgpu', { scene, camera, light, lut });
      const chain = await buildChain(renderer, passes);
      expect(chain.pipeline.outputNode).toBeTruthy();
      expect(chain.nodes.length).toBeGreaterThan(passes.length - 3);
      chain.dispose();
    });
  }
  it('builds the volumes into ultra’s chain', async () => {
    const volumetrics = await createVolumetrics(scene, renderer, { tier: 'ultra' });
    const passes = passesFor('ultra', hoth.sunny, 'webgpu', { scene, camera, light, lut, volumetrics });
    expect(passes.map((p) => p.kind)).toContain('volumes');
    const chain = await buildChain(renderer, passes);
    expect(chain.pipeline.outputNode).toBeTruthy();
    chain.dispose();
    volumetrics.dispose();
  });
  it('a shader pass still needs the webgl backend; an unknown kind is refused', async () => {
    await expect(buildChain(renderer, [{ kind: 'render', scene, camera }, { kind: 'shader' }])).rejects.toThrow('needs the webgl backend');
    await expect(buildChain(renderer, [{ kind: 'render', scene, camera }, { kind: 'vignette' }])).rejects.toThrow('unknown pass vignette');
    await expect(buildChain(renderer, [{ kind: 'ao' }])).rejects.toThrow('needs a render pass first');
  });
});
