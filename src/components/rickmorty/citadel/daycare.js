// Morty Day Care: the gate's been left open and six Mortys are loose on the
// concourse. They wander; come close and they run from you, so you herd
// them, from behind, back through the gate into the pen, where they stay.
// Get them all in before the clock runs out (the Day Care Rick looks up
// from his magazine), or they scatter and it starts again.

import { PEN, WORLD, inPen } from './layout';

// count, seconds on the clock, how close Rick scares them (m), how fast
// they run from him and wander about (m/s), and how big a Morty is
export const HERD = { count: 6, time: 75, scare: 4.5, flee: 3.1, wander: 0.9, radius: 0.35 };

const GATE = { x: PEN.gate.x, z: (PEN.gate.z0 + PEN.gate.z1) / 2 };
// a little way into the pen, past the gate: where the gate funnels them
const INSIDE = { x: PEN.gate.x - 3, z: GATE.z };
// the pen, less a Morty's width, to keep the penned ones in
const KEEP = { x0: PEN.x - PEN.w / 2 + 0.55, x1: PEN.x + PEN.w / 2 - 0.55, z0: PEN.z - PEN.d / 2 + 0.55, z1: PEN.z + PEN.d / 2 - 0.55 };

function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Where they start: round the gate, 6 to 14 m off, outside the pen and
// clear of its fence and of each other. (Clear of everything else is the
// caller's push: these spots are checked in daycare.test.js.)
const SPOTS_AROUND = (() => {
  const out = [];
  for (let a = -2.4; a <= 2.4; a += 0.16) {
    for (const d of [7, 9, 11, 13]) {
      const x = GATE.x + Math.cos(a) * d;
      const z = GATE.z + Math.sin(a) * d;
      const nearPen = x < KEEP.x1 + 1.6 && x > KEEP.x0 - 1.6 && z < KEEP.z1 + 1.6 && z > KEEP.z0 - 1.6;
      if (!nearPen) out.push([x, z]);
    }
  }
  return out;
})();
// (kept clear of the desk, the planter and the kiosk on that side)
const BLOCKED = [
  [-15, -9, 2.2],
  [-13, -13, 2.2],
  [-10, 14, 2.6],
];
const free = ([x, z]) => BLOCKED.every(([bx, bz, r]) => Math.hypot(x - bx, z - bz) > r);

export function newHerd(seed = 1) {
  const r = rng(seed);
  const pool = SPOTS_AROUND.filter(free);
  const mortys = [];
  while (mortys.length < HERD.count) {
    const [x, z] = pool[Math.floor(r() * pool.length)];
    if (mortys.some((m) => Math.hypot(m.x - x, m.z - z) < 2.5)) continue;
    const face = r() * Math.PI * 2;
    mortys.push({ id: mortys.length, x, z, face, speed: 0, penned: false, scared: false, drift: r() * 2 - 1, slide: null });
  }
  return { mortys, t: 0, state: 'loose', penned: 0, seed: seed + 1 };
}

const turnTo = (face, want, k) => {
  let d = want - face;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return face + d * Math.min(1, k);
};
// a heading as the walker has it: +x is (cos, -sin)
const dirOf = (face) => [Math.cos(face), -Math.sin(face)];
const faceOf = (dx, dz) => Math.atan2(-dz, dx);

// keep a point on the concourse
function rim(x, z) {
  const max = WORLD.radius - HERD.radius;
  const r = Math.hypot(x, z);
  return r > max ? [(x * max) / r, (z * max) / r] : [x, z];
}

