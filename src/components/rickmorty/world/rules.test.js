import { describe, expect, it, vi } from 'vitest';
import { pushOut } from '../../middleearth/towns/walker';
import {
  AREAS,
  ARCADE,
  BOARD,
  BUILDINGS,
  COLLIDERS,
  CRUISER,
  DRIVEWAY,
  FENCES,
  GARAGE,
  HOTSPOTS,
  HOUSE,
  HOUSE_GARAGE,
  LINKS,
  MORTY,
  NEIGHBOURS,
  OUTDOOR,
  QUIZ,
  ROAD,
  ROOM_IDS,
  SCHOOL,
  START,
  TASKS,
  TREES,
  WALLS,
  areaAt,
  canLand,
  collidersIn,
  exitCruiser,
  floorAt,
  grade,
  inArea,
  nearHotspot,
  nearLink,
  newCruiser,
  newMorty,
  progress,
  stepCruiser,
  stepMorty,
  wallsIn,
} from './rules';

const DT = 1 / 60;
const link = (id) => LINKS.find((l) => l.id === id);
const centre = (a) => ({ x: (a.x0 + a.x1) / 2, z: (a.z0 + a.z1) / 2 });
const street = [...BUILDINGS];

// is a Morty-sized circle at (x, z) standing in the area, clear of everything in it?
const free = (area, x, z, rad = MORTY.radius) => {
  if (!inArea(area, x, z, -rad)) return false;
  const [px, pz] = pushOut(x, z, rad, collidersIn(area), wallsIn(area));
  return Math.hypot(px - x, pz - z) < 1e-6;
};

// can Morty walk from a to b (to within `r` of it)? A search over half-metre squares.
function canWalk(area, a, b, r) {
  const S = 0.5;
  const key = (i, j) => `${i},${j}`;
  const seen = new Set([key(0, 0)]);
  const queue = [[0, 0]];
  while (queue.length) {
    const [i, j] = queue.shift();
    if (Math.hypot(a.x + i * S - b.x, a.z + j * S - b.z) < r) return true;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = key(i + di, j + dj);
      if (seen.has(k)) continue;
      seen.add(k);
      if (free(area, a.x + (i + di) * S, a.z + (j + dj) * S)) queue.push([i + di, j + dj]);
    }
  }
  return false;
}

// how near a point is to a box footprint (0 inside it)
const boxDist = (b, x, z) => Math.hypot(Math.max(Math.abs(x - b.x) - b.w / 2, 0), Math.max(Math.abs(z - b.z) - b.d / 2, 0));
const segDist = (px, pz, [x0, z0, x1, z1]) => {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (x0 + t * dx), pz - (z0 + t * dz));
};
const walk = (m, move, seconds, area = 'street', opts) => {
  for (let t = 0; t < seconds; t += DT) m = stepMorty(m, move, DT, area, opts);
  return m;
};

describe('C-137: the areas', () => {
  it('finds each area from its centre, and nothing between them', () => {
    for (const id of [...OUTDOOR, ...ROOM_IDS]) expect(areaAt(centre(AREAS[id]).x, centre(AREAS[id]).z), id).toBe(id);
    expect(areaAt(-200, 0)).toBe(null);
    expect(areaAt(200, 0)).toBe(null);
    expect(areaAt(-300, 50)).toBe(null);
    expect(areaAt(0, 100)).toBe(null);
  });

  it('knows the rooms from the outdoors, and pads in and out of an area', () => {
    expect(ROOM_IDS).toEqual(['house', 'garage', 'school', 'arcade']);
    expect(OUTDOOR).toEqual(['street', 'annex']);
    expect(inArea('street', 60, 0)).toBe(true);
    expect(inArea('street', 60.1, 0)).toBe(false);
    expect(inArea('street', 60, 0, -0.4)).toBe(false);
    expect(inArea('street', 60.3, 0, 0.4)).toBe(true);
  });
});

