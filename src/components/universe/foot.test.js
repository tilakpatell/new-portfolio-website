import { describe, expect, it } from 'vitest';
import { FOOT, METRE, TROOPS, aimAt, apart, at, bearing, bolt, facingAlong, fly, landingSpot, march, offset, person, squad, vec, walk } from './foot';

const R = 18;
const seeded = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const run = (w, input, seconds, obstacles) => {
  let s = w;
  for (let t = 0; t < seconds; t += 1 / 60) s = walk(s, input, 1 / 60, R, obstacles);
  return s;
};
const onGround = (w) => {
  expect(vec.len(w.n)).toBeCloseTo(1, 6);
  expect(vec.len(w.f)).toBeCloseTo(1, 6);
  expect(vec.dot(w.n, w.f)).toBeCloseTo(0, 6); // facing along the ground
};

describe('on foot', () => {
  const start = person([0, 1, 0], [0, 0, -1]);

  it('walks where it faces, faster running, and stays on the ground', () => {
    const walked = run(start, { move: 1 }, 2);
    onGround(walked);
    expect(walked.n[2]).toBeLessThan(0); // forward is −z here
    const d = apart(start, walked, R);
    expect(d).toBeGreaterThan(FOOT.walk * 1.5);
    expect(d).toBeLessThan(FOOT.walk * 2.05);
    expect(apart(start, run(start, { move: 1, run: true }, 2), R)).toBeGreaterThan(d * 2);
  });

  it('turns right when told to, and steps sideways', () => {
    const turned = run(start, { turn: 1 }, 0.3);
    onGround(turned);
    expect(turned.f[0]).toBeGreaterThan(0.3); // its right is +x
    expect(apart(start, turned, R)).toBeCloseTo(0, 9); // on the spot
    const stepped = run(start, { strafe: 1 }, 1);
    expect(stepped.n[0]).toBeGreaterThan(0);
    expect(stepped.f[2]).toBeCloseTo(-1, 3); // still facing the same way
  });

  it('goes all the way round the planet in a straight line', () => {
    let w = { ...start, speed: FOOT.run };
    const steps = Math.round((2 * Math.PI * R) / (FOOT.run / 60));
    for (let i = 0; i < steps; i++) w = walk(w, { move: 1, run: true }, 1 / 60, R);
    onGround(w);
    expect(apart(start, w, R)).toBeLessThan(FOOT.run * 0.1);
  });

  it('jumps, comes down again, and only jumps off the ground', () => {
    let w = walk(start, { jump: true }, 1 / 60, R);
    let top = 0;
    let again = 0;
    for (let t = 0; t < 1.5; t += 1 / 60) {
      const was = w.vh;
      w = walk(w, { jump: w.h > 0 }, 1 / 60, R); // (held in the air: no second jump)
      if (w.vh > 0 && was <= 0) again++; // (a new jump)
      top = Math.max(top, w.h);
    }
    expect(top).toBeGreaterThan(0.7 * METRE);
    expect(top).toBeLessThan(1.4 * METRE);
    expect(again).toBe(0);
    expect(w.h).toBe(0);
  });

  it('goes round the parked ship, never through it', () => {
    const ship = { n: offset(start, 0.1, 0, R).n, r: 0.04 };
    const w = run(start, { move: 1 }, 6, [ship]);
    expect(apart(w, ship, R)).toBeGreaterThanOrEqual(ship.r + FOOT.radius - 1e-6);
  });

  it('comes down on the near side of a planet, toward the light', () => {
    const c = [100, 0, 0];
    const from = [100, 0, 40];
    expect(landingSpot(from, c)).toEqual([0, 0, 1]);
    const lit = landingSpot(from, c, [0, 1, 0]);
    expect(lit[1]).toBeGreaterThan(0.4);
    expect(lit[2]).toBeGreaterThan(0.4);
    // the light round the far side: still the near side
    expect(landingSpot(from, c, [0, 0, -1])[2]).toBeGreaterThan(0.3);
    const f = facingAlong([0, 1, 0], [1, 1, 0]);
    expect(f[0]).toBeCloseTo(1, 6);
    expect(bearing([0, 1, 0], [0, 0, -1], [-1, 0, 0])).toBeCloseTo(Math.PI / 2, 6); // to the left is +
  });
});

