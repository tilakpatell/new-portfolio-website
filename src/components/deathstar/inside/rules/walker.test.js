import { describe, expect, it } from 'vitest';
import { buildLayout, validateStation } from './layout';
import { DS1 } from './stations/ds1';
import { BODY, createBody, lineClear, pushOut, stepBody } from './walker';

const TICK = 1 / 30;
const R = 0.35;

// tiny stations, each built round the one thing a test walks into
const room = (id, x, z, w, d, o = {}) => ({ id, kind: 'corridor', name: id, section: 's', x, z, w, d, y: 0, h: 3, ...o });
const station = (rooms, doors = []) => {
  const at = { room: rooms[0].id, x: rooms[0].x, z: rooms[0].z, yaw: 0 };
  return { id: 't', name: 'Test', era: 'anh', sections: { s: 'Test' }, rooms, doors, lifts: [], starts: { rebel: at, imperial: at }, spots: {} };
};

// one 10 m square room, walls at x ±5 and z ±5
const HALL = station([room('hall', 0, 0, 10, 10)]);
// two rooms either side of a wall along z = 0, with a 1.2 m door in it at x = 0, 2.2 m high
const PAIR = station([room('south', 0, 3, 6, 6), room('north', 0, -3, 6, 6)], [{ id: 'gap', a: 'south', b: 'north', x: 0, z: 0, axis: 'x', w: 1.2, h: 2.2, kind: 'slide' }]);
// the north half of a room raised `high` metres over the south half
const cliff = (high) =>
  station([
    room('cliff', 0, 0, 10, 10, {
      h: high + 4,
      floors: [
        { x: 0, z: -2.5, w: 10, d: 5, y: high },
        { x: 0, z: 2.5, w: 10, d: 5, y: 0 },
      ],
    }),
  ]);
// floor only on the north half: the south half is a shaft with nothing under it
const BRINK = station([room('brink', 0, 0, 10, 10, { kind: 'shaft', floors: [{ x: 0, z: -2.5, w: 10, d: 5, y: 0 }] })]);
// a 1.5 m duct north of a hall, through a 1.4 m grille
const DUCT = station(
  [room('hall', 0, 0, 6, 6), room('duct', 0, -5, 2, 4, { kind: 'maintenance', h: 1.5 })],
  [{ id: 'grille', a: 'hall', b: 'duct', x: 0, z: -3, axis: 'x', w: 1.2, h: 1.4, kind: 'hatch' }],
);

const shut = () => false;
const ajar = () => true;
const world = (s, o = {}) => ({ layout: buildLayout(s), open: shut, solids: [], ...o });
const types = (events) => events.map((e) => e.type);

// Steps a body for so many seconds holding one input; `each` sees it after every step.
function walk(body, input, seconds, w, each = () => {}) {
  const events = [];
  for (let k = 0; k < Math.round(seconds / TICK); k++) {
    events.push(...stepBody(body, input, TICK, w));
    each(body);
  }
  return events;
}

// Steps until an event of the given type comes, or the time runs out.
function until(body, input, type, seconds, w) {
  const events = [];
  for (let k = 0; k < Math.round(seconds / TICK); k++) {
    const now = stepBody(body, input, TICK, w);
    events.push(...now);
    if (now.some((e) => e.type === type)) break;
  }
  return events;
}

describe('the test stations', () => {
  it('are all ones the layout accepts', () => {
    for (const s of [HALL, PAIR, cliff(3), cliff(8), BRINK, DUCT]) expect(validateStation(s)).toEqual([]);
  });
});

describe('a new body', () => {
  it('stands on the ground at full height, with where it stands as its safe spot', () => {
    const body = createBody({ x: 1, y: 0, z: 2, room: 'hall' });
    expect(body).toMatchObject({ x: 1, y: 0, z: 2, vy: 0, yaw: 0, r: 0.35, h: 1.8, room: 'hall', ground: true, crouch: false, falls: 0 });
    expect(body.safe).toEqual({ x: 1, y: 0, z: 2, room: 'hall' });
  });

  it('takes its own size, for a droid or a Wookiee', () => {
    expect(createBody({ x: 0, y: 0, z: 0, r: 0.2, h: 0.5, yaw: 1, room: 'hall' })).toMatchObject({ r: 0.2, h: 0.5, yaw: 1 });
  });
});

