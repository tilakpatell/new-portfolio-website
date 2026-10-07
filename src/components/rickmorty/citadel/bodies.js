// How the Citadel's people show what they're doing: the small rules
// between a brain's step and a figure's animator, for ./people.js and
// ./townsfolk.js (and ./crowd.js's promoted few). A figure regards someone
// with its head first and turns its body only when they're well round
// (past 70°), by time; a Cop Rick's watch (../../middleearth/towns/
// watchers.js, which the Citadel shares with Middle-earth and so doesn't
// change) is read as body.js reads any brain's step, through the Citadel's
// own table of what each of his modes looks like; a drawn figure walks to
// where its rules put it, instead of appearing there; the dozen nearest of
// a still crowd are picked with a margin, so the edge of the dozen doesn't
// flicker; a rally cheers on beats of seeded lengths. Pure: no three.js.
//
//   yawOf(face): a walker's heading (+x turned to (cos face, −sin face), the
//     towns' way) as a figure's turn and body.js's yaw (0 along +z, toward +x)
//   easeTurn(yaw, want, dt, rate, max) → yaw: gait.js's turn, no faster than max rad/s
//   regard(yaw, want, dt, st, { limit, settle, rate, max }) → yaw: the body
//     turned toward `want` only once it's more than `limit` round, then
//     until it's within `settle`, eased at `rate` (gait.js's turn); st: the
//     figure's own ({ turning })
//   COP_BODY: body.js's MODE_BODY with the watchers' modes (patrol, alert,
//     caught, back) in it; copStep(w, rick) → the step body.js reads
//   moveFor(speed, { walk, jog, run }) → locomotion's move for a pace (m/s)
//   stepBody(prev, next, dt, opts): bodyFrom, a jump further than JUMP read
//     as a standing start (a figure put somewhere, not walked there)
//   lookAt(f, p): a figure's head on p ({ x, y?, z }, or null), asked again
//     only once p has moved on
//   lookAhead(x, z, yaw, off, dist) → { x, z }: a point `off` round from ahead
//   scanLook(x, z, yaw, t, seed) → { x, z }: a searcher's head, sweeping its cone
//   catchUp(vis, to, dt, { speed, near, snap, push }): vis ({ x, z, face, speed })
//     walked toward `to` at `speed`, kept out of things by push(x, z) → [x, z];
//     with it once it's within `near` (a step of its rules'); put there past `snap`
//   nearestN(points, at, n, current, { margin, ok }) → indices
//   createBeats({ seed, every: [lo, hi] }) → { tick(t, on) → true on a beat }
//   sayFor(line) → seconds a line takes to say (its talk's length)

import { MODE_BODY, bodyFrom } from '../../../lib/ai/body';
import { turn } from '../../../lib/three/gait';
import { seeded } from '../../../lib/seeded';

export const yawOf = (face) => face + Math.PI / 2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ── regarding someone ──
// (a body turned on the spot goes round no faster than `max` radians a
// second, so its feet, which don't step, barely move under it)
export const REGARD = { limit: (70 * Math.PI) / 180, settle: 0.3, rate: 4, max: 1.4 };
export function easeTurn(yaw, want, dt, rate = REGARD.rate, max = REGARD.max) {
  const next = turn(yaw, want, dt, rate);
  const step = max * (dt > 0 ? Math.min(dt, 0.1) : 0);
  const d = wrap(next - yaw);
  return Math.abs(d) <= step ? next : yaw + Math.sign(d) * step;
}
export function regard(yaw, want, dt, st, { limit = REGARD.limit, settle = REGARD.settle, rate = REGARD.rate, max = REGARD.max } = {}) {
  if (!Number.isFinite(want)) return yaw;
  const d = Math.abs(wrap(want - yaw));
  if (d > limit) st.turning = true;
  else if (d < settle) st.turning = false;
  return st.turning ? easeTurn(yaw, want, dt, rate, max) : yaw;
}

// ── a Cop Rick's watch ──
// What each of the watchers' modes looks like (the rest are body.js's own:
// suspicious stares at where it heard you, chase at its belief of you,
// search sweeps the head). Seen, he turns on you before he runs; caught,
// he's on you; back to his round, he walks it.
export const COP_BODY = { ...MODE_BODY, patrol: {}, alert: { look: 'belief' }, caught: { look: 'belief' }, back: {} };

export function copStep(w, rick) {
  const yaw = yawOf(w.face);
  const step = { x: w.x, z: w.z, yaw, mode: w.mode };
  if (w.mode === 'suspicious' && w.at) step.belief = { x: w.at[0], z: w.at[1] };
  else if (w.mode === 'alert' || w.mode === 'chase' || w.mode === 'caught') {
    const b = w.me?.beliefs?.you?.at;
    step.belief = b && w.mode === 'chase' ? { x: b.x, z: b.z } : { x: rick.x, z: rick.z };
  }
  // looking about at a corner, or where it's off to look: the head, not the body
  if (w.look) step.look = lookAhead(w.x, w.z, yaw, w.look);
  return step;
}

