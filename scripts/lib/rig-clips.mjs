// The pure steps of packing a rig's own clips (the walkers', the droideka's:
// scripts/bf2017-rigclips.mjs), kept apart from the file handling so Node
// can test them without the drop.
//
// The game moves a figure by `AITrajectory`, the node above the hips, and
// turns it there too: in a walker's clip that node carries a constant quarter
// turn and everything under it is written in the turned frame, while at rest
// (the frame the mesh is bound in) the node is square and its children carry
// the turn themselves. The site moves and turns the figure itself, so the
// clip plays in place: the trajectory's turn (its first key) is folded into
// its children's channels and its own channels go, its travel kept as a
// number (metres a cycle) for the stride.

// a quaternion product, a × b ([x, y, z, w], three.js's order)
export const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];

// a point turned by a quaternion
export function qrot(q, p) {
  const [x, y, z, w] = q;
  const ix = w * p[0] + y * p[2] - z * p[1];
  const iy = w * p[1] + z * p[0] - x * p[2];
  const iz = w * p[2] + x * p[1] - y * p[0];
  const iw = -x * p[0] - y * p[1] - z * p[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
}

const slerp = (a, b, t) => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const s = d < 0 ? -1 : 1;
  d *= s;
  if (d > 0.9995) {
    const r = a.map((v, i) => v + (s * b[i] - v) * t);
    const n = Math.hypot(...r);
    return r.map((v) => v / n);
  }
  const th = Math.acos(d);
  const k0 = Math.sin((1 - t) * th) / Math.sin(th);
  const k1 = (s * Math.sin(t * th)) / Math.sin(th);
  return a.map((v, i) => v * k0 + b[i] * k1);
};

// a channel's values at `fps` from 0 to `end` (the end always a key): linear
// for positions, slerp for turns, the last value held past the channel's end
export function resample(times, values, size, fps, end) {
  const n = Math.max(1, Math.round(end * fps));
  const at = Array.from({ length: n + 1 }, (_, i) => Math.min(end, i / fps));
  const out = { times: [], values: [] };
  const key = (k) => Array.from(values.slice(k * size, k * size + size));
  let k = 0;
  for (const t of at) {
    while (k < times.length - 2 && times[k + 1] < t) k++;
    const k1 = Math.min(k + 1, times.length - 1);
    const t0 = times[k];
    const t1 = times[k1];
    const f = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0;
    const a = key(k);
    const b = key(k1);
    out.times.push(t);
    out.values.push(...(size === 4 ? slerp(a, b, f) : a.map((v, i) => v + (b[i] - v) * f)));
  }
  return out;
}

// whether a channel holds one value all through (within eps), and whether
// that value is `rest` (a turn and its negative are the same turn)
export function heldAt(values, size, eps = 1e-4) {
  for (let i = size; i < values.length; i++) if (Math.abs(values[i] - values[i % size]) > eps) return null;
  return Array.from(values.slice(0, size));
}
export function sameAs(v, rest, eps = 1e-4) {
  if (v.length !== rest.length) return false;
  const near = (s) => v.every((x, i) => Math.abs(x - s * rest[i]) <= eps);
  return near(1) || (v.length === 4 && near(-1));
}

// a child's channel of the trajectory, its turn `q` folded in: a rotation
// becomes q × r, a translation q applied to t
export function folded(path, values, q) {
  const size = path === 'rotation' ? 4 : 3;
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i += size) {
    const v = Array.from(values.slice(i, i + size));
    out.set(path === 'rotation' ? qmul(q, v) : path === 'translation' ? qrot(q, v) : v, i);
  }
  return out;
}

// the ground a clip covers, from its trajectory's translation keys: the
// straight-line distance from the first key to the last, in metres
export function travel(values) {
  if (!values || values.length < 6) return 0;
  const n = values.length;
  return Math.hypot(values[n - 3] - values[0], values[n - 1] - values[2]);
}

// what to do with one channel, given its rest: 'drop' (it never leaves its
// rest), 'hold' (one value all through: two keys), or 'keep'
export function channelFate(values, size, rest) {
  const held = heldAt(values, size);
  if (!held) return 'keep';
  return sameAs(held, rest) ? 'drop' : 'hold';
}
