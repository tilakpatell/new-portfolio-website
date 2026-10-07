import { describe, expect, it } from 'vitest';
import { attend, createGlance, heard, lineHold, scanAt, stepMotion } from './living';

describe('how long a line takes to say', () => {
  it('grows with the line, inside a short and a long', () => {
    expect(lineHold('Hi, Morty.')).toBeCloseTo(1.6, 6);
    const mid = lineHold('Oh, hey, Morty. Brad’s around somewhere.');
    expect(mid).toBeGreaterThan(1.6);
    expect(mid).toBeLessThan(6);
    expect(lineHold('word '.repeat(200))).toBe(6);
    expect(lineHold('')).toBe(1.6);
    expect(lineHold(null)).toBe(1.6);
  });
});

describe('a searcher’s head', () => {
  it('sweeps from one side of its facing to the other and back', () => {
    const at = { x: 2, z: 3, yaw: 0 }; // (facing +z)
    const angles = [];
    for (let t = 0; t < 3.2; t += 0.1) {
      const p = scanAt(at, t, { span: 0.9, period: 3.2, dist: 4 });
      expect(Math.hypot(p.x - at.x, p.z - at.z)).toBeCloseTo(4, 6);
      angles.push(Math.atan2(p.x - at.x, p.z - at.z));
    }
    expect(Math.max(...angles)).toBeGreaterThan(0.8);
    expect(Math.min(...angles)).toBeLessThan(-0.8);
    expect(Math.max(...angles.map(Math.abs))).toBeLessThanOrEqual(0.9 + 1e-9);
  });

  it('sweeps round whichever way it faces, two out of step', () => {
    const p = scanAt({ x: 0, z: 0, yaw: Math.PI / 2 }, 0, { span: 0, dist: 2 });
    expect(p.x).toBeCloseTo(2, 6); // (yaw π/2 faces +x)
    expect(p.z).toBeCloseTo(0, 6);
    const a = scanAt({ x: 0, z: 0, yaw: 0 }, 1, { phase: 0 });
    const b = scanAt({ x: 0, z: 0, yaw: 0 }, 1, { phase: 0.4 });
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.1);
  });
});

describe('Morty’s glance about', () => {
  it('looks off to one side now and then while he stands, back ahead after', () => {
    const g = createGlance({ seed: 3, every: [2, 3], hold: [0.8, 1] });
    const seen = [];
    for (let i = 0; i < 600; i++) seen.push(g.step(1 / 60, true));
    const off = seen.filter((a) => a != null);
    expect(off.length).toBeGreaterThan(0);
    expect(off.length).toBeLessThan(seen.length / 2);
    expect(seen.slice(0, 100).every((a) => a == null)).toBe(true); // (not straight away)
    for (const a of off) expect(Math.abs(a)).toBeGreaterThan(0.3);
  });

  it('never while he moves, and a move starts the wait again', () => {
    const g = createGlance({ seed: 3, every: [2, 3], hold: [0.8, 1] });
    for (let i = 0; i < 600; i++) expect(g.step(1 / 60, false)).toBe(null);
    for (let i = 0; i < 100; i++) expect(g.step(1 / 60, true)).toBe(null);
  });

  it('is the same for a seed, and differs between two', () => {
    const run = (seed) => {
      const g = createGlance({ seed, every: [2, 3] });
      return Array.from({ length: 900 }, () => g.step(1 / 60, true));
    };
    expect(run(5)).toEqual(run(5));
    expect(run(5)).not.toEqual(run(6));
  });
});

