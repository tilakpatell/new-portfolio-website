// How an enemy shoots: as a person would, not a turret. The scatter grows
// with range and while they move; the first volley at a fresh target goes
// wide on purpose (the telegraph: you hear it go by and have time to act);
// after two hits in a row the next is thrown wide once, so a run of bad luck
// never kills you outright; and they lead a moving target, because a bolt
// takes a third of a second to cross a street and a sidestep shouldn't
// always be enough.
//
// spread(range, { base, perMetre, moving, suppressed, first }) → radians;
// scatter(dir, rad, rng, min = 0) → a unit direction within rad of dir (and
// at least min off it); freshAim() → s, shotStep(s, { hit }) → s' with
// s = { streak, fresh, wide }; missBy(range, girth) → the least angle that
// misses a body that wide at that range; lead(target, vel, from, speed) →
// where to aim. Pure: plain [x, y, z] arrays.
//
// lead() is the shared aim's (lib/combat/aim.js), re-exported: one
// implementation, and fight.js, hostiles.js and foot.js keep their import.

export const FIRST = 2.5; // the first volley at a fresh target
export const MOVING = 1.6; // while the shooter walks

export function spread(range, { base = 0.02, perMetre = 0.0012, moving = false, suppressed = 1, first = false } = {}) {
  return (base + perMetre * Math.max(0, range)) * (moving ? MOVING : 1) * suppressed * (first ? FIRST : 1);
}

// A direction inside the cone of half-angle rad round dir, even over the
// cone's disc (so most shots land near the middle's width, not its centre).
export function scatter(dir, rad, rng = Math.random, min = 0) {
  const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const d = [dir[0] / len, dir[1] / len, dir[2] / len];
  // two directions square to d
  const up = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let u = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]];
  const ul = Math.hypot(u[0], u[1], u[2]);
  u = [u[0] / ul, u[1] / ul, u[2] / ul];
  const v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
  const lo = Math.min(min, rad);
  const th = Math.sqrt(lo * lo + rng() * (rad * rad - lo * lo));
  const ph = rng() * Math.PI * 2;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const cp = Math.cos(ph) * s;
  const sp = Math.sin(ph) * s;
  return [d[0] * c + u[0] * cp + v[0] * sp, d[1] * c + u[1] * cp + v[1] * sp, d[2] * c + u[2] * cp + v[2] * sp];
}

export function freshAim() {
  return { streak: 0, fresh: true, wide: false };
}

// After a shot: two hits in a row and the next goes wide, once.
export function shotStep(s, { hit }) {
  const streak = hit ? (s?.streak ?? 0) + 1 : 0;
  return streak >= 2 ? { streak: 0, fresh: false, wide: true } : { streak, fresh: false, wide: false };
}

// The least angle off that misses a body `girth` across at `range` (with a
// little to spare, so a wide shot is heard going by, not felt).
export function missBy(range, girth = 0.6) {
  return Math.atan((girth * 1.2) / Math.max(1, range));
}

// Where to aim so a bolt at `speed` from `from` meets a mover: the shared
// aim's (./aim.js), here too so the enemies' callers keep their import.
export { lead } from './aim.js';
