import { describe, expect, it } from 'vitest';
import { COAST, PLACES, RIVER, SPAWN, WORLD, blockAt, buildWorld, groundAt, near, waterAt, zoneAt } from './map';

const W = buildWorld();
const overlaps = (b, x, z, r) => x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1;
// a seeded walk over the map
const points = (n, seed = 3) => {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, () => [(r() * 2 - 1) * WORLD.half, (r() * 2 - 1) * WORLD.half]);
};

describe('the land', () => {
  it('is flat in town and rises into hills to the north', () => {
    expect(groundAt(0, 0)).toBe(0);
    expect(groundAt(-2200, 400)).toBe(0);
    expect(groundAt(0, -3000)).toBeGreaterThan(40);
  });
  it('has the river east of downtown and the sea to the south', () => {
    expect(waterAt((RIVER.x0 + RIVER.x1) / 2, 0)).toBe(true);
    expect(waterAt(0, COAST + 200)).toBe(true);
    expect(waterAt(0, 0)).toBe(false);
    expect(zoneAt(-2400, 0)).toBe('suburb');
    expect(zoneAt(0, 0)).toBe('city');
  });
  it('knows a block from a street', () => {
    expect(blockAt(0, 0)).not.toBeNull(); // the plaza's block
    expect(blockAt(40, 0)).toBeNull(); // a street line runs at x = 40
  });
});

describe('the buildings', () => {
  it('has a downtown of towers and a suburb of houses', () => {
    expect(W.buildings.length).toBeGreaterThan(600);
    expect(W.houses.length).toBeGreaterThan(1500);
    expect(Math.max(...W.buildings.map((b) => b.h + (b.top?.h ?? 0)))).toBeGreaterThan(250);
  });
  it('builds nothing in the water', () => {
    for (const b of W.boxes) {
      if (b.bridge) continue;
      for (const [x, z] of [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1], [(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2]]) expect(waterAt(x, z), `box ${b.id} at ${x},${z}`).toBe(false);
    }
  });
  it('builds nothing over a street in town', () => {
    for (const b of W.buildings) expect(blockAt(b.x, b.z), `building ${b.id}`).not.toBeNull();
  });
  it('finds the same boxes nearby as a scan of all of them', () => {
    for (const [x, z] of points(60)) {
      const r = 30;
      const want = W.boxes.filter((b) => overlaps(b, x, z, r)).map((b) => b.id).sort((a, b) => a - b);
      const got = near(W, x, z, r).filter((b) => overlaps(b, x, z, r)).map((b) => b.id).sort((a, b) => a - b);
      expect(got).toEqual(want);
    }
  });
});

describe('the places', () => {
  it('has the Graysons’, the school, Burger Mart, the Guardians’ hall and the GDA', () => {
    expect(PLACES.map((p) => p.id).sort()).toEqual(['burgermart', 'gda', 'guardians', 'home', 'school']);
  });
  it('puts every door on open ground', () => {
    for (const p of W.places) {
      const [x, z] = p.door;
      expect(waterAt(x, z), p.id).toBe(false);
      expect(W.boxes.filter((b) => overlaps(b, x, z, 2.5)).map((b) => b.id), p.id).toEqual([]);
    }
  });
  it('starts you on the Graysons’ lawn, clear of everything', () => {
    const home = W.places.find((p) => p.id === 'home');
    expect(Math.hypot(SPAWN.x - home.x, SPAWN.z - home.z)).toBeLessThan(40);
    expect(W.boxes.filter((b) => overlaps(b, SPAWN.x, SPAWN.z, 1.5))).toEqual([]);
    expect(SPAWN.y).toBe(groundAt(SPAWN.x, SPAWN.z));
  });
});
