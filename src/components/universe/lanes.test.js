import { describe, expect, it } from 'vitest';
import { bezier, clearance, flybyLane, laneBetween, laneLength, tangent } from './lanes';
import { SHIP, parkAt, spawn } from './ship';
import { MAP_RADIUS, ORDER } from './layout';

// the same "random" every run
const seeded = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

describe('a lane', () => {
  it('runs from its first point to its last, along its tangent', () => {
    const pts = [
      [0, 0, 0],
      [5, 2, 0],
      [10, 0, 0],
    ];
    expect(bezier(pts, 0)).toEqual([0, 0, 0]);
    expect(bezier(pts, 1)).toEqual([10, 0, 0]);
    expect(bezier(pts, 0.5)).toEqual([5, 1, 0]);
    expect(tangent(pts, 0.5)).toEqual([10, 0, 0]);
    expect(laneLength(pts)).toBeGreaterThan(10);
    expect(laneLength(pts)).toBeLessThan(11);
  });
});

describe('everyday traffic', () => {
  it('never meets a planet, a station or the sun, and stays off the disc you fly on', () => {
    const rand = seeded(7);
    for (let n = 0; n < 300; n++) {
      const high = n % 5 === 0;
      const pts = laneBetween(rand, { high });
      expect(clearance(pts), `lane ${n}`).toBeGreaterThan(0.5);
      for (let i = 0; i <= 20; i++) expect(Math.abs(bezier(pts, i / 20)[1] - SHIP.height), `lane ${n}`).toBeGreaterThan(2.5);
    }
  });

  it('flies between places inside the map, and the big ships right across it', () => {
    const rand = seeded(3);
    for (let n = 0; n < 50; n++) {
      const pts = laneBetween(rand);
      for (const p of [pts[0], pts[2]]) expect(Math.hypot(p[0], p[2])).toBeLessThan(MAP_RADIUS + 8);
      const big = laneBetween(rand, { high: true });
      expect(laneLength(big)).toBeGreaterThan(MAP_RADIUS);
    }
  });
});

describe('a flyby', () => {
  it('crosses in front of the nose, close enough to hit with a shot', () => {
    const rand = seeded(13);
    let made = 0;
    for (const id of ORDER) {
      const at = parkAt(id);
      const ship = { ...spawn(null), x: at.x, z: at.z, heading: at.heading + Math.PI };
      const pts = flybyLane(ship, rand, { cross: true });
      if (!pts) continue;
      made++;
      expect(clearance(pts)).toBeGreaterThan(0.6);
      // somewhere along it, it's right in front of the ship: on the line a shot flies
      const fwd = [-Math.sin(ship.heading), -Math.cos(ship.heading)];
      let best = Infinity;
      for (let i = 0; i <= 200; i++) {
        const p = bezier(pts, i / 200);
        const along = (p[0] - ship.x) * fwd[0] + (p[2] - ship.z) * fwd[1];
        const off = Math.abs((p[0] - ship.x) * fwd[1] - (p[2] - ship.z) * fwd[0]);
        if (along > 2) best = Math.min(best, off);
      }
      expect(best).toBeLessThan(0.2);
    }
    expect(made).toBeGreaterThan(ORDER.length / 2);
  });

  it('comes from ahead, passes close beside the ship without touching it, and goes on behind', () => {
    const rand = seeded(11);
    let made = 0;
    for (const id of ORDER) {
      const at = parkAt(id);
      const ship = { ...spawn(null), x: at.x, z: at.z, heading: at.heading + Math.PI }; // facing away from the planet
      for (let n = 0; n < 4; n++) {
        const pts = flybyLane(ship, rand, { cross: false });
        if (!pts) continue;
        made++;
        expect(clearance(pts)).toBeGreaterThan(0.6);
        let closest = Infinity;
        for (let i = 0; i <= 100; i++) {
          const p = bezier(pts, i / 100);
          closest = Math.min(closest, Math.hypot(p[0] - ship.x, p[1] - ship.y, p[2] - ship.z));
        }
        expect(closest).toBeGreaterThan(0.7);
        expect(closest).toBeLessThan(2.4);
        // starts in front of the ship, ends behind it
        const fwd = [-Math.sin(ship.heading), -Math.cos(ship.heading)];
        const along = (p) => (p[0] - ship.x) * fwd[0] + (p[2] - ship.z) * fwd[1];
        expect(along(pts[0])).toBeGreaterThan(10);
        expect(along(pts[2])).toBeLessThan(-3);
      }
    }
    expect(made).toBeGreaterThan(ORDER.length * 3); // nearly always there's a way past
  });

  it('is skipped when it would go through a planet', () => {
    const at = parkAt('marvel');
    const ship = { ...spawn(null), x: at.x, z: at.z, heading: at.heading }; // facing the planet, close
    const rand = seeded(5);
    for (let n = 0; n < 20; n++) {
      const pts = flybyLane(ship, rand);
      if (pts) expect(clearance(pts)).toBeGreaterThan(0.6);
    }
  });
});

describe('lanes out in deep space', () => {
  it('finds lanes near the ship out there, clear of everything', async () => {
    const { laneNear, convoyLane, clearance, bezier } = await import('./lanes');
    const { DEEP } = await import('./deep');
    let rand = seeded(5);
    let made = 0;
    for (let i = 0; i < 40; i++) {
      const a = i * 0.7;
      const ship = { x: Math.cos(a) * (DEEP.open + 60 + i * 9), y: (i % 5) * 10 - 20, z: Math.sin(a) * (DEEP.open + 60 + i * 9), heading: a };
      for (const make of [laneNear, convoyLane]) {
        const pts = make(ship, rand);
        if (!pts) continue;
        made++;
        expect(clearance(pts)).toBeGreaterThan(1.4);
        // it passes within sight of the ship
        let near = Infinity;
        for (let k = 0; k <= 50; k++) {
          const p = bezier(pts, k / 50);
          near = Math.min(near, Math.hypot(p[0] - ship.x, p[1] - ship.y, p[2] - ship.z));
        }
        expect(near).toBeLessThan(60);
        expect(near).toBeGreaterThan(3);
      }
      rand = seeded(5 + i);
    }
    expect(made).toBeGreaterThan(60);
  });
});
