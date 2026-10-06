// The seas of the galaxy's worlds, as numbers: each world's swell (Gerstner
// waves: direction, wavelength, steepness), its shallows and sea bed, its
// foam, and how its waves rise and break on a beach; the waves' height in
// JavaScript (the same sum the shader draws, so a later thing can float on
// it), the water's depth over the reach baked from the ground, and the
// rings of the disc the sea is drawn on, round the camera. Pure: water.js
// builds the mesh and its shader from these.
//
// What Wookieepedia says, and what each is for:
// - Scarif: clear, shallow oceans round volcanic island chains, tranquil
//   sandy beaches: a long low swell, turquoise over the sand, surf.
// - Kamino: all ocean, savage storms: tall steep swells, whitecaps, slate.
// - Naboo: lakes in the Lake Country, Lake Paonga: calm, the sky in it.
// - Kashyyyk: the shallows under the karst at Kachirho: grey-green, small surf.
// - Dagobah, Yavin 4: swamp and jungle river: near still, murky.
//
// A preset: { waves: [[dir rad, len m, steep]…], shallow, bed, clarity (m:
// how deep you see the bed), caps (whitecaps, 0–1), shore (foam washing up
// the beach), breakers (how hard the swell rises and breaks), glint, rough
// (fine ripples), speed (of the waves, 1 the real one), scum (swamp skin) }

const TAU = Math.PI * 2;

export const SEAS = {
  // (any other sea)
  sea: {
    waves: [[0.6, 70, 0.08], [1.4, 33, 0.07], [-0.3, 17, 0.06], [2.2, 9, 0.04]],
    shallow: '#4f9a9a',
    bed: '#c8b890',
    clarity: 5,
    caps: 0.2,
    shore: 0.7,
    breakers: 0.6,
    glint: 1,
    rough: 0.7,
  },
  swamp: {
    waves: [[0.4, 9, 0.018], [1.7, 5, 0.014], [2.8, 3, 0.01]],
    shallow: '#46553c',
    bed: '#2a3020',
    clarity: 0.8,
    caps: 0,
    shore: 0,
    breakers: 0,
    glint: 0.35,
    rough: 0.25,
    speed: 0.5,
    scum: 0.55,
  },
  scarif: {
    waves: [[0.7, 88, 0.05], [1.1, 61, 0.05], [1.9, 23, 0.06], [-0.4, 13, 0.05], [2.6, 7, 0.04]],
    shallow: '#4fd8cc',
    bed: '#e9dcb4',
    clarity: 7,
    caps: 0.05,
    shore: 1,
    breakers: 1,
    glint: 1.2,
    rough: 0.6,
  },
  kamino: {
    waves: [[0.4, 110, 0.11], [0.9, 70, 0.11], [0.1, 44, 0.1], [1.6, 26, 0.09], [-0.5, 14, 0.07], [2.3, 8, 0.05]],
    shallow: '#4d6670',
    bed: '#2a343c',
    clarity: 3,
    caps: 0.85,
    shore: 0.6,
    breakers: 0.4,
    glint: 0.35,
    rough: 1.4,
    speed: 1.1,
  },
  naboo: {
    waves: [[0.3, 18, 0.035], [1.2, 11, 0.03], [2.1, 6, 0.025]],
    shallow: '#6aa39a',
    bed: '#7a8a5a',
    clarity: 5,
    caps: 0,
    shore: 0.35,
    breakers: 0.15,
    glint: 1,
    rough: 0.3,
  },
  kashyyyk: {
    waves: [[0.8, 58, 0.07], [1.3, 36, 0.06], [0.2, 19, 0.05], [2.4, 10, 0.04]],
    shallow: '#7fa595',
    bed: '#b5a888',
    clarity: 4,
    caps: 0.1,
    shore: 0.8,
    breakers: 0.6,
    glint: 0.8,
    rough: 0.7,
  },
};
SEAS.dagobah = SEAS.swamp;
SEAS.yavin = { ...SEAS.swamp, waves: [[0.2, 11, 0.022], [1.1, 6, 0.016], [2.5, 3.5, 0.01]], shallow: '#4c5e44', clarity: 1.4, speed: 0.8, scum: 0.3 };

export const seaFor = (id, water) => SEAS[id] ?? SEAS[water?.kind] ?? SEAS.sea;

export const wavesFor = (sea) =>
  sea.waves.map(([dir, len, steep]) => {
    const k = TAU / len;
    return { dx: Math.cos(dir), dz: Math.sin(dir), k, c: Math.sqrt(9.8 / k) * (sea.speed ?? 1), steep, amp: steep / k, len };
  });

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// How the swell stands up toward a beach: still on the sand, rising in the
// shallows as it slows (it breaks there), as it is in deep water
export function damp(depth, sea = SEAS.sea) {
  if (!(depth > 0)) return 0;
  const rise = smooth(0, 1.2, depth);
  const shoal = 1 + (sea.breakers ?? 0.5) * 0.45 * (1 - smooth(1.5, 9, depth));
  return rise * shoal;
}