describe('C-137: the layout', () => {
  it('has the road run east to west along the middle, with sidewalks either side', () => {
    expect(ROAD).toEqual({ z: 0, w: 10, sidewalk: 2 });
  });

  it('keeps every footprint inside its own area', () => {
    for (const b of street) {
      expect(b.x - b.w / 2, b.id).toBeGreaterThanOrEqual(AREAS.street.x0);
      expect(b.x + b.w / 2, b.id).toBeLessThanOrEqual(AREAS.street.x1);
      expect(b.z - b.d / 2, b.id).toBeGreaterThanOrEqual(AREAS.street.z0);
      expect(b.z + b.d / 2, b.id).toBeLessThanOrEqual(AREAS.street.z1);
      expect(b.roof, b.id).toBeGreaterThanOrEqual(b.h);
    }
    expect(ARCADE.x - ARCADE.w / 2).toBeGreaterThanOrEqual(AREAS.annex.x0);
    expect(ARCADE.x + ARCADE.w / 2).toBeLessThanOrEqual(AREAS.annex.x1);
    expect(ARCADE.z - ARCADE.d / 2).toBeGreaterThanOrEqual(AREAS.annex.z0);
    expect(ARCADE.z + ARCADE.d / 2).toBeLessThanOrEqual(AREAS.annex.z1);
  });

  it('keeps every building off the road and its sidewalks, and apart from the others', () => {
    for (const b of street) expect(Math.abs(b.z) - b.d / 2, b.id).toBeGreaterThanOrEqual(ROAD.w / 2 + ROAD.sidewalk);
    for (const a of street)
      for (const b of street)
        if (a !== b) {
          const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.z - b.z) >= (a.d + b.d) / 2;
          expect(apart, `${a.id} / ${b.id}`).toBe(true);
        }
  });

  it('has six neighbours, three a side, and a house and garage that sit within one footprint', () => {
    expect(NEIGHBOURS).toHaveLength(6);
    expect(NEIGHBOURS.filter((n) => n.z < 0).map((n) => n.x)).toEqual([-42, 24, 46]);
    expect(NEIGHBOURS.filter((n) => n.z > 0).map((n) => n.x)).toEqual([-42, -18, 4]);
    expect(BUILDINGS).toEqual([HOUSE, GARAGE, SCHOOL, ...NEIGHBOURS]);
    for (const b of [HOUSE, GARAGE]) {
      expect(b.x - b.w / 2, b.id).toBeGreaterThanOrEqual(HOUSE_GARAGE.x0);
      expect(b.x + b.w / 2, b.id).toBeLessThanOrEqual(HOUSE_GARAGE.x1);
      expect(b.z - b.d / 2, b.id).toBeGreaterThanOrEqual(HOUSE_GARAGE.z0);
      expect(b.z + b.d / 2, b.id).toBeLessThanOrEqual(HOUSE_GARAGE.z1);
    }
  });

  it('parks the cruiser on the driveway, in front of the garage, nose to the road', () => {
    expect(BOARD.x).toBeGreaterThan(DRIVEWAY.x0 + CRUISER.radius);
    expect(BOARD.x).toBeLessThan(DRIVEWAY.x1 - CRUISER.radius);
    expect(BOARD.z).toBeGreaterThan(DRIVEWAY.z0 + CRUISER.radius);
    expect(BOARD.z).toBeLessThan(DRIVEWAY.z1 - CRUISER.radius);
    expect(Math.cos(BOARD.yaw)).toBe(1);
  });

  it('plants about eighteen trees, the same every visit, clear of buildings, road, driveway and doors', () => {
    expect(TREES.length).toBeGreaterThanOrEqual(14);
    expect(TREES.length).toBeLessThanOrEqual(24);
    const doors = LINKS.filter((l) => l.area === 'street');
    const landings = LINKS.filter((l) => l.to === 'street').map((l) => l.arrive);
    for (const t of TREES) {
      expect(inArea('street', t.x, t.z, -1), 'in the street').toBe(true);
      for (const b of street) expect(boxDist(b, t.x, t.z), `${b.id}`).toBeGreaterThanOrEqual(2);
      expect(Math.abs(t.z - ROAD.z), 'road').toBeGreaterThanOrEqual(ROAD.w / 2 + ROAD.sidewalk);
      const d = { x: Math.max(DRIVEWAY.x0 - t.x, 0, t.x - DRIVEWAY.x1), z: Math.max(DRIVEWAY.z0 - t.z, 0, t.z - DRIVEWAY.z1) };
      expect(Math.hypot(d.x, d.z), 'driveway').toBeGreaterThanOrEqual(2);
      for (const l of doors) expect(Math.hypot(t.x - l.x, t.z - l.z), l.id).toBeGreaterThanOrEqual(2);
      for (const a of landings) expect(Math.hypot(t.x - a.x, t.z - a.z), 'landing').toBeGreaterThanOrEqual(2);
      expect(Math.hypot(t.x - START.x, t.z - START.z), 'start').toBeGreaterThanOrEqual(2);
      for (const f of FENCES) expect(segDist(t.x, t.z, f), 'fence').toBeGreaterThanOrEqual(1);
    }
    vi.resetModules();
    return import('./rules').then((again) => expect(again.TREES).toEqual(TREES));
  });

  it('runs low picket fences round the back yards, behind the houses', () => {
    expect(FENCES.length).toBeGreaterThan(6);
    for (const [x0, z0, x1, z1, thick, low] of FENCES) {
      expect(low).toBe(true);
      expect(thick).toBeGreaterThan(0);
      for (const z of [z0, z1]) expect(z <= -25 || z >= 26).toBe(true);
      for (const x of [x0, x1]) expect(Math.abs(x)).toBeLessThanOrEqual(AREAS.street.x1);
    }
    expect(WALLS.street).toBe(FENCES);
    expect(wallsIn('street')).toBe(FENCES);
    expect(wallsIn('annex')).toEqual([]);
    for (const id of ROOM_IDS) expect(wallsIn(id), id).toEqual([]);
  });

  it('puts a collider on every building, the annex arcade included, and on every tree', () => {
    const boxes = collidersIn('street').filter((c) => c.kind === 'box');
    for (const b of street) expect(boxes.some((c) => c.x === b.x && c.z === b.z && c.w === b.w && c.d === b.d), b.id).toBe(true);
    expect(collidersIn('street').filter((c) => c.kind === 'circle')).toHaveLength(TREES.length);
    expect(collidersIn('annex').some((c) => c.x === ARCADE.x && c.z === ARCADE.z && c.w === ARCADE.w && c.d === ARCADE.d)).toBe(true);
    expect(COLLIDERS.street).toBe(collidersIn('street'));
  });

  it('keeps the parked cruiser out of the colliders: it is added by whoever walks', () => {
    for (const c of collidersIn('street')) expect(c.kind === 'circle' && c.r === CRUISER.radius, c.id).toBe(false);
    expect(collidersIn('street')).toBe(collidersIn('street'));
  });

  it('puts furniture in every room, inside it', () => {
    for (const id of ROOM_IDS) {
      const room = AREAS[id];
      expect(collidersIn(id).length, id).toBeGreaterThanOrEqual(3);
      for (const c of collidersIn(id)) {
        expect(c.kind).toBe('box');
        expect(c.x - c.w / 2, `${id} ${c.id}`).toBeGreaterThanOrEqual(room.x0 - 1e-9);
        expect(c.x + c.w / 2, `${id} ${c.id}`).toBeLessThanOrEqual(room.x1 + 1e-9);
        expect(c.z - c.d / 2, `${id} ${c.id}`).toBeGreaterThanOrEqual(room.z0 - 1e-9);
        expect(c.z + c.d / 2, `${id} ${c.id}`).toBeLessThanOrEqual(room.z1 + 1e-9);
      }
    }
  });
});

