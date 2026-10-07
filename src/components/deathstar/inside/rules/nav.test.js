import { describe, expect, it } from 'vitest';
import { buildLayout } from './layout';
import { createNav, route } from './nav';
import { DS1 } from './stations/ds1';

// A tiny station round whatever rooms, doors and lifts a test needs. Nav
// reads only the graph (rooms, doors, lifts), so these stations needn’t
// pass the validator floor by floor.
const room = (id, x, z, w, d, o = {}) => ({ id, kind: 'corridor', name: id, section: 's', x, z, w, d, y: 0, h: 3, ...o });
const door = (id, a, b, x, z, axis, w = 2) => ({ id, a, b, x, z, axis, w, h: 2.4, kind: 'slide' });
const station = (rooms, doors = [], lifts = []) => {
  const at = { room: rooms[0].id, x: rooms[0].x, z: rooms[0].z, yaw: 0 };
  return { id: 't', name: 'Test', era: 'anh', sections: { s: 'Test' }, rooms, doors, lifts, starts: { rebel: at, imperial: at }, spots: {} };
};
const navOf = (s) => createNav(buildLayout(s));
const doorsOf = (path) => path.filter((p) => p.door).map((p) => p.door);

// Three rooms round a corner: west and east share a door, and both open
// on north too, so there are two ways from west to east.
const corner = () =>
  station(
    [room('west', -5, 0, 10, 4), room('east', 5, 0, 10, 4), room('north', 0, -6, 20, 8)],
    [door('we', 'west', 'east', 0, 0, 'z'), door('wn', 'west', 'north', -5, -2, 'x'), door('en', 'east', 'north', 5, -2, 'x')],
  );

// Two corridors one above the other, joined at their west ends by a lift
// and at their east ends by a stair room 46 m round by foot; the lower
// corridor is `levels` levels down, each `levelHeight` metres (12, DS1’s,
// when the station gives none).
function tower(levels, levelHeight) {
  const y = -(levelHeight ?? 12) * levels;
  const s = station(
    [
      room('up', 0, 0, 20, 4),
      room('car-up', -11.5, 0, 3, 3, { kind: 'lift' }),
      room('down', 0, 10, 20, 4, { y }),
      room('car-down', -11.5, 10, 3, 3, { kind: 'lift', y }),
      room('stair', 15, 5, 10, 14),
    ],
    [door('up-car', 'up', 'car-up', -10, 0, 'z'), door('down-car', 'down', 'car-down', -10, 10, 'z'), door('up-stair', 'up', 'stair', 10, 0, 'z'), door('stair-down', 'stair', 'down', 10, 10, 'z')],
    [{ id: 'lift', stops: ['car-up', 'car-down'] }],
  );
  return levelHeight === undefined ? s : { ...s, levelHeight };
}

describe('routes through doors', () => {
  const nav = createNav(buildLayout(DS1));
  const deck = { room: 'bay327', x: 10, z: -19.5 };
  const desk = { room: 'ctl327', x: 22, z: -27.5 };

  it('goes from Docking Bay 327 to its control room through the door between them', () => {
    expect(route(nav, deck, desk)).toEqual([
      { x: 10, z: -19.5, room: 'bay327' },
      { x: 22, z: -24, room: 'bay327', door: 'bay327-ctl' },
      { x: 22, z: -27.5, room: 'ctl327' },
    ]);
  });

  it('has no route to the control room when its only door is refused', () => {
    expect(route(nav, deck, desk, { canPass: (id) => id !== 'bay327-ctl' })).toBeNull();
  });

  it('takes the shorter of two ways, and the longer one when the shorter door is refused', () => {
    const n = navOf(corner());
    const from = { room: 'west', x: -8, z: 0 };
    const to = { room: 'east', x: 8, z: 0 };
    expect(doorsOf(route(n, from, to))).toEqual(['we']);
    const round = route(n, from, to, { canPass: (id) => id !== 'we' });
    expect(doorsOf(round)).toEqual(['wn', 'en']);
    expect(round.map((p) => p.room)).toEqual(['west', 'west', 'north', 'east']);
  });

  it('gives a single point when the start and the end are the same place in one room', () => {
    expect(route(nav, deck, { ...deck })).toEqual([{ x: 10, z: -19.5, room: 'bay327' }]);
  });

  it('has no route from or to a room the station doesn’t have, nor to a room no door reaches', () => {
    const n = navOf(station([room('a', 0, 0, 4, 4), room('island', 20, 0, 4, 4)]));
    expect(route(n, { room: 'nowhere', x: 0, z: 0 }, { room: 'a', x: 1, z: 0 })).toBeNull();
    expect(route(n, { room: 'a', x: 0, z: 0 }, { room: 'nowhere', x: 1, z: 0 })).toBeNull();
    expect(route(n, { room: 'a', x: 0, z: 0 }, { room: 'island', x: 20, z: 0 })).toBeNull();
  });

  it('walks each leg inside the room its point names, a door’s point in the room before it', () => {
    const path = route(nav, { room: 'hold', x: -12, z: -9 }, { room: 'ring2', x: -10, z: -44 });
    expect(doorsOf(path)).toEqual(['hold-hatch', 'bay327-corr', 'corr327-lobby1', 'lobby1-ring2']);
    expect(path.map((p) => p.room)).toEqual(['hold', 'hold', 'bay327', 'corr327', 'lobby1', 'ring2']);
  });
});