describe('a squad', () => {
  const me = { id: 'me', ...person([0, 1, 0], [0, 0, -1]) };

  it('comes from over the horizon, a way off, facing you', () => {
    const troops = squad(seeded(3), me, R, { count: 4 });
    expect(troops).toHaveLength(4);
    for (const t of troops) {
      onGround(t);
      expect(apart(t, me, R)).toBeGreaterThan(35 * METRE);
      expect(Math.abs(bearing(t.n, t.f, vec.add(me.n, t.n, -1)))).toBeLessThan(0.05);
      expect(TROOPS[t.kind]).toBeTruthy();
    }
  });

  it('walks at you, stops at its distance and shoots, mostly at you', () => {
    const rand = seeded(5);
    let troops = squad(rand, me, R, { count: 3, kinds: ['gromflomite'] });
    const shots = [];
    for (let t = 0; t < 40; t += 1 / 30) {
      const r = march(troops, [me], 1 / 30, R, rand);
      troops = r.troops;
      shots.push(...r.shots);
    }
    for (const t of troops) {
      const d = apart(t, me, R);
      expect(d).toBeLessThan(TROOPS.gromflomite.range[1] * METRE * 1.15);
      expect(d).toBeGreaterThan(TROOPS.gromflomite.range[0] * METRE * 0.5);
    }
    expect(shots.length).toBeGreaterThan(6);
    // a shot at you passes near you
    const near = shots.filter((s) => {
      const toMe = vec.add(vec.add(at(me, R), me.n, METRE), s.from, -1);
      const along = vec.dot(toMe, s.dir);
      return vec.len(vec.add(toMe, s.dir, -along)) < METRE * 1.5;
    });
    expect(near.length).toBeGreaterThan(shots.length * 0.3);
  });

  it('charges in without a gun, and lands a blow', () => {
    const rand = seeded(9);
    let troops = squad(rand, me, R, { count: 1, kinds: ['gazorpian'] });
    let hits = [];
    for (let t = 0; t < 30 && !hits.length; t += 1 / 30) {
      const r = march(troops, [me], 1 / 30, R, rand);
      troops = r.troops;
      hits = r.hits;
    }
    expect(hits[0]).toMatchObject({ target: 'me', damage: TROOPS.gazorpian.damage });
  });
});

describe('a bolt', () => {
  it('flies straight, and hits whoever it passes close to first', () => {
    const from = [0, R + METRE, 0];
    let b = bolt(from, [0, 0, -1], 'me');
    const people = [
      { id: 'far', p: [0, R + METRE, -20 * METRE] },
      { id: 'near', p: [0.2 * METRE, R + METRE, -10 * METRE] },
    ];
    let hit = null;
    for (let i = 0; i < 120 && !hit; i++) ({ bolt: b, hit } = fly(b, 1 / 60, R, people));
    expect(hit).toBe('near');
  });

  it('goes into the ground', () => {
    let b = bolt([0, R + METRE, 0], vec.unit([0, -1, -1]), 'me');
    let hit = null;
    for (let i = 0; i < 60 && !hit; i++) ({ bolt: b, hit } = fly(b, 1 / 60, R, []));
    expect(hit).toBe('ground');
  });

  it('is aimed at the nearest trooper round the way you face', () => {
    const me = person([0, 1, 0], [0, 0, -1]);
    const ahead = { ...person(offset(me, 10 * METRE, 1 * METRE, R).n, [0, 0, 1]), id: 1, alive: true };
    const closer = { ...person(offset(me, 6 * METRE, -0.5 * METRE, R).n, [0, 0, 1]), id: 2, alive: true };
    const behind = { ...person(offset(me, -3 * METRE, 0, R).n, [0, 0, 1]), id: 3, alive: true };
    expect(aimAt(me, [ahead, closer, behind], R).id).toBe(2);
    expect(aimAt(me, [ahead, behind], R).id).toBe(1);
    expect(aimAt(me, [behind], R)).toBeNull();
    expect(aimAt(me, [{ ...closer, alive: false }], R)).toBeNull();
  });
});