// The water's height at a place and time (Gerstner waves slide the surface
// sideways too, so find the point that slid to here, three times over)
export function heightAt(x, z, t, waves, depth = Infinity, sea = SEAS.sea) {
  const a = depth === Infinity ? 1 : damp(depth, sea);
  if (a === 0) return 0;
  let qx = x;
  let qz = z;
  for (let i = 0; i < 3; i++) {
    let ox = 0;
    let oz = 0;
    for (const w of waves) {
      const c = Math.cos(w.k * (w.dx * qx + w.dz * qz - w.c * t)) * w.amp * a;
      ox += w.dx * c;
      oz += w.dz * c;
    }
    qx = x - ox;
    qz = z - oz;
  }
  let y = 0;
  for (const w of waves) y += Math.sin(w.k * (w.dx * qx + w.dz * qz - w.c * t)) * w.amp * a;
  return y;
}

// The depth of the water over the reach, from the ground's height: one byte
// a texel (0 on land, `max` metres and deeper at 255), read back between
// texel centres as the GPU reads it; deep past the edge.
export function bakeDepth(height, level, { half = 640, n = 256, max = 24 } = {}) {
  const data = new Uint8Array(n * n);
  const step = (half * 2) / n;
  for (let j = 0; j < n; j++) {
    const z = -half + (j + 0.5) * step;
    for (let i = 0; i < n; i++) {
      const d = level - height(-half + (i + 0.5) * step, z);
      data[j * n + i] = Math.round((Math.min(max, Math.max(0, d)) / max) * 255);
    }
  }
  const texel = (i, j) => data[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))];
  return {
    data,
    half,
    n,
    max,
    at(x, z) {
      if (Math.abs(x) > half || Math.abs(z) > half) return max;
      const u = (x + half) / step - 0.5;
      const v = (z + half) / step - 0.5;
      const i = Math.floor(u);
      const j = Math.floor(v);
      const fu = u - i;
      const fv = v - j;
      const top = texel(i, j) * (1 - fu) + texel(i + 1, j) * fu;
      const bottom = texel(i, j + 1) * (1 - fu) + texel(i + 1, j + 1) * fu;
      return ((top * (1 - fv) + bottom * fv) / 255) * max;
    },
  };
}

// The disc's rings: even and fine round the camera, then each a little
// wider out to the horizon (fewer, coarser, on a small screen)
export function discRings({ small = false } = {}) {
  const [around, step, near, grow, far] = small ? [96, 2.5, 40, 1.09, 9000] : [160, 1.25, 48, 1.05, 9000];
  const radii = [0];
  for (let r = step; r < near; r += step) radii.push(r);
  for (let r = near; r < far; r *= grow) radii.push(r);
  radii.push(far);
  return { radii, around, step };
}

// Where the disc sits: the camera's place, in whole steps (it moves in jumps,
// so between them the waves are drawn on the same points and don't swim)
export const snapCentre = (x, z, step) => [Math.floor(x / step) * step, Math.floor(z / step) * step];

// The waves in GLSL: gerstner(p, dist, amp) → the displacement, and the
// normal and how pinched the surface is (for whitecaps). `amp` scales them
// (the shallows); short waves fade with distance, where the rings are too
// coarse to draw them.
export const WAVES_GLSL = (waves) => `
vec3 gerstner(vec2 p, float dist, float amp, out vec3 n, out float pinch) {
  vec3 d = vec3(0.0);
  float txx = 0.0, tzz = 0.0, txz = 0.0, nx = 0.0, nz = 0.0;
${waves
  .map(
    (w) => `  {
    float fade = (1.0 - smoothstep(${(w.len * 8).toFixed(1)}, ${(w.len * 16).toFixed(1)}, dist)) * amp;
    float f = ${w.k.toFixed(5)} * (dot(vec2(${w.dx.toFixed(5)}, ${w.dz.toFixed(5)}), p) - ${w.c.toFixed(4)} * uTime);
    float s = sin(f), co = cos(f);
    float a = ${w.amp.toFixed(5)} * fade, st = ${w.steep.toFixed(4)} * fade;
    d += vec3(${w.dx.toFixed(5)} * a * co, a * s, ${w.dz.toFixed(5)} * a * co);
    txx += ${(w.dx * w.dx).toFixed(5)} * st * s;
    tzz += ${(w.dz * w.dz).toFixed(5)} * st * s;
    txz += ${(w.dx * w.dz).toFixed(5)} * st * s;
    nx += ${w.dx.toFixed(5)} * st * co;
    nz += ${w.dz.toFixed(5)} * st * co;
  }`,
  )
  .join('\n')}
  n = normalize(vec3(-nx, 1.0 - txx - tzz, -nz));
  pinch = (1.0 - txx) * (1.0 - tzz) - txz * txz;
  return d;
}
`;
