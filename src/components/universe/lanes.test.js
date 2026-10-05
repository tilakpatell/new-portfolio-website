import { describe, expect, it } from 'vitest';
import { bezier, clearance, flybyLane, laneBetween, laneLength, meteorLane, tangent } from './lanes';
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
      for (const p of [pts[0], pts[2]]) expect(Math.hypot(p[0], p[2])).toBeLessThan(MAP_RADIUS + 24);
      const big = laneBetween(rand, { high: true });
      expect(laneLength(big)).toBeGreaterThan(MAP_RADIUS);
    }
  });
});

describe('traffic where you are', () => {
  it('curves round the place and leaves it, clear of everything, within sight', async () => {
    const { laneLocal, laneDepart } = await import('./lanes');
    const { PLACES } = await import('./deep');
    let made = 0;
    PLACES.forEach((place, i) => {
      const rand = seeded(20 + i);
      for (let n = 0; n < 12; n++) {
        for (const [make, within] of [
          [laneLocal, place.reach + 24.5 + place.reach * 0.35],
          [laneDepart, place.reach + 17.5],
        ]) {
          const pts = make(place, rand, { high: n % 4 === 0 });
          if (!pts) continue;
          made++;
          expect(clearance(pts), `${place.id} ${n}`).toBeGreaterThan(0.5);
          // it starts or ends beside the place
          const near = Math.min(...[pts[0], pts[2]].map((p) => Math.hypot(p[0] - place.at[0], p[2] - place.at[2])));
          expect(near, `${place.id} ${n}`).toBeLessThan(within);
        }
      }
    });
    expect(made).toBeGreaterThan(PLACES.length * 12);
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

describe('a meteor stream', () => {
  it('runs straight across the ship’s path ahead, at its height, clear of everything, or not at all', () => {
    const rand = seeded(29);
    let made = 0;
    const ships = [...ORDER.map((id) => ({ ...parkAt(id), y: 0, speed: 0 })), { x: 0, y: 0.3, z: 400, heading: 0, speed: 0 }, { x: -2500, y: 120, z: 3000, heading: 1.1, speed: 0 }];
    for (const s of ships) {
      for (let n = 0; n < 6; n++) {
        const lane = meteorLane(s, rand);
        if (!lane) continue;
        made++;
        const [from, to] = lane;
        const pts = [from, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2], to];
        expect(clearance(pts), `${s.x},${s.z}`).toBeGreaterThan(3);
        // ahead of the nose, from one side to the other, level with the ship
        const [fx, fz] = [-Math.sin(s.heading), -Math.cos(s.heading)];
        for (const p of [from, to]) {
          expect((p[0] - s.x) * fx + (p[2] - s.z) * fz).toBeGreaterThan(40);
          expect(Math.abs(p[1] - s.y)).toBeLessThan(2.01);
        }
        const side = (p) => (p[0] - s.x) * -fz + (p[2] - s.z) * fx;
        expect(Math.sign(side(from))).not.toBe(Math.sign(side(to)));
        expect(Math.hypot(to[0] - from[0], to[2] - from[2])).toBeGreaterThan(100);
      }
    }
    expect(made).toBeGreaterThan(ships.length * 3);
  });
});