describe('C-137: walking about as Morty', () => {
  it('starts on the road, on the pavement, facing the other side', () => {
    expect(START.area).toBe('street');
    expect(Math.abs(START.z - ROAD.z)).toBeLessThan(ROAD.w / 2);
    expect(free('street', START.x, START.z)).toBe(true);
    const m = newMorty();
    expect(m).toMatchObject({ x: START.x, z: START.z, face: START.face, vx: 0, vz: 0, speed: 0, running: false });
    expect(newMorty({ x: 1, z: 2, face: 3 })).toMatchObject({ x: 1, z: 2, face: 3 });
  });

  it('walks north for a second at walking pace, and stays out of everything', () => {
    let m = newMorty();
    for (let t = 0; t < 1; t += DT) {
      m = stepMorty(m, { x: 0, z: -1 }, DT, 'street');
      expect(free('street', m.x, m.z)).toBe(true);
    }
    const went = START.z - m.z;
    expect(went).toBeGreaterThan(1.5);
    expect(went).toBeLessThan(MORTY.walk + 0.1);
    expect(Math.abs(m.x - START.x)).toBeLessThan(1e-6);
    expect(m.speed).toBeGreaterThan(MORTY.walk - 0.5);
    expect(m.running).toBe(false);
  });

  it('runs faster than it walks', () => {
    const a = walk(newMorty(), { x: 1, z: 0 }, 1);
    const b = walk(newMorty(), { x: 1, z: 0, run: true }, 1);
    expect(b.x - START.x).toBeGreaterThan(a.x - START.x + 1.5);
    expect(b.running).toBe(true);
  });

  it('stops at the front wall of the house', () => {
    const m = walk(newMorty({ x: HOUSE.x, z: -9, face: Math.PI / 2 }), { x: 0, z: -1 }, 4);
    expect(m.z).toBeCloseTo(HOUSE.z + HOUSE.d / 2 + MORTY.radius, 1);
    expect(m.x).toBeCloseTo(HOUSE.x, 1);
    expect(free('street', m.x, m.z)).toBe(true);
  });

  it('cannot squeeze between the house and the garage: they are one block', () => {
    const gap = (HOUSE.x + HOUSE.w / 2 + GARAGE.x - GARAGE.w / 2) / 2;
    const m = walk(newMorty({ x: gap, z: -9, face: Math.PI / 2 }), { x: 0, z: -1 }, 4);
    expect(m.z).toBeCloseTo(HOUSE.z + HOUSE.d / 2 + MORTY.radius, 1);
  });

  it('stops dead soon after the keys are let go, even from a run', () => {
    let m = walk(newMorty(), { x: 1, z: 0, run: true }, 2);
    expect(m.speed).toBeGreaterThan(MORTY.walk);
    m = walk(m, { x: 0, z: 0 }, 0.5);
    expect(m.speed).toBeLessThan(0.05);
  });

  it('keeps to its own area: the edge of the street, and the walls of a room', () => {
    const west = walk(newMorty(), { x: -1, z: 0, run: true }, 20);
    expect(west.x).toBeCloseTo(AREAS.street.x0 + MORTY.radius, 1);
    const arrive = link('house-door').arrive;
    const east = walk(newMorty(arrive), { x: 1, z: 0, run: true }, 6, 'house');
    expect(east.x).toBeCloseTo(AREAS.house.x1 - MORTY.radius, 1);
    const north = walk(newMorty(arrive), { x: 0, z: -1, run: true }, 8, 'house');
    expect(north.z).toBeGreaterThanOrEqual(AREAS.house.z0 + MORTY.radius - 1e-6);
  });

  it('stops at the TV stand in the living room', () => {
    const tv = collidersIn('house').find((c) => c.id === 'tv');
    const m = walk(newMorty({ x: tv.x, z: 0, face: Math.PI / 2 }), { x: 0, z: -1 }, 4, 'house');
    expect(m.z).toBeCloseTo(tv.z + tv.d / 2 + MORTY.radius, 1);
  });

  it('is stopped by the parked cruiser only when it is told it is there', () => {
    const near = { x: BOARD.x + 1, z: BOARD.z, face: 0 };
    const without = stepMorty(newMorty(near), { x: 0, z: 0 }, DT, 'street');
    expect(without.x).toBeCloseTo(near.x, 6);
    const withIt = stepMorty(newMorty(near), { x: 0, z: 0 }, DT, 'street', { cruiser: { x: BOARD.x, z: BOARD.z } });
    expect(Math.hypot(withIt.x - BOARD.x, withIt.z - BOARD.z)).toBeGreaterThanOrEqual(CRUISER.radius + MORTY.radius - 1e-6);
    // walking at it from the road: it stands in the way, then lets go again
    let m = newMorty({ x: BOARD.x, z: -5, face: Math.PI / 2 });
    for (let t = 0; t < 3; t += DT) m = stepMorty(m, { x: 0, z: -1 }, DT, 'street', { cruiser: BOARD });
    expect(m.z).toBeGreaterThanOrEqual(BOARD.z + CRUISER.radius + MORTY.radius - 1e-6);
    m = walk(newMorty({ x: BOARD.x, z: -5 }), { x: 0, z: -1 }, 3);
    expect(m.z).toBeLessThan(BOARD.z);
    // not in a room, and not when it is gone
    const room = link('house-door').arrive;
    expect(stepMorty(newMorty(room), { x: 1, z: 0 }, DT, 'house', { cruiser: room })).toEqual(stepMorty(newMorty(room), { x: 1, z: 0 }, DT, 'house'));
    expect(stepMorty(newMorty(near), { x: 0, z: 0 }, DT, 'street', { cruiser: null }).x).toBeCloseTo(near.x, 6);
  });

  it('can be walked: from the start to every door in the street, and straight from the road to each', () => {
    const doors = LINKS.filter((l) => l.area === 'street');
    expect(doors.length).toBeGreaterThanOrEqual(3);
    for (const l of doors) {
      expect(canWalk('street', START, l, l.r), l.id).toBe(true);
      // the lane from the sidewalk's far edge to the door is clear
      const edge = Math.sign(l.z) * (ROAD.w / 2 + ROAD.sidewalk);
      for (let k = 0; k <= 1; k += 0.02) expect(free('street', l.x, edge + (l.z - edge) * k), `${l.id} lane`).toBe(true);
    }
  });

  it('can be walked in the annex: from the portal to the arcade and back', () => {
    const arrive = link('garage-portal').arrive;
    expect(canWalk('annex', arrive, link('arcade-door'), link('arcade-door').r)).toBe(true);
    expect(canWalk('annex', link('arcade-exit').arrive, link('annex-portal'), link('annex-portal').r)).toBe(true);
  });
});

