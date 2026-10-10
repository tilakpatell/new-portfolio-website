// Lane X's checks on the lit fixture (litWorld.js with `particles`):
// the game's falling snow drawn from its emitter table over the ring, and
// the GPU twin held to the CPU step (scripts/light-fixture.mjs --particles
// reads `probe.particles`).
//
// parity(): the same emitter, the same seed and the same spawns, stepped
// 120 frames by emitter.js on the CPU and by gpu.js's compute pass, read
// back; the largest distance between a slot's two positions over the live
// slots (the plan's bar: 1 cm). On WebGL 2 the compute pass runs through
// three's transform-feedback fallback, so both kinds can be measured.
//
// createParticleProbe({ scene, renderer, camera, light, tier, effects }) → Promise<probe>

import SNOW from '../../data/bf2017/fx/FX_Snow_FallingSnow_01_Hoth.json';
import { createSim } from '../../lib/three/particles/gpu.js';
import { MAX_OWNERS, OWNER, spawnCount } from '../../lib/three/particles/emitter.js';
import { createShared, createSpriteMesh, placeholderSheet } from '../../lib/three/particles/sprites.js';

export async function createParticleProbe({ scene, renderer, light }) {
  // one emitter drawn: the falling snow over the ring, its box 6 m up
  const em = SNOW.emitters[0];
  const shared = await createShared();
  const owners = new Float32Array(MAX_OWNERS * OWNER);
  owners.set([0, 6, 0, 1, 0, 0, 0, 1], 0);
  const sim = await createSim(em, em.maxCount, { renderer, seed: 5 });
  const mesh = await createSpriteMesh(em, sim, { shared, map: await placeholderSheet(em.uv.grid) });
  scene.add(mesh);
  const state = { t: 0, acc: 0, burst: false };
  const batches = [{ owner: 0, count: 0 }];
  const p = light?.params;
  if (p) {
    shared.sunDir.value.set(...p.sun.dir).normalize();
    shared.sunColor.value.setRGB(...p.sun.color).multiplyScalar(p.sun.intensity / Math.PI);
    shared.ambient.value.setRGB(...p.ambient.sky).multiplyScalar(p.ambient.intensity);
  }
  const out = {
    mode: sim.mode,
    // the snow run for `seconds` before the first shot, so the box is full
    warm(seconds = 6) {
      for (let t = 0; t < seconds; t += 1 / 30) out.step(1 / 30);
    },
    step(dt, camVel = null) {
      if (camVel) shared.camVel.value.copy(camVel);
      batches[0].count = spawnCount(state, em, dt);
      sim.step(dt, { batches, owners, wind: [0.6, 0, 0.2] });
    },
    dispose() {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      mesh.material.dispose();
      sim.dispose();
    },
    async parity(frames = 120) {
      const em = SNOW.emitters[0];
      const n = 2048;
      const owners = new Float32Array(MAX_OWNERS * OWNER);
      owners.set([0, 12, 0, 1, 0, 0, 0, 1], 0);
      owners.set([8, 10, -4, 1, 0, 0.3826834, 0, 0.9238795], OWNER);
      const cpu = await createSim(em, n, { renderer, seed: 77, mode: 'cpu' });
      let gpu;
      try {
        gpu = await createSim(em, n, { renderer, seed: 77, mode: 'gpu' });
      } catch (e) {
        return { error: `gpu sim: ${String(e.message ?? e).split('\n')[0]}` };
      }
      const batches = [
        { owner: 0, count: 0 },
        { owner: 1, count: 0 },
      ];
      const wind = [1.5, 0, -0.5];
      for (let f = 0; f < frames; f++) {
        batches[0].count = f < 60 ? 9 : 0;
        batches[1].count = f % 3 === 0 ? 5 : 0;
        cpu.step(1 / 60, { batches, owners, wind });
        gpu.step(1 / 60, { batches, owners, wind });
      }
      const [a, b] = [await cpu.read(), await gpu.read()];
      let worst = 0;
      let live = 0;
      let agree = 0;
      for (let i = 0; i < n; i++) {
        const k = i * 4;
        const la = a.posAge[k + 3] < a.velLife[k + 3];
        const lb = b.posAge[k + 3] < b.velLife[k + 3];
        if (la === lb) agree++;
        if (!la || !lb) continue;
        live++;
        worst = Math.max(worst, Math.hypot(a.posAge[k] - b.posAge[k], a.posAge[k + 1] - b.posAge[k + 1], a.posAge[k + 2] - b.posAge[k + 2]));
      }
      gpu.dispose();
      return { frames, live, agree: agree / n, worstMetres: worst, backend: renderer.backend?.isWebGLBackend ? 'nodes-webgl' : 'webgpu' };
    },
  };
  return out;
}
