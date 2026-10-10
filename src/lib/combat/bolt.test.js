import { describe, expect, it } from 'vitest';
import { BOLT_SPEED, createBolts, segCapsule, segSeg } from './bolt';

// a world with nothing in it but what a test gives it
const open = (more = {}) => ({ solids: () => null, bodies: [], blades: [], ...more });

// a wall across the line x = wx: anything crossing it stops there
const wallAt = (wx) => (a, b) => {
  if ((a[0] - wx) * (b[0] - wx) > 0 || a[0] === b[0]) return a[0] === wx ? { at: [...a], normal: [-1, 0, 0] } : null;
  const t = (wx - a[0]) / (b[0] - a[0]);
  return { at: [wx, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], normal: [-1, 0, 0] };
};

// a standing person at (x, z): feet at 0.3, head at 1.5, girth 0.35
const person = (id, x, z, side, r = 0.35) => ({ id, a: [x, 0.3, z], b: [x, 1.5, z], r, side });

// fly a pool until nothing's left in the air, gathering what happened
const run = (bolts, world, dt = 1 / 60, frames = 400) => {
  const all = [];
  for (let i = 0; i < frames && bolts.live().length; i++) all.push(...bolts.step(dt, world));
  return all;
};

describe('the geometry', () => {
  it('finds the closest points of two crossing segments', () => {
    const k = segSeg([-1, 0, 0], [1, 0, 0], [0, -1, 0.5], [0, 1, 0.5]);
    expect(k.s).toBeCloseTo(0.5);
    expect(k.t).toBeCloseTo(0.5);
    expect(k.dist).toBeCloseTo(0.5);
  });

  it('finds the closest points of parallel and degenerate segments', () => {
    expect(segSeg([0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]).dist).toBeCloseTo(1);
    expect(segSeg([0, 0, 0], [0, 0, 0], [2, 0, 0], [2, 0, 0]).dist).toBeCloseTo(2);
    expect(segSeg([0, 0, 0], [0, 0, 0], [-1, 1, 0], [1, 1, 0]).dist).toBeCloseTo(1);
  });

  it('enters a capsule where the segment first comes within its radius', () => {
    const k = segCapsule([0, 1, -5], [0, 1, 5], [0, 0, 0], [0, 2, 0], 0.5);
    expect(k.t).toBeCloseTo(0.45, 3);
    expect(k.at[2]).toBeCloseTo(-0.5, 3);
    expect(segCapsule([0, 3, -5], [0, 3, 5], [0, 0, 0], [0, 2, 0], 0.5)).toBeNull();
    expect(segCapsule([0, 1, 0], [0, 1, 5], [0, 0, 0], [0, 2, 0], 0.5).t).toBe(0); // starts inside
  });
});