describe('walking', () => {
  it('covers 1.6 m a second walking, 4.2 running and 1.0 crouched', () => {
    const w = world(HALL);
    const go = (input) => {
      const body = createBody({ x: 0, y: 0, z: 4, room: 'hall' });
      walk(body, { dir: { x: 0, z: -1 }, ...input }, 1, w);
      return 4 - body.z;
    };
    expect(go({})).toBeCloseTo(1.6, 6);
    expect(go({ run: true })).toBeCloseTo(4.2, 6);
    expect(go({ crouch: true })).toBeCloseTo(1.0, 6);
  });

  it('never goes faster than full speed, however long the wanted direction', () => {
    const body = createBody({ x: 0, y: 0, z: 4, room: 'hall' });
    walk(body, { dir: { x: 0, z: -3 } }, 1, world(HALL));
    expect(4 - body.z).toBeCloseTo(1.6, 6);
  });

  it('stops r from a wall it walks into', () => {
    const body = createBody({ x: 0, y: 0, z: 0, room: 'hall' });
    walk(body, { dir: { x: 0, z: -1 } }, 5, world(HALL));
    expect(body.z).toBeCloseTo(-5 + R, 6);
    expect(body.x).toBeCloseTo(0, 9);
  });

  it('stops in a corner it walks into diagonally, through neither wall on the way', () => {
    const body = createBody({ x: 0, y: 0, z: 0, room: 'hall' });
    const s = Math.SQRT1_2;
    let worst = 0;
    walk(body, { dir: { x: s, z: -s } }, 8, world(HALL), (b) => {
      worst = Math.max(worst, b.x - (5 - R), -(5 - R) - b.z);
    });
    expect(worst).toBeLessThan(1e-6);
    expect(body.x).toBeCloseTo(5 - R, 6);
    expect(body.z).toBeCloseTo(-5 + R, 6);
  });

  it('can’t be carried through a wall by one long step', () => {
    const body = createBody({ x: 0, y: 0, z: -4.6, room: 'hall' });
    stepBody(body, { dir: { x: 0, z: -1 }, run: true }, 0.25, world(HALL));
    expect(body.z).toBeCloseTo(-5 + R, 6);
    expect(body.room).toBe('hall');
  });

  it('slides along a wall it walks into at an angle', () => {
    const body = createBody({ x: -3, y: 0, z: -4, room: 'hall' });
    walk(body, { dir: { x: 0.6, z: -0.8 } }, 2, world(HALL));
    expect(body.z).toBeCloseTo(-5 + R, 6);
    expect(body.x).toBeGreaterThan(-3 + 1.5);
  });
});

describe('doors', () => {
  it('a closed door’s gap stops you like a wall', () => {
    const body = createBody({ x: 0, y: 0, z: 3, room: 'south' });
    const events = walk(body, { dir: { x: 0, z: -1 } }, 4, world(PAIR, { open: shut }));
    expect(body.z).toBeCloseTo(R, 6);
    expect(body.room).toBe('south');
    expect(types(events)).not.toContain('room');
  });

  it('an open one lets you through, and the room changes with a ‘room’ event', () => {
    const body = createBody({ x: 0, y: 0, z: 3, room: 'south' });
    const events = walk(body, { dir: { x: 0, z: -1 } }, 3, world(PAIR, { open: (id) => id === 'gap' }));
    expect(body.z).toBeLessThan(-1);
    expect(body.room).toBe('north');
    expect(events.filter((e) => e.type === 'room')).toEqual([{ type: 'room', from: 'south', to: 'north' }]);
  });

  it('an open door doesn’t let you through the wall beside it', () => {
    const body = createBody({ x: 2, y: 0, z: 3, room: 'south' });
    walk(body, { dir: { x: 0, z: -1 } }, 4, world(PAIR, { open: ajar }));
    expect(body.z).toBeCloseTo(R, 6);
    expect(body.room).toBe('south');
  });

  it('a doorway narrower than you can’t be squeezed through, however you lean on its edges', () => {
    const narrow = station([room('south', 0, 3, 6, 6), room('north', 0, -3, 6, 6)], [{ id: 'slot', a: 'south', b: 'north', x: 0, z: 0, axis: 'x', w: 0.6, h: 2.2, kind: 'slide' }]);
    const w = world(narrow, { open: ajar });
    for (const lean of [0, 0.05, -0.2]) {
      const body = createBody({ x: lean, y: 0, z: 2, room: 'south' });
      walk(body, { dir: { x: 0, z: -1 } }, 3, w);
      expect(body.z).toBeGreaterThan(0);
      expect(body.room).toBe('south');
    }
  });

  // (Chewbacca is 2.28 m and Vader 2.03 m; the control room's door is 2 m)
  it('one taller than a man stoops through an open doorway lower than his head, but no lower than a man stands', () => {
    const low = station([room('south', 0, 3, 6, 6), room('north', 0, -3, 6, 6)], [{ id: 'low', a: 'south', b: 'north', x: 0, z: 0, axis: 'x', w: 1.4, h: 2, kind: 'slide' }]);
    const wookiee = createBody({ x: 0, y: 0, z: 2, room: 'south', h: 2.28 });
    walk(wookiee, { dir: { x: 0, z: -1 } }, 3, world(low, { open: ajar }));
    expect(wookiee.room).toBe('north');
    // (shut, it stops him as it stops anyone)
    const shutOut = createBody({ x: 0, y: 0, z: 2, room: 'south', h: 2.28 });
    walk(shutOut, { dir: { x: 0, z: -1 } }, 3, world(low, { open: shut }));
    expect(shutOut.room).toBe('south');
  });

  it('a door lower than your head stops you standing and lets you through crouched', () => {
    const w = world(DUCT, { open: ajar });
    const standing = createBody({ x: 0, y: 0, z: 0, room: 'hall' });
    walk(standing, { dir: { x: 0, z: -1 } }, 4, w);
    expect(standing.z).toBeCloseTo(-3 + R, 6);
    const crouched = createBody({ x: 0, y: 0, z: 0, room: 'hall' });
    walk(crouched, { dir: { x: 0, z: -1 }, crouch: true }, 4, w);
    expect(crouched.room).toBe('duct');
  });
});

