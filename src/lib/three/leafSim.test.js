import { describe, expect, it } from 'vitest';
import { seeded } from '../seeded';
import { LEAF, blastLeaves, layLeaves, makeLeafSim, shakeLeaves, shedLeaf, stepLeafSim, weatherWind, wrapLeaves } from './leafSim';

// (one leaf, put where a case wants it, of a weight)
const one = ({ x = 0, y = LEAF.floor, z = 0, w = 0.15, rest = 1 } = {}) => {
  const s = makeLeafSim(1);
  layLeaves(s, 1, { half: 50, rand: seeded(1) });
  s.p[0] = x;
  s.p[1] = y;
  s.p[2] = z;
  s.w[0] = w;
  s.rest[0] = rest;
  return s;
};
const F = { x: 0, z: 0 };
// (stepped for `secs` at `hz`, `each` a frame first; the highest it got and how far it went from where it was)
const run = (s, secs, ctx, { hz = 60, each = null } = {}) => {
  const from = [s.p[0], s.p[2]];
  let peak = 0;
  for (let t = 0; t < secs; t += 1 / hz) {
    each?.(t);
    stepLeafSim(s, 1 / hz, ctx(t));
    peak = Math.max(peak, s.p[1] - LEAF.floor);
  }
  return { peak, moved: Math.hypot(s.p[0] - from[0], s.p[2] - from[1]) };
};
// (someone walking by along +z, `off` to the side of the leaf, at `speed`)
const passBy = (s, { off, speed, y = 0 }) => {
  const P = { x: -off, z: -3, y, vx: 0, vz: speed };
  return run(s, 6, () => ({ focus: F, half: 50, walkers: [P] }), { each: () => (P.z += P.vz / 60) });
};
const finite = (s) => [...s.p, ...s.v].every(Number.isFinite);

describe('leaves walked through', () => {
  it('slide along from a stroll right by, hardly leaving the ground', () => {
    const { moved, peak } = passBy(one({ w: 0.1 }), { off: 0.1, speed: 1.8 });
    expect(moved).toBeGreaterThan(0.7);
    expect(moved).toBeLessThan(1.6);
    expect(peak).toBeLessThan(0.05);
  });

  it('are left alone by someone walking by 0.8 m off', () => {
    expect(passBy(one(), { off: 0.8, speed: 1.8 }).moved).toBeLessThan(1e-3);
  });

  it('go up and away from a run right by', () => {
    const { moved, peak } = passBy(one({ w: 0.1 }), { off: 0.1, speed: 6 });
    expect(peak).toBeGreaterThan(0.8);
    expect(moved).toBeGreaterThan(3);
  });

  it('are left alone by someone jumping over', () => {
    expect(passBy(one(), { off: 0.1, speed: 6, y: 0.5 }).moved).toBeLessThan(1e-6);
  });

  it('are moved by a stroll 0.3 m off, however long they had lain still', () => {
    // (a leaf asleep, woken by the kick: never put to sleep the frame it's kicked)
    expect(passBy(one({ rest: 1 }), { off: 0.3, speed: 1.8 }).moved).toBeGreaterThan(0.4);
  });

  it('pass over a walker with anything not a number in it', () => {
    const s = one({ rest: 0 });
    const was = [...s.p];
    run(s, 1, () => ({ focus: F, half: 50, walkers: [{ x: NaN, z: 0, y: 0, vx: 0, vz: 1.8 }, { x: 0, z: 0, y: 0, vx: NaN, vz: 1 }] }));
    expect([...s.p]).toEqual(was);
  });
});

describe('leaves in the wind', () => {
  it('skate along where the gust lets them go, never lifting', () => {
    const s = one({ w: 0.15 });
    let fastest = 0;
    const { peak } = run(s, 10, () => ({ focus: F, half: 1e4, wind: { strength: 0.55, dir: [1, 0], gate: () => 0.15 } }), { each: () => (fastest = Math.max(fastest, Math.hypot(s.v[0], s.v[2]))) });
    expect(fastest).toBeGreaterThan(0);
    expect(peak).toBeLessThan(1e-6);
  });

  it('lie still and asleep where it is shut', () => {
    const s = one();
    const { moved } = run(s, 10, () => ({ focus: F, half: 50, wind: { strength: 0.45, dir: [1, 0], gate: () => 0.6 } }));
    expect(moved).toBeLessThan(1e-6);
    expect(s.rest[0]).toBe(1);
  });

  it('blow harder in a stronger wind, rising and falling slowly round its base', () => {
    expect(weatherWind(0, 0.45)).toBeCloseTo(0.45, 9);
    for (let t = 0; t < 4000; t += 3.7) {
      const k = weatherWind(t, 0.45);
      expect(k).toBeGreaterThanOrEqual(0.1);
      expect(k).toBeLessThanOrEqual(1);
      expect(Math.abs(weatherWind(t + 1 / 60, 0.45) - k)).toBeLessThan(0.01);
    }
    expect(weatherWind(100, 2)).toBe(1);
  });
});