describe('C-137: doors, exits and portals', () => {
  it('has the links the world needs, with their labels', () => {
    expect(LINKS.map((l) => l.id).sort()).toEqual(['annex-portal', 'arcade-door', 'arcade-exit', 'garage-door', 'garage-exit', 'garage-portal', 'house-door', 'house-exit', 'school-door', 'school-exit']);
    expect(link('house-door')).toMatchObject({ area: 'street', x: -12, z: -13.4, to: 'house', kind: 'door', label: 'Smith house' });
    expect(link('garage-door')).toMatchObject({ area: 'street', x: 3, z: -13.6, to: 'garage', label: 'Rick’s garage' });
    expect(link('school-door')).toMatchObject({ area: 'street', x: 40, z: 14.4, to: 'school', label: 'Harry Herpson High' });
    expect(link('arcade-door')).toMatchObject({ area: 'annex', x: 400, z: -3.4, to: 'arcade', label: 'Blips and Chitz' });
    expect(link('garage-portal')).toMatchObject({ area: 'garage', x: -294.8, z: 100, to: 'annex', kind: 'portal', label: 'Through the portal', arrive: { x: 400, z: 9 } });
    expect(link('annex-portal')).toMatchObject({ area: 'annex', x: 400, z: 13, to: 'garage', kind: 'portal', label: 'Back to the garage', arrive: { x: -296.8, z: 100, face: Math.PI } });
    for (const id of ROOM_IDS) expect(link(`${id}-exit`)).toMatchObject({ area: id, kind: 'exit', label: 'Back outside' });
  });

  it('lands you in the area it leads to, standing clear, and never on another link', () => {
    for (const l of LINKS) {
      const a = l.arrive;
      expect(areaAt(a.x, a.z), l.id).toBe(l.to);
      expect(free(l.to, a.x, a.z), `${l.id} lands clear`).toBe(true);
      for (const o of LINKS.filter((o) => o.area === l.to)) expect(Math.hypot(a.x - o.x, a.z - o.z), `${l.id} lands by ${o.id}`).toBeGreaterThan(o.r + 0.3);
      expect(nearLink(l.to, a.x, a.z), `${l.id} ping-pong`).toBe(null);
    }
  });

  it('turns you to face away from the link you came through', () => {
    for (const l of LINKS) {
      const back = LINKS.filter((o) => o.area === l.to).sort((p, q) => Math.hypot(l.arrive.x - p.x, l.arrive.z - p.z) - Math.hypot(l.arrive.x - q.x, l.arrive.z - q.z))[0];
      const dx = l.arrive.x - back.x;
      const dz = l.arrive.z - back.z;
      const d = Math.hypot(dx, dz);
      const heading = [Math.cos(l.arrive.face), -Math.sin(l.arrive.face)];
      expect((heading[0] * dx + heading[1] * dz) / d, `${l.id} faces`).toBeGreaterThan(0.9);
    }
  });

  it('gives every door an exit back, arriving a little way outside it', () => {
    for (const door of LINKS.filter((l) => l.kind === 'door')) {
      const exit = LINKS.find((l) => l.kind === 'exit' && l.area === door.to);
      expect(exit, door.id).toBeTruthy();
      expect(exit.to).toBe(door.area);
      const out = Math.hypot(exit.arrive.x - door.x, exit.arrive.z - door.z);
      expect(out, `${door.id} exit`).toBeGreaterThan(door.r + 0.3);
      expect(out, `${door.id} exit`).toBeLessThan(3.5);
      // and the door puts you at the exit's end of the room
      const room = AREAS[door.to];
      expect(door.arrive.z, door.id).toBeCloseTo(room.z1 - 2, 6);
      expect(exit.z, door.id).toBeCloseTo(room.z1 - 0.6, 6);
      expect(door.arrive.x).toBe(-300);
      expect(door.arrive.face).toBeCloseTo(Math.PI / 2, 6);
    }
    expect(link('garage-door').arrive.z).toBe(104);
    expect(link('school-door').arrive.z).toBe(204);
    expect(link('arcade-door').arrive.z).toBe(306);
    expect(link('house-door').arrive.z).toBe(4);
  });

  it('keeps every link where Morty can reach and stand, in its own area', () => {
    for (const l of LINKS) {
      expect(areaAt(l.x, l.z), l.id).toBe(l.area);
      expect(free(l.area, l.x, l.z), l.id).toBe(true);
    }
  });

  it('finds the house door at its spot and nothing at the start', () => {
    expect(nearLink('street', -12, -13.4).id).toBe('house-door');
    expect(nearLink('street', -12 + 1.5, -13.4).id).toBe('house-door');
    expect(nearLink('street', -12 + 1.7, -13.4)).toBe(null);
    expect(nearLink('street', START.x, START.z)).toBe(null);
    expect(nearLink('house', -12, -13.4)).toBe(null);
    expect(nearLink('garage', -295.4, 101).id).toBe('garage-portal');
  });
});

