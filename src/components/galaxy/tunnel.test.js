import { describe, expect, it } from 'vitest';
import { frameOf, keepIn, nearestOn, tunnelPath } from './tunnel';

const len = (a) => Math.hypot(a[0], a[1], a[2]);

describe('tunnelPath', () => {
  it('starts at the mouth heading in, and runs as long as it’s asked', () => {
    const p = tunnelPath('t1', { length: 60, turns: 3, bend: 0.5 });
    expect(p.pts[0]).toEqual([0, 0, 0]);
    expect(p.tans[0][2]).toBeGreaterThan(0.95);
    expect(p.length).toBeGreaterThan(55);
    expect(p.length).toBeLessThan(80);
  });
  it('is the same path for the same seed', () => {
    expect(tunnelPath('a', { length: 40 })).toEqual(tunnelPath('a', { length: 40 }));
    expect(tunnelPath('a', { length: 40 }).pts).not.toEqual(tunnelPath('b', { length: 40 }).pts);
  });
  it('bends no sharper than a ship can follow', () => {
    const p = tunnelPath('c', { length: 80, turns: 4, bend: 0.6 });
    for (let i = 1; i < p.tans.length; i++) {
      const a = p.tans[i - 1];
      const b = p.tans[i];
      const turn = Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
      const step = p.cum[i] - p.cum[i - 1];
      expect(turn / step, `at ${i}`).toBeLessThan(0.12);
    }
  });
});

describe('nearestOn and keepIn', () => {
  const p = tunnelPath('k', { length: 50, turns: 2, bend: 0.4 });
  const tube = { path: p, radius: 2, chamber: 6 };
  it('finds how far along and how far off the axis a point is', () => {
    const at = p.pts[10];
    const n = nearestOn(p, [at[0] + 0.5, at[1], at[2]]);
    expect(n.s).toBeCloseTo(p.cum[10], 0);
    expect(n.off).toBeLessThan(0.6);
  });
  it('leaves a ship inside alone', () => {
    const at = p.pts[20];
    const k = keepIn(tube, at, 0.15);
    expect(k.bumped).toBe(false);
    expect(k.p).toEqual(at);
    expect(k.where).toBe('tube');
  });
  it('pushes a ship that’s gone into the wall back inside it', () => {
    const at = p.pts[20];
    const t = p.tans[20];
    // straight out across the tube, sideways to it
    const side = Math.abs(t[1]) < 0.9 ? [t[2], 0, -t[0]] : [1, 0, 0];
    const l = len(side);
    const out = [at[0] + (side[0] / l) * 3, at[1] + (side[1] / l) * 3, at[2] + (side[2] / l) * 3];
    const k = keepIn(tube, out, 0.15);
    expect(k.bumped).toBe(true);
    expect(nearestOn(p, k.p).off).toBeLessThanOrEqual(2 - 0.15 + 1e-6);
  });
  it('has a chamber at its far end, room to turn round in', () => {
    const end = p.pts[p.pts.length - 1];
    const t = p.tans[p.tans.length - 1];
    const c = [end[0] + t[0] * 6 * 0.8, end[1] + t[1] * 6 * 0.8, end[2] + t[2] * 6 * 0.8];
    const k = keepIn(tube, [c[0] + 4, c[1], c[2]], 0.15);
    expect(k.where).toBe('chamber');
    expect(k.bumped).toBe(false);
  });
  it('says when a ship’s back out of its mouth', () => {
    expect(keepIn(tube, [0, 0, -1.5], 0.15).where).toBe('out');
  });
});

describe('frameOf', () => {
  it('takes points into a tunnel’s own frame and back', () => {
    const f = frameOf([10, 5, -3], [0, -1, 0], [1, 0, 0]);
    const w = [12, 1, -2];
    const l = f.toLocal(w);
    expect(l[2]).toBeCloseTo(4); // (4 in along its way in, straight down)
    const back = f.toWorld(l);
    back.forEach((v, i) => expect(v).toBeCloseTo(w[i], 9));
  });
});