describe('leaves blasted', () => {
  it('fly up from a blast a metre off, and none past its reach', () => {
    const near = one({ x: 1, w: 0.1 });
    expect(blastLeaves(near, 0, 0, 3, 20, () => 0.5)).toBe(1);
    expect(run(near, 8, () => ({ focus: F, half: 50 })).peak).toBeGreaterThan(0.6);
    const far = one({ x: 3.1 });
    expect(blastLeaves(far, 0, 0, 3, 20, () => 0.5)).toBe(0);
    expect(run(far, 8, () => ({ focus: F, half: 50 })).moved).toBe(0);
  });

  it('do nothing for a blast that is not a number', () => {
    const s = one();
    expect(blastLeaves(s, NaN, 0, 3)).toBe(0);
    expect(blastLeaves(s, 0, 0, NaN)).toBe(0);
    expect(s.rest[0]).toBe(1);
  });
});

describe('leaves falling', () => {
  it('come down from 6 m in still air in 3 to 10 s, swinging', () => {
    for (const w of [0.1, 0.15, 0.2]) {
      const s = one({ y: 6, w, rest: 0 });
      let t = 0;
      for (; s.p[1] > LEAF.floor + 1e-3 && t < 40; t += 1 / 60) stepLeafSim(s, 1 / 60, { focus: F, half: 50 });
      expect(t, `w ${w}`).toBeGreaterThan(3);
      expect(t, `w ${w}`).toBeLessThan(10);
    }
  });

  it('go the same way at 30, 60 and 144 frames a second, and a hitch is one of his frames', () => {
    const at = (hz) => {
      const s = one({ x: 1, w: 0.12 });
      blastLeaves(s, 0, 0, 3, 20, () => 0.5);
      run(s, 1, () => ({ focus: F, half: 50 }), { hz });
      return [s.p[0], s.p[1]];
    };
    const [x60, y60] = at(60);
    for (const hz of [30, 144]) {
      const [x, y] = at(hz);
      expect(Math.abs(x - x60) / Math.abs(x60 - 1), `${hz} Hz x`).toBeLessThan(0.1);
      expect(Math.abs(y - y60) / y60, `${hz} Hz y`).toBeLessThan(0.1);
    }
    const a = one({ x: 1, w: 0.12 });
    const b = one({ x: 1, w: 0.12 });
    blastLeaves(a, 0, 0, 3, 20, () => 0.5);
    blastLeaves(b, 0, 0, 3, 20, () => 0.5);
    stepLeafSim(a, 0.5, { focus: F, half: 50 });
    stepLeafSim(b, LEAF.tick, { focus: F, half: 50 });
    expect([...a.p]).toEqual([...b.p]);
  });

  it('does nothing in a frozen frame', () => {
    const s = one({ y: 3, rest: 0 });
    const was = [...s.p];
    stepLeafSim(s, 0, { focus: F, half: 50 });
    stepLeafSim(s, NaN, { focus: F, half: 50 });
    expect([...s.p]).toEqual(was);
  });
});