describe('C-137: the things to touch', () => {
  it('has the hotspots the rooms need, with their words', () => {
    expect(HOTSPOTS.map((h) => h.id)).toEqual(['cable', 'butter', 'jerry', 'rick', 'meeseeks', 'plumbus', 'portalpanic', 'quiz', 'roy', 'cabinet1', 'cabinet2', 'cabinet3']);
    const at = (id) => HOTSPOTS.find((h) => h.id === id);
    expect(at('cable')).toMatchObject({ area: 'house', x: -304, z: -5.2, r: 1.4, label: 'Watch interdimensional cable', verb: 'Watch' });
    expect(at('butter')).toMatchObject({ area: 'house', x: -295, z: -2, label: 'The butter robot', verb: 'Switch on' });
    expect(at('jerry')).toMatchObject({ area: 'house', x: -304, z: -1.4, label: 'Jerry', verb: 'Talk' });
    expect(at('rick')).toMatchObject({ area: 'garage', x: -302, z: 95.6, label: 'Rick', verb: 'Talk' });
    expect(at('meeseeks')).toMatchObject({ area: 'garage', x: -297.5, z: 95.6, label: 'Mr. Meeseeks box', verb: 'Press' });
    expect(at('plumbus')).toMatchObject({ area: 'garage', x: -305.2, z: 99, label: 'The plumbus factory', verb: 'Watch' });
    expect(at('portalpanic')).toMatchObject({ area: 'garage', x: -305.2, z: 103, label: 'Portal panic cabinet', verb: 'Play' });
    expect(at('quiz')).toMatchObject({ area: 'school', x: -300, z: 196.4, label: 'Mr. Goldenfold’s pop quiz', verb: 'Sit the quiz' });
    expect(at('roy')).toMatchObject({ area: 'arcade', x: -300, z: 293.6, label: 'Roy: A Life Well Lived', verb: 'Put the headset on' });
    for (const id of ['cabinet1', 'cabinet2', 'cabinet3']) expect(at(id)).toMatchObject({ area: 'arcade', verb: 'Play', r: 1.4 });
    for (const h of HOTSPOTS) expect(h.r, h.id).toBe(1.4);
  });

  it('finds each at its own spot, and nothing out in the street', () => {
    for (const h of HOTSPOTS) {
      expect(areaAt(h.x, h.z), h.id).toBe(h.area);
      expect(nearHotspot(h.area, h.x, h.z).id, h.id).toBe(h.id);
    }
    expect(nearHotspot('street', START.x, START.z)).toBe(null);
    expect(nearHotspot('house', -300, 3)).toBe(null);
    expect(nearHotspot('house', -304 + 1.5, -5.2)).toBe(null);
  });

  it('lets Morty stand close enough to every hotspot, and walk there from the way in', () => {
    for (const h of HOTSPOTS) {
      let found = false;
      for (let dx = -h.r; dx <= h.r && !found; dx += 0.1) for (let dz = -h.r; dz <= h.r && !found; dz += 0.1) if (Math.hypot(dx, dz) <= h.r - 0.1 && free(h.area, h.x + dx, h.z + dz)) found = true;
      expect(found, `${h.id} can be stood at`).toBe(true);
      const door = LINKS.find((l) => l.kind === 'door' && l.to === h.area);
      expect(canWalk(h.area, door.arrive, h, h.r - 0.1), `${h.id} can be walked to`).toBe(true);
    }
  });

  it('lets Morty walk from the way in to the way out of every room', () => {
    for (const door of LINKS.filter((l) => l.kind === 'door')) {
      const exit = LINKS.find((l) => l.kind === 'exit' && l.area === door.to);
      expect(canWalk(door.to, door.arrive, exit, exit.r), door.to).toBe(true);
    }
    expect(canWalk('garage', link('annex-portal').arrive, link('garage-exit'), 0.9)).toBe(true);
    expect(canWalk('garage', link('garage-door').arrive, link('garage-portal'), 1.4)).toBe(true);
  });
});

