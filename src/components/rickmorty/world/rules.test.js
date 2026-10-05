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
  FRONT_WALK,
  FURNITURE,
  GARAGE,
  HOTSPOTS,
  HOUSE,
  HOUSE_GARAGE,
  INNER_WALLS,
  LINKS,
  MORTY,
  NEIGHBOURS,
  OUTDOOR,
  PEOPLE,
  PLAN,
  QUIZ,
  ROAD,
  ROOM_IDS,
  RUGS,
  SCHOOL,
  START,
  TASKS,
  TREES,
  WALLS,
  YARDS,
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
// (pushOut cannot tell which way to push a point exactly on a wall, so that is not clear)
const free = (area, x, z, rad = MORTY.radius) => {
  if (!inArea(area, x, z, -rad)) return false;
  if (wallsIn(area).some((w) => segDist(x, z, w) < 1e-6)) return false;
  const [px, pz] = pushOut(x, z, rad, collidersIn(area), wallsIn(area));
  return Math.hypot(px - x, pz - z) < 1e-6;
};

// Every spot Morty can walk to from a, over half-metre squares (stopping early
// if `stop(x, z)` says so)
function flood(area, a, stop = () => false) {
  const S = 0.5;
  const key = (i, j) => `${i},${j}`;
  const cells = [];
  const seen = new Set([key(0, 0)]);
  const queue = [[0, 0]];
  while (queue.length) {
    const [i, j] = queue.shift();
    const x = a.x + i * S;
    const z = a.z + j * S;
    cells.push({ x, z });
    if (stop(x, z)) return { cells, hit: true };
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = key(i + di, j + dj);
      if (seen.has(k)) continue;
      seen.add(k);
      if (free(area, a.x + (i + di) * S, a.z + (j + dj) * S)) queue.push([i + di, j + dj]);
    }
  }
  return { cells, hit: false };
}
// can Morty walk from a to b (to within `r` of it)?
const canWalk = (area, a, b, r) => flood(area, a, (x, z) => Math.hypot(x - b.x, z - b.z) < r).hit;
const inRoom = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
// where a room is first walked into, and out of
const WAY_IN = { house: 'house-door', upstairs: 'stairs-up', garage: 'garage-door', school: 'school-door', arcade: 'arcade-door' };
const WAY_OUT = { house: 'front', upstairs: 'stairs-down', garage: 'garage-exit', school: 'school-exit', arcade: 'arcade-exit' };