describe('a bolt in flight', () => {
  it('stops at a solid 10 m ahead and reports its point and normal', () => {
    const bolts = createBolts();
    bolts.fire({ from: [0, 1, 0], dir: [1, 0, 0], side: 'you', owner: 'you' });
    const ev = run(bolts, open({ solids: wallAt(10) }));
    expect(ev).toHaveLength(1);
    expect(ev[0].type).toBe('solid');
    expect(ev[0].at[0]).toBeCloseTo(10);
    expect(ev[0].normal).toEqual([-1, 0, 0]);
    expect(bolts.live()).toHaveLength(0);
  });

  it('passes through a 0.3 m gap between two capsules', () => {
    const bolts = createBolts();
    // two people 1 m apart, girth 0.35: the gap between their skins is 0.3 m
    const bodies = [person('l', 10, -0.5, 'them'), person('r', 10, 0.5, 'them')];
    bolts.fire({ from: [0, 1, 0], dir: [1, 0, 0], side: 'you', owner: 'you', range: 20 });
    const ev = run(bolts, open({ bodies }));
    expect(ev.map((e) => e.type)).toEqual(['gone']);
  });

  it('hits a capsule it crosses once, and is gone', () => {
    const bolts = createBolts();
    const bodies = [person('t', 10, 0.2, 'them'), person('behind', 14, 0, 'them')];
    bolts.fire({ from: [0, 1, 0], dir: [1, 0, 0], side: 'you', owner: 'you', damage: 12 });
    const ev = run(bolts, open({ bodies }));
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ type: 'hit', body: bodies[0] });
    expect(ev[0].bolt.damage).toBe(12);
    expect(ev[0].at[0]).toBeLessThan(10);
    expect(bolts.live()).toHaveLength(0);
  });

  it('hits the nearer of two bodies along its way within one frame', () => {
    const bolts = createBolts();
    const bodies = [person('far', 1.5, 0, 'them'), person('near', 0.8, 0, 'them')];
    bolts.fire({ from: [0, 1, 0], dir: [1, 0, 0], side: 'you', owner: 'you' });
    const ev = bolts.step(0.05, open({ bodies })); // 4.5 m in the frame
    expect(ev[0].body.id).toBe('near');
  });

  // (a solid the world knocks when it's met, as a landing's props are:
  // landings/physics.js shot, footScene's moveBolts)
  const knocking = (wall) => {
    const asked = [];
    const knocked = [];
    const solids = (a, b) => {
      asked.push(b[0]);
      const hit = wall(a, b);
      if (hit) knocked.push(hit.at[0]);
      return hit;
    };
    return { solids, asked, knocked };
  };

  it('hits a person on its way before a solid behind them in the one frame, and never meets the solid', () => {
    const bolts = createBolts();
    // (a lamp post 0.6 m behind them: both on this frame's 4.5 m)
    const post = knocking(wallAt(3));
    bolts.fire({ from: [0, 1, 0], dir: [1, 0, 0], side: 'you', owner: 'you' });
    const ev = bolts.step(0.05, open({ solids: post.solids, bodies: [person('t', 2.4, 0, 'them')] }));
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ type: 'hit', body: { id: 't' } });
    expect(ev[0].at[0]).toBeCloseTo(2.05, 3);
    expect(post.knocked).toEqual([]);
    expect(Math.max(...post.asked)).toBeLessThanOrEqual(2.05 + 1e-6);
  });

  it('stops at a solid before a person in the one frame, and meets it', () => {
    const bolts = createBolts();
    const crate = knocking(wallAt(1.5));
    bolts.fire({ from: [0, 1, 0], dir: [1, 0, 0], side: 'you', owner: 'you' });
    const ev = bolts.step(0.05, open({ solids: crate.solids, bodies: [person('t', 2.4, 0, 'them')] }));
    expect(ev).toHaveLength(1);
    expect(ev[0].type).toBe('solid');
    expect(ev[0].at[0]).toBeCloseTo(1.5);
    expect(crate.knocked).toEqual([1.5]);
  });

  it('does not hit a body on its own side, nor its shooter', () => {
    const bolts = createBolts();
    const bodies = [person('mate', 5, 0, 'you'), person('you', 0, 0, 'you')];
    bolts.fire({ from: [0, 1, 0], dir: [1, 0, 0], side: 'you', owner: 'you', range: 10 });
    expect(run(bolts, open({ bodies })).map((e) => e.type)).toEqual(['gone']);
    // a soldier's own capsule round the muzzle doesn't stop their shot
    const theirs = createBolts();
    theirs.fire({ from: [0, 1, 0], dir: [1, 0, 0], side: 'none', owner: 'you', range: 3 });
    expect(run(theirs, open({ bodies: [person('you', 0, 0, 'you')] })).map((e) => e.type)).toEqual(['gone']);
  });

  it('is turned back along its line by a raised blade, its side swapped, and then hits its shooter', () => {
    const bolts = createBolts();
    const trooper = person('trooper', 0, 0, 'them');
    const you = person('you', 20, 0, 'you');
    // your blade upright in front of you, across the bolt's line
    const blades = [{ id: 'you', base: [19.4, 0.6, 0], tip: [19.4, 1.6, 0], r: 0.12, side: 'you' }];
    const b = bolts.fire({ from: [0.6, 1, 0], dir: [1, 0, 0], side: 'them', owner: 'trooper', deflect: true, damage: 10 });
    const ev = run(bolts, open({ bodies: [trooper, you], blades }));
    expect(ev.map((e) => e.type)).toEqual(['deflect', 'hit']);
    expect(ev[0].blade).toBe(blades[0]);
    expect(ev[0].at[0]).toBeCloseTo(19.4 - 0.12, 1);
    expect(ev[1].body.id).toBe('trooper');
    expect(b.side).toBe('you');
    expect(b.deflected).toBe(true);
  });

  it('spares a body that counts the bolt’s side its ally', () => {
    const bolts = createBolts();
    const you = { ...person('you', 5, 0, 'you'), allies: ['rebel'] };
    bolts.fire({ from: [0, 1, 0], dir: [1, 0, 0], side: 'rebel', owner: 'r1', range: 10 });
    expect(run(bolts, open({ bodies: [you] })).map((e) => e.type)).toEqual(['gone']);
    bolts.fire({ from: [0, 1, 0], dir: [1, 0, 0], side: 'empire', owner: 'e1', range: 10 });
    expect(run(bolts, open({ bodies: [you] })).map((e) => e.type)).toEqual(['hit']);
  });

  it('a ghost bolt (a battle’s tracer) stops at solids and passes through bodies', () => {
    const bolts = createBolts();
    bolts.fire({ from: [0, 1, 0], dir: [1, 0, 0], ghost: true, range: 30 });
    const ev = run(bolts, open({ solids: wallAt(20), bodies: [person('t', 10, 0, 'them')] }));
    expect(ev.map((e) => e.type)).toEqual(['solid']);
  });

  it('is not turned by a blade unless it is marked deflect', () => {
    const bolts = createBolts();
    const blades = [{ id: 'you', base: [10, 0.6, 0], tip: [10, 1.6, 0], r: 0.12, side: 'you' }];
    bolts.fire({ from: [0, 1, 0], dir: [1, 0, 0], side: 'them', owner: 'trooper', range: 15 });
    expect(run(bolts, open({ blades })).map((e) => e.type)).toEqual(['gone']);
  });

  it('flies no further than its range and reports gone', () => {
    const bolts = createBolts();
    const b = bolts.fire({ from: [0, 1, 0], dir: [3, 0, 4], side: 'you', owner: 'you', range: 25 });
    const ev = run(bolts, open());
    expect(ev).toHaveLength(1);
    expect(ev[0].type).toBe('gone');
    expect(Math.hypot(b.pos[0], b.pos[2])).toBeCloseTo(25);
  });

  it('a solid at 0 m (the muzzle inside a wall) ends the bolt at the muzzle without hitting the shooter', () => {
    const bolts = createBolts();
    const shooter = person('you', 0, 0, 'you');
    const target = person('t', 5, 0, 'them');
    bolts.fire({ from: [0.3, 1, 0], dir: [1, 0, 0], side: 'none', owner: 'x', range: 30 });
    const ev = bolts.step(1 / 60, open({ solids: wallAt(0.3), bodies: [shooter, target] }));
    expect(ev).toHaveLength(1);
    expect(ev[0].type).toBe('solid');
    expect(ev[0].at[0]).toBeCloseTo(0.3);
  });
});

