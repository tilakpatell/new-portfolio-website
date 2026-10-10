// The leaves on the ground, Bruno Simon's (folio-2025's Leaves.js: research
// note Part 2 §4), as numbers only: no three.js here, so it's tested in
// Node and drawn by whoever holds it (universe/landings/litter.js). His
// runs at a scaled 1/30 s frame; here a step is as long as our own frame,
// his per-frame pushes kept as they were per his frame (and a hitch is
// stepped as one of his frames, never more).
//
// Each leaf has a weight (0.1 to 0.2). A gust lets it go where the wind's
// slow noise is below the wind's strength (his gate), and it skates along
// the ground the wind's way, lifted a little by its own speed near the
// ground (his lift is set, not added: a leaf skating fast rises, one
// slowing settles), damped, and falling by its weight. Anyone walking by
// within 0.7 m kicks it along their way and out to the side, by how fast
// they go (a stroll slides it, a run sends it up); not someone in the air.
// A blast (a shot into the ground, a ship setting down) throws it out from
// the middle. Beyond him: a leaf off the ground swings as it falls, and a
// leaf at rest sleeps (looked at a frame in four, by the gate) until
// something wakes it. A crown sheds now and then, and a bolt through one
// shakes a few loose: each taken from the faded ring at the edge of the
// box, where it won't be missed.
//
// Everything is in metres on a flat chart, y up off the ground, wrapped
// round the focus (`half` each way), so the leaves are always about you.
//
//   makeLeafSim(max) → sim; layLeaves(sim, count, { half, focus, rand, clump, accent })
//   stepLeafSim(sim, dt, { focus, half, wind: { strength, dir: [x, z], gate(x, z) } | null,
//     walkers: [{ x, z, y, vx, vz }] })
//   wrapLeaves(sim, focus, half)                    kept round the focus, nothing moved
//   blastLeaves(sim, x, z, r, strength, rand) → how many it threw
//   shedLeaf(sim, crown, { focus, half, rand }) → the leaf it put up there, or −1
//   shakeLeaves(sim, x, y, z, dirX, dirZ, n, { focus, half, rand }) → how many
//   weatherWind(clock, base)                        the strength, rising and falling
//
// sim.p is 4 a leaf (x, y, z, its colour: 0…1 between two, 2 the accent),
// sim.seed 4 a leaf (its turn, its size 0.5…1, its two tilts ±1): both laid
// out for a shader to read as they are.

export const LEAF = {
  tick: 1 / 30, // his scaled frame (a push per frame is a push per this)
  timeScale: 1, // (2 would match the pace his go at on screen)
  weight: [0.1, 0.2],
  wind: { frequency: 0.005, multiplier: 0.5 }, // his gate
  lift: { cap: 2.5, top: 6 }, // his lift, set (2 his cap: 2.5 so a heavy leaf still lifts)
  damping: 1.5,
  gravity: 9.807, // (a fall speed, by the weight: his)
  floor: 0.02,
  // walking by: within `near`…`far` m (and `feet` above their soles),
  // along their way and out from it, by how fast (`run` the full kick),
  // from `slowest`; nobody off the ground by more than `airborne`
  kick: { near: 0.15, far: 0.7, feet: 0.1, along: 100, sideways: 20, gain: 0.25, run: 6, power: 0.75, slowest: 0.3, airborne: 0.3 },
  blast: { strength: 20, inner: 0.5, peak: 0.2 }, // his explode, the inside held at its 0.5 r speed
  swing: { accel: 2.4, rate: 2.6, above: 0.1 }, // a falling leaf's sway
  rest: { speed: 0.05, every: 4 },
  init: { noise: 0.02, shift: 15 }, // his clumps
  shedRing: 0.9, // (a leaf moved only from the faded edge, as a share of half)
};

export const remapClamp = (v, a, b, c, d) => {
  let t = (v - a) / (b - a);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return c + (d - c) * t;
};

// The wind's strength over time, round `base` (his weather's: three slow
// sines, never quite still, never past a gale)
export const weatherWind = (clock, base = 0.45) => {
  const c = clock * 0.05;
  return Math.min(1, Math.max(0.1, base * (1 + 0.5 * Math.sin(c) * Math.sin(1.678 * c) * Math.sin(2.345 * c))));
};

const wrap = (v, c, h) => c + ((((v - c + h) % (2 * h)) + 2 * h) % (2 * h)) - h;

export function makeLeafSim(max) {
  return { max, count: 0, p: new Float32Array(4 * max), v: new Float32Array(3 * max), w: new Float32Array(max), rest: new Uint8Array(max), seed: new Float32Array(4 * max), t: 0, frame: 0, cursor: 0 };
}

