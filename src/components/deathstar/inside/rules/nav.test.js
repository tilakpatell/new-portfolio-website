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

// Whether a route can be walked as the walker walks: each leg (not a ride),
// read every 2 cm, stands on a floor of the room its point names, climbs or
// drops no more than a step (0.4 m) at once, never enters a room nested in
// that room, and has no floor more than a step above or below it within a
// body’s radius (0.35 m), walls and nested rooms aside. null when it can;
// else where it can’t.
function footing(layout, path) {
  const within = (r, x, z) => x > r.box.x0 + 1e-6 && x < r.box.x1 - 1e-6 && z > r.box.z0 + 1e-6 && z < r.box.z1 - 1e-6;
  for (let i = 1; i < path.length; i++) {
    const [p, q] = [path[i - 1], path[i]];
    if (p.lift) continue;
    const room = layout.rooms.get(q.room);
    const kids = [...layout.rooms.values()].filter((r) => r.inside === room.id);
    const n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / 0.02));
    let last = layout.floorAt(room.id, p.x, p.z);
    for (let k = 0; k <= n; k++) {
      const x = p.x + ((q.x - p.x) * k) / n;
      const z = p.z + ((q.z - p.z) * k) / n;
      const y = layout.floorAt(room.id, x, z);
      const at = `leg ${i} in ${room.id} at ${x.toFixed(2)}, ${z.toFixed(2)}`;
      if (y === null || last === null || Math.abs(y - last) > 0.4 + 1e-9) return `${at}: from ${last} to ${y}`;
      if (kids.some((r) => within(r, x, z))) return `${at}: inside a nested room`;
      for (let a = 0; a < 16; a++) {
        const [rx, rz] = [x + 0.35 * Math.cos((a * Math.PI) / 8), z + 0.35 * Math.sin((a * Math.PI) / 8)];
        if (!within(room, rx, rz) || kids.some((r) => within(r, rx, rz))) continue;
        const ry = layout.floorAt(room.id, rx, rz);
        if (ry === null || Math.abs(ry - y) > 0.4 + 1e-9) return `${at}: ${ry} within a body of ${y}`;
      }
      last = y;
    }
  }
  return null;
}

