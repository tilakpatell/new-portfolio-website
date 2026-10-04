import { describe, expect, it } from 'vitest';
import { DESKS, DOORS, PLAN, STAFF, WALLS_OUTER, segments, toWorld, wallRuns } from './layout';

describe('the floor plan', () => {
  it('reads walls as straight runs', () => {
    expect(segments('M0 0 H10 V5 h-4 v-2 Z')).toEqual([
      [0, 0, 10, 0],
      [10, 0, 10, 5],
      [10, 5, 6, 5],
      [6, 5, 6, 3],
      [6, 3, 0, 0],
    ]);
  });

  it('cuts the doorways out of the walls', () => {
    const runs = wallRuns(WALLS_OUTER);
    // the lobby door: the west wall at x=142 is open from y=40 to 70
    const west = runs.filter(([x0, , x1]) => x0 === 142 && x1 === 142);
    expect(west.length).toBeGreaterThan(1);
    for (const [, y0, , y1] of west) {
      const [a, b] = [Math.min(y0, y1), Math.max(y0, y1)];
      expect(b <= 40 || a >= 70).toBe(true);
    }
    expect(segments(DOORS).length).toBeGreaterThan(0);
  });

  it('gives everyone a desk but the receptionist, who has the counter', () => {
    for (const s of STAFF) {
      if (s.id === 'erin') continue;
      expect(DESKS.find((d) => d.who === s.id), s.id).toBeTruthy();
    }
  });

  it('keeps every desk on the plan, and Michael’s in his office', () => {
    for (const d of DESKS) {
      const [x, y, w, h] = d.at;
      expect(x >= 0 && y >= 0 && x + w <= PLAN.w && y + h <= PLAN.h).toBe(true);
      expect(['n', 's', 'e', 'w']).toContain(d.seat);
    }
    const m = DESKS.find((d) => d.who === 'michael');
    expect(m.at[0]).toBeGreaterThan(206);
    expect(m.at[0] + m.at[2]).toBeLessThan(324);
  });

  it('measures the set in metres', () => {
    const a = toWorld(0, 0);
    const b = toWorld(PLAN.w, PLAN.h);
    expect(b.x - a.x).toBeCloseTo(PLAN.w * PLAN.metres, 9);
    expect(b.x - a.x).toBeGreaterThan(25); // the set is about thirty metres across
  });
});
