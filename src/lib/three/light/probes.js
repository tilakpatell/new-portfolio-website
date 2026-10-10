// The level's reflection volumes as the scene's environment, and on ultra a
// grid of irradiance probes over the arena.
//
// Volumes. The game bakes a 128² HDR cube per reflection volume (lane G's
// probes, `textures/levels/`). The one the visitor stands in (the smallest
// that holds them) is the environment, crossfaded over FADE seconds when
// they cross into another: `scene.environmentNode` is a mix of two
// pmremTexture nodes whose cubes are swapped in place, so a crossing
// changes two textures and a uniform and compiles nothing. PMREMNode
// prefilters a plain cube itself on the node renderer, so `loadCube(volume)`
// hands back the HDR cube as loaded, not a PMREM (lane G's probeEnv.js
// prefilters with the classic renderer's PMREMGenerator and keeps one cube
// alive, which a crossfade cannot: two are on screen while it runs). The
// cubes are kept per volume once loaded (a level has a handful; each is
// 128² × 6 at half float) and freed on dispose.
//
// The grid. three's LightProbeGrid (three/addons/lighting/LightProbeGrid.js)
// is a Light: added to the scene, it lights every node material from L2
// spherical harmonics baked on the GPU at each probe. The bake needs the
// node renderer, on either backend. Baked once, after the level's near
// cells are in, never again. It ships behind the design's numbers (A3):
// under BAKE_BUDGET ms to bake and FRAME_BUDGET ms a frame on the owner's
// laptop, so applyGameLight bakes it only when asked (`grid: true`). (A
// first bake on the fixture, with three's RoomEnvironment scene as the
// environment, failed to build its materials and lit everything pink;
// with the TSL sky it bakes clean on WebGL 2 too.)
//
// probeFor(volumes, pos) → { i, blend }      (pure)
// createProbes(scene, volumes, loadCube, { fallback, fade }) → Promise<{ update(pos, dt), current, dispose }>
// createProbeGrid(scene, renderer, bounds, res = PROBE_GRID, opts) → Promise<{ grid, bake(), dispose }>

import { loadThree } from './three.js';

export const FADE = 0.5; // s: the crossfade between two volumes' cubes
export const EDGE = 4; // m: how deep into a volume `blend` reaches 1
export const PROBE_GRID = [8, 3, 8]; // probes along x, y, z over the arena
export const BAKE_BUDGET = 400; // ms: the most the grid's one bake may take (A3)
export const FRAME_BUDGET = 0.5; // ms: the most the grid may add to a frame (A3)

const inside = (v, p) => p[0] >= v.min[0] && p[0] <= v.max[0] && p[1] >= v.min[1] && p[1] <= v.max[1] && p[2] >= v.min[2] && p[2] <= v.max[2];
const volumeOf = (v) => (v.max[0] - v.min[0]) * (v.max[1] - v.min[1]) * (v.max[2] - v.min[2]);

// volumes: [{ min: [x, y, z], max: [x, y, z] }]; the smallest holding pos,
// and how far in it is (0 at a face, 1 from EDGE in); -1 when none does
export function probeFor(volumes, pos) {
  let best = -1;
  for (let i = 0; i < (volumes?.length ?? 0); i++) {
    if (inside(volumes[i], pos) && (best < 0 || volumeOf(volumes[i]) < volumeOf(volumes[best]))) best = i;
  }
  if (best < 0) return { i: -1, blend: 0 };
  const v = volumes[best];
  let d = Infinity;
  for (let a = 0; a < 3; a++) d = Math.min(d, pos[a] - v.min[a], v.max[a] - pos[a]);
  return { i: best, blend: Math.min(1, d / EDGE) };
}

export async function createProbes(scene, volumes, loadCube, { fallback = scene.environment, fade = FADE } = {}) {
  const { tsl } = await loadThree();
  const cubes = new Map(); // volume → its cube, once loaded
  let base = fallback;
  let a = null; // the pmremTexture nodes, made once there is a texture to start them on
  let b = null;
  const t = tsl.uniform(0);
  let want = -1;
  let showing = -1;
  let fading = false;
  let disposed = false;
  const before = scene.environmentNode;

  const start = (tex) => {
    a = tsl.pmremTexture(tex);
    b = tsl.pmremTexture(tex);
    scene.environmentNode = tsl.mix(a, b, t);
  };
  if (base) start(base);

  const show = (i, tex) => {
    if (!tex) return;
    if (!a) {
      start(tex);
      showing = i;
      return;
    }
    b.value = tex;
    t.value = 0;
    fading = true;
    showing = i;
  };

  async function pick(i) {
    if (i < 0) return show(-1, base);
    if (!cubes.has(i)) cubes.set(i, loadCube(volumes[i], i));
    const tex = await cubes.get(i);
    if (!disposed && want === i) show(i, tex);
  }

  return {
    update(pos, dt) {
      const { i } = probeFor(volumes, pos);
      if (i !== want) {
        want = i;
        pick(i);
      }
      if (fading) {
        t.value = Math.min(1, t.value + dt / fade);
        if (t.value >= 1) {
          a.value = b.value;
          t.value = 0;
          fading = false;
        }
      }
      return showing;
    },
    get current() {
      return showing;
    },
    get fade() {
      return t.value;
    },
    // a new fallback (the sky's environment after a weather change)
    setFallback(tex) {
      base = tex;
      if (showing < 0) show(-1, tex);
    },
    async dispose() {
      disposed = true;
      scene.environmentNode = before;
      for (const p of cubes.values()) (await p)?.dispose?.();
      cubes.clear();
    },
  };
}

// bounds: { min, max } (the pack's arena); res: probes per axis
export async function createProbeGrid(scene, renderer, bounds, res = PROBE_GRID, { cubemapSize = 8, far = 600 } = {}) {
  const { LightProbeGrid } = await import('three/addons/lighting/LightProbeGrid.js');
  const size = [0, 1, 2].map((k) => bounds.max[k] - bounds.min[k]);
  const grid = new LightProbeGrid(size[0], size[1], size[2], res[0], res[1], res[2]);
  grid.position.set(...[0, 1, 2].map((k) => (bounds.min[k] + bounds.max[k]) / 2));
  grid.updateMatrixWorld();
  scene.add(grid);
  return {
    grid,
    // one bake; the CPU's ms to issue it (the caller waits on the GPU)
    bake() {
      const t0 = performance.now();
      grid.bake(renderer, scene, { cubemapSize, near: 0.1, far });
      return performance.now() - t0;
    },
    dispose() {
      grid.removeFromParent();
      grid.dispose();
    },
  };
}