describe('routes by lift', () => {
  it('rides the lift between two of its landings', () => {
    const nav = createNav(buildLayout(DS1));
    const path = route(nav, { room: 'lift1-l2', x: 10, z: -49 }, { room: 'lift1-l5', x: 40.5, z: -90 });
    expect(path).toEqual([
      { x: 10, z: -49, room: 'lift1-l2' },
      { x: 10, z: -49.5, room: 'lift1-l2', lift: 'lift1' },
      { x: 40, z: -90, room: 'lift1-l5' },
      { x: 40.5, z: -90, room: 'lift1-l5' },
    ]);
  });

  it('goes from the Falcon’s hold down to Level 6 by the bay, the corridor, the lobby and the lift', () => {
    const nav = createNav(buildLayout(DS1));
    const path = route(nav, { room: 'hold', x: -12, z: -9 }, { room: 'lift1-l6', x: -40, z: -110 });
    expect(doorsOf(path)).toEqual(['hold-hatch', 'bay327-corr', 'corr327-lobby1', 'lobby1-lift']);
    expect(path.filter((p) => p.lift)).toEqual([{ x: 10, z: -49.5, room: 'lift1-l2', lift: 'lift1' }]);
    expect(path.at(-1)).toEqual({ x: -40, z: -110, room: 'lift1-l6' });
  });

  // Riding costs 7 m of walking to and from the cars plus 8 m a level, so
  // four levels (39 m) beat the 46 m stair and five (47 m) don’t.
  const from = { room: 'up', x: -8, z: 0 };
  const to = { room: 'down', x: -8, z: 10 };
  const rides = (path) => path.some((p) => p.lift === 'lift');

  it('counts 8 m a level of 12 m, DS1’s, so four levels down rides and five walks the 46 m stair', () => {
    const four = route(navOf(tower(4)), from, to);
    expect(doorsOf(four)).toEqual(['up-car', 'down-car']);
    expect(rides(four)).toBe(true);
    const five = route(navOf(tower(5)), from, to);
    expect(doorsOf(five)).toEqual(['up-stair', 'stair-down']);
    expect(rides(five)).toBe(false);
  });

  it('counts a level by the station’s own `levelHeight` when it gives one', () => {
    expect(rides(route(navOf(tower(4, 5)), from, to))).toBe(true);
    expect(rides(route(navOf(tower(5, 5)), from, to))).toBe(false);
  });
});

// How near a route’s legs come to a box or a circle, sampled every few
// centimetres along each leg (0 when a leg runs through it).
const toBox = (b, p) => Math.hypot(Math.max(b.x0 - p.x, 0, p.x - b.x1), Math.max(b.z0 - p.z, 0, p.z - b.z1));
const toCircle = (c, p) => Math.max(0, Math.hypot(p.x - c.x, p.z - c.z) - c.r);
function closest(path, far) {
  let min = Infinity;
  for (let i = 1; i < path.length; i++) {
    const [p, q] = [path[i - 1], path[i]];
    const n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / 0.02));
    for (let k = 0; k <= n; k++) min = Math.min(min, far({ x: p.x + ((q.x - p.x) * k) / n, z: p.z + ((q.z - p.z) * k) / n }));
  }
  return min;
}
const near = (p, x, z) => Math.abs(p.x - x) < 0.05 && Math.abs(p.z - z) < 0.05;