describe('steps and solids', () => {
  const crate = (y1) => ({ box: { x0: -1, x1: 1, z0: -3, z1: -1, y0: 0, y1 } });

  it('a 0.3 m box is stepped onto', () => {
    const body = createBody({ x: 0, y: 0, z: 0, room: 'hall' });
    const events = walk(body, { dir: { x: 0, z: -1 } }, 1.2, world(HALL, { solids: [crate(0.3)] }));
    expect(body.z).toBeCloseTo(-1.92, 6);
    expect(body.y).toBeCloseTo(0.3, 9);
    expect(body.ground).toBe(true);
    expect(types(events)).not.toContain('land');
  });

  it('a 0.6 m box blocks', () => {
    const body = createBody({ x: 0, y: 0, z: 0, room: 'hall' });
    walk(body, { dir: { x: 0, z: -1 } }, 2, world(HALL, { solids: [crate(0.6)] }));
    expect(body.z).toBeCloseTo(-1 + R, 6);
    expect(body.y).toBe(0);
  });

  it('a round solid blocks at the sum of the two radii', () => {
    const body = createBody({ x: 0, y: 0, z: 0, room: 'hall' });
    walk(body, { dir: { x: 0, z: -1 } }, 2, world(HALL, { solids: [{ circle: { x: 0, z: -2, r: 0.5, y0: 0, y1: 1 } }] }));
    expect(body.z).toBeCloseTo(-2 + 0.5 + R, 6);
  });

  it('a solid hung over your head is walked under', () => {
    const body = createBody({ x: 0, y: 0, z: 0, room: 'hall' });
    walk(body, { dir: { x: 0, z: -1 } }, 1.2, world(HALL, { solids: [{ box: { x0: -1, x1: 1, z0: -3, z1: -1, y0: 2, y1: 2.5 } }] }));
    expect(body.z).toBeCloseTo(-1.92, 6);
  });

  it('steps back down off a box without falling', () => {
    const body = createBody({ x: 0, y: 0, z: 0, room: 'hall' });
    const events = walk(body, { dir: { x: 0, z: -1 } }, 2.5, world(HALL, { solids: [crate(0.3)] }));
    expect(body.z).toBeCloseTo(-4, 6);
    expect(body.y).toBe(0);
    expect(types(events)).toEqual([]);
  });
});