// One step. rick: { x, z }. push(x, z, r): out of everything, as the
// walker does it. Returns what happened: a Morty penned, all in, or out
// of time.
export function stepHerd(herd, rick, dt, { push }) {
  const events = [];
  if (herd.state === 'loose') herd.t += dt;
  for (const m of herd.mortys) {
    if (m.penned) {
      stepPenned(m, dt);
      continue;
    }
    const dx = m.x - rick.x;
    const dz = m.z - rick.z;
    const d = Math.hypot(dx, dz);
    m.scared = herd.state === 'loose' && d < HERD.scare;
    let speed;
    if (m.slide && m.scared) {
      // sliding along whatever it ran into, for a moment
      m.slide.t -= dt;
      m.face = turnTo(m.face, m.slide.face, dt * 10);
      speed = HERD.flee;
      if (m.slide.t <= 0) m.slide = null;
    } else if (m.scared) {
      let want = faceOf(dx, dz);
      // near the gate and running its way: through it
      const gx = INSIDE.x - m.x;
      const gz = INSIDE.z - m.z;
      const gd = Math.hypot(gx, gz);
      if (Math.hypot(m.x - GATE.x, m.z - GATE.z) < 5 && (dx * gx + dz * gz) / (d * gd || 1) > 0.3) want = faceOf(gx, gz);
      m.face = turnTo(m.face, want, dt * 9);
      speed = HERD.flee;
    } else {
      // wandering: a heading that drifts, back toward the gate if it's gone far
      m.slide = null;
      m.drift += (Math.sin(herd.t * 0.7 + m.id * 1.9) - m.drift * 0.2) * dt;
      let want = m.face + m.drift * dt * 1.4;
      if (Math.hypot(m.x - GATE.x, m.z - GATE.z) > 16) want = faceOf(GATE.x - m.x, GATE.z - m.z);
      m.face = turnTo(m.face, want, dt * 2);
      speed = HERD.wander;
    }
    const [ux, uz] = dirOf(m.face);
    const step = speed * dt;
    let [x, z] = push(m.x + ux * step, m.z + uz * step, HERD.radius);
    [x, z] = rim(x, z);
    const moved = Math.hypot(x - m.x, z - m.z);
    if (moved < step * 0.5 && !m.slide) {
      // in the way: turn along it, the side that's more open
      const sides = [m.face + Math.PI / 2, m.face - Math.PI / 2].map((f) => {
        const [sx, sz] = dirOf(f);
        const [px, pz] = rim(...push(m.x + sx * 0.6, m.z + sz * 0.6, HERD.radius));
        return { f, room: Math.hypot(px - m.x, pz - m.z) - Math.hypot(px - rick.x, pz - rick.z) * 0.01 + (m.id % 2) * 1e-3 };
      });
      const best = sides[0].room >= sides[1].room ? sides[0] : sides[1];
      // running: slide along it for a moment; wandering: just turn away
      if (m.scared) m.slide = { face: best.f, t: 0.7 };
      else m.face = best.f;
    }
    m.speed = moved / Math.max(dt, 1e-6);
    m.x = x;
    m.z = z;
    if (inPen(m.x, m.z)) {
      m.penned = true;
      m.slide = null;
      m.scared = false;
      herd.penned += 1;
      if (herd.state === 'loose') events.push({ type: 'penned', id: m.id });
    }
  }
  if (herd.state === 'loose') {
    if (herd.mortys.every((m) => m.penned)) {
      herd.state = 'won';
      events.push({ type: 'won' });
    } else if (herd.t >= HERD.time) {
      herd.state = 'out';
      events.push({ type: 'out' });
    }
  }
  return events;
}

// in the pen: pottering about, kept off the fence
function stepPenned(m, dt) {
  m.drift += (Math.sin(m.id * 2.3 + m.x * 0.7) * 0.6 - m.drift * 0.3) * dt;
  m.face += m.drift * dt;
  const [ux, uz] = dirOf(m.face);
  const s = HERD.wander * 0.6 * dt;
  let x = m.x + ux * s;
  let z = m.z + uz * s;
  if (x < KEEP.x0 || x > KEEP.x1 || z < KEEP.z0 || z > KEEP.z1) {
    // turn back in, toward the middle of the pen
    m.face = turnTo(m.face, faceOf(PEN.x - m.x, PEN.z - m.z), 1);
    x = Math.min(KEEP.x1, Math.max(KEEP.x0, x));
    z = Math.min(KEEP.z1, Math.max(KEEP.z0, z));
  }
  m.speed = Math.hypot(x - m.x, z - m.z) / Math.max(dt, 1e-6);
  m.x = x;
  m.z = z;
}