describe('C-137: the cruiser', () => {
  const fly = (c, input, seconds, each) => {
    for (let t = 0; t < seconds; t += DT) {
      c = stepCruiser(c, input, DT);
      each?.(c);
    }
    return c;
  };

  it('starts parked on its spot, at hover height, at rest', () => {
    expect(newCruiser()).toEqual({ x: BOARD.x, z: BOARD.z, y: CRUISER.hover, yaw: BOARD.yaw, speed: 0, vy: 0, bank: 0 });
  });

  it('reaches its top speed under full throttle, and never leaves the street', () => {
    const inside = (c) => expect(inArea('street', c.x, c.z, -2 + 1e-9)).toBe(true);
    let c = fly(newCruiser(), { throttle: 1, steer: 0, lift: 0 }, 5, inside);
    expect(Math.abs(c.speed - CRUISER.top)).toBeLessThanOrEqual(1);
    // east along the road, and across it, and on the diagonal
    for (const yaw of [Math.PI / 2, -Math.PI / 2, Math.PI, 0.7, -2.4]) {
      c = fly({ ...newCruiser(), yaw }, { throttle: 1, steer: 0, lift: 1 }, 8, inside);
      expect(c.speed).toBeLessThanOrEqual(CRUISER.top + 1e-6);
    }
  });

  it('speeds up and slows down at its own pace, and can go back', () => {
    const a = fly(newCruiser(), { throttle: 1 }, 1);
    expect(a.speed).toBeCloseTo(CRUISER.accel, 0);
    const b = fly({ ...newCruiser(), yaw: Math.PI / 2, x: -20 }, { throttle: 0 }, 1);
    expect(b.speed).toBe(0);
    const slowing = fly({ ...newCruiser(), speed: CRUISER.top }, { throttle: 0 }, 1);
    expect(slowing.speed).toBeCloseTo(CRUISER.top - CRUISER.accel, 0);
    const back = fly({ ...newCruiser(), yaw: Math.PI / 2, x: 20 }, { throttle: -1 }, 3);
    expect(back.speed).toBeLessThan(0);
  });

  it('flies the way its nose points: yaw 0 is south, a quarter turn is east, and steering turns it', () => {
    const south = fly({ ...newCruiser(), z: -20 }, { throttle: 1 }, 1);
    expect(south.z).toBeGreaterThan(-20);
    expect(south.x).toBeCloseTo(BOARD.x, 6);
    const east = fly({ ...newCruiser(), x: -40, yaw: Math.PI / 2 }, { throttle: 1 }, 1);
    expect(east.x).toBeGreaterThan(-40);
    expect(east.z).toBeCloseTo(BOARD.z, 6);
    const left = fly(newCruiser(), { steer: 1 }, 1);
    const right = fly(newCruiser(), { steer: -1 }, 1);
    expect(left.yaw).toBeCloseTo(CRUISER.turn, 6);
    expect(right.yaw).toBeCloseTo(-CRUISER.turn, 6);
    expect(fly(newCruiser(), {}, 1)).toEqual({ ...newCruiser() });
  });

  it('leans into a turn at speed, and not when it is still', () => {
    const still = fly(newCruiser(), { steer: 1 }, 1);
    expect(still.bank).toBeCloseTo(0, 6);
    const fast = fly({ ...newCruiser(), x: -40, z: -30, yaw: Math.PI / 2, speed: CRUISER.top }, { throttle: 1, steer: 1 }, 0.5);
    expect(fast.bank).toBeGreaterThan(0.2);
    const other = fly({ ...newCruiser(), x: -40, z: -30, yaw: Math.PI / 2, speed: CRUISER.top }, { throttle: 1, steer: -1 }, 0.5);
    expect(other.bank).toBeLessThan(-0.2);
  });

  it('climbs under lift and stops at the ceiling', () => {
    const c = fly(newCruiser(), { lift: 1 }, 10);
    expect(c.y).toBeCloseTo(CRUISER.ceiling, 6);
    const a = fly(newCruiser(), { lift: 1 }, 1);
    expect(a.y).toBeGreaterThan(CRUISER.hover + 3);
    expect(a.y).toBeLessThan(CRUISER.hover + CRUISER.climb + 0.01);
    // and it comes back down, but not below its hover
    const down = fly(c, { lift: -1 }, 12);
    expect(down.y).toBeCloseTo(CRUISER.hover, 6);
  });

  it('keeps above the roofs: two metres over the top of whatever it is over', () => {
    expect(floorAt(0, 0)).toBe(CRUISER.hover);
    expect(floorAt(HOUSE.x, HOUSE.z)).toBe(HOUSE.roof + 2);
    expect(floorAt(GARAGE.x, GARAGE.z)).toBe(GARAGE.roof + 2);
    expect(floorAt(SCHOOL.x, SCHOOL.z)).toBe(SCHOOL.roof + 2);
    for (const n of NEIGHBOURS) expect(floorAt(n.x, n.z), n.id).toBe(n.roof + 2);
    // padded by the cruiser's own size, so it clears the eaves
    expect(floorAt(HOUSE.x + HOUSE.w / 2 + CRUISER.radius - 0.1, HOUSE.z)).toBe(HOUSE.roof + 2);
    expect(floorAt(HOUSE.x - HOUSE.w / 2 - CRUISER.radius - 0.1, HOUSE.z)).toBe(CRUISER.hover);
    expect(floorAt(HOUSE.x, HOUSE.z + HOUSE.d / 2 + CRUISER.radius + 0.1)).toBe(CRUISER.hover);
    // and across the join between the house and the garage
    expect(floorAt((HOUSE.x + HOUSE.w / 2 + GARAGE.x - GARAGE.w / 2) / 2, HOUSE.z)).toBe(HOUSE.roof + 2);

    let over = 0;
    // from the west along the house's own line, at the lowest it will go
    fly({ ...newCruiser(), x: -40, z: HOUSE.z, yaw: Math.PI / 2 }, { throttle: 1 }, 5, (c) => {
      if (Math.abs(c.x - HOUSE.x) < HOUSE.w / 2 && Math.abs(c.z - HOUSE.z) < HOUSE.d / 2) {
        over++;
        expect(c.y).toBeGreaterThanOrEqual(HOUSE.roof + 2 - 0.01);
      }
      expect(c.y).toBeGreaterThanOrEqual(floorAt(c.x, c.z) - 1e-9);
    });
    expect(over).toBeGreaterThan(5);
    // pressing down over a roof does not take it through
    const held = fly({ ...newCruiser(), x: HOUSE.x, z: HOUSE.z, y: HOUSE.roof + 4 }, { lift: -1 }, 5);
    expect(held.y).toBeCloseTo(HOUSE.roof + 2, 6);
  });

  it('only lands slowly, on open ground in the street', () => {
    expect(canLand(newCruiser())).toBe(true);
    expect(canLand({ ...newCruiser(), speed: 2.9 })).toBe(true);
    expect(canLand({ ...newCruiser(), speed: 3.1 })).toBe(false);
    expect(canLand({ ...newCruiser(), speed: -3.1 })).toBe(false);
    for (const b of [HOUSE, GARAGE, SCHOOL, ...NEIGHBOURS]) expect(canLand({ ...newCruiser(), x: b.x, z: b.z, y: b.roof + 2 }), b.id).toBe(false);
    expect(canLand({ ...newCruiser(), x: HOUSE.x, z: HOUSE.z + HOUSE.d / 2 + CRUISER.radius - 0.1 })).toBe(false);
    expect(canLand({ ...newCruiser(), x: -30, z: 0 })).toBe(true);
    expect(canLand({ ...newCruiser(), x: 100, z: 0 })).toBe(false);
  });

  it('lets Morty out beside it, standing clear, wherever it can land', () => {
    const e = exitCruiser(newCruiser());
    expect(free('street', e.x, e.z)).toBe(true);
    expect(Math.hypot(e.x - BOARD.x, e.z - BOARD.z)).toBeGreaterThanOrEqual(CRUISER.radius + MORTY.radius);
    expect(Math.hypot(e.x - BOARD.x, e.z - BOARD.z)).toBeLessThan(4);
    expect(Math.cos(e.face)).toBeCloseTo(Math.sin(BOARD.yaw), 6);
    expect(-Math.sin(e.face)).toBeCloseTo(Math.cos(BOARD.yaw), 6);
    let tried = 0;
    for (let x = -57; x <= 57; x += 1.5)
      for (let z = -37; z <= 37; z += 1.5)
        for (const yaw of [0, 1, 2.5]) {
          const c = { ...newCruiser(), x, z, yaw };
          if (!canLand(c)) continue;
          tried++;
          const out = exitCruiser(c);
          expect(free('street', out.x, out.z), `from ${x}, ${z}, ${yaw}`).toBe(true);
          expect(Math.hypot(out.x - x, out.z - z), `from ${x}, ${z}, ${yaw}`).toBeGreaterThanOrEqual(CRUISER.radius + MORTY.radius - 1e-6);
        }
    expect(tried).toBeGreaterThan(500);
  });
});