describe('ledges and falls', () => {
  it('walking off a ledge onto a floor 3 m down lands with ‘land’', () => {
    const body = createBody({ x: 0, y: 3, z: -1, room: 'cliff' });
    const events = walk(body, { dir: { x: 0, z: 1 } }, 2.5, world(cliff(3)));
    expect(types(events)).toEqual(['land']);
    expect(events[0].speed).toBeGreaterThan(7);
    expect(body).toMatchObject({ y: 0, ground: true, falls: 0, room: 'cliff' });
  });

  it('a ledge higher than a step stops you at its foot', () => {
    const body = createBody({ x: 0, y: 0, z: 2, room: 'cliff' });
    walk(body, { dir: { x: 0, z: -1 } }, 3, world(cliff(3)));
    expect(body.z).toBeCloseTo(R, 6);
    expect(body.y).toBe(0);
  });

  it('off into a void gives ‘fell’ then ‘respawn’ at the safe spot, with the fall counted', () => {
    const body = createBody({ x: 0, y: 0, z: -1, room: 'brink' });
    const events = until(body, { dir: { x: 0, z: 1 } }, 'respawn', 5, world(BRINK));
    expect(types(events)).toEqual(['fell', 'respawn']);
    expect(body.falls).toBe(1);
    expect({ x: body.x, y: body.y, z: body.z, room: body.room }).toEqual(body.safe);
    expect(body.safe.z).toBeLessThanOrEqual(0);
    expect(body.safe.y).toBe(0);
    expect(body).toMatchObject({ ground: true, vy: 0 });
  });

  it('a drop of more than 6 m onto a floor is a fall, not a landing', () => {
    const body = createBody({ x: 0, y: 8, z: -1, room: 'cliff' });
    const events = until(body, { dir: { x: 0, z: 1 } }, 'respawn', 5, world(cliff(8)));
    expect(types(events)).toEqual(['fell', 'respawn']);
    expect(body.falls).toBe(1);
    expect(body.y).toBe(8);
  });
});

describe('jumping', () => {
  it('rises about 0.9 m and lands again', () => {
    const body = createBody({ x: 0, y: 0, z: 0, room: 'hall' });
    const w = world(HALL);
    let top = 0;
    const events = stepBody(body, { jump: true }, TICK, w);
    events.push(...walk(body, {}, 1.5, w, (b) => (top = Math.max(top, b.y))));
    expect(top).toBeGreaterThan(0.8);
    expect(top).toBeLessThan(0.91);
    expect(types(events)).toEqual(['land']);
    expect(body).toMatchObject({ y: 0, ground: true });
  });

  it('a jump in a doorway stops when your head meets the top of it', () => {
    const body = createBody({ x: 0, y: 0, z: 0, room: 'south' });
    const w = world(PAIR, { open: ajar });
    let top = 0;
    stepBody(body, { jump: true }, TICK, w);
    walk(body, {}, 1.5, w, (b) => (top = Math.max(top, b.y)));
    expect(top).toBeCloseTo(2.2 - 1.8, 6);
    expect(body.y).toBe(0);
  });

  // a press that lands: a moment off a ledge still jumps (coyote time), a
  // moment before the feet touch is kept till they do (the buffer)
  it('still jumps a moment after walking off a ledge, and no longer after', () => {
    const w = world(cliff(3));
    const off = (steps) => {
      const body = createBody({ x: 0, y: 3, z: -0.2, room: 'cliff' });
      let n = 0;
      while (body.ground && n++ < 60) stepBody(body, { dir: { x: 0, z: 1 } }, TICK, w);
      for (let i = 0; i < steps; i++) stepBody(body, { dir: { x: 0, z: 1 } }, TICK, w);
      stepBody(body, { dir: { x: 0, z: 1 }, jump: true }, TICK, w);
      return body;
    };
    expect(off(1).vy).toBeGreaterThan(0); // 2 steps, 0.067 s off
    expect(off(4).vy).toBeLessThan(0); // 0.17 s off: falling
    expect(BODY.coyote).toBe(0.1);
  });

  it('lands a jump pressed a moment before the feet touch, once', () => {
    const w = world(HALL);
    const body = createBody({ x: 0, y: 0, z: 0, room: 'hall' });
    stepBody(body, { jump: true }, TICK, w);
    // down again: pressed 2 steps (0.067 s) before it lands
    let n = 0;
    while (n++ < 60) {
      const landsIn = body.vy < 0 && body.y + body.vy * 3 * TICK <= 0;
      stepBody(body, { jump: landsIn && !body.pressed }, TICK, w);
      if (landsIn) body.pressed = true;
      if (body.ground) break;
    }
    expect(body.ground).toBe(true);
    stepBody(body, {}, TICK, w);
    expect(body.vy).toBeGreaterThan(0); // up again, on the buffered press
    let again = 0;
    for (let i = 0; i < 60; i++) {
      stepBody(body, {}, TICK, w);
      if (body.vy > 0 && body.y < 0.2 && i > 5) again++;
    }
    expect(again).toBe(0);
  });

  it('drops a press made too long before landing', () => {
    const w = world(HALL);
    const body = createBody({ x: 0, y: 0, z: 0, room: 'hall' });
    stepBody(body, { jump: true }, TICK, w);
    stepBody(body, {}, TICK, w);
    stepBody(body, { jump: true }, TICK, w); // in the air, 0.4 s before landing
    let rose = 0;
    for (let i = 0; i < 60; i++) {
      const was = body.ground;
      stepBody(body, {}, TICK, w);
      if (was && body.vy > 0) rose++;
    }
    expect(rose).toBe(0);
  });

  it('can’t jump crouched', () => {
    const body = createBody({ x: 0, y: 0, z: 0, room: 'hall' });
    stepBody(body, { jump: true, crouch: true }, TICK, world(HALL));
    expect(body).toMatchObject({ y: 0, ground: true });
  });
});