describe('a brain’s step to its figure’s feet', () => {
  it('reads speed along its facing, side across it and its turn, in its own units', () => {
    const m = stepMotion({ x: 0, z: 0, yaw: 0 }, { x: 0, z: 0.1, yaw: 0.02 }, 0.1, { scale: 1 });
    expect(m.speed).toBeCloseTo(1, 1);
    expect(Math.abs(m.side)).toBeLessThan(0.02);
    expect(m.turn).toBeCloseTo(0.2, 6);
    const big = stepMotion({ x: 0, z: 0, yaw: 0 }, { x: 0, z: 0.1, yaw: 0 }, 0.1, { scale: 2 });
    expect(big.speed).toBeCloseTo(0.5, 6); // (a figure drawn twice its size covers half its own stride)
  });

  it('takes a jump across the room for someone put there, not a step', () => {
    const m = stepMotion({ x: 0, z: 0, yaw: 0 }, { x: 8, z: 0, yaw: 1 }, 1 / 60, { scale: 1 });
    expect(m).toEqual({ speed: 0, side: 0, turn: 0 });
    expect(stepMotion(null, { x: 1, z: 1, yaw: 0 }, 0.1)).toEqual({ speed: 0, side: 0, turn: 0 });
    expect(stepMotion({ x: 0, z: 0, yaw: 0 }, { x: 0, z: 1, yaw: 0 }, 0)).toEqual({ speed: 0, side: 0, turn: 0 });
  });
});

describe('a word to someone', () => {
  it('is new once for each time Morty talks to them', () => {
    expect(heard({ id: 'beth', n: 1 }, 'beth', 0)).toBe(true);
    expect(heard({ id: 'beth', n: 1 }, 'beth', 1)).toBe(false);
    expect(heard({ id: 'beth', n: 2 }, 'beth', 1)).toBe(true);
    expect(heard({ id: 'jerry', n: 2 }, 'beth', 1)).toBe(false);
    expect(heard(null, 'beth', 1)).toBe(false);
  });
});

describe('one who stands about', () => {
  const someone = (calls = true) => {
    const log = { look: [], react: [] };
    const c = { group: { position: { x: 0, y: 0, z: 0 } }, log };
    if (calls) {
      c.look = (p) => log.look.push(p);
      c.react = (e, ctx) => log.react.push([e, ctx]);
    }
    return c;
  };
  const at = (x, z, talk = null) => ({ morty: { x, z }, talk });

  it('turns its head to Morty while he’s near, and lets go once he’s gone', () => {
    const c = someone();
    const b = {};
    expect(attend(c, b, 'beth', 1, at(10, 0))).toBe(null);
    expect(c.log.look).toEqual([]); // (nothing asked of it while there's nothing to look at)
    expect(attend(c, b, 'beth', 2, at(2, 0), { y: 0.5 })).toEqual({ x: 2, y: 1.95, z: 0 });
    attend(c, b, 'beth', 3, at(10, 0));
    attend(c, b, 'beth', 4, at(10, 0));
    expect(c.log.look.map((p) => p && p.x)).toEqual([2, null]);
  });

  it('talks with its hands for a word to it, once, its head on him till it’s said', () => {
    const c = someone();
    const b = {};
    attend(c, b, 'beth', 1, at(8, 0, { id: 'beth', n: 3, hold: 2.5 }));
    attend(c, b, 'beth', 2, at(8, 0, { id: 'beth', n: 3, hold: 2.5 }));
    expect(c.log.react).toEqual([['say', { hold: 2.5, target: { x: 8, y: 1.45, z: 0 } }]]);
    expect(attend(c, b, 'beth', 3.4, at(8, 0))).toEqual({ x: 8, y: 1.45, z: 0 }); // (still saying it)
    expect(attend(c, b, 'beth', 3.6, at(8, 0))).toBe(null);
    attend(c, b, 'beth', 4, at(8, 0, { id: 'jerry', n: 4, hold: 2 }));
    expect(c.log.react.length).toBe(1);
  });

  it('does nothing it can’t, in shapes', () => {
    const c = someone(false);
    expect(() => attend(c, {}, 'beth', 1, at(1, 0, { id: 'beth', n: 1 }))).not.toThrow();
    expect(() => attend(c, {}, 'beth', 1, null)).not.toThrow();
  });
});
