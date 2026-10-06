import { describe, expect, it } from 'vitest';
import { FOOT, METRE, TROOPS, aimAt, apart, at, bearing, bolt, byTrench, facingAlong, fly, inTrench, landingSpot, march, offset, person, place, rightOf, solidsOn, squad, vec, walk } from './foot';

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

describe('by a trench', () => {
  // (a big planet, the Death Star's size against a person, its trench round its middle)
  const BIG = 150;
  const band = { half: 1.48, home: 0.4, arc: Math.PI };

  it('comes down beside it, on the side it was coming down on, its door toward it', () => {
    for (const n of [vec.unit([1, 0.3, 0.2]), vec.unit([-0.2, -0.6, 0.7]), vec.unit([0.3, 0.001, -1])]) {
      const back = 20 * METRE;
      const spot = byTrench(n, band, BIG, back);
      onGround({ ...spot, n: spot.n, f: spot.f });
      expect(Math.sign(spot.n[1])).toBe(Math.sign(n[1]));
      // `back` from the rim, along the ground
      expect(Math.asin(Math.abs(spot.n[1])) * BIG - band.half).toBeCloseTo(back, 6);
      expect(inTrench(spot.n, band, BIG)).toBe(false);
      // as near where it was coming down as that is: the same way round
      expect(Math.atan2(spot.n[2], spot.n[0])).toBeCloseTo(Math.atan2(n[2], n[0]), 6);
      // facing along the trench, its right toward it
      expect(spot.f[1]).toBeCloseTo(0, 2);
      expect(-Math.sign(spot.n[1]) * rightOf(spot)[1]).toBeGreaterThan(0);
    }
  });

  it('only comes down along the part of a trench there is', () => {
    const part = { ...band, home: 0, arc: 0.5 };
    const spot = byTrench([0, 0.1, -1], part, BIG, 0.5);
    expect(Math.abs(Math.atan2(spot.n[2], spot.n[0]))).toBeLessThanOrEqual(0.5);
  });

  it('walks up to the rim and no further, and along it', () => {
    const spot = byTrench([1, 0.2, 0], band, BIG, 2 * METRE);
    let w = person(spot.n, [0, -1, 0]); // facing the trench
    for (let t = 0; t < 3; t += 1 / 60) w = walk(w, { move: 1, run: true }, 1 / 60, BIG, [{ band }]);
    onGround(w);
    expect(inTrench(w.n, band, BIG)).toBe(false);
    expect(Math.asin(w.n[1]) * BIG).toBeCloseTo(band.half + FOOT.radius, 4);
    // and along it, as it was
    let a = person(spot.n, spot.f);
    for (let t = 0; t < 3; t += 1 / 60) a = walk(a, { move: 1 }, 1 / 60, BIG, [{ band }]);
    expect(apart(a, { n: spot.n }, BIG)).toBeGreaterThan(FOOT.walk * 2.5);
    expect(inTrench(a.n, band, BIG)).toBe(false);
  });

  it('sends squads from your side of it', () => {
    const me = { id: 'me', ...person(byTrench([1, 0.2, 0], band, BIG, 10 * METRE).n, [0, 0, 1]) };
    const rand = seeded(5);
    for (let i = 0; i < 20; i++) {
      for (const t of squad(rand, me, BIG, { band })) {
        expect(inTrench(t.n, band, BIG, 2 * METRE)).toBe(false);
        expect(Math.sign(t.n[1])).toBe(Math.sign(me.n[1]));
      }
    }
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
    // each says who fired it and how far off its mark was (so the drawing can start it at the muzzle)
    for (const s of shots) {
      expect(troops.some((t) => t.id === s.by)).toBe(true);
      expect(s.range).toBeGreaterThan(5 * METRE);
      expect(s.range).toBeLessThan(TROOPS.gromflomite.range[1] * METRE * 1.5);
    }
    // a shot at you passes near you
    const near = shots.filter((s) => {
      const toMe = vec.add(vec.add(at(me, R), me.n, METRE), s.from, -1);
      const along = vec.dot(toMe, s.dir);
      return vec.len(vec.add(toMe, s.dir, -along)) < METRE * 1.5;
    });
    expect(near.length).toBeGreaterThan(shots.length * 0.3);
  });

  it('raises its gun as it comes into range, and lowers it out of range', () => {
    const rand = seeded(7);
    let troops = squad(rand, me, R, { count: 1, kinds: ['cop'] });
    expect(troops[0].aim ?? 0).toBe(0);
    let raisedAt = null;
    for (let t = 0; t < 40; t += 1 / 30) {
      troops = march(troops, [me], 1 / 30, R, rand).troops;
      if (raisedAt == null && troops[0].aim > 0.9) raisedAt = t;
    }
    expect(raisedAt).not.toBeNull();
    expect(apart(troops[0], me, R)).toBeLessThan(TROOPS.cop.range[1] * METRE * 1.5);
    // far off again: it comes down, over more than a moment
    let far = { ...troops[0], ...person(offset(me, 60 * METRE, 0, R).n, me.f), cool: 1, hold: troops[0].hold };
    const t0 = far.aim;
    far = march([far], [me], 1 / 30, R, rand).troops[0];
    expect(far.aim).toBeLessThan(t0);
    expect(far.aim).toBeGreaterThan(t0 - 0.2);
    for (let t = 0; t < 2; t += 1 / 30) far = march([far], [me], 1 / 30, R, rand).troops[0];
    expect(far.aim).toBe(0);
    // one without a gun never aims
    let brute = squad(rand, me, R, { count: 1, kinds: ['gazorpian'], dist: 8 * METRE });
    for (let t = 0; t < 3; t += 1 / 30) brute = march(brute, [me], 1 / 30, R, rand).troops;
    expect(brute[0].aim).toBe(0);
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

describe("a landing's things", () => {
  const frame = person([0, 1, 0], [0, 0, -1]); // facing −z, so +x (three.js's left of it) is −x here
  const left = vec.cross([0, 1, 0], [0, 0, -1]); // n × f

  it('stands a thing so many metres ahead and to the side, upright on the ground', () => {
    const ahead = place(frame, 0, 10, R);
    onGround(ahead);
    expect(apart(frame, ahead, R)).toBeCloseTo(10 * METRE, 6);
    expect(ahead.n[2]).toBeLessThan(0);
    expect(vec.dot(ahead.f, frame.f)).toBeCloseTo(1, 3); // facing on, the way the frame does
    const side = place(frame, 4, 0, R);
    expect(apart(frame, side, R)).toBeCloseTo(4 * METRE, 6);
    expect(vec.dot(vec.unit(vec.add(side.n, frame.n, -1)), left)).toBeGreaterThan(0.99); // +x: n × f
  });

  it('turns it as three.js turns a thing about its up: +z round toward +x', () => {
    const turned = place(frame, 0, 0, R, Math.PI / 2);
    onGround(turned);
    expect(vec.dot(turned.f, left)).toBeCloseTo(1, 6);
  });

  it("makes a thing's solids circles along the ground, where they stand", () => {
    const spot = place(frame, 0, 20, R);
    const [c] = solidsOn(spot, [{ circle: [0, 0, 3] }], R);
    expect(apart(c, spot, R)).toBeCloseTo(0, 6);
    expect(c.r).toBeCloseTo(3 * METRE, 9);
    // a box 8 m by 2 m: a row of circles down its length, covering it end to end
    const row = solidsOn(spot, [{ box: [0, 0, 4, 1] }], R);
    expect(row.length).toBeGreaterThan(2);
    const ends = row.map((o) => apart(o, spot, R) + o.r);
    expect(Math.max(...ends)).toBeGreaterThanOrEqual(4 * METRE - 1e-9);
    expect(Math.max(...ends)).toBeLessThan(4.6 * METRE);
    for (const o of row) expect(o.r).toBeCloseTo(1 * METRE, 9);
    // turned a quarter round by its yaw, the row runs the other way
    const along = (list) => vec.unit(vec.add(list[list.length - 1].n, list[0].n, -1));
    expect(Math.abs(vec.dot(along(row), left))).toBeGreaterThan(0.99);
    const turnedRow = solidsOn(spot, [{ box: [0, 0, 4, 1, Math.PI / 2] }], R);
    expect(Math.abs(vec.dot(along(turnedRow), spot.f))).toBeGreaterThan(0.99);
  });

  it('keeps someone out of a solid placed on the ground', () => {
    const spot = place(frame, 0, 6, R);
    const solids = solidsOn(spot, [{ circle: [0, 0, 2] }], R);
    const walked = run(frame, { move: 1 }, 6, solids);
    expect(apart(walked, spot, R)).toBeGreaterThanOrEqual(2 * METRE + FOOT.radius - 1e-6);
  });
});

describe('other dimensions', () => {
  it('give every pilot the same code wherever they are met, and different pilots different ones', async () => {
    const { dimensionOf } = await import('./footScene');
    const a = dimensionOf('7f3a9c');
    expect(dimensionOf('7f3a9c')).toEqual(a);
    expect(a.code).toMatch(/^[A-Z]-\d{2,3}\S\d$/);
    expect(a.hue).toBeGreaterThanOrEqual(0);
    expect(a.hue).toBeLessThan(1);
    const codes = new Set(Array.from({ length: 50 }, (_, i) => dimensionOf(`pilot-${i}`).code));
    expect(codes.size).toBeGreaterThan(45);
  });
});
