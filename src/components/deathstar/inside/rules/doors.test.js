import { describe, expect, it } from 'vitest';
import { buildLayout, validateStation } from './layout';
import { createDoors, passable, stepDoors } from './doors';

const STEP = 1 / 30;

// Two rooms 4 m wide either side of one door, `d`, at the origin: north
// and south of it when its wall runs along x, west and east when it runs
// along z. Each room is a section of its own, so a lockdown can take one
// side and not the other.
function pair(door = {}, axis = 'x') {
  const [a, b] = axis === 'x' ? [{ id: 'north', x: 0, z: -5, w: 4, d: 10 }, { id: 'south', x: 0, z: 5, w: 4, d: 10 }] : [{ id: 'west', x: -5, z: 0, w: 10, d: 4 }, { id: 'east', x: 5, z: 0, w: 10, d: 4 }];
  const at = { room: a.id, x: a.x, z: a.z, yaw: 0 };
  const station = {
    id: 't',
    name: 'Test',
    era: 'anh',
    sections: { [a.id]: a.id, [b.id]: b.id },
    rooms: [a, b].map((r) => ({ ...r, kind: 'corridor', name: r.id, section: r.id, y: 0, h: 3 })),
    doors: [{ id: 'd', a: a.id, b: b.id, x: 0, z: 0, axis, w: 2, h: 2.4, kind: 'slide', ...door }],
    lifts: [],
    starts: { rebel: at, imperial: at },
    spots: {},
  };
  expect(validateStation(station)).toEqual([]);
  return buildLayout(station);
}

// Steps the doors for a while, every step as the game does, and returns
// everything they said.
function run(doors, layout, seconds, world = {}, { dt = STEP } = {}) {
  const events = [];
  for (let t = 0; t < Math.round(seconds / dt); t++) events.push(...stepDoors(doors, layout, dt, world));
  return events;
}

const trooper = (x, z, o = {}) => ({ x, z, side: 'imperial', disguised: false, ...o });
const rebel = (x, z, o = {}) => ({ x, z, side: 'rebel', disguised: false, ...o });

describe('a sliding door', () => {
  it('opens in 0.45 s for an Imperial 2 m away, and closes once they leave', () => {
    const layout = pair();
    const doors = createDoors(layout);
    expect(passable(doors, 'd')).toBe(false);
    const near = { near: [trooper(0, -2)] };
    const opening = run(doors, layout, 0.4, near, { dt: 0.05 });
    expect(opening).toEqual([{ type: 'open', door: 'd' }]);
    expect(doors.d.open).toBeGreaterThan(0.85);
    expect(doors.d.open).toBeLessThan(1);
    expect(run(doors, layout, 0.05, near, { dt: 0.05 })).toEqual([]);
    expect(doors.d.open).toBeCloseTo(1, 9);
    expect(passable(doors, 'd')).toBe(true);

    const gone = { near: [trooper(0, -8)] };
    expect(run(doors, layout, 0.45, gone, { dt: 0.05 })).toEqual([{ type: 'close', door: 'd' }]);
    expect(doors.d.open).toBeCloseTo(0, 9);
    expect(passable(doors, 'd')).toBe(false);
  });

  it('stays shut for an Imperial 2.5 m away', () => {
    const layout = pair();
    const doors = createDoors(layout);
    expect(run(doors, layout, 1, { near: [trooper(1.5, 2)] })).toEqual([]);
    expect(doors.d.open).toBe(0);
  });

  it('opens for anyone at all when it has no lock, a Rebel included', () => {
    const layout = pair();
    const doors = createDoors(layout);
    run(doors, layout, 0.5, { near: [rebel(0, 1.5)] });
    expect(passable(doors, 'd')).toBe(true);
  });

  it('says “denied” once to a Rebel without a disguise at a door marked for Imperials, and stays shut', () => {
    const layout = pair({ lock: 'side:imperial' });
    const doors = createDoors(layout);
    const near = { near: [rebel(0, -1.5)] };
    expect(run(doors, layout, 1, near)).toEqual([{ type: 'denied', door: 'd' }]);
    expect(doors.d.open).toBe(0);
    // walking off and coming back is a second try
    expect(run(doors, layout, 0.5, { near: [rebel(0, -6)] })).toEqual([]);
    expect(run(doors, layout, 0.5, near)).toEqual([{ type: 'denied', door: 'd' }]);
  });

  it('opens a door marked for Imperials to a Rebel in a disguise', () => {
    const layout = pair({ lock: 'side:imperial' });
    const doors = createDoors(layout);
    expect(run(doors, layout, 0.5, { near: [rebel(0, -1.5, { disguised: true })] })).toEqual([{ type: 'open', door: 'd' }]);
    expect(passable(doors, 'd')).toBe(true);
  });

  it('opens for an Imperial even with an undisguised Rebel beside him, and denies nobody', () => {
    const layout = pair({ lock: 'side:imperial' });
    const doors = createDoors(layout);
    expect(run(doors, layout, 0.5, { near: [rebel(0.5, -1.5), trooper(-0.5, -1.5)] })).toEqual([{ type: 'open', door: 'd' }]);
    expect(passable(doors, 'd')).toBe(true);
  });
});