// how near a point is to a box footprint (0 inside it)
const boxDist = (b, x, z) => Math.hypot(Math.max(Math.abs(x - b.x) - b.w / 2, 0), Math.max(Math.abs(z - b.z) - b.d / 2, 0));
const segDist = (px, pz, [x0, z0, x1, z1]) => {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (x0 + t * dx), pz - (z0 + t * dz));
};
// the line two rooms share, if they touch along one
const shared = (a, b) => {
  const ox = [Math.max(a.x0, b.x0), Math.min(a.x1, b.x1)];
  const oz = [Math.max(a.z0, b.z0), Math.min(a.z1, b.z1)];
  if (ox[0] === ox[1] && oz[0] < oz[1]) return { axis: 'x', at: ox[0], from: oz[0], to: oz[1] };
  if (oz[0] === oz[1] && ox[0] < ox[1]) return { axis: 'z', at: oz[0], from: ox[0], to: ox[1] };
  return null;
};
// the open stretches of a line, between the wall pieces laid on it
const openings = (walls, { axis, at, from, to }) => {
  const runs = walls
    .filter(([x0, z0, x1, z1]) => (axis === 'x' ? x0 === at && x1 === at : z0 === at && z1 === at))
    .map(([x0, z0, x1, z1]) => (axis === 'x' ? [Math.min(z0, z1), Math.max(z0, z1)] : [Math.min(x0, x1), Math.max(x0, x1)]))
    .sort((p, q) => p[0] - q[0]);
  const gaps = [];
  let at0 = from;
  for (const [a, b] of runs) {
    if (at0 >= to) break;
    if (a > at0) gaps.push(Math.min(a, to) - at0);
    at0 = Math.max(at0, b);
  }
  if (to > at0) gaps.push(to - at0);
  return gaps;
};
// can Morty stand somewhere on the line?
const stands = (area, { axis, at, from, to }) => {
  for (let t = from; t <= to; t += 0.05) if (free(area, axis === 'x' ? at : t, axis === 'x' ? t : at)) return true;
  return false;
};
// how near a point is to a piece of furniture, turned as it is (0 inside it)
const pieceDist = (f, x, z) => {
  const dx = x - f.x;
  const dz = z - f.z;
  const lx = dx * Math.cos(f.turn) - dz * Math.sin(f.turn);
  const lz = dx * Math.sin(f.turn) + dz * Math.cos(f.turn);
  return Math.hypot(Math.max(Math.abs(lx) - f.w / 2, 0), Math.max(Math.abs(lz) - f.d / 2, 0));
};
// do the segments a-b and c-d cross?
const crosses = (ax, az, bx, bz, [cx, cz, dx, dz]) => {
  const side = (px, pz, qx, qz, rx, rz) => (qx - px) * (rz - pz) - (qz - pz) * (rx - px);
  return side(ax, az, bx, bz, cx, cz) * side(ax, az, bx, bz, dx, dz) < 0 && side(cx, cz, dx, dz, ax, az) * side(cx, cz, dx, dz, bx, bz) < 0;
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
    expect(areaAt(-300, 350)).toBe(null);
  });

  it('knows the rooms from the outdoors, and pads in and out of an area', () => {
    expect(ROOM_IDS).toEqual(['house', 'upstairs', 'garage', 'school', 'arcade']);
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

  it('has six neighbours, three a side, and the house and garage within one footprint', () => {
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

  it('puts the garage on the west, the house on the east, the two joined, the garage standing forward', () => {
    expect(GARAGE).toMatchObject({ x: -19, z: -19.5, w: 8, d: 11, h: 3.4, roof: 6.2 });
    expect(HOUSE).toMatchObject({ x: -5, z: -21.5, w: 20, d: 13, h: 3.2, roof: 8.6 });
    expect(HOUSE_GARAGE).toEqual({ x0: -23, x1: 5, z0: -28, z1: -14 });
    // they share a wall, with no gap between
    expect(GARAGE.x + GARAGE.w / 2).toBe(HOUSE.x - HOUSE.w / 2);
    expect(GARAGE.x).toBeLessThan(HOUSE.x);
    // the garage's front face is a metre forward of the house's
    expect(GARAGE.z + GARAGE.d / 2).toBe(-14);
    expect(HOUSE.z + HOUSE.d / 2).toBe(-15);
    // the combined footprint is exactly the two
    expect(HOUSE_GARAGE.x0).toBe(GARAGE.x - GARAGE.w / 2);
    expect(HOUSE_GARAGE.x1).toBe(HOUSE.x + HOUSE.w / 2);
    expect(HOUSE_GARAGE.z0).toBe(HOUSE.z - HOUSE.d / 2);
    expect(HOUSE_GARAGE.z1).toBe(GARAGE.z + GARAGE.d / 2);
  });

  it('runs the driveway from the garage door to the sidewalk, and the front walk from the front door to it', () => {
    expect(DRIVEWAY).toEqual({ x0: -23, x1: -15, z0: -14, z1: -7 });
    expect(DRIVEWAY.x0).toBe(GARAGE.x - GARAGE.w / 2);
    expect(DRIVEWAY.x1).toBe(GARAGE.x + GARAGE.w / 2);
    expect(DRIVEWAY.z1).toBe(-(ROAD.w / 2 + ROAD.sidewalk));
    expect(FRONT_WALK).toEqual({ x0: -8.6, x1: -7.4, z0: -15, z1: -7 });
    const door = link('house-door');
    expect(door.x).toBeGreaterThan(FRONT_WALK.x0);
    expect(door.x).toBeLessThan(FRONT_WALK.x1);
    expect(door.z).toBeGreaterThan(FRONT_WALK.z0);
    expect(FRONT_WALK.z0).toBe(HOUSE.z + HOUSE.d / 2);
    expect(FRONT_WALK.z1).toBe(DRIVEWAY.z1);
  });

  it('parks the cruiser on the driveway, in front of the garage, nose to the road', () => {
    expect(BOARD.x).toBeGreaterThan(DRIVEWAY.x0 + CRUISER.radius);
    expect(BOARD.x).toBeLessThan(DRIVEWAY.x1 - CRUISER.radius);
    expect(BOARD.z).toBeGreaterThan(DRIVEWAY.z0 + CRUISER.radius);
    expect(BOARD.z).toBeLessThan(DRIVEWAY.z1 - CRUISER.radius);
    expect(Math.cos(BOARD.yaw)).toBe(1);
    expect(BOARD).toEqual({ x: -19, z: -10.5, yaw: 0 });
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
    for (const id of ['garage', 'school', 'arcade']) expect(wallsIn(id), id).toEqual([]);
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

  it('puts something in every room, inside it', () => {
    for (const id of ROOM_IDS) {
      const room = AREAS[id];
      expect(collidersIn(id).length, id).toBeGreaterThanOrEqual(3);
      for (const c of collidersIn(id).filter((o) => o.kind === 'box')) {
        // a box turned a quarter swaps its sides
        const quarter = Math.abs(Math.sin(c.turn)) > 0.5;
        const w = quarter ? c.d : c.w;
        const d = quarter ? c.w : c.d;
        expect(c.x - w / 2, `${id} ${c.id}`).toBeGreaterThanOrEqual(room.x0 - 1e-9);
        expect(c.x + w / 2, `${id} ${c.id}`).toBeLessThanOrEqual(room.x1 + 1e-9);
        expect(c.z - d / 2, `${id} ${c.id}`).toBeGreaterThanOrEqual(room.z0 - 1e-9);
        expect(c.z + d / 2, `${id} ${c.id}`).toBeLessThanOrEqual(room.z1 + 1e-9);
      }
    }
  });
});

describe('C-137: the furniture', () => {
  it('lists each piece once, with what the scene needs to draw it', () => {
    expect(FURNITURE.length).toBeGreaterThan(30);
    expect(new Set(FURNITURE.map((f) => `${f.area}/${f.id}`)).size).toBe(FURNITURE.length);
    for (const f of FURNITURE) {
      expect(ROOM_IDS, f.id).toContain(f.area);
      expect(typeof f.kind, f.id).toBe('string');
      for (const k of ['x', 'z', 'w', 'd', 'h', 'turn']) expect(Number.isFinite(f[k]), `${f.id} ${k}`).toBe(true);
      expect(f.w, f.id).toBeGreaterThan(0);
      expect(f.d, f.id).toBeGreaterThan(0);
      expect(f.h, f.id).toBeGreaterThan(0);
    }
  });

  it('has the kinds the scene draws', () => {
    const kinds = new Set(FURNITURE.map((f) => f.kind));
    for (const k of ['couch', 'tv', 'table', 'counter', 'stove', 'fridge', 'bed', 'desk', 'dresser', 'workbench', 'shelf', 'cabinet', 'arcade', 'roy', 'goldenfold-desk', 'school-desk', 'chalkboard']) expect(kinds.has(k), k).toBe(true);
    expect(FURNITURE.filter((f) => f.kind === 'bed').map((f) => f.id)).toEqual(expect.arrayContaining(['bed-summer', 'bed-morty', 'bed-master']));
  });

  it('makes each piece a box in the way, where it stands, turned as it is drawn', () => {
    for (const f of FURNITURE) {
      const c = collidersIn(f.area).find((o) => o.id === f.id);
      expect(c, f.id).toMatchObject({ kind: 'box', x: f.x, z: f.z, w: f.w, d: f.d, turn: f.turn });
    }
    // a turned piece is in the way along its turned sides: the couch is long on z, facing the TV
    const couch = FURNITURE.find((f) => f.id === 'couch');
    expect(Math.abs(Math.sin(couch.turn))).toBeCloseTo(1, 6);
    expect(free('house', couch.x, couch.z - couch.w / 2 + 0.05)).toBe(false);
    expect(free('house', couch.x + couch.w / 2 + MORTY.radius + 0.05, couch.z)).toBe(true);
    expect(free('house', couch.x + couch.d / 2 + MORTY.radius - 0.05, couch.z)).toBe(false);
  });

  it('keeps every piece of furniture clear of the walls inside the house: none stands on a wall line', () => {
    for (const f of FURNITURE.filter((o) => INNER_WALLS[o.area])) {
      for (const [x0, z0, x1, z1] of INNER_WALLS[f.area]) {
        const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.05);
        for (let k = 0; k <= n; k++) expect(pieceDist(f, x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n), `${f.id} on a wall at ${x0}, ${z0}`).toBeGreaterThanOrEqual(0.06 - 1e-9);
      }
    }
  });

  it('has the TV on the living room’s east wall, the couch facing it, the dining table and the red rug where they belong', () => {
    const at = (id) => FURNITURE.find((f) => f.id === id);
    const living = PLAN.find((r) => r.id === 'living');
    const tv = at('tv');
    // its back is against the wall but off the wall's own line (the wall is 0.12 thick)
    expect(living.x1 - (tv.x + tv.d / 2)).toBeGreaterThanOrEqual(0.06);
    expect(living.x1 - (tv.x + tv.d / 2)).toBeLessThan(0.3);
    expect(inRoom(living, tv.x, tv.z)).toBe(true);
    expect(at('couch').x).toBeLessThan(tv.x);
    expect(inRoom(living, at('couch').x, at('couch').z)).toBe(true);
    // the couch faces east (its front turned to +x), the TV west
    expect(Math.sin(at('couch').turn)).toBeCloseTo(1, 6);
    expect(Math.sin(tv.turn)).toBeCloseTo(-1, 6);
    const dining = PLAN.find((r) => r.id === 'dining');
    expect(inRoom(dining, at('table').x, at('table').z)).toBe(true);
    expect(at('table').kind).toBe('table');
    const entry = PLAN.find((r) => r.id === 'entry');
    expect(RUGS).toHaveLength(1);
    expect(RUGS[0]).toMatchObject({ id: 'entry', area: 'house' });
    expect(RUGS[0].x - RUGS[0].w / 2).toBeGreaterThanOrEqual(entry.x0);
    expect(RUGS[0].x + RUGS[0].w / 2).toBeLessThanOrEqual(entry.x1);
    expect(RUGS[0].z - RUGS[0].d / 2).toBeGreaterThanOrEqual(entry.z0);
    expect(RUGS[0].z + RUGS[0].d / 2).toBeLessThanOrEqual(entry.z1);
  });
});

describe('C-137: the Smith house, room by room', () => {
  it('has the ground floor and the first floor as areas, with the rooms of the plan', () => {
    expect(AREAS.house).toEqual({ x0: -312, x1: -288, z0: -8, z1: 8.5 });
    expect(AREAS.upstairs).toEqual({ x0: -306, x1: -294.7, z0: 394, z1: 410.3 });
    expect(PLAN.map((r) => r.id)).toEqual(['kitchen', 'living', 'den', 'dining', 'entry', 'hall', 'stairs', 'rickroom', 'summer', 'morty', 'upHall', 'master', 'balcony', 'stairTop']);
    const room = (id) => PLAN.find((r) => r.id === id);
    expect(room('kitchen')).toMatchObject({ area: 'house', name: 'The kitchen', x0: -312, x1: -306.7, z0: -8, z1: 3.4 });
    expect(room('living')).toMatchObject({ x0: -306.7, x1: -296.9, z0: -8, z1: -1.9 });
    expect(room('den')).toMatchObject({ name: 'The den', x0: -296.9, x1: -288, z0: -8, z1: -1.6 });
    expect(room('dining')).toMatchObject({ x0: -306.7, x1: -299.5, z0: -1.9, z1: 3.4 });
    expect(room('entry')).toMatchObject({ x0: -299.5, x1: -295.7, z0: -1.9, z1: 3.4 });
    expect(room('hall')).toMatchObject({ x0: -295.7, x1: -288, z0: -1.6, z1: 0.5 });
    expect(room('stairs')).toMatchObject({ x0: -295.7, x1: -294.5, z0: 0.5, z1: 3.4 });
    expect(room('rickroom')).toMatchObject({ name: 'The back room', x0: -294.5, x1: -288, z0: 0.5, z1: 8.5 });
    expect(room('summer')).toMatchObject({ area: 'upstairs', x0: -306, x1: -299.8, z0: 394, z1: 399.9 });
    expect(room('morty')).toMatchObject({ x0: -299.8, x1: -294.7, z0: 394, z1: 399.9 });
    expect(room('upHall')).toMatchObject({ x0: -306, x1: -294.7, z0: 399.9, z1: 401.7 });
    expect(room('master')).toMatchObject({ x0: -302.4, x1: -294.7, z0: 401.7, z1: 408.8 });
    expect(room('balcony')).toMatchObject({ x0: -302.4, x1: -294.7, z0: 408.8, z1: 410.3 });
    for (const r of PLAN) {
      expect(r.name.length, r.id).toBeGreaterThan(3);
      expect(Number.isInteger(r.floor) && r.floor >= 0 && r.floor <= 0xffffff, r.id).toBe(true);
      const a = AREAS[r.area];
      expect(r.x0, r.id).toBeGreaterThanOrEqual(a.x0);
      expect(r.x1, r.id).toBeLessThanOrEqual(a.x1);
      expect(r.z0, r.id).toBeGreaterThanOrEqual(a.z0);
      expect(r.z1, r.id).toBeLessThanOrEqual(a.z1);
    }
  });

  it('has no two rooms of a floor overlapping, but for the sliver where the den and the entry meet', () => {
    const overlaps = [];
    for (const a of PLAN)
      for (const b of PLAN) {
        if (a.id >= b.id || a.area !== b.area) continue;
        const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
        if (ox > 1e-9 && oz > 1e-9) overlaps.push({ rooms: [a.id, b.id], x0: Math.max(a.x0, b.x0), x1: Math.min(a.x1, b.x1), z0: Math.max(a.z0, b.z0), z1: Math.min(a.z1, b.z1) });
      }
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].rooms).toEqual(['den', 'entry']);
    expect([overlaps[0].x0, overlaps[0].x1, overlaps[0].z0, overlaps[0].z1].map((v) => +v.toFixed(6))).toEqual([-296.9, -295.7, -1.9, -1.6]);
  });

  it('gives the master bedroom a single door onto the hall, and keeps the top of the stairs open to the hall', () => {
    const room = (id) => PLAN.find((r) => r.id === id);
    const line = shared(room('master'), room('upHall'));
    const gaps = openings(INNER_WALLS.upstairs, line);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toBeGreaterThanOrEqual(1.1);
    // the top of the stairs is the hall's: no wall across it
    const top = shared(room('stairTop'), room('upHall'));
    expect(openings(INNER_WALLS.upstairs, top)).toEqual([top.to - top.from]);
    expect(stands('upstairs', top)).toBe(true);
  });

  it('has nowhere to stand in the house or upstairs outside a room of the plan', () => {
    for (const area of ['house', 'upstairs']) {
      const a = AREAS[area];
      let stood = 0;
      for (let x = a.x0; x <= a.x1; x += 0.25)
        for (let z = a.z0; z <= a.z1; z += 0.25) {
          if (!free(area, x, z)) continue;
          stood++;
          expect(
            PLAN.some((r) => r.area === area && inRoom(r, x, z)),
            `${area} ${x}, ${z}`
          ).toBe(true);
        }
      expect(stood, area).toBeGreaterThan(300);
    }
  });

  it('walls the rooms off from each other, with a door where the plan has one and none where it has not', () => {
    const room = (id) => PLAN.find((r) => r.id === id);
    const doors = {
      house: [['kitchen', 'dining'], ['kitchen', 'living'], ['living', 'dining'], ['living', 'den'], ['dining', 'entry'], ['entry', 'hall'], ['hall', 'den'], ['hall', 'rickroom']],
      upstairs: [['summer', 'upHall'], ['morty', 'upHall'], ['master', 'upHall'], ['master', 'balcony']],
    };
    const shut = { house: [['living', 'entry'], ['stairs', 'rickroom'], ['stairs', 'hall']], upstairs: [['summer', 'morty']] };
    for (const area of Object.keys(doors)) {
      for (const [a, b] of doors[area]) {
        const line = shared(room(a), room(b));
        expect(line, `${a} / ${b} touch`).toBeTruthy();
        expect(Math.max(...openings(INNER_WALLS[area], line)), `${a} / ${b} door`).toBeGreaterThanOrEqual(1.1);
        expect(stands(area, line), `${a} / ${b} can be walked through`).toBe(true);
      }
      for (const [a, b] of shut[area]) {
        const line = shared(room(a), room(b));
        expect(line, `${a} / ${b} touch`).toBeTruthy();
        expect(stands(area, line), `${a} / ${b} is shut`).toBe(false);
      }
    }
  });

  it('keeps every wall piece a thin, straight, level line, and every opening from being squeezed', () => {
    for (const area of Object.keys(INNER_WALLS)) {
      expect(INNER_WALLS[area].length, area).toBeGreaterThan(5);
      for (const [x0, z0, x1, z1, thick] of INNER_WALLS[area]) {
        expect(x0 === x1 || z0 === z1, `${area} ${x0},${z0}`).toBe(true);
        expect(Math.hypot(x1 - x0, z1 - z0)).toBeGreaterThan(0);
        expect(thick).toBe(0.12);
      }
    }
    expect(WALLS.house).toBe(INNER_WALLS.house);
    expect(wallsIn('house')).toBe(INNER_WALLS.house);
    expect(wallsIn('upstairs')).toEqual(expect.arrayContaining(INNER_WALLS.upstairs));
    // the balcony has its railing on the south edge, low
    const rail = wallsIn('upstairs').find((w) => w[5] === true);
    expect(rail).toBeTruthy();
    expect(rail[1]).toBe(rail[3]);
    expect(rail[1]).toBeGreaterThan(AREAS.upstairs.z1 - 0.5);
  });

  it('has no way out of the house’s outline: the blocked part south of the kitchen, and the void by the stairs', () => {
    expect(free('house', -303, 4)).toBe(false);
    expect(free('house', -297.6, 3.0)).toBe(true);
    expect(free('house', -297.6, 3.2)).toBe(false);
    expect(free('house', -294.0, 5)).toBe(true);
    expect(free('upstairs', -305, 405)).toBe(false);
    expect(free('upstairs', -303, 407)).toBe(false);
    expect(free('upstairs', -303, 403)).toBe(true);
    expect(free('upstairs', -300, 405)).toBe(true);
  });

  it('can be walked: every room of the ground floor from the front door, every room upstairs from the stairs', () => {
    const down = flood('house', link('house-door').arrive).cells;
    for (const r of PLAN.filter((r) => r.area === 'house')) expect(down.some((c) => inRoom(r, c.x, c.z)), r.id).toBe(true);
    const up = flood('upstairs', link('stairs-up').arrive).cells;
    for (const r of PLAN.filter((r) => r.area === 'upstairs')) expect(up.some((c) => inRoom(r, c.x, c.z)), r.id).toBe(true);
    // and from the foot of the stairs too
    const back = flood('house', link('stairs-down').arrive).cells;
    for (const r of PLAN.filter((r) => r.area === 'house')) expect(back.some((c) => inRoom(r, c.x, c.z)), r.id).toBe(true);
    // and in from the garage, through the kitchen
    const kitchen = flood('house', link('garage-kitchen').arrive).cells;
    for (const r of PLAN.filter((r) => r.area === 'house')) expect(kitchen.some((c) => inRoom(r, c.x, c.z)), r.id).toBe(true);
  });
});

describe('C-137: walking about as Morty', () => {
  it('starts on the sidewalk in front of the house, facing it', () => {
    expect(START.area).toBe('street');
    expect(Math.abs(START.z - ROAD.z)).toBeGreaterThanOrEqual(ROAD.w / 2);
    expect(Math.abs(START.z - ROAD.z)).toBeLessThanOrEqual(ROAD.w / 2 + ROAD.sidewalk);
    // on the house's side of the road, between it and the asphalt
    expect(START.z).toBeLessThan(ROAD.z);
    expect(START.z).toBeGreaterThan(HOUSE.z + HOUSE.d / 2);
    expect(Math.abs(START.x - link('house-door').x)).toBeLessThan(1.5);
    expect(Math.cos(START.face)).toBeCloseTo(0, 6);
    expect(Math.sin(START.face)).toBeCloseTo(1, 6);
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

  it('walks up the front walk to the front door, and stops at the front wall of the house', () => {
    const door = link('house-door');
    const m = walk(newMorty({ x: door.x, z: -9, face: Math.PI / 2 }), { x: 0, z: -1 }, 4);
    expect(m.z).toBeCloseTo(HOUSE.z + HOUSE.d / 2 + MORTY.radius, 1);
    expect(m.x).toBeCloseTo(door.x, 1);
    expect(Math.hypot(m.x - door.x, m.z - door.z)).toBeLessThan(door.r);
    expect(free('street', m.x, m.z)).toBe(true);
  });

  it('stops at the garage door, a metre before the house’s front wall, and walks round the garage’s corner', () => {
    const door = link('garage-door');
    const m = walk(newMorty({ x: door.x, z: -8, face: Math.PI / 2 }), { x: 0, z: -1 }, 4);
    expect(m.z).toBeCloseTo(GARAGE.z + GARAGE.d / 2 + MORTY.radius, 1);
    const round = walk(m, { x: 1, z: 0 }, 2.5);
    expect(round.x).toBeGreaterThan(GARAGE.x + GARAGE.w / 2 + MORTY.radius);
    expect(free('street', round.x, round.z)).toBe(true);
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
    const arrive = link('garage-door').arrive;
    const east = walk(newMorty(arrive), { x: 1, z: 0, run: true }, 6, 'garage');
    expect(east.x).toBeCloseTo(AREAS.garage.x1 - MORTY.radius, 1);
    const south = walk(newMorty(arrive), { x: 0, z: 1, run: true }, 3, 'garage');
    expect(south.z).toBeCloseTo(AREAS.garage.z1 - MORTY.radius, 1);
  });

  it('keeps to the house’s outline: out the back of the entry is the street, so it stops at the front wall', () => {
    const m = walk(newMorty(link('house-door').arrive), { x: 0, z: 1, run: true }, 3, 'house');
    expect(m.z).toBeCloseTo(PLAN.find((r) => r.id === 'entry').z1 - MORTY.radius, 1);
    // and up the hall, through the door gaps, into the back room
    let g = newMorty({ x: -291, z: -0.5, face: 0 });
    g = walk(g, { x: 0, z: 1, run: true }, 2, 'house');
    expect(g.z).toBeGreaterThan(5);
  });

  it('stops at the TV stand in the living room, and at a wall between the rooms', () => {
    const tv = FURNITURE.find((f) => f.id === 'tv');
    const m = walk(newMorty({ x: -300, z: tv.z, face: 0 }), { x: 1, z: 0 }, 4, 'house');
    // the TV is turned a quarter, so its depth is across x
    expect(m.x).toBeCloseTo(tv.x - tv.d / 2 - MORTY.radius, 1);
    // east along the wall between the living room and the entry, from the living room, stops at it
    const wall = walk(newMorty({ x: -299, z: -4, face: -Math.PI / 2 }), { x: 0, z: 1 }, 3, 'house');
    expect(wall.z).toBeCloseTo(-1.9 - 0.12 - MORTY.radius, 1);
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
    // and walking out of the garage door never shoves him: he comes out beside the parked cruiser, not in it
    for (const l of LINKS.filter((o) => o.to === 'street')) {
      const out = stepMorty(newMorty(l.arrive), { x: 0, z: 0 }, DT, 'street', { cruiser: BOARD });
      expect(Math.hypot(out.x - l.arrive.x, out.z - l.arrive.z), l.id).toBeLessThan(1e-9);
    }
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
    expect(LINKS.map((l) => l.id).sort()).toEqual([
      'annex-portal',
      'arcade-door',
      'arcade-exit',
      'front',
      'garage-door',
      'garage-exit',
      'garage-kitchen',
      'garage-portal',
      'house-door',
      'kitchen-garage',
      'school-door',
      'school-exit',
      'stairs-down',
      'stairs-up',
    ]);
    expect(link('house-door')).toMatchObject({ area: 'street', x: -8, z: -14.4, r: 1.6, to: 'house', kind: 'door', label: 'Smith house' });
    expect(link('garage-door')).toMatchObject({ area: 'street', x: -19, z: -13.4, r: 1.6, to: 'garage', label: 'Rick’s garage' });
    expect(link('school-door')).toMatchObject({ area: 'street', x: 40, z: 14.4, to: 'school', label: 'Harry Herpson High' });
    expect(link('arcade-door')).toMatchObject({ area: 'annex', x: 400, z: -3.4, to: 'arcade', label: 'Blips and Chitz' });
    expect(link('front')).toMatchObject({ area: 'house', x: -297.6, z: 3, r: 0.9, to: 'street', kind: 'exit', label: 'Back outside' });
    expect(link('kitchen-garage')).toMatchObject({ area: 'house', x: -311.6, z: 1.1, r: 0.9, to: 'garage', kind: 'door' });
    expect(link('garage-kitchen')).toMatchObject({ area: 'garage', r: 0.9, to: 'house', kind: 'door' });
    expect(link('stairs-up')).toMatchObject({ area: 'house', x: -295.1, z: 2.6, to: 'upstairs' });
    expect(link('stairs-down')).toMatchObject({ area: 'upstairs', x: -303, z: 403.4, to: 'house' });
    expect(link('garage-portal')).toMatchObject({ area: 'garage', x: -294.8, z: 100, to: 'annex', kind: 'portal', label: 'Through the portal', arrive: { x: 400, z: 9 } });
    expect(link('annex-portal')).toMatchObject({ area: 'annex', x: 400, z: 13, to: 'garage', kind: 'portal', label: 'Back to the garage', arrive: { x: -296.8, z: 100, face: Math.PI } });
    for (const id of ['garage', 'school', 'arcade']) expect(link(`${id}-exit`)).toMatchObject({ area: id, kind: 'exit', label: 'Back outside' });
    for (const l of LINKS) expect(['door', 'exit', 'portal', 'stairs'], l.id).toContain(l.kind);
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

  it('never lands you inside the parked cruiser, wherever you come out into the street', () => {
    const landings = LINKS.filter((l) => l.to === 'street');
    expect(landings.map((l) => l.id).sort()).toEqual(['front', 'garage-exit', 'school-exit']);
    for (const l of landings) expect(Math.hypot(l.arrive.x - BOARD.x, l.arrive.z - BOARD.z), l.id).toBeGreaterThanOrEqual(CRUISER.radius + MORTY.radius + 0.3);
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

  it('gives every door from outside an exit back, arriving a little way outside it', () => {
    const doors = LINKS.filter((l) => l.kind === 'door' && OUTDOOR.includes(l.area));
    expect(doors.map((d) => d.id).sort()).toEqual(['arcade-door', 'garage-door', 'house-door', 'school-door']);
    for (const door of doors) {
      const exit = LINKS.find((l) => l.kind === 'exit' && l.area === door.to);
      expect(exit, door.id).toBeTruthy();
      expect(exit.to).toBe(door.area);
      const out = Math.hypot(exit.arrive.x - door.x, exit.arrive.z - door.z);
      expect(out, `${door.id} exit`).toBeGreaterThan(door.r + 0.3);
      expect(out, `${door.id} exit`).toBeLessThan(3.5);
    }
  });

  it('puts you at the south end of the garage, the school and the arcade, and in the front entry of the house', () => {
    for (const id of ['garage', 'school', 'arcade']) {
      const door = link(`${id}-door`);
      const exit = link(`${id}-exit`);
      const room = AREAS[id];
      expect(door.arrive.z, id).toBeCloseTo(room.z1 - 2, 6);
      expect(exit.z, id).toBeCloseTo(room.z1 - 0.6, 6);
      expect(door.arrive.x).toBe(-300);
      expect(door.arrive.face).toBeCloseTo(Math.PI / 2, 6);
    }
    expect(link('garage-door').arrive.z).toBe(104);
    expect(link('school-door').arrive.z).toBe(204);
    expect(link('arcade-door').arrive.z).toBe(306);
    const entry = PLAN.find((r) => r.id === 'entry');
    const front = link('house-door').arrive;
    expect(inRoom(entry, front.x, front.z)).toBe(true);
    expect(link('front').x).toBeGreaterThan(entry.x0);
    expect(link('front').x).toBeLessThan(entry.x1);
    expect(link('front').z).toBeCloseTo(entry.z1 - 0.4, 6);
    expect(link('stairs-up').x).toBeGreaterThan(PLAN.find((r) => r.id === 'stairs').x0);
    expect(inRoom(PLAN.find((r) => r.id === 'stairs'), link('stairs-up').x, link('stairs-up').z)).toBe(true);
    expect(inRoom(PLAN.find((r) => r.id === 'stairTop'), link('stairs-down').x, link('stairs-down').z)).toBe(true);
    expect(inRoom(PLAN.find((r) => r.id === 'stairTop'), link('stairs-up').arrive.x, link('stairs-up').arrive.z)).toBe(true);
  });

  it('puts you at the top of the stairs with the hall straight ahead, and a walk north goes on into it', () => {
    const top = link('stairs-up').arrive;
    // a metre or so either way of where you land, the walls slide you into the hall
    for (const dx of [-0.3, 0, 0.3]) {
      const m = walk(newMorty({ ...top, x: top.x + dx }), { x: 0, z: -1 }, 1.5, 'upstairs');
      expect(m.z, `from ${dx}`).toBeLessThan(PLAN.find((r) => r.id === 'upHall').z1);
    }
  });

  it('joins the kitchen to the garage lab both ways, on the kitchen’s west wall and the garage’s east side', () => {
    const k = link('kitchen-garage');
    const g = link('garage-kitchen');
    expect(k.to).toBe(g.area);
    expect(g.to).toBe(k.area);
    expect(k.x).toBeCloseTo(AREAS.house.x0 + MORTY.radius, 6);
    expect(g.x).toBeGreaterThan(AREAS.garage.x1 - 1);
    expect(inRoom(PLAN.find((r) => r.id === 'kitchen'), k.x, k.z)).toBe(true);
    // each puts you well in, clear of the other's reach
    expect(Math.hypot(k.arrive.x - g.x, k.arrive.z - g.z)).toBeGreaterThan(g.r + 0.3);
    expect(Math.hypot(g.arrive.x - k.x, g.arrive.z - k.z)).toBeGreaterThan(k.r + 0.3);
    expect(Math.hypot(k.arrive.x - link('garage-portal').x, k.arrive.z - link('garage-portal').z)).toBeGreaterThan(link('garage-portal').r + 0.3);
  });

  it('keeps every link where Morty can reach and stand, in its own area', () => {
    for (const l of LINKS) {
      expect(areaAt(l.x, l.z), l.id).toBe(l.area);
      expect(free(l.area, l.x, l.z), l.id).toBe(true);
    }
  });

  it('finds the house door at its spot and nothing at the start', () => {
    const door = link('house-door');
    expect(nearLink('street', door.x, door.z).id).toBe('house-door');
    expect(nearLink('street', door.x + 1.5, door.z).id).toBe('house-door');
    expect(nearLink('street', door.x + 1.7, door.z)).toBe(null);
    expect(nearLink('street', START.x, START.z)).toBe(null);
    expect(nearLink('house', door.x, door.z)).toBe(null);
    expect(nearLink('garage', -295.4, 101).id).toBe('garage-portal');
    expect(nearLink('house', -297.6, 3).id).toBe('front');
    expect(nearLink('house', -295.1, 2.6).id).toBe('stairs-up');
  });
});

describe('C-137: the things to touch', () => {
  it('has the hotspots the rooms need, with their words', () => {
    expect(HOTSPOTS.map((h) => h.id)).toEqual(['cable', 'jerry', 'beth', 'butter', 'summer', 'mortyroom', 'rick', 'meeseeks', 'plumbus', 'portalpanic', 'quiz', 'roy', 'cabinet1', 'cabinet2', 'cabinet3']);
    const at = (id) => HOTSPOTS.find((h) => h.id === id);
    expect(at('cable')).toMatchObject({ area: 'house', r: 1.4, label: 'Watch interdimensional cable', verb: 'Watch' });
    expect(at('jerry')).toMatchObject({ area: 'house', label: 'Jerry', verb: 'Talk' });
    expect(at('beth')).toMatchObject({ area: 'house', label: 'Beth', verb: 'Talk' });
    expect(at('butter')).toMatchObject({ area: 'house', label: 'The butter robot', verb: 'Switch on' });
    expect(at('summer')).toMatchObject({ area: 'upstairs', label: 'Summer', verb: 'Talk' });
    expect(at('mortyroom')).toMatchObject({ area: 'upstairs', label: 'Morty’s room', verb: 'Look round' });
    expect(at('rick')).toMatchObject({ area: 'garage', x: -302, z: 95.6, label: 'Rick', verb: 'Talk' });
    expect(at('meeseeks')).toMatchObject({ area: 'garage', x: -297.5, z: 95.6, label: 'Mr. Meeseeks box', verb: 'Press' });
    expect(at('plumbus')).toMatchObject({ area: 'garage', x: -305.2, z: 99, label: 'The plumbus factory', verb: 'Watch' });
    expect(at('portalpanic')).toMatchObject({ area: 'garage', x: -305.2, z: 103, label: 'Portal panic cabinet', verb: 'Play' });
    expect(at('quiz')).toMatchObject({ area: 'school', x: -300, z: 196.4, label: 'Mr. Goldenfold’s pop quiz', verb: 'Sit the quiz' });
    expect(at('roy')).toMatchObject({ area: 'arcade', x: -300, z: 293.6, label: 'Roy: A Life Well Lived', verb: 'Put the headset on' });
    for (const id of ['cabinet1', 'cabinet2', 'cabinet3']) expect(at(id)).toMatchObject({ area: 'arcade', verb: 'Play', r: 1.4 });
    for (const h of HOTSPOTS) expect(h.r, h.id).toBe(1.4);
  });

  it('puts everyone where the show has them: Jerry on the couch facing the TV, Beth at the stove, Summer in her room', () => {
    const at = (id) => HOTSPOTS.find((h) => h.id === id);
    const room = (id) => PLAN.find((r) => r.id === id);
    const piece = (id) => FURNITURE.find((f) => f.id === id);
    expect(inRoom(room('living'), at('cable').x, at('cable').z)).toBe(true);
    // the TV is the east wall's, the cable hotspot is just in front of it
    expect(at('cable').x).toBeLessThan(piece('tv').x);
    expect(at('cable').x).toBeGreaterThan(piece('tv').x - piece('tv').d / 2 - 0.6);
    expect(Math.abs(at('cable').z - piece('tv').z)).toBeLessThan(piece('tv').w / 2);
    // Jerry is at the couch, which faces the TV
    expect(Math.hypot(at('jerry').x - piece('couch').x, at('jerry').z - piece('couch').z)).toBeLessThan(1);
    expect(at('jerry').x).toBeLessThan(at('cable').x);
    expect(inRoom(room('kitchen'), at('beth').x, at('beth').z)).toBe(true);
    expect(Math.hypot(at('beth').x - piece('stove').x, at('beth').z - piece('stove').z)).toBeLessThan(1.4);
    expect(inRoom(room('dining'), at('butter').x, at('butter').z)).toBe(true);
    expect(Math.hypot(at('butter').x - piece('table').x, at('butter').z - piece('table').z)).toBeLessThan(piece('table').w / 2 + 0.2);
    expect(inRoom(room('summer'), at('summer').x, at('summer').z)).toBe(true);
    expect(inRoom(room('morty'), at('mortyroom').x, at('mortyroom').z)).toBe(true);
  });

  it('puts every hotspot in front of what it is for, not inside it, but for the two that sit on a piece', () => {
    // Jerry is on the couch and the butter robot is on the dining table
    const on = { jerry: 'couch', butter: 'table' };
    for (const h of HOTSPOTS) {
      const inside = FURNITURE.filter((f) => f.area === h.area && pieceDist(f, h.x, h.z) < 1e-9).map((f) => f.id);
      expect(inside, h.id).toEqual(on[h.id] ? [on[h.id]] : []);
    }
    // the others stand clear in front, close enough to have been put there for it
    for (const id of ['cable', 'beth', 'rick', 'meeseeks', 'plumbus', 'portalpanic', 'quiz', 'roy']) {
      const h = HOTSPOTS.find((o) => o.id === id);
      const nearest = Math.min(...FURNITURE.filter((f) => f.area === h.area).map((f) => pieceDist(f, h.x, h.z)));
      expect(nearest, id).toBeGreaterThan(0.05);
      expect(nearest, id).toBeLessThan(0.7);
    }
  });

  it('finds each at its own spot, and nothing out in the street', () => {
    for (const h of HOTSPOTS) {
      expect(areaAt(h.x, h.z), h.id).toBe(h.area);
      expect(nearHotspot(h.area, h.x, h.z).id, h.id).toBe(h.id);
    }
    const cable = HOTSPOTS.find((h) => h.id === 'cable');
    expect(nearHotspot('street', START.x, START.z)).toBe(null);
    expect(nearHotspot('house', -300, 3)).toBe(null);
    expect(nearHotspot('house', cable.x + 1.5, cable.z)).toBe(null);
  });

  it('lets Morty stand close enough to every hotspot, and walk there from the way in', () => {
    for (const h of HOTSPOTS) {
      let found = false;
      for (let dx = -h.r; dx <= h.r && !found; dx += 0.1) for (let dz = -h.r; dz <= h.r && !found; dz += 0.1) if (Math.hypot(dx, dz) <= h.r - 0.1 && free(h.area, h.x + dx, h.z + dz)) found = true;
      expect(found, `${h.id} can be stood at`).toBe(true);
      expect(canWalk(h.area, link(WAY_IN[h.area]).arrive, h, h.r - 0.1), `${h.id} can be walked to`).toBe(true);
    }
  });

  it('lets Morty walk from the way in to the way out of every room', () => {
    for (const id of ROOM_IDS) expect(canWalk(id, link(WAY_IN[id]).arrive, link(WAY_OUT[id]), link(WAY_OUT[id]).r), id).toBe(true);
    expect(canWalk('garage', link('annex-portal').arrive, link('garage-exit'), 0.9)).toBe(true);
    expect(canWalk('garage', link('garage-door').arrive, link('garage-portal'), 1.4)).toBe(true);
    // the garage's kitchen door, in from the kitchen and back
    expect(canWalk('garage', link('kitchen-garage').arrive, link('garage-exit'), 0.9)).toBe(true);
    expect(canWalk('garage', link('garage-door').arrive, link('garage-kitchen'), 0.9)).toBe(true);
    expect(canWalk('house', link('garage-kitchen').arrive, link('stairs-up'), 0.9)).toBe(true);
    expect(canWalk('house', link('garage-kitchen').arrive, link('front'), 0.9)).toBe(true);
    expect(canWalk('house', link('stairs-down').arrive, link('kitchen-garage'), 0.9)).toBe(true);
    expect(canWalk('upstairs', link('stairs-up').arrive, link('stairs-down'), 0.9)).toBe(true);
  });
});

describe('C-137: the people', () => {
  // whose hotspot each is
  const HOTSPOT_OF = { jerry: 'jerry', beth: 'beth', summer: 'summer', rick: 'rick', teacher: 'quiz' };

  it('has Jerry, Beth, Summer, Rick and the teacher, each in their own room', () => {
    expect(PEOPLE.map((p) => p.id)).toEqual(['jerry', 'beth', 'summer', 'rick', 'teacher']);
    expect(PEOPLE.map((p) => p.area)).toEqual(['house', 'house', 'upstairs', 'garage', 'school']);
    const room = (id) => PLAN.find((r) => r.id === id);
    const at = (id) => PEOPLE.find((p) => p.id === id);
    expect(inRoom(room('living'), at('jerry').x, at('jerry').z)).toBe(true);
    expect(inRoom(room('kitchen'), at('beth').x, at('beth').z)).toBe(true);
    expect(inRoom(room('summer'), at('summer').x, at('summer').z)).toBe(true);
    for (const p of PEOPLE) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.face), p.id).toBe(true);
      expect(inArea(p.area, p.x, p.z, -0.3), p.id).toBe(true);
    }
    // Jerry is on the couch, facing the TV; the teacher stands behind Goldenfold's desk
    expect(at('jerry').sits).toBe(true);
    expect(pieceDist(FURNITURE.find((f) => f.id === 'couch'), at('jerry').x, at('jerry').z)).toBe(0);
    expect(Math.cos(at('jerry').face)).toBeCloseTo(1, 6);
    const desk = FURNITURE.find((f) => f.id === 'goldenfold-desk');
    expect(at('teacher').z).toBeLessThan(desk.z - desk.d / 2);
    expect(PEOPLE.filter((p) => p.sits).map((p) => p.id)).toEqual(['jerry']);
  });

  it('puts each one at the hotspot that talks to them: just behind it, or Jerry on the couch', () => {
    for (const p of PEOPLE) {
      const h = HOTSPOTS.find((o) => o.id === HOTSPOT_OF[p.id]);
      expect(h, p.id).toBeTruthy();
      expect(h.area, p.id).toBe(p.area);
      // the teacher is across the desk from his, with the whole desk between
      expect(Math.hypot(p.x - h.x, p.z - h.z), p.id).toBeLessThan(p.id === 'teacher' ? 2.2 : 0.4);
      expect(nearHotspot(p.area, p.x, p.z)?.id, p.id).toBe(p.id === 'teacher' ? undefined : h.id);
    }
  });

  it('makes each who stands a small round thing in the way, clear of the furniture, and Jerry none', () => {
    for (const p of PEOPLE) {
      const c = collidersIn(p.area).find((o) => o.id === p.id);
      if (p.sits) {
        expect(c, p.id).toBeUndefined();
        continue;
      }
      expect(c, p.id).toMatchObject({ kind: 'circle', x: p.x, z: p.z });
      expect(c.r, p.id).toBeCloseTo(0.3, 6);
      for (const f of FURNITURE.filter((o) => o.area === p.area)) expect(pieceDist(f, p.x, p.z), `${p.id} in ${f.id}`).toBeGreaterThanOrEqual(c.r - 1e-9);
    }
    // Morty cannot walk through Rick
    const rick = PEOPLE.find((p) => p.id === 'rick');
    const m = walk(newMorty({ x: rick.x, z: rick.z + 3, face: Math.PI / 2 }), { x: 0, z: -1 }, 3, 'garage');
    expect(m.z).toBeCloseTo(rick.z + 0.3 + MORTY.radius, 1);
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
    // along the whole length of the road, from the west end, with room to get there
    let c = fly({ ...newCruiser(), x: -57, z: 0, yaw: Math.PI / 2 }, { throttle: 1, steer: 0, lift: 0 }, 5, inside);
    expect(Math.abs(c.speed - CRUISER.top)).toBeLessThanOrEqual(1);
    // and out in every direction from the driveway, into the edge and past it
    for (const yaw of [0, Math.PI / 2, -Math.PI / 2, Math.PI, 0.7, -2.4]) {
      c = fly({ ...newCruiser(), yaw }, { throttle: 1, steer: 0, lift: 1 }, 8, inside);
      expect(c.speed).toBeLessThanOrEqual(CRUISER.top + 1e-6);
    }
  });

  it('slows to nothing when nosed into the edge of the street, and slides on along it when it only skims it', () => {
    const edge = AREAS.street.x1 - 2;
    const head = fly({ ...newCruiser(), x: 50, z: 0, yaw: Math.PI / 2 }, { throttle: 1 }, 4);
    expect(head.x).toBeCloseTo(edge, 6);
    expect(head.z).toBeCloseTo(0, 6);
    expect(head.speed).toBeLessThan(0.5);
    // skimming: nose a little east of south along the east edge
    const skim = fly({ ...newCruiser(), x: edge, z: -30, yaw: 0.15 }, { throttle: 1 }, 3);
    expect(skim.x).toBeCloseTo(edge, 6);
    expect(skim.z).toBeGreaterThan(-30 + 15);
    expect(skim.speed).toBeGreaterThan(5);
    expect(skim.speed).toBeLessThan(CRUISER.top);
    // and when it flies free, nothing scales it
    const free = fly({ ...newCruiser(), x: -57, z: 0, yaw: Math.PI / 2, speed: 10 }, { throttle: 1 }, 1);
    expect(free.speed).toBeCloseTo(10 + CRUISER.accel, 0);
    // the same at the other edges
    expect(fly({ ...newCruiser(), z: 30, yaw: 0 }, { throttle: 1 }, 3).speed).toBeLessThan(0.5);
    expect(fly({ ...newCruiser(), x: -50, z: 0, yaw: -Math.PI / 2 }, { throttle: 1 }, 3).speed).toBeLessThan(0.5);
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
    expect(floorAt(HOUSE.x + HOUSE.w / 2 + CRUISER.radius + 0.1, HOUSE.z)).toBe(CRUISER.hover);
    expect(floorAt(HOUSE.x, HOUSE.z + HOUSE.d / 2 + CRUISER.radius + 0.1)).toBe(CRUISER.hover);
    expect(floorAt(HOUSE.x, HOUSE.z - HOUSE.d / 2 - CRUISER.radius - 0.1)).toBe(CRUISER.hover);
    // where the garage and the house both lie under it, the higher roof wins
    expect(floorAt(GARAGE.x + GARAGE.w / 2, GARAGE.z)).toBe(HOUSE.roof + 2);
    expect(floorAt(GARAGE.x, GARAGE.z)).toBe(GARAGE.roof + 2);

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

  it('never lands in a fenced back yard', () => {
    expect(YARDS).toHaveLength(7);
    for (const y of YARDS) {
      // a fence runs along the back of each
      expect(FENCES.some(([x0, z0, x1, z1]) => x0 === y.x0 && x1 === y.x1 && z0 === z1 && (z0 === y.z0 || z0 === y.z1)), `${y.x0}, ${y.z0}`).toBe(true);
      for (let x = y.x0; x <= y.x1; x += 1) for (let z = y.z0; z <= y.z1; z += 1) expect(canLand({ ...newCruiser(), x, z }), `${x}, ${z}`).toBe(false);
      // but it can land just outside the back fence
      const out = y.z0 < 0 ? y.z0 - 2.5 : y.z1 + 2.5;
      let landed = false;
      for (let x = y.x0; x <= y.x1; x += 1) landed ||= canLand({ ...newCruiser(), x, z: out });
      expect(landed, `behind ${y.x0}`).toBe(true);
    }
  });

  it('never lands on a tree, but can land beside one', () => {
    const sidewalk = TREES.filter((t) => Math.abs(t.z) < 10);
    expect(sidewalk.length).toBeGreaterThan(5);
    for (const t of sidewalk) {
      expect(canLand({ ...newCruiser(), x: t.x, z: t.z }), 'on it').toBe(false);
      const reach = CRUISER.radius + 0.45 * t.s;
      const toward = -Math.sign(t.z);
      expect(canLand({ ...newCruiser(), x: t.x, z: t.z + toward * (reach - 0.05) }), 'touching it').toBe(false);
      expect(canLand({ ...newCruiser(), x: t.x, z: t.z + toward * (reach + 0.05) }), 'beside it').toBe(true);
    }
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

  it('lets Morty out on the cruiser’s own side of every fence, on ground he can walk back to the start from', () => {
    // every spot the start can walk to, on half-metre squares
    const S = 0.5;
    const reach = new Set(flood('street', START).cells.map((c) => `${Math.round((c.x - START.x) / S)},${Math.round((c.z - START.z) / S)}`));
    const connected = (x, z) => {
      const i0 = Math.round((x - START.x) / S);
      const j0 = Math.round((z - START.z) / S);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) if (reach.has(`${i0 + di},${j0 + dj}`) && Math.hypot(START.x + (i0 + di) * S - x, START.z + (j0 + dj) * S - z) < 0.7) return true;
      return false;
    };
    let tried = 0;
    for (let x = -57; x <= 57; x += 1)
      for (let z = -37; z <= 37; z += 1)
        for (const yaw of [0, 1, 2.5, -2]) {
          const c = { ...newCruiser(), x, z, yaw };
          if (!canLand(c)) continue;
          tried++;
          const out = exitCruiser(c);
          const at = `from ${x}, ${z}, ${yaw} to ${out.x.toFixed(2)}, ${out.z.toFixed(2)}`;
          for (const f of FENCES) expect(crosses(x, z, out.x, out.z, f), `${at} across a fence`).toBe(false);
          expect(connected(out.x, out.z), `${at} can be walked back from`).toBe(true);
        }
    expect(tried).toBeGreaterThan(5000);
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