describe('C-137: what there is to do', () => {
  it('lists the ten things, in order, each with a name and a hint', () => {
    expect(TASKS.map((t) => t.id)).toEqual(['cable', 'butter', 'meeseeks', 'plumbus', 'portalpanic', 'quiz', 'fly', 'portal', 'roy', 'roy55']);
    for (const t of TASKS) {
      expect(t.name.length, t.id).toBeGreaterThan(3);
      expect(t.hint.length, t.id).toBeGreaterThan(10);
      expect(t.hint, t.id).not.toMatch(/!/);
    }
  });

  it('starts at the cable, and moves on as things are done, in whatever order', () => {
    const p = progress([]);
    expect(p).toMatchObject({ done: [], count: 0, total: 10 });
    expect(p.next.id).toBe('cable');
    expect(p.objective).toBe(TASKS[0].hint);
    expect(progress().next.id).toBe('cable');
    const q = progress(['roy', 'cable']);
    expect(q.count).toBe(2);
    expect(q.done).toEqual(['cable', 'roy']);
    expect(q.next.id).toBe('butter');
    expect(q.objective).toBe(TASKS[1].hint);
    // strangers and repeats do not count
    expect(progress(['cable', 'cable', 'nonsense']).count).toBe(1);
  });

  it('says so when it is all done', () => {
    const p = progress(TASKS.map((t) => t.id));
    expect(p.count).toBe(10);
    expect(p.next).toBe(null);
    expect(p.objective).toBe('Everything’s done. Wubba lubba dub dub.');
  });
});