describe('many leaves round you', () => {
  it('stay round a moving focus, whatever blasts and gusts them, and never go to NaN', () => {
    const s = makeLeafSim(640);
    layLeaves(s, 640, { half: 14, rand: seeded(3) });
    const f = { x: 0, z: 0 };
    const rand = seeded(9);
    const wind = { strength: 0.6, dir: [0.8, 0.6], gate: (x, z) => 0.5 + 0.4 * Math.sin(x * 0.3) * Math.cos(z * 0.2) };
    let worst = 0;
    for (let k = 0; k < 600; k++) {
      f.x += 0.05;
      f.z -= 0.03;
      if (k % 50 === 0) blastLeaves(s, f.x, f.z, 3, 20, rand);
      stepLeafSim(s, 1 / 60, { focus: f, half: 14, wind, walkers: [{ x: f.x, z: f.z, y: 0, vx: 6, vz: 0 }] });
      for (let i = 0; i < s.count; i++) worst = Math.max(worst, Math.abs(s.p[4 * i] - f.x), Math.abs(s.p[4 * i + 2] - f.z));
    }
    expect(worst).toBeLessThanOrEqual(14 + 1e-3);
    expect(finite(s)).toBe(true);
    // (wrapped alone, as with motion turned down: kept round it, nothing moved but that)
    f.x += 40;
    wrapLeaves(s, f, 14);
    for (let i = 0; i < s.count; i++) expect(Math.abs(s.p[4 * i] - f.x)).toBeLessThanOrEqual(14 + 1e-3);
  });

  it('are laid the same for a seed, inside the box, in his weights and sizes, a few the accent', () => {
    const a = layLeaves(makeLeafSim(640), 640, { half: 14, rand: seeded(5), clump: (u, v) => Math.sin(u * 40) * Math.cos(v * 30) * 0.5 });
    const b = layLeaves(makeLeafSim(640), 640, { half: 14, rand: seeded(5), clump: (u, v) => Math.sin(u * 40) * Math.cos(v * 30) * 0.5 });
    expect([...a.p]).toEqual([...b.p]);
    expect([...a.seed]).toEqual([...b.seed]);
    let accents = 0;
    for (let i = 0; i < a.count; i++) {
      expect(Math.abs(a.p[4 * i])).toBeLessThanOrEqual(14);
      expect(Math.abs(a.p[4 * i + 2])).toBeLessThanOrEqual(14);
      expect(a.p[4 * i + 1]).toBeCloseTo(LEAF.floor, 6);
      expect(a.w[i]).toBeGreaterThanOrEqual(0.1 - 1e-6);
      expect(a.w[i]).toBeLessThanOrEqual(0.2 + 1e-6);
      expect(a.seed[4 * i + 1]).toBeGreaterThanOrEqual(0.5);
      expect(a.seed[4 * i + 1]).toBeLessThanOrEqual(1);
      expect(a.rest[i]).toBe(1);
      if (a.p[4 * i + 3] === 2) accents += 1;
      else expect(a.p[4 * i + 3]).toBeLessThan(1);
    }
    expect(accents / a.count).toBeGreaterThan(0.1);
    expect(accents / a.count).toBeLessThan(0.2);
  });
});

describe('leaves off the trees', () => {
  const crown = { x: 5, z: 5, r: 2, lo: 3, hi: 8 };
  it('are let go inside a crown, taken only from the faded ring at the box’s edge', () => {
    const s = makeLeafSim(64);
    layLeaves(s, 64, { half: 14, rand: seeded(4) });
    const was = [...s.p];
    const rand = seeded(5);
    let got = 0;
    for (let k = 0; k < 20; k++) {
      const i = shedLeaf(s, crown, { focus: F, half: 14, rand });
      if (i < 0) continue;
      got += 1;
      expect(Math.max(Math.abs(was[4 * i]), Math.abs(was[4 * i + 2]))).toBeGreaterThanOrEqual(0.9 * 14);
      expect(Math.hypot(s.p[4 * i] - crown.x, s.p[4 * i + 2] - crown.z)).toBeLessThanOrEqual(0.8 * crown.r + 1e-6);
      expect(s.p[4 * i + 1]).toBeGreaterThanOrEqual(crown.lo);
      expect(s.p[4 * i + 1]).toBeLessThanOrEqual(crown.hi);
      expect(s.rest[i]).toBe(0);
    }
    expect(got).toBeGreaterThan(0);
  });

  it('can’t be let go when the ring is empty', () => {
    const s = makeLeafSim(32);
    layLeaves(s, 32, { half: 14, rand: seeded(4) });
    for (let i = 0; i < s.count; i++) s.p[4 * i] = s.p[4 * i + 2] = 0;
    expect(shedLeaf(s, crown, { focus: F, half: 14, rand: seeded(1) })).toBe(-1);
    expect(shakeLeaves(s, 5, 4, 5, 1, 0, 6, { focus: F, half: 14, rand: seeded(1) })).toBe(0);
  });

  it('are shaken loose by a bolt through the crown, sent its way', () => {
    const s = makeLeafSim(64);
    layLeaves(s, 64, { half: 14, rand: seeded(4) });
    const rand = seeded(2);
    const before = s.rest.slice();
    const n = shakeLeaves(s, 5, 4, 5, 0.6, 0.8, 6, { focus: F, half: 14, rand });
    expect(n).toBeGreaterThan(0);
    let shaken = 0;
    for (let i = 0; i < s.count; i++) {
      if (s.rest[i] === before[i]) continue;
      shaken += 1;
      expect(Math.abs(s.p[4 * i] - 5)).toBeLessThanOrEqual(0.4);
      expect(Math.abs(s.p[4 * i + 1] - 4)).toBeLessThanOrEqual(0.4);
      expect(s.v[3 * i] * 0.8 - s.v[3 * i + 2] * 0.6).toBeCloseTo(0, 6);
      expect(s.v[3 * i]).toBeGreaterThan(0);
    }
    expect(shaken).toBe(n);
  });
});