describe('crouching', () => {
  it('lowers h to 1.2, and letting go stands you back up to 1.8', () => {
    const body = createBody({ x: 0, y: 0, z: 0, room: 'hall' });
    const w = world(HALL);
    stepBody(body, { crouch: true }, TICK, w);
    expect(body).toMatchObject({ h: 1.2, crouch: true });
    stepBody(body, {}, TICK, w);
    expect(body).toMatchObject({ h: 1.8, crouch: false });
  });

  it('refuses to stand under a 1.5 m ceiling, and stands once out from under it', () => {
    const body = createBody({ x: 0, y: 0, z: -5, room: 'duct' });
    const w = world(DUCT, { open: ajar });
    stepBody(body, { crouch: true }, TICK, w);
    stepBody(body, {}, TICK, w);
    expect(body).toMatchObject({ h: 1.2, crouch: true });
    walk(body, { dir: { x: 0, z: 1 } }, 3, w);
    expect(body.room).toBe('hall');
    expect(body).toMatchObject({ h: 1.8, crouch: false });
  });
});

describe('pushOut', () => {
  it('moves a body overlapping a wall out to r from it', () => {
    const body = createBody({ x: 0, y: 0, z: -4.8, room: 'hall' });
    pushOut(body, buildLayout(HALL), shut, []);
    expect(body.z).toBeCloseTo(-5 + R, 6);
  });

  it('counts a closed door’s gap as wall and an open one as a way through', () => {
    const layout = buildLayout(PAIR);
    const body = createBody({ x: 0, y: 0, z: 0.2, room: 'south' });
    pushOut(body, layout, ajar, []);
    expect(body.z).toBe(0.2);
    pushOut(body, layout, shut, []);
    expect(body.z).toBeCloseTo(R, 6);
  });

  it('moves a body out of a solid', () => {
    const body = createBody({ x: 0, y: 0, z: 0.9, room: 'hall' });
    pushOut(body, buildLayout(HALL), shut, [{ box: { x0: -1, x1: 1, z0: -1, z1: 1, y0: 0, y1: 1 } }]);
    expect(body.z).toBeCloseTo(1 + R, 6);
  });
});

describe('lineClear', () => {
  const layout = buildLayout(PAIR);
  const a = { x: 0, y: 1.5, z: 2 };
  const b = { x: 0, y: 1.5, z: -2 };

  it('sees through an open door and not a closed one', () => {
    expect(lineClear(layout, ajar, a, b)).toBe(true);
    expect(lineClear(layout, shut, a, b)).toBe(false);
  });

  it('is stopped by the wall beside a doorway and the wall over it', () => {
    expect(lineClear(layout, ajar, { ...a, x: 2 }, { ...b, x: 2 })).toBe(false);
    expect(lineClear(layout, ajar, { ...a, y: 2.6 }, { ...b, y: 2.6 })).toBe(false);
  });

  it('passes over a solid lower than the line and not through it', () => {
    const hall = buildLayout(HALL);
    const solids = [{ box: { x0: -1, x1: 1, z0: -1, z1: 1, y0: 0, y1: 0.6 } }];
    expect(lineClear(hall, shut, { x: 0, y: 1.5, z: 3 }, { x: 0, y: 1.5, z: -3 }, solids)).toBe(true);
    expect(lineClear(hall, shut, { x: 0, y: 0.3, z: 3 }, { x: 0, y: 0.3, z: -3 }, solids)).toBe(false);
  });

  it('is stopped by the rise of a ledge, and passes over it', () => {
    const steep = buildLayout(cliff(3));
    expect(lineClear(steep, shut, { x: 0, y: 1, z: 3 }, { x: 0, y: 4, z: -3 })).toBe(false);
    expect(lineClear(steep, shut, { x: 0, y: 5, z: 3 }, { x: 0, y: 5, z: -3 })).toBe(true);
  });

  it('runs along a floor without the floor stopping it', () => {
    expect(lineClear(buildLayout(HALL), shut, { x: 0, y: 1.62, z: 3 }, { x: 0, y: 0, z: -3 })).toBe(true);
  });
});