describe('the pool', () => {
  it('reuses a dead slot before the oldest live one', () => {
    const bolts = createBolts({ pool: 3 });
    const a = bolts.fire({ from: [0, 1, 0], dir: [1, 0, 0], range: 100 });
    const b = bolts.fire({ from: [0, 1, 0], dir: [0, 0, 1], range: 1 });
    const c = bolts.fire({ from: [0, 1, 0], dir: [-1, 0, 0], range: 100 });
    bolts.step(1 / 30, open()); // b's range is spent
    expect(bolts.live()).toHaveLength(2);
    const d = bolts.fire({ from: [0, 1, 0], dir: [0, 0, -1], range: 100 });
    expect(d).toBe(b);
    expect(bolts.live()).toContain(a);
    // full: the oldest in flight gives way
    const e = bolts.fire({ from: [0, 1, 0], dir: [0, 1, 0], range: 100 });
    expect(e).toBe(a);
    expect(bolts.live()).toEqual(expect.arrayContaining([c, d, e]));
  });

  it('clears every bolt in the air at once', () => {
    const bolts = createBolts();
    bolts.fire({ from: [0, 1, 0], dir: [1, 0, 0] });
    bolts.clear();
    expect(bolts.live()).toHaveLength(0);
  });

  it('keeps what the caller tagged a shot with', () => {
    const bolts = createBolts();
    const b = bolts.fire({ from: [0, 1, 0], dir: [1, 0, 0], tag: { weapon: 'dl44' } });
    expect(b.tag).toEqual({ weapon: 'dl44' });
    expect(b.speed).toBe(BOLT_SPEED);
    expect(BOLT_SPEED).toBe(90);
    expect(b.range).toBe(120);
  });
});