// `count` leaves at rest on the ground round the focus, in his clumps
// (`clump(u, v)`, a noise about nought, shifting them along x), `accent`
// of them the third colour
export function layLeaves(s, count, { half, focus = { x: 0, z: 0 }, rand, clump = null, accent = 0.15 }) {
  s.count = Math.min(count, s.max);
  s.t = 0;
  s.frame = 0;
  s.cursor = 0;
  for (let i = 0; i < s.count; i++) {
    let x = (rand() - 0.5) * 2 * half;
    const z = (rand() - 0.5) * 2 * half;
    if (clump) x += clump(x * LEAF.init.noise, z * LEAF.init.noise) * LEAF.init.shift;
    s.p[4 * i] = wrap(focus.x + x, focus.x, half);
    s.p[4 * i + 1] = LEAF.floor;
    s.p[4 * i + 2] = wrap(focus.z + z, focus.z, half);
    s.p[4 * i + 3] = rand() < accent ? 2 : rand();
    s.v[3 * i] = s.v[3 * i + 1] = s.v[3 * i + 2] = 0;
    s.w[i] = LEAF.weight[0] + (LEAF.weight[1] - LEAF.weight[0]) * rand();
    s.rest[i] = 1;
    s.seed[4 * i] = rand() * Math.PI * 2;
    s.seed[4 * i + 1] = 0.5 + 0.5 * rand();
    s.seed[4 * i + 2] = (rand() - 0.5) * 2;
    s.seed[4 * i + 3] = (rand() - 0.5) * 2;
  }
  return s;
}

export function wrapLeaves(s, focus, half) {
  for (let i = 0; i < s.count; i++) {
    s.p[4 * i] = wrap(s.p[4 * i], focus.x, half);
    s.p[4 * i + 2] = wrap(s.p[4 * i + 2], focus.z, half);
  }
}

export function stepLeafSim(s, dt, { focus, half, wind = null, walkers = [] }) {
  if (!(dt > 0)) return;
  const d = Math.min(dt, LEAF.tick) * LEAF.timeScale;
  s.t += d;
  s.frame += 1;
  const K = LEAF.kick;
  const S = wind?.strength ?? 0;
  for (let i = 0; i < s.count; i++) {
    const o = 4 * i;
    const q = 3 * i;
    let x = s.p[o];
    let y = s.p[o + 1];
    let z = s.p[o + 2];
    let vx = s.v[q];
    let vy = s.v[q + 1];
    let vz = s.v[q + 2];
    const w = s.w[i];
    let woke = false;
    // kicked by anyone walking by (each test fails on a NaN: a walker with
    // anything not a number in it is passed over)
    for (const k of walkers) {
      const dx = x - k.x;
      const dz = z - k.z;
      if (!(Math.abs(dx) <= K.far && Math.abs(dz) <= K.far && k.y <= K.airborne)) continue;
      const sp = Math.hypot(k.vx, k.vz);
      if (!(sp >= K.slowest)) continue;
      const m = remapClamp(Math.hypot(dx, y - k.y - K.feet, dz), K.near, K.far, 1, 0);
      if (!(m > 0)) continue;
      const h = Math.hypot(dx, dz) || 1;
      const g = m * K.gain * Math.min(1, sp / K.run) ** K.power * d;
      vx += (k.vx * sp * K.along * LEAF.tick + (dx / h) * K.sideways * sp) * g;
      vz += (k.vz * sp * K.along * LEAF.tick + (dz / h) * K.sideways * sp) * g;
      woke = true;
    }
    // (asleep: only kept round the focus, and the gate looked at a frame in four)
    if (s.rest[i] && !woke && (i + s.frame) % LEAF.rest.every !== 0) {
      s.p[o] = wrap(x, focus.x, half);
      s.p[o + 2] = wrap(z, focus.z, half);
      continue;
    }
    const gw = wind ? Math.max(0, (S - wind.gate(x, z)) * w * LEAF.wind.multiplier) / LEAF.tick : 0;
    if (s.rest[i] && !woke && !(gw > 0)) {
      s.p[o] = wrap(x, focus.x, half);
      s.p[o + 2] = wrap(z, focus.z, half);
      continue;
    }
    s.rest[i] = 0;
    if (gw > 0) {
      vx += wind.dir[0] * gw * d;
      vz += wind.dir[1] * gw * d;
    }
    // off the ground, it swings as it falls
    if (y > LEAF.floor + LEAF.swing.above) {
      const a = Math.sin(s.t * LEAF.swing.rate + s.seed[o + 2] * 3) * LEAF.swing.accel * d;
      vx += Math.cos(s.seed[o]) * a;
      vz += Math.sin(s.seed[o]) * a;
    }
    vy = Math.min(Math.hypot(vx, vz), LEAF.lift.cap) * remapClamp(y, 0, LEAF.lift.top, 1, 0);
    const keep = Math.max(0, 1 - LEAF.damping * d);
    vx *= keep;
    vy *= keep;
    vz *= keep;
    vy -= LEAF.gravity * w;
    x += vx * d;
    y += vy * d;
    z += vz * d;
    if (y < LEAF.floor) y = LEAF.floor;
    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) && Number.isFinite(vx) && Number.isFinite(vz))) {
      x = focus.x;
      y = LEAF.floor;
      z = focus.z;
      vx = vy = vz = 0;
      woke = false;
    }
    // (down and slow: asleep, but never one kicked this frame, which a
    // stroll past sends off slower than this)
    if (!woke && y <= LEAF.floor + 1e-4 && vx * vx + vz * vz < LEAF.rest.speed ** 2 && !(gw > 0)) {
      vx = vy = vz = 0;
      s.rest[i] = 1;
    }
    s.p[o] = wrap(x, focus.x, half);
    s.p[o + 1] = y;
    s.p[o + 2] = wrap(z, focus.z, half);
    s.v[q] = vx;
    s.v[q + 1] = vy;
    s.v[q + 2] = vz;
  }
}

