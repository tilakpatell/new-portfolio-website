import { describe, expect, it } from 'vitest';
import { findLegs, legGait, legPose, legWeights, standPose, surfacePoints } from './legRig';

// a stick person 1.8 m tall: two legs 0.24 m apart up to the crotch at
// 0.85 m, a body over them as wide as both, arms hanging at its sides
function person({ stride = 0 } = {}) {
  const pts = [];
  for (let y = 0; y <= 1.8; y += 0.01) {
    if (y < 0.85) {
      for (const s of [1, -1])
        for (let a = 0; a < 6; a++) pts.push([s * 0.12 + Math.cos(a) * 0.06, y, s * stride * (1 - y / 0.85) + Math.sin(a) * 0.06]);
    } else for (let x = -0.2; x <= 0.2; x += 0.04) pts.push([x, y, 0]);
    if (y > 0.75 && y < 1.45) for (const s of [1, -1]) pts.push([s * 0.32, y, 0]);
  }
  return pts;
}

describe('legRig', () => {
  it('finds a person’s legs: the crotch where they meet, left (+x) first', () => {
    const l = findLegs(person());
    expect(l).not.toBeNull();
    expect(l.crotch).toBeGreaterThan(0.8);
    expect(l.crotch).toBeLessThan(0.9);
    expect(l.legs[0].x).toBeCloseTo(0.12, 1);
    expect(l.legs[1].x).toBeCloseTo(-0.12, 1);
    expect(l.knee).toBeLessThan(l.hip);
    expect(l.ankle).toBeLessThan(l.knee);
  });

  it('finds them mid-stride too, one foot ahead', () => {
    const l = findLegs(person({ stride: 0.15 }));
    expect(l).not.toBeNull();
    expect(l.legs[0].x).toBeGreaterThan(l.legs[1].x);
  });

  it('finds none where the legs never part (a robe to the ground), unless told', () => {
    const robe = [];
    for (let y = 0; y <= 1; y += 0.01) for (let x = -0.3; x <= 0.3; x += 0.02) robe.push([x, y, 0]);
    expect(findLegs(robe)).toBeNull();
    const told = findLegs(robe, { crotch: 0.4, x: 0.1 });
    expect(told.crotch).toBeCloseTo(0.4, 1);
  });

  it('weighs every vertex whole, the feet to the feet and the chest to the body', () => {
    const l = findLegs(person());
    for (const p of person()) {
      const sum = legWeights(p, l).reduce((a, [, w]) => a + w, 0);
      expect(sum).toBeCloseTo(1, 9);
    }
    const top = (p) => legWeights(p, l).reduce((a, b) => (b[1] > a[1] ? b : a));
    expect(top([0, 1.5, 0])[0]).toBe(0); // the chest: the body
    expect(top([0.12, 0.02, 0])[0]).toBe(3); // the left foot
    expect(top([-0.12, 0.02, 0])[0]).toBe(6); // the right foot
    expect(top([0.12, 0.3, 0])[0]).toBe(2); // the left shin
    expect(top([-0.12, 0.7, 0])[0]).toBe(4); // the right thigh
  });

  it('swings the legs half a cycle apart by the ground covered, the feet level, and stands them still', () => {
    const l = findLegs(person());
    const g = { phase: 0, amount: 0 };
    for (let i = 0; i < 30; i++) legGait(g, 1 / 30, 1.4, l);
    const a = legPose(g, 0, l);
    const b = legPose(g, 1, l);
    expect(Math.sign(a.thigh)).toBe(-Math.sign(b.thigh));
    expect(a.thigh + a.knee + a.foot).toBeCloseTo(0, 9);
    // a second of walking at 1.4 m/s is 1.4 m: so many cycles of 1.6 legs
    expect(g.phase).toBeCloseTo((1.4 / (1.6 * (l.hip - l.bottom))) % 1, 6);
    for (let i = 0; i < 120; i++) legGait(g, 1 / 30, 0, l);
    expect(Math.abs(legPose(g, 0, l).thigh)).toBeLessThan(0.01);
  });

  it('finds a low-poly figure\'s legs from points on its surface, where its vertices are only at the ends', () => {
    // two leg boxes 0–0.85 m and a body box 0.85–1.8 m: eight corners each, nothing between
    const pos = [];
    const box = (x0, x1, y0, y1, z0, z1) => {
      const c = [];
      for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) c.push([x, y, z]);
      // the twelve triangles of its six faces
      for (const [a, b, d, e] of [
        [0, 1, 3, 2],
        [4, 5, 7, 6],
        [0, 1, 5, 4],
        [2, 3, 7, 6],
        [0, 2, 6, 4],
        [1, 3, 7, 5],
      ])
        pos.push(...c[a], ...c[b], ...c[d], ...c[a], ...c[d], ...c[e]);
    };
    box(0.06, 0.18, 0, 0.85, -0.06, 0.06);
    box(-0.18, -0.06, 0, 0.85, -0.06, 0.06);
    box(-0.15, 0.15, 0.85, 1.8, -0.03, 0.03);
    const verts = [];
    for (let i = 0; i < pos.length; i += 3) verts.push([pos[i], pos[i + 1], pos[i + 2]]);
    expect(findLegs(verts)).toBeNull();
    const pts = surfacePoints(new Float32Array(pos), null, 6000);
    expect(pts.length).toBeGreaterThan(5000);
    const l = findLegs(pts);
    expect(l).not.toBeNull();
    expect(l.crotch).toBeCloseTo(0.85, 1);
    expect(l.legs[0].x).toBeCloseTo(0.12, 1);
    // (the same each time: no randomness)
    expect(surfacePoints(new Float32Array(pos), null, 6000)).toEqual(pts);
  });

  it('shifts its weight standing, a knee at a time, the foot kept under the hip and level; walking, not at all', () => {
    const seen = new Set();
    for (let t = 0; t < 20; t += 0.5) {
      const [l, r] = [0, 1].map((i) => standPose(t, 3, i, 0));
      for (const p of [l, r]) {
        expect(p.knee).toBeGreaterThanOrEqual(0);
        expect(p.knee).toBeCloseTo(-2 * p.thigh, 6);
        expect(p.thigh + p.knee + p.foot).toBeCloseTo(0, 6);
        expect(p.knee).toBeLessThan(0.2);
      }
      seen.add(l.knee > r.knee);
    }
    expect(seen.size).toBe(2);
    expect(Math.max(...[0, 1, 2, 3].map((t) => standPose(t, 3, 0, 0).knee))).toBeGreaterThan(0.02);
    expect(standPose(5, 3, 0, 1)).toEqual({ thigh: -0, knee: 0, foot: 0 });
  });
});