describe('C-137: the pop quiz', () => {
  it('has ten questions, each with four different answers and one right one', () => {
    expect(QUIZ).toHaveLength(10);
    for (const q of QUIZ) {
      expect(q.q.endsWith('?'), q.q).toBe(true);
      expect(q.options, q.q).toHaveLength(4);
      expect(new Set(q.options).size, q.q).toBe(4);
      expect(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3, q.q).toBe(true);
    }
    expect(new Set(QUIZ.map((q) => q.answer)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(QUIZ.map((q) => q.q)).size).toBe(10);
  });

  it('gets the show right', () => {
    const right = (re) => {
      const q = QUIZ.find((x) => re.test(x.q));
      expect(q, String(re)).toBeTruthy();
      return q.options[q.answer];
    };
    expect(right(/home dimension/i)).toBe('C-137');
    expect(right(/arcade/i)).toBe('Blips and Chitz');
    expect(right(/how old was Roy/i)).toBe('55');
    expect(right(/family therapy/i)).toBe('a pickle');
    expect(right(/Meeseeks/i)).toBe('complete one task, then vanish');
    expect(right(/butter robot/i)).toBe('pass the butter');
    expect(right(/Birdperson/i)).toBe('Bird World');
    expect(right(/floating heads/i)).toBe('Show me what you got');
    expect(right(/Jerry/i)).toBe('Hungry for apples?');
    expect(right(/Morty’s sister/i)).toBe('Summer');
  });

  it('grades the answer key ten out of ten and a pass, and all wrong as nought and a fail', () => {
    expect(grade(QUIZ.map((q) => q.answer))).toEqual({ right: 10, total: 10, pass: true });
    expect(grade(QUIZ.map((q) => (q.answer + 1) % 4))).toEqual({ right: 0, total: 10, pass: false });
  });

  it('passes at seven, and counts unanswered questions as wrong', () => {
    const key = QUIZ.map((q) => q.answer);
    const wrong = (n) => key.map((a, i) => (i < n ? (a + 1) % 4 : a));
    expect(grade(wrong(3))).toMatchObject({ right: 7, pass: true });
    expect(grade(wrong(4))).toMatchObject({ right: 6, pass: false });
    expect(grade([])).toEqual({ right: 0, total: 10, pass: false });
    expect(grade(key.slice(0, 7))).toMatchObject({ right: 7, pass: true });
    expect(grade(undefined)).toMatchObject({ right: 0, pass: false });
  });
});
