import { describe, expect, it } from 'vitest';
import { createBattle } from './battle';
import { BATTLE, seededRand } from './battleKit';
import { FLIGHTS } from './battleFlights';
import { WARS } from './wars';

// Where a pilot comes back into a battle after a death (battleHome.js): on
// their own side, behind its line, under the hangar of its carrier nearest
// the line (else behind the line itself), out of what the battle keeps out
// of, facing the enemy.
const war = WARS.starwars;
const make = (o = {}) => createBattle({ war, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 6, rand: seededRand('home'), tickets: false, tactics: true, ...o });
const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
// how far toward the other side a point is (the axis is +x: the attacker's way to the defender)
const toward = (p, team) => (team === 0 ? p.x : -p.x);

describe('coming back into a battle', () => {
  it('is behind your own side’s line, facing the other side', () => {
    const b = make();
    for (const team of [0, 1]) {
      const h = b.homeFor(team);
      const mine = b.capitals.filter((c) => c.team === team);
      const theirs = b.capitals.filter((c) => c.team !== team);
      // nearer your own fleet than theirs, and no further forward than your own line's front
      const near = (list) => Math.min(...list.map((c) => d(h.pos, c.pos)));
      expect(near(mine)).toBeLessThan(near(theirs));
      expect(toward(h.pos, team)).toBeLessThanOrEqual(Math.max(...mine.map((c) => toward(c.pos, team))) + 1e-6);
      // facing them
      expect(team === 0 ? h.fwd.x : -h.fwd.x).toBeGreaterThan(0.99);
      expect(Math.hypot(h.fwd.x, h.fwd.y, h.fwd.z)).toBeCloseTo(1, 6);
    }
  });

  it('is under the hangar of your side’s carrier, clear of its hull', () => {
    const b = make();
    const h = b.homeFor(1);
    const carriers = b.capitals.filter((c) => c.team === 1 && FLIGHTS.carriers.includes(c.kind));
    expect(carriers.length).toBeGreaterThan(0);
    const cap = carriers.reduce((a, c) => (d(h.pos, c.pos) < d(h.pos, a.pos) ? c : a));
    expect(h.pos.y).toBeLessThan(cap.pos.y);
    for (const sp of cap.spheres) expect(d(h.pos, sp.c)).toBeGreaterThan(sp.r);
  });

  it('is behind the line itself with no carrier and no flagship left', () => {
    const b = make();
    for (const c of b.capitals) if (c.team === 0) c.alive = false;
    const h = b.homeFor(0);
    expect(toward(h.pos, 0)).toBeLessThan(-BATTLE.lines);
    expect(h.fwd.x).toBeGreaterThan(0.99);
  });

  it('is never inside what the battle keeps out of', () => {
    const avoid = [{ c: { x: -110, y: 0, z: 0 }, r: 60 }];
    const b = make({ avoid });
    for (const c of b.capitals) if (c.team === 0) c.alive = false;
    const h = b.homeFor(0);
    expect(d(h.pos, avoid[0].c)).toBeGreaterThanOrEqual(avoid[0].r);
  });
});