// locomotion.js's `move` (0…1: its idle, walk and run weighed from it) for
// a pace in metres a second: a whole walk by `walk`, the walk going over
// into the run from `jog`, a whole run by `run`, so a stroller's feet are
// all walk and a chaser's all run (the stride's paced to the ground either way)
export function moveFor(speed, { walk = 0.9, jog = 3, run = 5 } = {}) {
  const s = Math.abs(Number.isFinite(speed) ? speed : 0);
  if (s <= walk) return (0.3 * s) / walk;
  if (s <= jog) return 0.3 + (0.25 * (s - walk)) / (jog - walk);
  return Math.min(1, 0.55 + (0.35 * (s - jog)) / (run - jog));
}

const JUMP = 2.5; // metres in a step: put there, not walked
export function stepBody(prev, next, dt, opts) {
  const jumped = prev && next && Math.hypot(next.x - prev.x, next.z - prev.z) > JUMP;
  return bodyFrom(jumped ? null : prev, next, dt, opts);
}

// ── where a head looks ──
export const lookAhead = (x, z, yaw, off = 0, dist = 6) => ({ x: x + Math.sin(yaw + off) * dist, z: z + Math.cos(yaw + off) * dist });

export function scanLook(x, z, yaw, t, seed = 0) {
  const r = seeded(seed);
  const rate = 1.1 + r() * 0.5;
  const a = Math.sin(t * rate + r() * Math.PI * 2);
  // (a little longer at either end of the sweep, as a head stops to look)
  return lookAhead(x, z, yaw, 0.95 * Math.sign(a) * Math.pow(Math.abs(a), 0.7));
}

// A head's target, set on the figure only when it's moved on (a figure's
// look() puts back a reaction's glance, so it isn't asked every frame for
// the same thing): f.lookAt keeps the last
export function lookAt(f, p) {
  const last = f.lookAt ?? null;
  if (!p) {
    if (last) f.look?.(null);
    f.lookAt = null;
    return;
  }
  const y = Number.isFinite(p.y) ? p.y : null;
  if (last && (last.y == null) === (y == null) && Math.abs(last.x - p.x) + Math.abs(last.z - p.z) + Math.abs((last.y ?? 0) - (y ?? 0)) < 0.25) return;
  f.lookAt = y == null ? { x: p.x, z: p.z } : { x: p.x, y, z: p.z };
  f.look?.(f.lookAt);
}

// ── a drawn figure after its rules ──
export function catchUp(vis, to, dt, { speed = 1.5, near = 0.3, snap = 40, push = null } = {}) {
  const dx = to.x - vis.x;
  const dz = to.z - vis.z;
  const d = Math.hypot(dx, dz);
  if (d > snap || !(dt > 0)) {
    if (d > snap) {
      vis.x = to.x;
      vis.z = to.z;
    }
    vis.speed = 0;
    return vis;
  }
  if (d < 1e-6) {
    vis.speed = 0;
    return vis;
  }
  // (within `near`, a step of its rules': with it, at its pace)
  const step = d <= near ? d : Math.min(d, speed * dt);
  let x = vis.x + (dx / d) * step;
  let z = vis.z + (dz / d) * step;
  if (push && step < d) [x, z] = push(x, z);
  vis.speed = Math.hypot(x - vis.x, z - vis.z) / dt;
  vis.face = Math.atan2(-dz, dx);
  vis.x = x;
  vis.z = z;
  return vis;
}

// ── the nearest few ──
export function nearestN(points, at, n, current = [], { margin = 1.5, ok = () => true } = {}) {
  const dist = (i) => Math.hypot(points[i].x - at.x, points[i].z - at.z);
  const had = new Set(current);
  const all = [];
  for (let i = 0; i < points.length; i++) if (ok(points[i], i)) all.push({ i, d: dist(i) - (had.has(i) ? margin : 0) });
  all.sort((a, b) => a.d - b.d || a.i - b.i);
  return all.slice(0, Math.max(0, n)).map((e) => e.i);
}

// ── a rally's beats ──
export function createBeats({ seed = 1, every = [7, 14] } = {}) {
  const r = seeded(seed);
  const [lo, hi] = every;
  let next = null;
  return {
    tick(t, on = true) {
      if (!on) {
        next = null;
        return false;
      }
      if (next == null) next = t + lo + (hi - lo) * r();
      if (t < next) return false;
      next = t + lo + (hi - lo) * r();
      return true;
    },
  };
}

// ── a line said ──
export function sayFor(line) {
  const words = String(line ?? '').split(/\s+/).filter(Boolean).length;
  return Math.min(6, Math.max(1.6, words / 2.6));
}
