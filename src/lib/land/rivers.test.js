import { describe, expect, it } from 'vitest';
import { REGION, STEP, clipRivers, lakeAt, nearestRiverPoint, regionRivers, riversNear } from './rivers';
import { landSpec } from './spec';
import { fieldAt } from './layers';

const temperate = (seed) => landSpec(seed, 'temperate');

describe('regionRivers', () => {
  it('has the plan’s constants', () => {
    expect(REGION).toBe(1024);
    expect(STEP).toBe(8);
  });

  it('never climbs, and ends in the sea or a lake', () => {
    let seen = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const spec = temperate(seed);
      for (const r of regionRivers(spec, 0, 0)) {
        seen++;
        const p = r.points;
        expect(p.length % 5).toBe(0);
        expect(p.length / 5).toBeGreaterThanOrEqual(2);
        for (let i = 5; i < p.length; i += 5) expect(p[i + 2]).toBeLessThanOrEqual(p[i - 3]);
        const last = p[p.length - 3];
        if (r.lake) {
          expect(r.lake.r).toBeGreaterThanOrEqual(20);
          expect(r.lake.r).toBeLessThanOrEqual(60);
          expect(r.lake.depth).toBe(spec.rivers.depth);
        } else expect(Math.abs(last - spec.sea)).toBeLessThan(0.5);
        if (last > spec.sea + 0.5) expect(r.lake).not.toBeNull();
      }
    }
    expect(seen).toBeGreaterThan(10);
  });

  it('widens as it runs, from 0.6 of its width at its source', () => {
    const spec = temperate(4);
    const all = [0, 1, 2].flatMap((rx) => regionRivers(spec, rx, 0));
    for (const r of all) {
      const p = r.points;
      if (r.source) expect(p[3]).toBeCloseTo(spec.rivers.width * 0.6, 3);
      for (let i = 8; i < p.length; i += 5) expect(p[i]).toBeGreaterThanOrEqual(p[i - 5]);
    }
    const long = all.sort((a, b) => b.length - a.length)[0];
    expect(long.points[long.points.length - 2]).toBeGreaterThan(spec.rivers.width * 0.6 + 0.5);
  });

  it('fills a lake it stalls in and runs on from its rim', () => {
    const all = [1, 2, 3, 4].flatMap((seed) => regionRivers(temperate(seed), 0, 0));
    const spilt = all.filter((r) => !r.source);
    expect(spilt.length).toBeGreaterThan(0);
    for (const r of spilt) {
      const up = all.find((u) => u.lake && Math.hypot(u.lake.x - r.points[0], u.lake.z - r.points[1]) <= u.lake.r + 8.01);
      expect(up).toBeTruthy();
      expect(r.points[2]).toBeLessThanOrEqual(up.lake.level + 1e-4);
    }
  });

  it('stays near its own region, so the 3 × 3 round a cell holds every river that reaches it', () => {
    for (let seed = 1; seed <= 10; seed++) {
      for (const r of regionRivers(temperate(seed), 2, -1)) {
        for (let i = 0; i < r.points.length; i += 5) {
          expect(r.points[i]).toBeGreaterThan(2 * REGION - REGION + 64);
          expect(r.points[i]).toBeLessThan(3 * REGION + REGION - 64);
          expect(r.points[i + 1]).toBeGreaterThan(-REGION - REGION + 64);
          expect(r.points[i + 1]).toBeLessThan(0 + REGION - 64);
        }
      }
    }
  });

  it('starts each source on a high, inside its region', () => {
    const spec = temperate(9);
    for (const r of regionRivers(spec, 1, 1).filter((v) => v.source)) {
      const [x, z] = r.points;
      expect(x).toBeGreaterThanOrEqual(REGION + 32);
      expect(x).toBeLessThan(2 * REGION - 32);
      expect(z).toBeGreaterThanOrEqual(REGION + 32);
      expect(fieldAt(spec, x, z)).toBeGreaterThan(spec.sea);
    }
  });

  it('is the same twice', () => {
    const spec = temperate(5);
    const a = regionRivers(spec, 3, -2);
    const b = regionRivers({ ...spec }, 3, -2);
    expect(a.length).toBe(b.length);
    a.forEach((r, i) => expect(Array.from(r.points)).toEqual(Array.from(b[i].points)));
  });

  it('gives none with perRegion 0', () => {
    const spec = temperate(5);
    expect(regionRivers({ ...spec, rivers: { ...spec.rivers, perRegion: 0 } }, 0, 0)).toEqual([]);
  });
});

describe('riversNear', () => {
  it('gives the cells either side of a region edge the same river across it', () => {
    let found = 0;
    for (let seed = 1; seed <= 40 && !found; seed++) {
      const spec = temperate(seed);
      for (let cz = -16; cz < 32 && !found; cz++) {
        const z0 = cz * 64;
        const crossing = riversNear(spec, 15, cz).find((r) => {
          for (let i = 5; i < r.points.length; i += 5) {
            const xa = r.points[i - 5];
            const xb = r.points[i];
            const za = r.points[i - 4];
            if ((xa - 1024) * (xb - 1024) <= 0 && za >= z0 && za < z0 + 64) return true;
          }
          return false;
        });
        if (!crossing) continue;
        found++;
        const other = riversNear(spec, 16, cz).find((r) => r.points.length === crossing.points.length && r.points[0] === crossing.points[0] && r.points[1] === crossing.points[1]);
        expect(other).toBeTruthy();
        expect(Array.from(other.points)).toEqual(Array.from(crossing.points));
      }
    }
    expect(found).toBe(1);
  });
});

describe('nearestRiverPoint and lakeAt', () => {
  // a straight river along +x at z = 0, level falling 10 → 9
  const straight = [{ points: new Float32Array([0, 0, 10, 4, 2, 50, 0, 9.5, 4, 2, 100, 0, 9, 4, 2]), lake: { x: 120, z: 0, r: 20, level: 9.5, depth: 2 }, length: 100 }];

  it('finds the point 1 m beside the river, and its way', () => {
    const n = nearestRiverPoint(straight, 25, 1);
    expect(n.d).toBeCloseTo(1, 5);
    expect(n.level).toBeCloseTo(9.75, 5);
    expect(n.width).toBe(4);
    expect(n.depth).toBe(2);
    expect(n.tangent[0]).toBeCloseTo(1, 5);
    expect(n.tangent[1]).toBeCloseTo(0, 5);
  });

  it('gives nothing beyond twice the width', () => {
    expect(nearestRiverPoint(straight, 25, 8.5)).toBeNull();
    expect(nearestRiverPoint([], 0, 0)).toBeNull();
  });

  it('finds the lake it ends in', () => {
    expect(lakeAt(straight, 125, 5).level).toBe(9.5);
    expect(lakeAt(straight, 200, 0)).toBeNull();
  });

  it('clips a river to a box without losing the segment that crosses it', () => {
    const c = clipRivers(straight, 60, -10, 70, 10, 0);
    expect(c).toHaveLength(1);
    expect(Array.from(c[0].points.slice(0, 1))).toEqual([50]);
    expect(nearestRiverPoint(c, 65, 1).d).toBeCloseTo(1, 5);
    expect(clipRivers(straight, 0, 50, 10, 60, 0)).toHaveLength(0);
    expect(clipRivers(straight, 130, -5, 140, 5, 0)[0].lake).toBeTruthy();
  });
});
