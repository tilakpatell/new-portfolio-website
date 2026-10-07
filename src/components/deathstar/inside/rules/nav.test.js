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
// corridor is `levels` levels down, 4 m each.
function tower(levels) {
  const y = -4 * levels;
  return station(
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

  it('counts 8 m a level for a ride, so four levels down rides and five walks the 46 m stair', () => {
    const from = { room: 'up', x: -8, z: 0 };
    const to = { room: 'down', x: -8, z: 10 };
    const four = route(navOf(tower(4)), from, to);
    expect(doorsOf(four)).toEqual(['up-car', 'down-car']);
    expect(four.some((p) => p.lift === 'lift')).toBe(true);
    const five = route(navOf(tower(5)), from, to);
    expect(doorsOf(five)).toEqual(['up-stair', 'stair-down']);
    expect(five.some((p) => p.lift)).toBe(false);
  });
});
