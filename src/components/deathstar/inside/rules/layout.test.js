import { describe, expect, it } from 'vitest';
import { ROOM_KINDS, buildLayout, offTags, validateStation } from './layout';
import { DS1 } from './stations/ds1';
import { STATIONS } from './stations/index';

// a tiny station round whatever rooms and doors a test needs
const room = (id, x, z, w, d, o = {}) => ({ id, kind: 'corridor', name: id, section: 's', x, z, w, d, y: 0, h: 3, ...o });
const station = (rooms, doors = [], o = {}) => {
  const at = { room: rooms[0].id, x: rooms[0].x, z: rooms[0].z, yaw: 0 };
  return { id: 't', name: 'Test', era: 'anh', sections: { s: 'Test' }, rooms, doors, lifts: [], starts: { rebel: at, imperial: at }, spots: {}, ...o };
};
const copy = (s) => structuredClone(s);
const named = (errors, name) => errors.length > 0 && errors.every((e) => e.includes(name));
const sideOf = (walls, room, test) => walls.filter((s) => s.room === room && test(s));
const len = (s) => Math.hypot(s.x1 - s.x0, s.z1 - s.z0);

// Whether a body can walk from one point to another over a room’s floors,
// 0.2 m at a time, never rising or dropping more than its 0.4 m step.
function walkable(layout, roomId, from, to) {
  const { x0, z0, x1, z1 } = layout.rooms.get(roomId).box;
  const g = 0.2;
  const nx = Math.round((x1 - x0) / g);
  const nz = Math.round((z1 - z0) / g);
  const cellOf = (p) => [Math.min(nx - 1, Math.floor((p.x - x0) / g)), Math.min(nz - 1, Math.floor((p.z - z0) / g))];
  const floor = (i, j) => layout.floorAt(roomId, x0 + (i + 0.5) * g, z0 + (j + 0.5) * g);
  const [si, sj] = cellOf(from);
  const [ti, tj] = cellOf(to);
  const seen = new Uint8Array(nx * nz);
  const queue = [[si, sj]];
  seen[sj * nx + si] = 1;
  while (queue.length) {
    const [i, j] = queue.pop();
    if (i === ti && j === tj) return true;
    const y = floor(i, j);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di;
      const b = j + dj;
      if (a < 0 || b < 0 || a >= nx || b >= nz || seen[b * nx + a]) continue;
      const next = floor(a, b);
      if (next === null || Math.abs(next - y) > 0.4) continue;
      seen[b * nx + a] = 1;
      queue.push([a, b]);
    }
  }
  return false;
}

describe('a round room', () => {
  it('has the square round its circle for its box, its diameter both ways', () => {
    const layout = buildLayout(DS1);
    const room = layout.rooms.get('meditation');
    expect(room.box).toEqual({ x0: room.x - room.w / 2, x1: room.x + room.w / 2, z0: room.z - room.w / 2, z1: room.z + room.w / 2 });
  });
});

describe('the room kinds', () => {
  it('include the Falcon’s hold as a ship and the open side of a bay as a field', () => {
    expect(ROOM_KINDS).toEqual(expect.arrayContaining(['hangar', 'control', 'corridor', 'lift', 'lobby', 'ship', 'field']));
  });
});

