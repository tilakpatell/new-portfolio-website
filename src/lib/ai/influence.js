// The battlefield as a grid (Dave Mark's modular tactical influence
// maps): each agent stamps a template of its influence, proximity (where
// it could be in a second: a linear falloff) or threat (what it could hit:
// flat most of the way and falling at the end, 1 − (d/R)^4), scaled by its
// strength; stamps add, so where two overlap is worth more than either; the
// map is cleared and restamped every half-second or so, not every frame. A
// working map round one agent assembles layers ("the enemy's threat, less
// half the allies' presence, times my interest") and answers where the
// highest or lowest point is. Pure.
//
//   createInfluence({ cell, w, h, origin }) → map; clear(map)
//   stamp(map, at, r, strength, shape: 'linear' | 'threat'); at(map, x, z) → number
//   working(map, centre, r) → { add(other, k), multiply(other, k), normalise(), invert(), highest(), lowest(), at(x, z) }

const templates = new Map();
function template(cells, shape) {
  const key = `${cells}:${shape}`;
  if (templates.has(key)) return templates.get(key);
  const n = cells * 2 + 1;
  const t = new Float32Array(n * n);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(i - cells, j - cells) / Math.max(1e-6, cells);
      t[j * n + i] = d >= 1 ? 0 : shape === 'threat' ? 1 - Math.pow(d, 4) : 1 - d;
    }
  templates.set(key, { n, cells, t });
  return templates.get(key);
}

export function createInfluence({ cell = 2, w = 32, h = 32, origin = { x: 0, z: 0 } } = {}) {
  return { cell, w, h, origin, data: new Float32Array(w * h) };
}
export const clear = (map) => map.data.fill(0);
const cellOf = (map, x, z) => [Math.round((x - map.origin.x) / map.cell), Math.round((z - map.origin.z) / map.cell)];

export function stamp(map, at, r, strength = 1, shape = 'linear') {
  const cells = Math.max(1, Math.round(r / map.cell));
  const { n, t } = template(cells, shape);
  const [ci, cj] = cellOf(map, at.x, at.z);
  for (let j = 0; j < n; j++) {
    const mj = cj + j - cells;
    if (mj < 0 || mj >= map.h) continue;
    for (let i = 0; i < n; i++) {
      const mi = ci + i - cells;
      if (mi < 0 || mi >= map.w) continue;
      map.data[mj * map.w + mi] += t[j * n + i] * strength;
    }
  }
}

export function at(map, x, z) {
  const [i, j] = cellOf(map, x, z);
  if (i < 0 || j < 0 || i >= map.w || j >= map.h) return 0;
  return map.data[j * map.w + i];
}

export function working(map, centre, r) {
  const cells = Math.max(1, Math.round(r / map.cell));
  const [ci, cj] = cellOf(map, centre.x, centre.z);
  const n = cells * 2 + 1;
  const data = new Float32Array(n * n);
  const world = (i, j) => ({ x: map.origin.x + (ci + i - cells) * map.cell, z: map.origin.z + (cj + j - cells) * map.cell });
  const each = (fn) => {
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) data[j * n + i] = fn(data[j * n + i], world(i, j), i, j);
  };
  const w = {
    data,
    n,
    add(other, k = 1) {
      each((v, p) => v + at(other, p.x, p.z) * k);
      return w;
    },
    multiply(other, k = 1) {
      each((v, p) => v * at(other, p.x, p.z) * k);
      return w;
    },
    // a template of interest round the centre (1 here, 0 at the edge)
    interest(shape = 'linear') {
      const { t } = template(cells, shape);
      each((v, p, i, j) => v * t[j * n + i]);
      return w;
    },
    normalise() {
      let lo = Infinity;
      let hi = -Infinity;
      for (const v of data) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      each((v) => (hi === lo ? 0 : (v - lo) / (hi - lo)));
      return w;
    },
    invert() {
      each((v) => 1 - v);
      return w;
    },
    highest() {
      let best = 0;
      for (let k = 1; k < data.length; k++) if (data[k] > data[best]) best = k;
      return { ...world(best % n, Math.floor(best / n)), v: data[best] };
    },
    lowest() {
      let best = 0;
      for (let k = 1; k < data.length; k++) if (data[k] < data[best]) best = k;
      return { ...world(best % n, Math.floor(best / n)), v: data[best] };
    },
    at(x, z) {
      const i = Math.round((x - map.origin.x) / map.cell) - ci + cells;
      const j = Math.round((z - map.origin.z) / map.cell) - cj + cells;
      return i < 0 || j < 0 || i >= n || j >= n ? 0 : data[j * n + i];
    },
  };
  return w;
}