describe('routes round solids', () => {
  // the Falcon on Bay 327’s deck, about 25 m across and 35 m long
  const FALCON = { x0: -20.5, x1: 4.5, z0: -19.5, z1: 15.5 };
  const falcon = (id) => (id === 'bay327' ? [{ box: FALCON }] : []);
  const nav = createNav(buildLayout(DS1));

  it('goes round the Falcon in Docking Bay 327 by her shorter side, 0.4 m clear, never across her', () => {
    const path = route(nav, { room: 'bay327', x: -26, z: 0 }, { room: 'bay327', x: 10, z: 0 }, { solidsOf: falcon });
    expect(path.length).toBe(4);
    // nor by her hatch, which stands under her, as if it were a corner of the bay
    expect(path.every((p) => p.room === 'bay327' && !p.door)).toBe(true);
    // round her nose, 15.9 m south towards the field, rather than her tail, 19.9 m north
    expect(near(path[1], -20.9, 15.9) && near(path[2], 4.9, 15.9)).toBe(true);
    expect(closest(path, (p) => toBox(FALCON, p))).toBeGreaterThan(0.39);
  });

  it('goes round a round solid 0.4 m clear of it', () => {
    const pillar = { x: 0, z: 0, r: 1 };
    const n = navOf(station([room('hall', 0, 0, 20, 10)]));
    const path = route(n, { room: 'hall', x: -3, z: 0.2 }, { room: 'hall', x: 3, z: 0 }, { solidsOf: () => [{ circle: pillar }] });
    expect(path.length).toBeGreaterThan(2);
    expect(closest(path, (p) => toCircle(pillar, p))).toBeGreaterThan(0.39);
  });

  it('passes a solid against a wall on its open side', () => {
    const bench = { x0: -2, x1: 2, z0: -5, z1: 1 };
    const n = navOf(station([room('hall', 0, 0, 20, 10)]));
    const path = route(n, { room: 'hall', x: -8, z: -3 }, { room: 'hall', x: 8, z: -3 }, { solidsOf: () => [{ box: bench }] });
    expect(path.some((p) => p.z > 1.4)).toBe(true);
    expect(closest(path, (p) => toBox(bench, p))).toBeGreaterThan(0.39);
  });

  it('takes the door in the open over one a bench puts out of the way', () => {
    // a long bench between the start and the nearer door
    const bench = { x0: -9, x1: 2, z0: 0, z1: 2 };
    const n = navOf(station([room('a', 0, 0, 20, 10), room('b', 0, 10, 20, 10)], [door('left', 'a', 'b', -3, 5, 'x'), door('right', 'a', 'b', 6, 5, 'x')]));
    const from = { room: 'a', x: -3, z: -4 };
    const to = { room: 'b', x: 1, z: 10 };
    expect(doorsOf(route(n, from, to))).toEqual(['left']);
    const path = route(n, from, to, { solidsOf: (id) => (id === 'a' ? [{ box: bench }] : []) });
    expect(doorsOf(path)).toEqual(['right']);
    expect(closest(path, (p) => toBox(bench, p))).toBeGreaterThan(0.39);
  });

  it('still finds a way out for someone standing inside a solid', () => {
    const path = route(nav, { room: 'hold', x: -12, z: -9 }, { room: 'ctl327', x: 22, z: -27.5 }, { solidsOf: falcon });
    expect(doorsOf(path)).toEqual(['hold-hatch', 'bay327-ctl']);
    expect(route(nav, { room: 'bay327', x: -8, z: 0 }, { room: 'bay327', x: 10, z: 0 }, { solidsOf: falcon })?.at(-1)).toEqual({ x: 10, z: 0, room: 'bay327' });
  });

  it('has no route to a point walled in by solids', () => {
    const n = navOf(station([room('hall', 0, 0, 20, 10)]));
    const pen = [{ box: { x0: 3, x1: 9, z0: -5, z1: -4 } }, { box: { x0: 3, x1: 9, z0: 4, z1: 5 } }, { box: { x0: 3, x1: 4, z0: -5, z1: 5 } }, { box: { x0: 8, x1: 9, z0: -5, z1: 5 } }];
    expect(route(n, { room: 'hall', x: -8, z: 0 }, { room: 'hall', x: 6, z: 0 }, { solidsOf: () => pen })).toBeNull();
  });
});
