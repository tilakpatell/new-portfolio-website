import { describe, expect, it } from 'vitest';
import { ORDER, REACH } from './layout';
import { cover, enterPlan, focusPose, overviewPose, poseAt, project, startFlight, worldPos } from './flight';
import { byId } from './universes';

const gap = (a, b) => Math.hypot(a.target[0] - b.target[0], a.target[1] - b.target[1], a.target[2] - b.target[2]) + Math.abs(Math.log(a.dist / b.dist)) + Math.abs(a.pitch - b.pitch);

const SCREENS = [
  ['desktop with the panel', { w: 1440, h: 900, panel: 400, top: 64 }],
  ['phone with the sheet', { w: 390, h: 844, sheet: Math.round(844 * 0.46), top: 56 }],
  ['phone on its side', { w: 844, h: 390, sheet: Math.round(390 * 0.46), top: 56 }],
];

describe('the overview', () => {
  for (const [name, screen] of SCREENS) {
    it(`fits every universe in the open area: ${name}`, () => {
      const size = { w: screen.w, h: screen.h };
      const rect = cover(screen);
      const pose = overviewPose(size, rect);
      for (const yaw of [0, 1, 2.5]) {
        for (const id of ORDER) {
          const p = worldPos(id, yaw);
          for (const dx of [-REACH[id], REACH[id]]) {
            const [x, y, z] = project([p[0] + dx, p[1], p[2]], pose, size, rect);
            expect(z, id).toBeGreaterThan(0);
            expect(x, `${id} x at yaw ${yaw}`).toBeGreaterThanOrEqual(rect.x);
            expect(x, `${id} x at yaw ${yaw}`).toBeLessThanOrEqual(rect.x + rect.w);
            expect(y, `${id} y at yaw ${yaw}`).toBeGreaterThanOrEqual(rect.y);
            expect(y, `${id} y at yaw ${yaw}`).toBeLessThanOrEqual(rect.y + rect.h);
          }
        }
      }
    });
  }
});

describe('a selected universe', () => {
  it('sits in the middle of the open area', () => {
    const screen = SCREENS[0][1];
    const rect = cover(screen);
    const pose = focusPose('marvel', 0.7, screen, rect);
    const [x, y] = project(worldPos('marvel', 0.7), pose, screen, rect);
    expect(x).toBeCloseTo(rect.x + rect.w / 2, 3);
    expect(y).toBeCloseTo(rect.y + rect.h / 2, 3);
  });
});

describe('the flight', () => {
  const size = { w: 1440, h: 900 };
  const rect = cover({ ...size, panel: 400 });
  const a = overviewPose(size, rect);
  const b = focusPose('office', 0, size, rect);

  it('starts where it was and ends where it is going, closing in all the way', () => {
    const f = startFlight(a, 1000);
    expect(poseAt(f, b, 1000).pose).toEqual(a);
    expect(poseAt(f, b, 1000 + f.dur)).toEqual({ pose: b, done: true });
    let last = Infinity;
    for (let t = 0; t <= f.dur; t += 50) {
      const g = gap(poseAt(f, b, 1000 + t).pose, b);
      expect(g).toBeLessThanOrEqual(last + 1e-9);
      last = g;
    }
  });

  it('retargets mid-flight from where the camera is, with no jump', () => {
    const f = startFlight(a, 0);
    const mid = poseAt(f, b, 300).pose;
    const c = focusPose('travel', 0, size, rect);
    const g = startFlight(mid, 300);
    expect(poseAt(g, c, 300).pose).toEqual(mid);
    expect(poseAt(g, c, 300 + g.dur).pose).toEqual(c);
  });

  it('opens straight on a universe from a link (no flight)', () => {
    expect(poseAt(null, b, 0)).toEqual({ pose: b, done: true });
  });
});

describe('Enter', () => {
  it('jumps for Star Wars, dives for the rest, and just goes without motion or 3D', () => {
    expect(enterPlan(byId('starwars'), { reduced: false, three: true })).toEqual({ mode: 'jump', delay: 1250 });
    expect(enterPlan(byId('office'), { reduced: false, three: true })).toEqual({ mode: 'dive', delay: 600 });
    expect(enterPlan(byId('starwars'), { reduced: true, three: true })).toEqual({ mode: 'now', delay: 0 });
    expect(enterPlan(byId('office'), { reduced: false, three: false })).toEqual({ mode: 'now', delay: 0 });
    expect(enterPlan(undefined, { reduced: false, three: true })).toBeNull();
  });

  it('goes the way the ship would', () => {
    expect(enterPlan(byId('starwars'), { reduced: false, three: true, ship: 'falcon' })).toEqual({ mode: 'jump', delay: 1250 });
    expect(enterPlan(byId('starwars'), { reduced: false, three: true, ship: 'xwing' })).toEqual({ mode: 'jump', delay: 1250 });
    expect(enterPlan(byId('starwars'), { reduced: false, three: true, ship: 'cruiser' })).toEqual({ mode: 'portal', delay: 600 });
    expect(enterPlan(byId('office'), { reduced: false, three: true, ship: 'cruiser' })).toEqual({ mode: 'portal', delay: 600 });
    expect(enterPlan(byId('office'), { reduced: true, three: true, ship: 'cruiser' })).toEqual({ mode: 'now', delay: 0 });
  });
});