// thrown out from (x, z) within r: his explode, as fast as `strength` at
// most, the inside half all at its edge's speed
export function blastLeaves(s, bx, bz, r, strength = LEAF.blast.strength, rand = Math.random) {
  if (!(r > 0) || !Number.isFinite(bx) || !Number.isFinite(bz) || !Number.isFinite(strength)) return 0;
  const B = LEAF.blast;
  let n = 0;
  for (let i = 0; i < s.count; i++) {
    const dx = s.p[4 * i] - bx;
    const dz = s.p[4 * i + 2] - bz;
    const dd = Math.hypot(dx, dz);
    if (dd > r) continue;
    const sp = Math.max(dd, B.inner * r) * remapClamp(dd, B.inner * r, r, B.peak, 0) * strength * (0.8 + 0.4 * rand());
    const a = dd > 1e-3 ? Math.atan2(dz, dx) : rand() * Math.PI * 2;
    s.v[3 * i] += Math.cos(a) * sp;
    s.v[3 * i + 2] += Math.sin(a) * sp;
    s.rest[i] = 0;
    n += 1;
  }
  return n;
}

// the next leaf lying in the faded ring at the box's edge (−1: none, of the
// next 32 looked at)
const fromRing = (s, focus, half) => {
  for (let tries = 0; tries < Math.min(32, s.count); tries++) {
    const i = s.cursor;
    s.cursor = (s.cursor + 1) % s.count;
    if (s.p[4 * i + 1] > LEAF.floor + 0.01) continue;
    if (Math.max(Math.abs(s.p[4 * i] - focus.x), Math.abs(s.p[4 * i + 2] - focus.z)) < LEAF.shedRing * half) continue;
    return i;
  }
  return -1;
};

// a leaf let go from a crown ({ x, z, r, lo, hi }, metres): somewhere in it
// (within 0.8 of its reach, a fifth to four fifths of the way up), still
export function shedLeaf(s, crown, { focus, half, rand }) {
  const i = fromRing(s, focus, half);
  if (i < 0) return -1;
  const a = rand() * Math.PI * 2;
  const rr = Math.sqrt(rand()) * 0.8 * crown.r;
  s.p[4 * i] = crown.x + Math.cos(a) * rr;
  s.p[4 * i + 2] = crown.z + Math.sin(a) * rr;
  s.p[4 * i + 1] = crown.lo + (crown.hi - crown.lo) * (0.2 + 0.6 * rand());
  s.v[3 * i] = s.v[3 * i + 1] = s.v[3 * i + 2] = 0;
  s.rest[i] = 0;
  return i;
}

// up to n leaves shaken loose at (x, y, z) (a bolt through a crown), sent
// the bolt's way ((dirX, dirZ), a unit) at 0.5 to 2.5 m/s
export function shakeLeaves(s, x, y, z, dirX, dirZ, n, { focus, half, rand }) {
  if (![x, y, z, dirX, dirZ].every(Number.isFinite)) return 0;
  let moved = 0;
  for (; moved < n; moved++) {
    const i = fromRing(s, focus, half);
    if (i < 0) break;
    s.p[4 * i] = x + (rand() - 0.5) * 0.8;
    s.p[4 * i + 1] = Math.max(LEAF.floor, y + (rand() - 0.5) * 0.8);
    s.p[4 * i + 2] = z + (rand() - 0.5) * 0.8;
    const sp = 1.5 + (rand() - 0.5) * 2;
    s.v[3 * i] = dirX * sp;
    s.v[3 * i + 1] = 0;
    s.v[3 * i + 2] = dirZ * sp;
    s.rest[i] = 0;
  }
  return moved;
}
