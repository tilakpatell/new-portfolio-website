import { describe, expect, it } from 'vitest';
import { buildLayout, validateStation } from './layout';
import { clearDoorway, createDoors, passable, stepDoors } from './doors';

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

// Steps the doors for a while, every step as the game does (clearing
// the doorways of `bodies` after each), and returns everything they said.
function run(doors, layout, seconds, world = {}, { dt = STEP, bodies } = {}) {
  const events = [];
  for (let t = 0; t < Math.round(seconds / dt); t++) {
    events.push(...stepDoors(doors, layout, dt, world));
    if (bodies) clearDoorway(doors, layout, bodies);
  }
  return events;
}

// How far a point is from a wall segment, seen from above.
function apart(wall, p) {
  const dx = wall.x1 - wall.x0;
  const dz = wall.z1 - wall.z0;
  const t = Math.max(0, Math.min(1, ((p.x - wall.x0) * dx + (p.z - wall.z0) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - (wall.x0 + t * dx), p.z - (wall.z0 + t * dz));
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

describe('a lockdown', () => {
  it('seals a blast door on the edge of its section, even with an Imperial at it, until it lifts', () => {
    const layout = pair({ kind: 'blast' });
    const doors = createDoors(layout);
    const near = { near: [trooper(0, -1)] };
    run(doors, layout, 0.5, near);
    expect(passable(doors, 'd')).toBe(true);

    const locked = { ...near, lockdown: new Set(['south']) };
    // and the Imperial at it is refused like anyone else
    expect(run(doors, layout, 0.5, locked)).toEqual([
      { type: 'seal', door: 'd' },
      { type: 'denied', door: 'd' },
    ]);
    expect(doors.d.sealed).toBe(true);
    expect(passable(doors, 'd')).toBe(false);
    expect(doors.d.open).toBe(0);
    expect(run(doors, layout, 5, locked)).toEqual([]);
    expect(passable(doors, 'd')).toBe(false);

    expect(run(doors, layout, 0.5, { ...near, lockdown: new Set() })).toEqual([
      { type: 'unseal', door: 'd' },
      { type: 'open', door: 'd' },
    ]);
    expect(passable(doors, 'd')).toBe(true);
  });

  it('leaves a sliding door working', () => {
    const layout = pair({ kind: 'slide' });
    const doors = createDoors(layout);
    expect(run(doors, layout, 0.5, { near: [trooper(0, -1)], lockdown: new Set(['north', 'south']) })).toEqual([{ type: 'open', door: 'd' }]);
    expect(passable(doors, 'd')).toBe(true);
  });

  it('never closes an arch, with nobody near or the whole station locked down', () => {
    const layout = pair({ kind: 'arch' });
    const doors = createDoors(layout);
    expect(passable(doors, 'd')).toBe(true);
    expect(run(doors, layout, 2, { lockdown: new Set(['north', 'south']) })).toEqual([]);
    expect(passable(doors, 'd')).toBe(true);
  });
});

describe('a door shutting on someone in its doorway', () => {
  // along: how far along the wall from the door’s centre; across: how far
  // off the wall’s line, + for south (or east), − for north (or west)
  const place = (axis, along, across) => (axis === 'x' ? { x: along, z: across } : { x: across, z: along });
  const across = (axis, b) => (axis === 'x' ? b.z : b.x);
  const along = (axis, b) => (axis === 'x' ? b.x : b.z);

  for (const axis of ['x', 'z']) {
    it(`pushes them out to the side their centre is on, clear of the leaf and every wall (a wall along ${axis})`, () => {
      const layout = pair({ kind: 'blast', w: 2.4 }, axis);
      const doors = createDoors(layout);
      const officer = { ...place(axis, 0, -1.5), side: 'imperial', disguised: false };
      const bodies = [
        { ...place(axis, 0.3, 0.1), y: 0, r: 0.35 },
        { ...place(axis, -0.5, -0.2), y: 0, r: 0.35 },
        // dead on the line: the tie goes south (or east)
        { ...place(axis, 0, 0), y: 0, r: 0.35 },
        // most of the way to the doorway’s end, half over its line
        { ...place(axis, 1.0, -0.15), y: 0, r: 0.35 },
      ];
      const started = bodies.map((b) => ({ along: along(axis, b), across: across(axis, b) }));
      run(doors, layout, 0.6, { near: [officer] });
      // an open door pushes nobody
      run(doors, layout, 0.5, { near: [officer] }, { bodies });
      bodies.forEach((b, i) => expect([along(axis, b), across(axis, b)]).toEqual([started[i].along, started[i].across]));

      const outside = () =>
        bodies.forEach((b, i) => {
          expect(along(axis, b)).toBe(started[i].along);
          const side = started[i].across < 0 ? -1 : 1;
          expect(across(axis, b) * side).toBeGreaterThanOrEqual(b.r + 0.05);
          for (const wall of layout.walls) expect(apart(wall, b)).toBeGreaterThanOrEqual(b.r);
        });
      const sealed = { near: [officer], lockdown: new Set([axis === 'x' ? 'south' : 'east']) };
      for (let t = 0; t < 30 && passable(doors, 'd'); t++) run(doors, layout, STEP, sealed, { bodies });
      // the step the walker starts counting the doorway as wall, nobody is in it
      expect(passable(doors, 'd')).toBe(false);
      expect(doors.d.open).toBeGreaterThan(0.5);
      outside();
      run(doors, layout, 1, sealed, { bodies });
      expect(doors.d.open).toBe(0);
      outside();
    });
  }

  it('leaves alone someone standing beside the doorway, clear of its leaf', () => {
    const layout = pair({ kind: 'blast' });
    const doors = createDoors(layout);
    // a step back from it, and against the wall past its end (the walker’s to push off, not the door’s)
    const bodies = [{ x: 0, z: 0.5, y: 0, r: 0.35 }, { x: -1.6, z: -0.2, y: 0, r: 0.35 }];
    run(doors, layout, 1, { lockdown: new Set(['north']) }, { bodies });
    expect(bodies).toEqual([{ x: 0, z: 0.5, y: 0, r: 0.35 }, { x: -1.6, z: -0.2, y: 0, r: 0.35 }]);
  });
});
