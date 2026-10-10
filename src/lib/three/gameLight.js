// The game's light, read for the site: what can be worked out from a level's
// records and probes without knowing the world it belongs to. Pure, so the
// numbers are pinned in tests; the scene wires them.
//
// siteLightFrom (the records to the site's sky, light, fog and exposure)
// joins this file once the VisualEnvironment records can be read and Hoth
// calibrated against them: its fields are not guessed ahead of the data.

// The cube map's faces in three.js's order and frame: for a texel at (u, v)
// in -1…1, u to the right and v down the image, the direction it looks.
const FACES = {
  px: (u, v) => [1, -v, -u],
  nx: (u, v) => [-1, -v, u],
  py: (u, v) => [u, 1, v],
  ny: (u, v) => [u, -1, -v],
  pz: (u, v) => [u, -v, 1],
  nz: (u, v) => [-u, -v, -1],
};

// The sun's direction from a probe when the level names no sun entity: the
// brightest texels, weighted by how bright, so a disc a few texels wide reads
// as its middle rather than one corner. faces: { px…nz: Float32Array RGB }.
export function sunFromProbe(faces, size) {
  let peak = 0;
  for (const k in FACES) {
    const f = faces[k];
    for (let i = 0; i < f.length; i += 3) peak = Math.max(peak, f[i] * 0.2126 + f[i + 1] * 0.7152 + f[i + 2] * 0.0722);
  }
  if (!(peak > 0)) return null;
  // the disc, not the sky round it: within a tenth of the brightest
  const floor = peak * 0.9;
  const d = [0, 0, 0];
  for (const k in FACES) {
    const f = faces[k];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 3;
        const lum = f[i] * 0.2126 + f[i + 1] * 0.7152 + f[i + 2] * 0.0722;
        if (lum < floor) continue;
        const dir = FACES[k]((2 * (x + 0.5)) / size - 1, (2 * (y + 0.5)) / size - 1);
        const len = Math.hypot(dir[0], dir[1], dir[2]);
        for (let c = 0; c < 3; c++) d[c] += (dir[c] / len) * lum;
      }
    }
  }
  const len = Math.hypot(d[0], d[1], d[2]);
  return len > 0 ? d.map((c) => c / len) : null;
}

// The spec's four sky states to the level's weather folders. The surface has
// no such states yet (weather.js draws particles), so whoever picks the state
// passes its name; anything else is a clear day.
const STATES = { clear: 'sunny', dusk: 'sunset', overcast: 'cloudy', storm: 'blizzard' };

// The entry a world is lit by for a state: the mapped weather, else sunny,
// else the only one it has; null for a world without a record, so the
// caller keeps the site's own light.
export function weatherEntry(light, state) {
  const w = light?.weathers;
  if (!w) return null;
  const pick = w[STATES[state]] ?? w.sunny ?? Object.values(w)[0];
  return pick ?? null;
}

// A grading LUT stored as a strip of slices: n slices of n × n laid side by
// side, either way round. Anything else is not a LUT the pass can take, and
// the grade falls back to brightness, contrast and saturation.
export function lutShape(width, height) {
  for (const n of [32, 16]) {
    if ((width === n * n && height === n) || (width === n && height === n * n)) return n;
  }
  return null;
}