describe('aboard the first Death Star', () => {
  const layout = buildLayout(DS1);
  const start = DS1.starts.rebel;

  it('walks from the Falcon’s hold down the ramp onto the deck of Bay 327', () => {
    const body = createBody({ x: start.x, y: 1.6, z: start.z, room: start.room });
    const events = walk(body, { dir: { x: 0, z: 1 } }, 8, { layout, open: (id) => id === 'hold-hatch', solids: [] });
    expect(types(events)).toEqual(['room']);
    expect(events[0]).toMatchObject({ from: 'hold', to: 'bay327' });
    expect(body).toMatchObject({ room: 'bay327', y: 0, ground: true, falls: 0 });
    expect(body.z).toBeGreaterThan(0.6);
  });

  it('stays in the hold while the hatch is shut', () => {
    const body = createBody({ x: start.x, y: 1.6, z: start.z, room: start.room });
    walk(body, { dir: { x: 0, z: 1 } }, 4, { layout, open: shut, solids: [] });
    expect(body.room).toBe('hold');
    expect(body.z).toBeCloseTo(-6 - R, 6);
  });

  it('climbs the stair to the landing and goes in to Docking Control 327', () => {
    const spot = DS1.spots.stairs327;
    const body = createBody({ x: spot.x, y: 0, z: spot.z, room: spot.room });
    const w = { layout, open: (id) => id === 'bay327-ctl', solids: [] };
    const events = [];
    for (let k = 0; k < 300 && body.x < 22; k++) events.push(...stepBody(body, { dir: { x: 1, z: 0 } }, TICK, w));
    expect(body.y).toBeCloseTo(6, 6);
    events.push(...walk(body, { dir: { x: 0, z: -1 } }, 3, w));
    expect(types(events)).toEqual(['room']);
    expect(body).toMatchObject({ room: 'ctl327', ground: true, falls: 0 });
    expect(body.y).toBeCloseTo(6, 6);
  });
});

// a 10 m shaft with a ledge at each end and a 2 m bridge across the middle, tagged so it can be drawn back
const BRIDGED = station([
  room('span', 0, 0, 10, 10, {
    kind: 'chasm',
    floors: [
      { x: 0, z: -4, w: 10, d: 2, y: 0 },
      { x: 0, z: 4, w: 10, d: 2, y: 0 },
      { x: 0, z: 0, w: 2, d: 6, y: 0, tag: 'bridge' },
    ],
  }),
]);

describe('a floor that can be drawn back', () => {
  it('holds you while it is out, and drops you into the shaft once it is drawn back', () => {
    const out = world(BRIDGED);
    const body = createBody({ x: 0, y: 0, z: 0, room: 'span' });
    walk(body, { dir: { x: 0, z: 0 } }, 0.5, out);
    expect(body.falls).toBe(0);
    expect(body.y).toBeCloseTo(0, 5);

    // the game says the bridge is off by answering its floor's name as open
    const back = world(BRIDGED, { open: (id) => id === 'floor:bridge' });
    const over = createBody({ x: 0, y: 0, z: 0, room: 'span' });
    over.safe = { x: 0, y: 0, z: -4, room: 'span' };
    walk(over, { dir: { x: 0, z: 0 } }, 3, back);
    expect(over.falls).toBe(1);
    expect(over.z).toBeCloseTo(-4, 5);
  });

  it('is walked across from one ledge to the other only while it is out', () => {
    const body = createBody({ x: 0, y: 0, z: -4, room: 'span' });
    walk(body, { dir: { x: 0, z: 1 } }, 6, world(BRIDGED));
    expect(body.falls).toBe(0);
    expect(body.z).toBeGreaterThan(3);
  });
});
