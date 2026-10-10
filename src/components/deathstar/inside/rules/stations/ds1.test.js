import { describe, expect, it } from 'vitest';
import { buildLayout, validateStation } from '../layout';
import { DS1 } from './ds1';
import FIRST from './fixtures/ds1-first-phase.json';

const layout = buildLayout(DS1);
const room = (id) => layout.rooms.get(id);
const door = (id) => layout.doors.get(id);
const spot = (name) => DS1.spots[name];
const jump = (id) => layout.jumps.find((j) => j.id === id);
const doorsOf = (id) => room(id).doors.map(door);
const between = (a, b) => DS1.doors.find((d) => [d.a, d.b].includes(a) && [d.a, d.b].includes(b));

// Whether a body can walk from one point to another over a room’s floors,
// 0.2 m at a time, never rising or dropping more than its 0.4 m step.
function walkable(roomId, from, to, off) {
  const { x0, z0, x1, z1 } = room(roomId).box;
  const g = 0.2;
  const nx = Math.round((x1 - x0) / g);
  const nz = Math.round((z1 - z0) / g);
  const cellOf = (p) => [Math.min(nx - 1, Math.floor((p.x - x0) / g)), Math.min(nz - 1, Math.floor((p.z - z0) / g))];
  const floor = (i, j) => layout.floorAt(roomId, x0 + (i + 0.5) * g, z0 + (j + 0.5) * g, off);
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

// a point just inside a room, through one of its doors
const inside = (d, id) => {
  const r = room(id);
  if (d.axis === 'x') return { x: d.x, z: d.z + (r.z > d.z ? 0.3 : -0.3) };
  return { x: d.x + (r.x > d.x ? 0.3 : -0.3), z: d.z };
};

describe('the first Death Star, whole', () => {
  it('is sound enough to walk', () => {
    expect(validateStation(DS1)).toEqual([]);
  });

  it('keeps every room, door, lift, spot and start the first phase built, where it was', () => {
    for (const r of FIRST.rooms) expect(DS1.rooms.find((q) => q.id === r.id), r.id).toEqual(r);
    for (const d of FIRST.doors) expect(DS1.doors.find((q) => q.id === d.id), d.id).toEqual(d);
    for (const l of FIRST.lifts) expect(DS1.lifts.find((q) => q.id === l.id), l.id).toEqual(l);
    expect(DS1.starts).toEqual(FIRST.starts);
    expect(DS1.spots).toMatchObject(FIRST.spots);
    expect(DS1.sections).toMatchObject(FIRST.sections);
  });

  it('has every room the stories walk through, each of its kind', () => {
    const kinds = {
      bay327: 'hangar',
      field327: 'field',
      hold: 'ship',
      ctl327: 'control',
      corr327: 'corridor',
      lobby5: 'lobby',
      corr5: 'corridor',
      aa23: 'detention',
      cellbay: 'cellbay',
      chute: 'chute',
      compactor: 'compactor',
      maint: 'maintenance',
      core6: 'corridor',
      tractor: 'shaft',
      chasm: 'chasm',
      conference: 'conference',
      overbridge: 'overbridge',
      firecontrol: 'firecontrol',
      tiebay: 'tiebay',
      archive: 'archive',
      meditation: 'meditation',
    };
    for (const [id, kind] of Object.entries(kinds)) expect(room(id)?.kind, id).toBe(kind);
  });

  it('has cells 2180 to 2190, each a cell opening off the cell bay', () => {
    for (let n = 2180; n <= 2190; n++) {
      const cell = room(`cell${n}`);
      expect(cell?.kind, n).toBe('cell');
      expect(cell.doors).toHaveLength(1);
      const way = door(cell.doors[0]);
      expect(room(way.a === cell.id ? way.b : way.a).kind, n).toBe('cellbay');
    }
  });

  it('names every spot the stories need, each in a room the station has', () => {
    const rebel = ['scan-hide', 'scan-crew', 'ambush-panel', 'ambush-trooper-1', 'ambush-trooper-2', 'ctl-door', 'ctl-officer', 'ctl-aide', 'ctl-intercom', 'scomp', 'ctl-closet'];
    const obiWan = ['core6-start', 'core6-guards', 'tractor-ledge', 'tractor-terminal', 'tractor-power-1', 'tractor-power-2'];
    const prison = ['lift5', 'aa23-desk', 'aa23-guards', 'aa23-camera-1', 'aa23-camera-2', 'aa23-intercom', 'cell2187-door', 'leia', 'cellbay-squad', 'chute-grate', 'chute-slide'];
    const escape = ['compactor-drop', 'dianoga', 'compactor-hatch', 'maint-squad', 'chasm-door', 'bridge-control', 'chasm-ledge', 'chasm-far', 'chasm-upper', 'bay-door', 'duel', 'falcon-ramp'];
    const imperial = ['ranks', 'vader-bay', 'maint-sweep', 'beacon'];
    for (const name of [...rebel, ...obiWan, ...prison, ...escape, ...imperial]) expect(spot(name), name).toBeDefined();
  });

  it('puts the story’s spots in the rooms its steps name', () => {
    const where = {
      'scan-hide': 'hold',
      'ambush-panel': 'hold',
      scomp: 'ctl327',
      'core6-start': 'core6',
      'tractor-terminal': 'tractor',
      'aa23-desk': 'aa23',
      'cell2187-door': room('cell2187').doors.map(door).map((d) => (d.a === 'cell2187' ? d.b : d.a))[0],
      leia: 'cell2187',
      'chute-slide': 'chute',
      'compactor-drop': 'compactor',
      'compactor-hatch': 'compactor',
      'chasm-ledge': 'chasm',
      'chasm-far': 'chasm',
      'chasm-upper': 'chasm',
      ranks: 'bay327',
      beacon: 'bay327',
      'falcon-ramp': 'bay327',
    };
    for (const [name, id] of Object.entries(where)) expect(spot(name).room, name).toBe(id);
  });

  it('stands each spot on a floor, not over a void', () => {
    for (const [name, s] of Object.entries(DS1.spots)) expect(layout.floorAt(s.room, s.x, s.z), name).not.toBeNull();
  });
});

describe('its levels and lifts', () => {
  const level = { 1: 12, 2: 0, 5: -36, 6: -48 };

  it('puts the officers’ deck on Level 1, the TIE bay on Level 2, AA-23 on Level 5 and the core shaft on Level 6', () => {
    for (const id of ['conference', 'overbridge', 'firecontrol', 'archive', 'meditation']) expect(room(id).y, id).toBe(level[1]);
    expect(room('tiebay').y).toBe(level[2]);
    expect(room('aa23').y).toBe(level[5]);
    expect(room('core6').y).toBe(level[6]);
  });

  it('lands a lift on every level the station uses', () => {
    const landings = DS1.lifts.flatMap((l) => l.stops).map(room);
    for (const [n, y] of Object.entries(level)) expect(landings.some((r) => r.y === y && r.kind === 'lift'), `Level ${n}`).toBe(true);
    for (const r of landings) expect([r.w, r.d], r.id).toEqual([3, 3]);
  });

  it('puts the TIE bay through a door from Docking Bay 327, with launch doors onto space that stay shut until a launch', () => {
    expect(between('bay327', 'tiebay')).toBeDefined();
    const launch = doorsOf('tiebay').find((d) => room(d.a === 'tiebay' ? d.b : d.a).kind === 'field');
    expect(launch.lock).toMatch(/^flag:/);
  });

  it('keeps the officers’ deck and fire control restricted, and the tractor shaft and the chasm dark', () => {
    for (const id of ['conference', 'overbridge', 'firecontrol', 'archive', 'meditation']) expect(room(id).restricted, id).toBe(true);
    for (const id of ['tractor', 'chasm']) expect(room(id).dark, id).toBe(true);
  });

  it('says in its name that the meditation chamber is inspired, not seen in the film', () => {
    expect(room('meditation').name).toMatch(/inspired/i);
  });
});

describe('the prison level', () => {
  it('blasts open into the chute through a grate in the cell bay’s wall', () => {
    const grate = DS1.doors.find((d) => [d.a, d.b].includes('chute'));
    expect(room(grate.a === 'chute' ? grate.b : grate.a).kind).toBe('cellbay');
    expect(grate.lock).toMatch(/^flag:/);
  });

  it('drops you from the chute into the compactor’s water, without a lift', () => {
    const drop = jump('chute-drop');
    expect(drop.from).toBe('chute');
    expect(spot(drop.to).room).toBe('compactor');
    expect(layout.floorAt('compactor', spot(drop.to).x, spot(drop.to).z)).toBeCloseTo(room('compactor').y - 0.9);
  });
});

describe('garbage compactor 3263827', () => {
  const c = room('compactor');

  it('is 10 × 4 m and 4 m high, with water 0.9 m below its walkway', () => {
    expect([c.w, c.d, c.h]).toEqual([10, 4, 4]);
    const ys = c.floors.map((f) => f.y);
    expect(Math.min(...ys)).toBeCloseTo(c.y - 0.9);
    expect(Math.max(...ys)).toBeCloseTo(c.y);
  });

  it('lets you climb from the water onto the walkway a step at a time', () => {
    const hatch = door('compactor-hatch');
    expect(walkable('compactor', spot('compactor-drop'), inside(hatch, 'compactor'))).toBe(true);
  });

  it('opens its hatch onto the maintenance corridor only to 3263827', () => {
    expect(between('compactor', 'maint')).toMatchObject({ id: 'compactor-hatch', kind: 'hatch', lock: 'code:3263827' });
    expect(door('compactor-hatch').y).toBeCloseTo(c.y);
  });
});

describe('the chasm', () => {
  const ch = room('chasm');
  const off = new Set(['bridge']);

  it('has two ledges with a void between them, bridged only while the bridge is out', () => {
    const mid = { x: ch.x, z: spot('chasm-ledge').z };
    expect(layout.floorAt('chasm', spot('chasm-ledge').x, spot('chasm-ledge').z, off)).toBe(ch.y);
    expect(layout.floorAt('chasm', spot('chasm-far').x, spot('chasm-far').z, off)).toBe(ch.y);
    expect(layout.floorAt('chasm', mid.x, mid.z, off)).toBeNull();
    expect(layout.floorAt('chasm', mid.x, mid.z)).toBe(ch.y);
    expect(walkable('chasm', spot('chasm-ledge'), spot('chasm-far'), off)).toBe(false);
    expect(walkable('chasm', spot('chasm-ledge'), spot('chasm-far'))).toBe(true);
    expect(ch.floors.filter((f) => f.tag === 'bridge')).toHaveLength(1);
  });

  it('swings you across from the ledge’s edge, once you have the grapple', () => {
    const swing = jump('swing');
    expect([swing.from, swing.to, swing.lock]).toEqual(['chasm', 'chasm-far', 'flag:grapple']);
    expect(Math.hypot(swing.x - spot('chasm-ledge').x, swing.z - spot('chasm-ledge').z)).toBeLessThanOrEqual(swing.r);
  });

  it('comes in from the maintenance corridors by a blast door, and goes on from the far ledge', () => {
    const near = doorsOf('chasm').find((d) => [d.a, d.b].some((id) => room(id).kind === 'maintenance'));
    expect(near.kind).toBe('blast');
    expect(Math.hypot(near.x - spot('chasm-door').x, near.z - spot('chasm-door').z)).toBeLessThan(1.5);
    const far = doorsOf('chasm').filter((d) => d !== near && layout.floorAt('chasm', inside(d, 'chasm').x, inside(d, 'chasm').z) === ch.y);
    expect(far.some((d) => walkable('chasm', inside(d, 'chasm'), spot('chasm-far'), off))).toBe(true);
  });

  it('gives the Imperial an upper ledge to shoot across from, up a stair a step at a time', () => {
    const upper = layout.floorAt('chasm', spot('chasm-upper').x, spot('chasm-upper').z, off);
    expect(upper).toBeGreaterThan(ch.y + 3);
    const way = doorsOf('chasm').find((d) => d.y === upper);
    const stair = way.a === 'chasm' ? way.b : way.a;
    const foot = doorsOf(stair).find((d) => d !== way);
    expect(walkable(stair, inside(foot, stair), inside(way, stair))).toBe(true);
    expect(walkable('chasm', inside(way, 'chasm'), spot('chasm-upper'))).toBe(true);
  });
});

describe('the tractor beam’s terminal', () => {
  it('stands at the end of a ledge over the void shaft, reached from the Level 6 corridor', () => {
    const t = room('tractor');
    const way = between('core6', 'tractor');
    expect(way).toBeDefined();
    expect(walkable('tractor', inside(way, 'tractor'), spot('tractor-terminal'))).toBe(true);
    expect(layout.floorAt('tractor', spot('tractor-ledge').x + 3, spot('tractor-ledge').z)).toBeNull();
    expect(layout.floorAt('tractor', t.box.x0 + 1, t.box.z0 + 1)).toBeNull();
    for (const name of ['tractor-power-1', 'tractor-power-2']) expect(spot(name).room).toBe('tractor');
  });
});
