import { describe, expect, it } from 'vitest';
import { COAST, HILLS, PLACES, RIVER, SPAWN, WORLD, blockAt, buildWorld, groundAt, isSafeStart, near, waterAt, zoneAt } from './map';
import { FLY, newHero, stepHero } from './flight';

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
  it('runs the river through the hills in a valley, not a slot', () => {
    for (let z = HILLS - 50; z > -WORLD.half; z -= 50) {
      // the banks are level with the water's edge in town, and the slopes up from them walkable
      expect(groundAt(RIVER.x0, z), `west bank at ${z}`).toBeLessThan(1);
      expect(groundAt(RIVER.x1, z), `east bank at ${z}`).toBeLessThan(1);
      for (let d = 0; d < 800; d += 5) {
        for (const [a, b] of [[RIVER.x1 + d, RIVER.x1 + d + 5], [RIVER.x0 - d, RIVER.x0 - d - 5]]) expect(Math.abs(groundAt(b, z) - groundAt(a, z)) / 5, `slope at ${a}, ${z}`).toBeLessThan(1);
      }
    }
    expect(groundAt(0, -3000)).toBeGreaterThan(40); // the hills away from it are as they were
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
  it('grows no trees in the water', () => {
    for (const [x, z] of W.trees) expect(zoneAt(x, z) === 'river' || waterAt(x, z), `tree at ${x}, ${z}`).toBe(false);
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

describe('a saved place to start from', () => {
  const tower = W.buildings.reduce((a, b) => (b.h > a.h ? b : a));
  const [body, top] = W.boxes.filter((b) => b.building === tower.id).sort((a, b) => a.y0 - b.y0);
  const house = W.houses[40];
  const home = W.houses.find((q) => q.home);
  const homeBox = W.boxes.find((b) => b.house === W.houses.indexOf(home));
  const bridge = W.boxes.find((b) => b.bridge);
  const hill = groundAt(0, -3000);
  it('takes the spawn, a street, a lawn and the air over a park', () => {
    expect(isSafeStart(W, SPAWN)).toBe(true);
    expect(isSafeStart(W, { x: 40, y: 0, z: 0 })).toBe(true); // the street east of the plaza
    expect(isSafeStart(W, { x: SPAWN.x, y: SPAWN.y, z: SPAWN.z, face: 1 })).toBe(true);
    expect(isSafeStart(W, { x: -240, y: 120, z: -880 })).toBe(true); // over the big park north of downtown
    expect(isSafeStart(W, { x: 0, y: hill + 0.2, z: -3000 })).toBe(true); // on a hillside
  });
  it('takes a roof, a bridge’s deck and the pavement right by a wall: where he can stand', () => {
    expect(isSafeStart(W, { x: top.x0 + 1, y: top.y1, z: tower.z })).toBe(true); // on the tower's top
    expect(isSafeStart(W, { x: body.x0 + 1, y: body.y1, z: tower.z })).toBe(true); // on its roof, beside the top
    expect(isSafeStart(W, { x: home.x, y: homeBox.y1, z: home.z })).toBe(true); // on the Graysons' roof
    expect(isSafeStart(W, { x: RIVER.x1 + 10, y: bridge.y1, z: (bridge.z0 + bridge.z1) / 2 })).toBe(true); // a bridge's deck, over the bank
    // walked into a wall, ./flight.js leaves him standing FLY.R off it: where he'd be saved
    let h = newHero({ x: body.x0 - 5, z: tower.z, face: Math.PI / 2 });
    const into = { fwd: 1, side: 0, up: 0, down: 0, boost: false, run: false, jump: false, look: [1, 0, 0] };
    for (let i = 0; i < 240; i++) h = stepHero(h, into, 1 / 60, W);
    expect(h.mode).toBe('ground');
    expect(body.x0 - h.p[0]).toBeCloseTo(FLY.R, 6);
    expect(isSafeStart(W, { x: h.p[0], y: h.p[1], z: h.p[2] })).toBe(true);
  });
  it('turns down a place inside a building', () => {
    expect(isSafeStart(W, { x: tower.x, y: 40, z: tower.z })).toBe(false);
    expect(isSafeStart(W, { x: body.x0 + 1, y: 0, z: tower.z })).toBe(false); // a metre in, at street level
    expect(isSafeStart(W, { x: tower.x - tower.w / 2 + 0.2, y: 0, z: tower.z })).toBe(false); // just inside the wall
    expect(isSafeStart(W, { x: tower.x - tower.w / 2 - 0.2, y: 0, z: tower.z })).toBe(false); // so close he'd be in it
    expect(isSafeStart(W, { x: top.x0 + 1, y: body.y1, z: tower.z })).toBe(false); // on the roof, but inside the top
    expect(isSafeStart(W, { x: top.x0 + 1, y: top.y1 - 1, z: tower.z })).toBe(false); // a metre down into the top
    expect(isSafeStart(W, { x: RIVER.x1 + 10, y: 0, z: (bridge.z0 + bridge.z1) / 2 })).toBe(false); // in a bridge's deck
    expect(isSafeStart(W, { x: house.x, y: 1, z: house.z })).toBe(false);
    expect(isSafeStart(W, { x: 0, y: 5, z: 0 })).toBe(false); // the Guardians' hall
  });
  it('turns down a place under the land', () => {
    expect(isSafeStart(W, { ...SPAWN, y: -500 })).toBe(false);
    expect(isSafeStart(W, { ...SPAWN, y: SPAWN.y - 1 })).toBe(false);
    expect(isSafeStart(W, { x: 0, y: hill - 10, z: -3000 })).toBe(false);
  });
  it('turns down a place off the edge of the world or above the sky', () => {
    expect(isSafeStart(W, { x: WORLD.half + 1, y: 0, z: 0 })).toBe(false);
    expect(isSafeStart(W, { x: 0, y: 0, z: -WORLD.half - 1 })).toBe(false);
    expect(isSafeStart(W, { x: -240, y: WORLD.ceiling, z: -880 })).toBe(false);
    expect(isSafeStart(W, { x: -240, y: 9500, z: -880 })).toBe(false);
  });
  it('turns down a place over the water', () => {
    expect(isSafeStart(W, { x: (RIVER.x0 + RIVER.x1) / 2, y: 0, z: 0 })).toBe(false);
    expect(isSafeStart(W, { x: (RIVER.x0 + RIVER.x1) / 2, y: 60, z: 0 })).toBe(false);
    expect(isSafeStart(W, { x: 0, y: 0, z: COAST + 200 })).toBe(false);
  });
  it('turns down anything that isn’t three numbers, without throwing', () => {
    for (const at of [null, undefined, 'x', 7, [], {}, { x: 0, z: 0 }, { x: NaN, y: 0, z: 0 }, { x: 40, y: Infinity, z: 0 }, { x: '40', y: '0', z: '0' }, { x: 40, y: null, z: 0 }]) expect(isSafeStart(W, at), JSON.stringify(at)).toBe(false);
  });
  it('turns everything down with no world to look in', () => {
    expect(isSafeStart(null, SPAWN)).toBe(false);
  });
});
