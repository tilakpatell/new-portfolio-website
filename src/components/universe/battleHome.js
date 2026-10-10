// Where a pilot comes back into a battle after a death: on their own side,
// behind its line. Under the hangar of their side's carrier nearest the line
// (a ship that carries fighters, battleFlights.js's FLIGHTS.carriers, else
// its flagship), a little astern of it; with none of them left, behind the
// line itself, where the fighters' own line is (battleFlights.js's). Out of
// what the battle keeps out of (`avoid`: a planet, a Death Star's shield),
// and facing the other side. Pure: it reads the battle (battle.js's k) and
// keeps nothing.
//
// homeFor(k, team) → { pos: { x, y, z }, fwd: { x, y, z } }

import { FLIGHTS, hangarAt } from './battleFlights';
import { dist2, v3 } from './battleKit';

export const HOME = {
  astern: 10, // behind the carrier's hangar, toward your own side
  line: 1.6, // behind the middle, in lines (the fighters' own line: battleFlights.js's)
  gap: 8, // clear of what's avoided by this much
};
const CARRIERS = new Set(FLIGHTS.carriers);

export function homeFor(k, team) {
  const { b, A, C, lines, avoid } = k;
  const dir = team === 0 ? 1 : -1;
  const fwd = { x: A.x * dir, y: 0, z: A.z * dir };
  const behind = { x: C.x - A.x * lines * dir * HOME.line, y: C.y, z: C.z - A.z * lines * dir * HOME.line };
  // the carrier nearest the line behind (the flagship only with none)
  let cap = null;
  let best = Infinity;
  for (const c of b.capitals) {
    if (c.team !== team || !c.alive || c.dying > 0) continue;
    const carries = CARRIERS.has(c.kind);
    if (!carries && c.role !== 'flagship') continue;
    const score = dist2(c.pos, behind) + (carries ? 0 : 1e12);
    if (score < best) (best = score), (cap = c);
  }
  let pos = behind;
  if (cap) {
    const h = hangarAt(cap, v3());
    pos = { x: h.x - fwd.x * HOME.astern, y: h.y, z: h.z - fwd.z * HOME.astern };
  }
  // (never in among what it's to keep out of: out past its edge)
  for (const o of avoid ?? []) {
    const dx = pos.x - o.c.x;
    const dy = pos.y - o.c.y;
    const dz = pos.z - o.c.z;
    const d = Math.hypot(dx, dy, dz);
    if (d >= o.r + HOME.gap) continue;
    const r = o.r + HOME.gap;
    pos = d > 1e-6 ? { x: o.c.x + (dx / d) * r, y: o.c.y + (dy / d) * r, z: o.c.z + (dz / d) * r } : { x: o.c.x, y: o.c.y + r, z: o.c.z };
  }
  return { pos, fwd };
}
