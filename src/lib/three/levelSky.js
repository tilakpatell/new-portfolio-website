// A world lit by its level's own light, from Star Wars Battlefront II
// (2017): the game keeps a probe of the sky at each of a level's
// reflection volumes, six Radiance faces (scripts/bf2017-sky.mjs makes the
// one out on the level's main arena the site's, under
// public/textures/galaxy/sky/<world>-probe-<size>-<face>.hdr). Loaded as a
// cube map, it is what the world's shiny things reflect and its light from
// all round (surface/scene.js puts it through PMREM in place of the sky
// dome's), and its brightest texel is where the sun stands, and its colour.
//
// probeSizeFor(level) → the face size a quality level loads (64 low, the
//   game's 128 above: 0.8 MB of half floats on the graphics chip at most)
// probeUrls(base, size) → its six files, in three's cube order
// sunFrom(faces) → { dir: [x, y, z] unit, color: [r, g, b] (the brightest
//   channel 1), intensity } from faces [{ data, width, height }]
// loadLevelSky(base, { level, load }) → { env (the cube texture), sun,
//   dispose() }: one held at a time, the last one disposed before the next
//   is asked for; `load(urls)` → a cube texture whose `images` are the
//   faces (three's HDRCubeTextureLoader, by default)
// forgetLevelSky() → drops the one held (the tests)

import * as THREE from 'three';
import { HDRCubeTextureLoader } from 'three/examples/jsm/loaders/HDRCubeTextureLoader.js';

export const FACES = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

export const probeSizeFor = (level) => (level === 'low' ? 64 : 128);
export const probeUrls = (base, size) => FACES.map((f) => `${base}-probe-${size}-${f}.hdr`);

// a face's texel (x, y) as the direction it looks along, the GL way (y down
// the file, each face's own across and up), then as the world sees it:
// three samples a cube map turned round in x (its flipEnvMap)
function dirOf(face, x, y, size) {
  const s = (2 * (x + 0.5)) / size - 1;
  const t = (2 * (y + 0.5)) / size - 1;
  const d = { px: [1, -t, -s], nx: [-1, -t, s], py: [s, 1, t], ny: [s, -1, -t], pz: [s, -t, 1], nz: [-s, -t, -1] }[face];
  const n = Math.hypot(...d);
  return [-d[0] / n, d[1] / n, d[2] / n];
}

export function sunFrom(faces) {
  let best = { v: -1 };
  for (const [i, f] of faces.entries()) {
    const img = f.image ?? f;
    const { data, width } = img;
    const half = data instanceof Uint16Array;
    const ch = Math.round(data.length / (width * img.height));
    const at = (k) => (half ? THREE.DataUtils.fromHalfFloat(data[k]) : data[k]);
    for (let p = 0; p < width * img.height; p++) {
      const r = at(p * ch);
      const g = at(p * ch + 1);
      const b = at(p * ch + 2);
      const v = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (v > best.v) best = { v, rgb: [r, g, b], face: FACES[i], x: p % width, y: Math.floor(p / width), size: width };
    }
  }
  const top = Math.max(...best.rgb, 1e-9);
  return { dir: dirOf(best.face, best.x, best.y, best.size), color: best.rgb.map((c) => c / top), intensity: best.v };
}

const loadCube = (urls) =>
  new Promise((resolve, reject) => {
    new HDRCubeTextureLoader().setDataType(THREE.HalfFloatType).load(urls, resolve, undefined, reject);
  });

let held = null;

export async function loadLevelSky(base, { level = 'high', load = loadCube } = {}) {
  // (the last world's let go of before this one's is asked for: two probes
  // and their PMREMs are never on the graphics chip at once)
  held?.dispose();
  const env = await load(probeUrls(base, probeSizeFor(level)));
  let gone = false;
  const sky = {
    env,
    sun: sunFrom(env.images),
    dispose() {
      if (gone) return;
      gone = true;
      env.dispose();
      if (held === sky) held = null;
    },
  };
  held = sky;
  return sky;
}

export function forgetLevelSky() {
  held = null;
}