describe('validating a station', () => {
  it('finds nothing wrong with the first Death Star', () => {
    expect(validateStation(DS1)).toEqual([]);
  });

  it('finds nothing wrong with any station on the list', () => {
    expect(Object.keys(STATIONS)).toContain('ds1');
    for (const s of Object.values(STATIONS)) expect(validateStation(s), s.id).toEqual([]);
  });

  it('names a door moved a metre off its wall', () => {
    const s = copy(DS1);
    const door = s.doors[0];
    if (door.axis === 'x') door.z += 1;
    else door.x += 1;
    expect(named(validateStation(s), door.id)).toBe(true);
  });

  it('names a door that hangs past the end of its wall', () => {
    const s = station([room('big', 0, 0, 10, 10), room('small', 0, -8, 4, 6)], [{ id: 'door-past', a: 'big', b: 'small', x: 1.5, z: -5, axis: 'x', w: 2, h: 2.4, kind: 'slide' }]);
    expect(named(validateStation(s), 'door-past')).toBe(true);
  });

  it('names a room nothing leads to, and only that', () => {
    const s = copy(DS1);
    s.rooms.push({ ...room('nowhere', 900, 900, 4, 4), section: Object.keys(s.sections)[0] });
    expect(validateStation(s)).toEqual([expect.stringContaining('nowhere')]);
  });

  it('counts a lift as a way in: without it the far landings can’t be reached', () => {
    const s = copy(DS1);
    // every landing off the bay’s level, and the rooms its doors lead to, are a ride away
    const onlyByLift = s.lifts.flatMap((l) => l.stops).filter((id) => s.rooms.find((r) => r.id === id).y !== 0);
    expect(onlyByLift.length).toBeGreaterThan(0);
    s.lifts = [];
    const errors = validateStation(s);
    for (const id of onlyByLift) expect(errors.some((e) => e.includes(id))).toBe(true);
  });

  it('names two rooms that overlap', () => {
    const s = station([room('west-room', 0, 0, 10, 10), room('east-room', 4, 0, 10, 10)]);
    const errors = validateStation(s);
    expect(errors.some((e) => e.includes('west-room') && e.includes('east-room') && e.includes('overlap'))).toBe(true);
  });

  it('lets rooms stack over each other when their heights don’t meet', () => {
    const s = station([
      room('low', 0, 0, 10, 10),
      room('high', 0, 0, 10, 10, { y: 3 }),
      room('car-low', 6.5, 0, 3, 3, { kind: 'lift' }),
      room('car-high', 6.5, 0, 3, 3, { kind: 'lift', y: 3 }),
    ]);
    s.doors = [
      { id: 'door-low', a: 'low', b: 'car-low', x: 5, z: 0, axis: 'z', w: 1, h: 2.4, kind: 'slide' },
      { id: 'door-high', a: 'high', b: 'car-high', x: 5, z: 0, axis: 'z', w: 1, h: 2.4, kind: 'slide' },
    ];
    s.lifts = [{ id: 'up', stops: ['car-low', 'car-high'] }];
    expect(validateStation(s)).toEqual([]);
  });

  it('lets a room nested inside another overlap it, and only it', () => {
    const s = copy(DS1);
    expect(s.rooms.find((r) => r.id === 'hold').inside).toBe('bay327');
    delete s.rooms.find((r) => r.id === 'hold').inside;
    expect(validateStation(s).some((e) => e.includes('hold') && e.includes('bay327') && e.includes('overlap'))).toBe(true);
  });

  it('wants the door between a nested room and its parent on the nested room’s wall, inside the parent', () => {
    const outer = room('outer', 0, 0, 20, 20, { h: 6 });
    const inner = room('inner', 0, 0, 4, 4, { inside: 'outer', y: 1, h: 2 });
    const good = station([outer, inner], [{ id: 'hatch', a: 'inner', b: 'outer', x: 0, z: 2, axis: 'x', w: 1, h: 1.8, kind: 'hatch' }]);
    good.rooms[0].floors = [{ x: 0, z: 0, w: 20, d: 20, y: 0 }, { x: 0, z: 2.5, w: 1, d: 1, y: 0.8 }];
    expect(validateStation(good)).toEqual([]);
    const onOuterWall = copy(good);
    onOuterWall.doors[0] = { ...onOuterWall.doors[0], z: 10 };
    expect(named(validateStation(onOuterWall), 'hatch')).toBe(true);
    const outside = copy(good);
    outside.rooms[1] = { ...inner, x: 9, z: 0 };
    outside.doors[0] = { ...outside.doors[0], x: 9, z: 2 };
    expect(validateStation(outside).some((e) => e.includes('inner'))).toBe(true);
  });

  it('names a door whose floors either side differ by more than a step', () => {
    const s = copy(DS1);
    const ctl = s.doors.find((d) => [d.a, d.b].includes('ctl327') && [d.a, d.b].includes('bay327'));
    const bay = s.rooms.find((r) => r.id === 'bay327');
    bay.floors = bay.floors.filter((f) => f.y < 5.9);
    expect(validateStation(s).some((e) => e.includes(ctl.id))).toBe(true);
  });

  it('names a lift stop that isn’t a lift', () => {
    const s = copy(DS1);
    s.lifts[0].stops.push('corr327');
    expect(validateStation(s).some((e) => e.includes('corr327') && e.includes(s.lifts[0].id))).toBe(true);
  });

  it('names a spot in a room that doesn’t exist', () => {
    const s = copy(DS1);
    s.spots.lost = { room: 'no-such-room', x: 0, z: 0, yaw: 0 };
    expect(validateStation(s)).toEqual([expect.stringContaining('lost')]);
  });

  it('names a room of a kind it doesn’t know', () => {
    const s = copy(DS1);
    s.rooms.find((r) => r.id === 'lobby1').kind = 'ballroom';
    expect(validateStation(s)).toEqual([expect.stringContaining('lobby1')]);
  });

  it('names a door id used twice', () => {
    const s = copy(DS1);
    s.doors[1].id = s.doors[0].id;
    expect(validateStation(s).some((e) => e.includes(s.doors[0].id) && e.includes('twice'))).toBe(true);
  });

  it('names a door with a lock it can’t read', () => {
    const s = copy(DS1);
    s.doors[0].lock = 'password please';
    expect(validateStation(s)).toEqual([expect.stringContaining(s.doors[0].id)]);
  });

  it('names a room whose section has no name for the intercom', () => {
    const s = copy(DS1);
    s.rooms.find((r) => r.id === 'lobby1').section = 'nowhere-in-particular';
    expect(validateStation(s)).toEqual([expect.stringContaining('lobby1')]);
  });

  it('names a start that stands outside its room', () => {
    const s = copy(DS1);
    s.starts.imperial = { ...s.starts.imperial, x: s.starts.imperial.x + 500 };
    expect(validateStation(s)).toEqual([expect.stringContaining('imperial')]);
  });

  // each: what goes wrong, how to break the first Death Star that way, and
  // the words one message must hold (the culprit’s name, and what is wrong
  // with it where something else could name it too)
  const breaks = [
    ['a room id used twice', (s) => s.rooms.push({ ...s.rooms.find((r) => r.id === 'lobby1') }), ['lobby1', 'twice']],
    ['a floor laid past its room’s walls', (s) => s.rooms.find((r) => r.id === 'bay327').floors.push({ x: 40, z: 0, w: 2, d: 2, y: 0 }), ['bay327', 'floor']],
    ['a door taller than a room it opens into', (s) => (s.doors.find((d) => d.id === 'corr327-lobby1').h = 3.5), ['corr327-lobby1']],
    ['a door of a kind nobody knows', (s) => (s.doors.find((d) => d.id === 'corr327-lobby1').kind = 'curtain'), ['corr327-lobby1']],
    ['a door into a room that isn’t there', (s) => (s.doors.find((d) => d.id === 'corr327-lobby1').b = 'lobby9'), ['corr327-lobby1', 'lobby9']],
    ['a door from a room into itself', (s) => (s.doors.find((d) => d.id === 'corr327-lobby1').b = 'corr327'), ['corr327-lobby1']],
    ['a room nested in a room that isn’t there', (s) => (s.rooms.find((r) => r.id === 'hold').inside = 'bay999'), ['hold', 'bay999']],
    ['a lift id used twice', (s) => s.lifts.push({ ...s.lifts[0], stops: [...s.lifts[0].stops] }), ['lift1', 'twice']],
    ['a lift stop that isn’t there', (s) => s.lifts[0].stops.push('lift1-l9'), ['lift1-l9']],
    ['a start in a room that isn’t there', (s) => (s.starts.imperial = { ...s.starts.imperial, room: 'bay999' }), ['imperial']],
    ['a spot outside its room', (s) => (s.spots.adrift = { room: 'lobby1', x: 900, z: 900, yaw: 0 }), ['adrift']],
  ];
  for (const [what, breakIt, words] of breaks) {
    it(`names ${what}`, () => {
      const s = copy(DS1);
      breakIt(s);
      expect(validateStation(s).some((e) => words.every((w) => e.includes(w)))).toBe(true);
    });
  }

  it('counts a jump as a way in, one way only', () => {
    const s = station([room('top', 0, 0, 10, 4), room('pit', 0, 20, 10, 4, { y: -6 })], [], { spots: { landing: { room: 'pit', x: 0, z: 20, yaw: 0 } } });
    s.jumps = [{ id: 'drop', from: 'top', x: 2, z: 0, r: 1, to: 'landing', prompt: 'Drop' }];
    expect(validateStation(s)).toEqual([]);
    const back = copy(s);
    back.starts.rebel = { room: 'pit', x: 0, z: 20, yaw: 0 };
    expect(validateStation(back)).toEqual([expect.stringContaining('top')]);
    expect(validateStation({ ...s, jumps: [] })).toEqual([expect.stringContaining('pit')]);
  });

  // each: what goes wrong with a jump, and the words one message must hold
  const jumps = [
    ['a jump from a room that isn’t there', { from: 'nowhere' }, ['drop', 'nowhere']],
    ['a jump whose use-point stands outside its room', { x: 40 }, ['drop', 'outside']],
    ['a jump to a spot that isn’t there', { to: 'moon' }, ['drop', 'moon']],
    ['a jump with a lock it can’t read', { lock: 'ask nicely' }, ['drop', 'lock']],
    ['a jump with no reach', { r: 0 }, ['drop', 'reach']],
  ];
  for (const [what, change, words] of jumps) {
    it(`names ${what}`, () => {
      const s = station([room('top', 0, 0, 10, 4), room('pit', 0, 20, 10, 4, { y: -6 })], [], { spots: { landing: { room: 'pit', x: 0, z: 20, yaw: 0 } } });
      s.jumps = [{ id: 'drop', from: 'top', x: 2, z: 0, r: 1, to: 'landing', prompt: 'Drop', lock: 'flag:rope', ...change }];
      expect(validateStation(s).some((e) => words.every((w) => e.includes(w)))).toBe(true);
    });
  }

  it('names a jump id used twice', () => {
    const s = station([room('top', 0, 0, 10, 4), room('pit', 0, 20, 10, 4, { y: -6 })], [], { spots: { landing: { room: 'pit', x: 0, z: 20, yaw: 0 } } });
    const drop = { id: 'drop', from: 'top', x: 2, z: 0, r: 1, to: 'landing', prompt: 'Drop' };
    s.jumps = [drop, { ...drop, x: -2 }];
    expect(validateStation(s)).toEqual([expect.stringMatching(/drop.*twice/)]);
  });

  it('wants a door on a round room where its wall runs along the door', () => {
    const drum = room('drum', 0, 0, 20, 20, { round: true, kind: 'reactor', h: 6 });
    const way = room('way', 0, -14, 3, 8, { h: 6 });
    const good = station([drum, way], [{ id: 'drum-door', a: 'way', b: 'drum', x: 0, z: -10, axis: 'x', w: 2, h: 6, kind: 'slide' }]);
    expect(validateStation(good)).toEqual([]);
    const askew = copy(good);
    askew.doors[0].axis = 'z';
    expect(named(validateStation(askew), 'drum-door')).toBe(true);
  });
});