// Points of a route standing in a line between their neighbours in one
// room: nothing to turn at, so nothing a walker should be told to aim for.
const idle = (path) =>
  path.filter((m, i) => {
    const [p, q] = [path[i - 1], path[i + 1]];
    if (!p || !q || p.room !== m.room || m.room !== q.room || p.lift || m.door || m.lift) return false;
    return Math.abs((m.x - p.x) * (q.z - p.z) - (m.z - p.z) * (q.x - p.x)) < 1e-6;
  });

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
  const layout = buildLayout(DS1);
  const nav = createNav(layout);
  const deck = { room: 'bay327', x: 10, z: -19.5 };
  const desk = { room: 'ctl327', x: 22, z: -27.5 };

  it('goes from Docking Bay 327 to its control room through the door between them', () => {
    const path = route(nav, deck, desk);
    expect(doorsOf(path)).toEqual(['bay327-ctl']);
    expect(path[0]).toEqual({ x: 10, z: -19.5, room: 'bay327' });
    expect(path.slice(-2)).toEqual([
      { x: 22, z: -24, room: 'bay327', door: 'bay327-ctl' },
      { x: 22, z: -27.5, room: 'ctl327' },
    ]);
  });

  // (the control room's door and the corridor's are in the bay's one back wall, 12 m apart)
  it('steps a pace out of a door before walking on to another door in the same wall, never along the wall itself', () => {
    const corridor = { room: 'corr327', x: 10, z: -32 };
    for (const [a, b] of [
      [desk, corridor],
      [corridor, desk],
    ]) {
      const path = route(nav, a, b);
      expect(doorsOf(path)).toContain('bay327-ctl');
      for (let i = 1; i < path.length; i++) {
        const [p, q] = [path[i - 1], path[i]];
        if (q.room !== 'bay327' || Math.hypot(q.x - p.x, q.z - p.z) < 1) continue;
        // the middle of every leg across the bay keeps off the back wall at z −24
        expect(Math.abs((p.z + q.z) / 2 + 24), `${JSON.stringify(p)} → ${JSON.stringify(q)}`).toBeGreaterThan(0.5);
      }
    }
  });

  // (the gantry's door is in its far wall, where a box's own floor ends, at the top of its stair)
  it('climbs the gantry stair and goes through its door on to the chasm’s upper ledge', () => {
    const path = route(nav, { room: 'maint', x: 9.9, z: -110 }, { room: 'chasm', x: 33.7, z: -102.8 });
    expect(path).not.toBeNull();
    expect(doorsOf(path)).toEqual(expect.arrayContaining(['maint2-gantry', 'gantry-chasm']));
  });

  // (the chasm's bridge is a tagged floor, there only while the story's flag runs it out)
  it('takes the chasm’s bridge only while it is out, and with it drawn back goes round by the lifts', () => {
    const near = { room: 'chasm', x: 27.2, z: -99.6 };
    const far = { room: 'chasmway', x: 50.7, z: -99.6 };
    const length = (w) => w.reduce((m, p, i) => (i ? m + Math.hypot(p.x - w[i - 1].x, p.z - w[i - 1].z) : 0), 0);
    const over = route(nav, near, far);
    expect(length(over)).toBeLessThan(30);
    const round = route(nav, near, far, { off: new Set(['bridge']) });
    // (never a leg out over the void where the bridge was)
    for (let i = 1; i < (round?.length ?? 0); i++) {
      const [p, q] = [round[i - 1], round[i]];
      if (q.room !== 'chasm' || p.lift) continue;
      for (let k = 0.1; k < 1; k += 0.1) expect(layout.floorAt('chasm', p.x + (q.x - p.x) * k, p.z + (q.z - p.z) * k, new Set(['bridge'])), `${JSON.stringify(p)} → ${JSON.stringify(q)}`).not.toBeNull();
    }
    expect(round === null || length(round) > 40).toBe(true);
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
    // (the two doors are in the north room's one wall: the way meets each square, from a pace out)
    expect(round.map((p) => p.room)).toEqual(['west', 'west', 'north', 'north', 'north', 'east']);
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
    expect(path.map((p) => p.room).filter((r, i, all) => r !== all[i - 1])).toEqual(['hold', 'bay327', 'corr327', 'lobby1', 'ring2']);
    for (const [i, p] of path.entries()) {
      if (!p.door) continue;
      const { a, b } = layout.doors.get(p.door);
      expect([a, b]).toContain(p.room);
      expect(path[i + 1].room).toBe(p.room === a ? b : a);
    }
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
    const layout = buildLayout(DS1);
    const path = route(createNav(layout), { room: 'hold', x: -12, z: -9 }, { room: 'lift1-l6', x: -40, z: -110 });
    expect(doorsOf(path)).toEqual(['hold-hatch', 'bay327-corr', 'corr327-lobby1', 'lobby1-lift']);
    expect(path.filter((p) => p.lift)).toEqual([{ x: 10, z: -49.5, room: 'lift1-l2', lift: 'lift1' }]);
    expect(path.at(-1)).toEqual({ x: -40, z: -110, room: 'lift1-l6' });
    expect(footing(layout, path)).toBeNull();
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

  // (a body stands nearer a solid than a way keeps clear: by its corner, a little out along both sides)
  it('finds a way from beside a box’s corner, nearer it than 0.4 m straight off but out of it on one side by more', () => {
    const crate = { x0: 0, x1: 4, z0: 0, z1: 4 };
    const n = navOf(station([room('hall', 0, 0, 20, 20)]));
    for (const from of [
      { room: 'hall', x: -0.3, z: 4.1 },
      { room: 'hall', x: 4.25, z: -0.15 },
      { room: 'hall', x: -0.12, z: -0.35 },
    ]) {
      const path = route(n, from, { room: 'hall', x: 8, z: 8 }, { solidsOf: () => [{ box: crate }] });
      expect(path, JSON.stringify(from)).not.toBeNull();
      expect(path.at(-1)).toMatchObject({ x: 8, z: 8 });
    }
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

describe('routes over floors of more than one level', () => {
  const layout = buildLayout(DS1);
  const nav = createNav(layout);

  it('climbs to Docking Control 327 by the stair from its foot, never up its side', () => {
    const path = route(nav, { room: 'bay327', x: 10, z: -19.5 }, { room: 'ctl327', x: 22, z: -27.5 });
    expect(doorsOf(path)).toEqual(['bay327-ctl']);
    expect(footing(layout, path)).toBeNull();
    // onto the stair by its bottom steps, which climb east from x 12 against the north wall
    expect(path.some((p) => p.room === 'bay327' && p.x > 11.5 && p.x < 13 && p.z < -21.5)).toBe(true);
  });

  it('goes down the Falcon’s ramp from her hatch, never off its side nor across her hold, and up it to come back', () => {
    const hold = { room: 'hold', x: -12, z: -9 };
    const ring = { room: 'ring2', x: -10, z: -44 };
    const out = route(nav, hold, ring);
    expect(footing(layout, out)).toBeNull();
    const back = route(nav, ring, hold);
    expect(doorsOf(back)).toEqual(['lobby1-ring2', 'corr327-lobby1', 'bay327-corr', 'hold-hatch']);
    expect(footing(layout, back)).toBeNull();
    // up the ramp in one leg, not tread by tread
    expect(idle(out)).toEqual([]);
    expect(idle(back)).toEqual([]);
  });

  it('walks round the stair’s landing on the deck rather than through it', () => {
    const path = route(nav, { room: 'bay327', x: 11, z: -20 }, { room: 'bay327', x: 25, z: -23 });
    expect(path.length).toBe(3);
    // round the landing’s south-east corner, 0.4 m clear
    expect(near(path[1], 24.41, -21.19)).toBe(true);
    expect(footing(layout, path)).toBeNull();
  });

  it('keeps to a walkway over water, turning at its corner rather than stepping off', () => {
    // water 0.9 m down across the room, under a walkway 2 m wide along its north and east walls
    const sump = station([room('sump', 0, 0, 12, 12, { floors: [{ x: 0, z: 0, w: 12, d: 12, y: -0.9 }, { x: 0, z: -5, w: 12, d: 2, y: 0 }, { x: 5, z: 0, w: 2, d: 12, y: 0 }] })]);
    const sumpLayout = buildLayout(sump);
    const path = route(createNav(sumpLayout), { room: 'sump', x: -5, z: -5 }, { room: 'sump', x: 5, z: 5 });
    expect(path.length).toBe(3);
    expect(near(path[1], 4.41, -4.41)).toBe(true);
    expect(footing(sumpLayout, path)).toBeNull();
  });

  it('crosses a chasm by its bridge, and not at all while the bridge is in', () => {
    // two ledges with nothing between them but, when it is out, a bridge 2 m wide
    const chasm = (bridge) => station([room('chasm', 0, 0, 20, 6, { floors: [{ x: -7.5, z: 0, w: 5, d: 6, y: 0 }, { x: 7.5, z: 0, w: 5, d: 6, y: 0 }, ...(bridge ? [{ x: 0, z: 0, w: 10, d: 2, y: 0 }] : [])] })]);
    const ends = [{ room: 'chasm', x: -8, z: -2.5 }, { room: 'chasm', x: 8, z: 2.5 }];
    expect(route(navOf(chasm(false)), ...ends)).toBeNull();
    const bridged = buildLayout(chasm(true));
    const path = route(createNav(bridged), ...ends);
    expect(path).not.toBeNull();
    expect(footing(bridged, path)).toBeNull();
  });

  it('goes round a room nested in another to come in by its door, never across it', () => {
    const s = station([room('hall', 0, 0, 20, 10), room('booth', 0, 0, 4, 4, { inside: 'hall', h: 2.5 })], [door('booth-door', 'booth', 'hall', 0, 2, 'x')]);
    const boothLayout = buildLayout(s);
    const path = route(createNav(boothLayout), { room: 'hall', x: 0, z: -4 }, { room: 'booth', x: 0, z: 0 });
    expect(doorsOf(path)).toEqual(['booth-door']);
    expect(footing(boothLayout, path)).toBeNull();
  });
});
