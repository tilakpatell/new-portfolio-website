import { describe, expect, it } from 'vitest';
import { CALM, airBrain, pointAt, prepareRoute } from './air';
import { createLife } from './life';
import { seeded } from '../../../lib/seeded';

// a base at (1000, 1000) with a guard of fighters round it
const spec = { id: 'test', seed: 11, biomes: [{ id: 'plains' }], pois: [{ id: 'base', name: 'Base', at: [1000, 1000], r: 200, edge: 100, h: 0 }] };
const field = { heightAt: () => 0, biomeAt: () => 0 };
const fights = { range: 700, burst: { n: 3, gap: 0.14 }, strafe: { speed: 3, every: 2.4, keep: 400 }, damage: 6 };
const life = {
  kinds: { default: 'wild', poi: 'hostile' },
  air: [{ name: 'tie', model: 'tie', perKm2: 1, alt: [150, 250], speed: 180, route: 'patrol', kind: 'hostile', near: 'poi', scramble: { r: 2400, n: 2 }, hostile: fights }],
  ground: [],
};
const dt = 1 / 30;

describe('air', () => {
  it('flies a route as a closed loop', () => {
    const r = prepareRoute({ points: [[0, 100, 0], [100, 100, 0], [100, 100, 100], [0, 100, 100]] });
    expect(r.length).toBeCloseTo(400);
    expect(pointAt(r, 0.125)).toMatchObject({ x: 50, y: 100, z: 0 });
    expect(pointAt(r, 1.125).x).toBeCloseTo(50);
    // (nose along the leg: +x is yaw −π/2 in the flight's terms)
    expect(pointAt(r, 0.1).yaw).toBeCloseTo(-Math.PI / 2);
  });

  it('keeps a ship with no guard to keep on its route', () => {
    const a = { route: { anchor: [0, 0] }, b: { x: 0, y: 0, z: 0, yaw: 0 } };
    expect(airBrain(a).step({ ship: { x: 0, y: 0, z: 0 }, mates: [a] }, 0.1).mode).toBe('route');
  });

  it('scrambles two at a ship at 300 m/s, hunts it, fires, gives up, and goes back to its route', () => {
    const hits = [];
    const l = createLife({ spec, life, field, rand: seeded(1), now: () => 0, warn: () => {}, onHit: (d) => hits.push(d) });
    const at = { x: 1000, y: 300, z: 6000, yaw: 0, pitch: 0, roll: 0, speed: 300 };
    for (let i = 0; i < 40; i++) l.update(at, dt);
    const ships = [...l.actors.values()].filter((a) => a.air);
    expect(ships.length).toBeGreaterThanOrEqual(3);
    expect(ships.every((a) => a.mode === 'route')).toBe(true);

    // in over the base at 300 m/s, nose down −z
    const news = [];
    let shots = 0;
    for (let i = 0; i < 30 * 30; i++) {
      at.z -= 300 * dt;
      if (at.z < -1000) at.z += 4000;
      const r = l.update(at, dt);
      news.push(...r.news);
      shots += r.shots.reduce((n, s) => n + s.n, 0);
    }
    const hunting = ships.filter((a) => a.mode === 'hunt');
    expect(hunting).toHaveLength(2);
    expect(news.filter((n) => n === 'Patrol inbound')).toHaveLength(1);
    expect(shots).toBeGreaterThan(0);
    for (const d of hits) expect(d).toBeLessThanOrEqual(30);

    // away and out of range: CALM seconds on, they give up and fly back
    at.z = 1000 + 4000;
    for (let i = 0; i < 30 * (CALM - 2); i++) l.update(at, dt);
    expect(ships.filter((a) => a.mode === 'hunt')).toHaveLength(2);
    for (let i = 0; i < 30 * 4; i++) l.update(at, dt);
    expect(ships.some((a) => a.mode === 'hunt')).toBe(false);
    for (let i = 0; i < 30 * 60; i++) l.update(at, dt);
    for (const a of hunting) {
      expect(a.mode).toBe('route');
      expect(a.fly).toBeFalsy();
      // where the route has got to
      const p = pointAt(a.route, a.u);
      expect(Math.hypot(p.x - a.b.x, p.z - a.b.z)).toBeLessThan(1);
    }
  });
});
