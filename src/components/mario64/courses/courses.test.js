import { describe, expect, it } from 'vitest';
import { findFloor, pushWalls } from '../rules/collide';
import { AREAS, COURSES, buildArea } from './index';

// things that stand against walls on purpose
const ON_WALLS = new Set(['painting', 'stardoor', 'door', 'gate', 'post']);

describe.each(Object.keys(AREAS))('the %s area', (id) => {
  const area = AREAS[id];
  const { world } = buildArea(id);

  it('builds, with triangles to stand on', () => {
    expect(world.all.length).toBeGreaterThan(100);
  });

  const spots = [
    ...Object.entries(area.entries).map(([name, e]) => [`entry ${name}`, e]),
    ...area.actors.filter((a) => !ON_WALLS.has(a.type) && a.type !== 'ballspawner').map((a, i) => [`${a.type} #${i}`, a]),
    ...(area.redStar ? [['the red coin star', area.redStar]] : []),
  ];

  it.each(spots)('has %s over a floor, not inside a wall', (_, p) => {
    const f = findFloor(world, p.x, p.y + 10, p.z);
    expect(f, `no floor under (${p.x}, ${p.y}, ${p.z})`).not.toBeNull();
    expect(p.y - f.y).toBeLessThan(400);
    expect(p.y - f.y).toBeGreaterThan(-20);
    const q = { x: p.x, y: f.y, z: p.z };
    pushWalls(world, q, 60, 50);
    expect(Math.hypot(q.x - p.x, q.z - p.z), `in a wall at (${p.x}, ${p.z})`).toBeLessThan(1);
  });
});

describe('the courses', () => {
  it('lists five, in painting order, with the spec\'s star doors', () => {
    expect(COURSES.map((c) => c.id)).toEqual(['bobomb', 'snow', 'beach', 'haunt', 'bowser']);
    expect(COURSES.map((c) => c.need)).toEqual([0, 1, 3, 5, 8]);
    for (const c of COURSES) expect(c.stars).toHaveLength(3);
  });

  it('has a painting for every course in the castle, and a star door for every one behind one', () => {
    const castle = AREAS.castle;
    for (const c of COURSES) {
      expect(castle.actors.some((a) => a.type === 'painting' && a.course === c.id), c.id).toBe(true);
      if (c.need > 0) expect(castle.actors.some((a) => a.type === 'stardoor' && a.need === c.need), c.id).toBe(true);
      expect(castle.entries[c.id], `return spot for ${c.id}`).toBeDefined();
    }
  });

  it('gives Bob-omb Ridge exactly eight red coins, and its three stars', () => {
    const b = AREAS.bobomb;
    expect(b.actors.filter((a) => a.type === 'coin' && a.kind === 'red')).toHaveLength(8);
    expect(b.redStar.index).toBe(1);
    expect(b.actors.find((a) => a.type === 'king').star).toBe(0);
    expect(b.actors.find((a) => a.type === 'gate').star).toBe(2);
  });

  it('makes every live course an area with a main entry', () => {
    for (const c of COURSES.filter((x) => x.live)) {
      expect(AREAS[c.area]).toBeDefined();
      expect(AREAS[c.area].entries.main).toBeDefined();
    }
  });
});