describe('the first Death Star', () => {
  const layout = buildLayout(DS1);

  it('starts the Rebel in the Falcon’s hold and the Imperial on the bay deck', () => {
    expect(DS1.starts.rebel.room).toBe('hold');
    expect(DS1.starts.imperial.room).toBe('bay327');
    expect(layout.roomAt(DS1.starts.rebel.x, layout.floorAt('hold', DS1.starts.rebel.x, DS1.starts.rebel.z), DS1.starts.rebel.z)).toBe('hold');
  });

  it('puts the corridor door less than 5 s’ walk north of the Imperial’s start', () => {
    const { x, z } = DS1.starts.imperial;
    const door = DS1.doors.find((d) => [d.a, d.b].includes('bay327') && [d.a, d.b].includes('corr327'));
    expect(door.axis).toBe('x');
    expect(Math.abs(door.x - x)).toBeLessThan(door.w / 2 - 0.35);
    expect(z - door.z).toBeGreaterThan(0);
    expect(z - door.z).toBeLessThan(5 * 1.6 - 1);
    expect(walkable(layout, 'bay327', { x, z }, { x: door.x, z: door.z + 0.1 })).toBe(true);
  });

  it('climbs from the bay deck to Docking Control 327’s door 6 m up, a step at a time', () => {
    const door = layout.doors.get(DS1.doors.find((d) => [d.a, d.b].includes('ctl327') && [d.a, d.b].includes('bay327')).id);
    expect(door.y).toBeCloseTo(6);
    expect(layout.rooms.get('ctl327').y).toBeCloseTo(6);
    const landing = { x: door.x, z: door.z + 0.3 };
    expect(layout.floorAt('bay327', landing.x, landing.z)).toBeCloseTo(6);
    expect(walkable(layout, 'bay327', DS1.starts.imperial, landing)).toBe(true);
  });

  it('walks down the Falcon’s ramp from the hold’s hatch to the deck, a step at a time', () => {
    const hatch = layout.doors.get(DS1.doors.find((d) => [d.a, d.b].includes('hold')).id);
    expect(hatch.kind).toBe('hatch');
    expect(hatch.y).toBeCloseTo(1.6);
    const top = { x: hatch.x, z: hatch.z + 0.3 };
    expect(layout.floorAt('bay327', top.x, top.z)).toBeGreaterThan(1.1);
    expect(walkable(layout, 'bay327', top, DS1.starts.imperial)).toBe(true);
  });
});

describe('the layout', () => {
  const layout = buildLayout(DS1);

  it('finds Docking Bay 327 at its centre, on the deck and up in the air', () => {
    const bay = DS1.rooms.find((r) => r.id === 'bay327');
    expect(layout.roomAt(bay.x, bay.y, bay.z)).toBe('bay327');
    expect(layout.roomAt(bay.x, bay.y + 13, bay.z)).toBe('bay327');
  });

  it('counts half a metre under a floor as in the room, and no further', () => {
    const bay = DS1.rooms.find((r) => r.id === 'bay327');
    expect(layout.roomAt(bay.x, bay.y - 0.45, bay.z)).toBe('bay327');
    expect(layout.roomAt(bay.x, bay.y - 0.55, bay.z)).toBeNull();
    expect(layout.roomAt(bay.x + 5000, bay.y, bay.z)).toBeNull();
  });

  it('finds the hold inside the bay at the hold’s floor, and the bay under it', () => {
    const hold = layout.rooms.get('hold');
    expect(layout.roomAt(hold.x, hold.y, hold.z)).toBe('hold');
    expect(layout.roomAt(hold.x, 0, hold.z)).toBe('bay327');
  });

  it('gives the magnetic field no floor at all', () => {
    const field = DS1.rooms.find((r) => r.id === 'field327');
    expect(layout.floorAt('field327', field.x, field.z)).toBeNull();
  });

  it('reads floors relative to their room, and none where none is laid', () => {
    const s = station([room('far', 100, 50, 10, 10, { y: 10, floors: [{ x: 1, z: 0, w: 2, d: 2, y: 0.5 }] })]);
    const l = buildLayout(s);
    expect(l.floorAt('far', 101, 50)).toBeCloseTo(10.5);
    expect(l.floorAt('far', 98, 50)).toBeNull();
    expect(l.rooms.get('far').floors).toEqual([{ x0: 100, x1: 102, z0: 49, z1: 51, y: 10.5 }]);
  });

  it('keeps a floor’s tag, and reads past floors whose tag is in the set it is given', () => {
    const gap = room('gap', 0, 0, 12, 4, { floors: [{ x: -5, z: 0, w: 2, d: 4, y: 0 }, { x: 0, z: 0, w: 8, d: 1.6, y: 0, tag: 'bridge' }, { x: 5, z: 0, w: 2, d: 4, y: 0 }] });
    const l = buildLayout(station([gap]));
    expect(l.rooms.get('gap').floors.map((f) => f.tag ?? null)).toEqual([null, 'bridge', null]);
    expect(l.floorAt('gap', 0, 0)).toBe(0);
    expect(l.floorAt('gap', 0, 0, new Set(['bridge']))).toBeNull();
    expect(l.floorAt('gap', 0, 0, new Set(['ramp']))).toBe(0);
    expect(l.floorAt('gap', -5, 0, new Set(['bridge']))).toBe(0);
  });

  it('takes a tagged floor away until a flag of its name is set, but never the water', () => {
    const gap = room('gap', 0, 0, 12, 4, { floors: [{ x: -5, z: 0, w: 2, d: 4, y: 0 }, { x: 0, z: 0, w: 8, d: 1.6, y: 0, tag: 'bridge' }, { x: 5, z: 0, w: 2, d: 4, y: -0.9, tag: 'water' }] });
    const l = buildLayout(station([gap]));
    expect([...offTags(l, new Set())]).toEqual(['bridge']);
    expect([...offTags(l)]).toEqual(['bridge']);
    expect(l.floorAt('gap', 0, 0, offTags(l, new Set(['ramp'])))).toBeNull();
    expect(l.floorAt('gap', 0, 0, offTags(l, new Set(['bridge'])))).toBe(0);
    expect(l.floorAt('gap', 0, 0, offTags(l, ['bridge']))).toBe(0);
    expect(l.floorAt('gap', 5, 0, offTags(l, new Set()))).toBe(-0.9);
  });

  it('draws the first station’s chasm bridge back until the flag bridge is set', () => {
    const l = buildLayout(DS1);
    const bridge = l.rooms.get('chasm').floors.find((f) => f.tag === 'bridge');
    const [x, z] = [(bridge.x0 + bridge.x1) / 2, (bridge.z0 + bridge.z1) / 2];
    expect(offTags(l, new Set()).has('bridge')).toBe(true);
    expect(offTags(l, new Set()).has('water')).toBe(false);
    expect(l.floorAt('chasm', x, z, offTags(l, new Set()))).toBeNull();
    expect(l.floorAt('chasm', x, z, offTags(l, new Set(['bridge'])))).toBe(bridge.y);
  });

  it('copies the station’s jumps, and has none when it gives none', () => {
    const s = station([room('top', 0, 0, 10, 4), room('pit', 0, 20, 10, 4, { y: -6 })], [], { spots: { landing: { room: 'pit', x: 0, z: 20, yaw: 0 } } });
    const drop = { id: 'drop', from: 'top', x: 2, z: 0, r: 1, to: 'landing', prompt: 'Drop', lock: 'flag:rope' };
    expect(buildLayout({ ...s, jumps: [drop] }).jumps).toEqual([drop]);
    expect(buildLayout({ ...s, jumps: [drop] }).jumps[0]).not.toBe(drop);
    expect(buildLayout(s).jumps).toEqual([]);
  });

  it('stands on the highest of the floors stacked at a point', () => {
    const s = station([room('stepped', 0, 0, 10, 10, { floors: [{ x: 0, z: 0, w: 10, d: 10, y: 0 }, { x: 0, z: 0, w: 2, d: 2, y: 0.3 }] })]);
    expect(buildLayout(s).floorAt('stepped', 0, 0)).toBeCloseTo(0.3);
    expect(buildLayout(s).floorAt('stepped', 3, 0)).toBeCloseTo(0);
  });

  it('cuts a wall round a 4 m door into two wall segments and one gap segment with `door` set', () => {
    const s = station([room('big', 0, 0, 10, 10, { h: 3 }), room('small', 0, -8, 4, 6, { h: 3 })], [{ id: 'door-4m', a: 'big', b: 'small', x: 0, z: -5, axis: 'x', w: 4, h: 3, kind: 'slide' }]);
    const l = buildLayout(s);
    const north = sideOf(l.walls, 'big', (w) => w.z0 === -5 && w.z1 === -5);
    expect(north).toHaveLength(3);
    const gaps = north.filter((w) => w.door);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ door: 'door-4m', y0: 0, y1: 3 });
    expect(len(gaps[0])).toBeCloseTo(4);
    expect(north.filter((w) => !w.door).map(len)).toEqual([3, 3]);
    expect(l.rooms.get('big').doors).toEqual(['door-4m']);
  });

  it('closes the wall over a door lower than its room with a lintel, and under a raised one with a sill', () => {
    const tall = room('tall', 0, 0, 10, 10, { h: 10, floors: [{ x: 0, z: 0, w: 10, d: 10, y: 0 }, { x: 0, z: -4, w: 4, d: 2, y: 4 }] });
    const up = room('up', 0, -8, 4, 6, { y: 4, h: 3 });
    const l = buildLayout(station([tall, up], [{ id: 'd', a: 'tall', b: 'up', x: 0, z: -5, axis: 'x', w: 2, h: 2.4, kind: 'slide' }]));
    expect(l.doors.get('d').y).toBeCloseTo(4);
    const over = sideOf(l.walls, 'tall', (w) => w.z0 === -5 && w.z1 === -5 && Math.abs(w.x0) <= 1 && Math.abs(w.x1) <= 1);
    const mm = (v) => Math.round(v * 1000) / 1000;
    expect(over.map((w) => [mm(w.y0), mm(w.y1), w.door ?? null]).sort((p, q) => p[0] - q[0])).toEqual([
      [0, 4, null],
      [4, 6.4, 'd'],
      [6.4, 10, null],
    ]);
    const upper = sideOf(l.walls, 'up', (w) => w.door === 'd');
    expect(upper.map((w) => [mm(w.y0), mm(w.y1)])).toEqual([[4, 6.4]]);
  });

  it('walks every wall with its room on the right, seen from above with north up', () => {
    for (const w of layout.walls) {
      const r = layout.rooms.get(w.room);
      const cross = (w.z1 - w.z0) * (r.x - w.x0) - (w.x1 - w.x0) * (r.z - w.z0);
      expect(cross, `${w.room} ${w.x0},${w.z0}→${w.x1},${w.z1}`).toBeLessThan(0);
    }
  });

  it('cuts no wall of the bay for the hatch of the hold nested inside it', () => {
    const hatch = DS1.doors.find((d) => [d.a, d.b].includes('hold')).id;
    expect(layout.walls.filter((w) => w.room === 'bay327' && w.door === hatch)).toEqual([]);
    expect(layout.walls.filter((w) => w.room === 'hold' && w.door === hatch)).toHaveLength(1);
  });

  it('makes a round room of 24 wall segments', () => {
    const l = buildLayout(station([room('drum', 0, 0, 20, 20, { round: true, kind: 'reactor' })]));
    const ring = l.walls.filter((w) => w.room === 'drum');
    expect(ring).toHaveLength(24);
    for (const w of ring) {
      expect(Math.hypot(w.x0, w.z0)).toBeCloseTo(10);
      expect(Math.hypot(w.x1, w.z1)).toBeCloseTo(10);
    }
  });

  it('opens a round room’s wall for a door and keeps the rest closed round it', () => {
    const drum = room('drum', 0, 0, 20, 20, { round: true, kind: 'reactor', h: 6 });
    const way = room('way', 0, -14, 3, 8, { h: 6 });
    const l = buildLayout(station([drum, way], [{ id: 'drum-door', a: 'way', b: 'drum', x: 0, z: -10, axis: 'x', w: 2, h: 6, kind: 'slide' }]));
    const ring = l.walls.filter((w) => w.room === 'drum');
    const gap = ring.filter((w) => w.door === 'drum-door');
    expect(gap).toHaveLength(1);
    expect([gap[0].x0, gap[0].z0, gap[0].x1, gap[0].z1]).toEqual([-1, -10, 1, -10]);
    for (let i = 0; i < ring.length; i++) {
      const next = ring[(i + 1) % ring.length];
      expect(next.x0).toBeCloseTo(ring[i].x1);
      expect(next.z0).toBeCloseTo(ring[i].z1);
    }
    expect(l.floorAt('drum', 0, 0)).toBe(0);
    expect(l.floorAt('drum', 9.5, 9.5)).toBeNull();
    expect(l.roomAt(9.5, 0, 9.5)).toBeNull();
  });

  it('keeps the lifts and their stops', () => {
    for (const lift of DS1.lifts) {
      expect(layout.lifts.get(lift.id).stops).toEqual(lift.stops);
      for (const stop of lift.stops) expect(layout.rooms.get(stop).kind).toBe('lift');
    }
  });
});
