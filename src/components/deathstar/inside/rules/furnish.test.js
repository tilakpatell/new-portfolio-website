import { describe, expect, it } from 'vitest';
import { furnish } from './furnish';
import { buildLayout, ROOM_KINDS } from './layout';
import { createNav, route } from './nav';
import { DS1 } from './stations/ds1';
import { DS2 } from './stations/ds2';
import { createBody, stepBody } from './walker';

const R = 0.35; // a body’s radius (walker.js)
const HAIR = 1e-6;
const TICK = 1 / 30;

// Both stations, every room furnished once.
const worlds = [DS1, DS2].map((station) => {
  const layout = buildLayout(station);
  const rooms = [...layout.rooms.values()].map((room) => ({ room, made: furnish(room, station) }));
  return { station, layout, rooms, made: new Map(rooms.map((r) => [r.room.id, r.made])) };
});
const [ds1, ds2] = worlds;
const everyRoom = worlds.flatMap((w) => w.rooms.map((r) => ({ ...w, ...r })));

// ── geometry ──

const corners = (p) => {
  const f = { x: Math.sin(p.yaw), z: -Math.cos(p.yaw) };
  const r = { x: Math.cos(p.yaw), z: Math.sin(p.yaw) };
  return [-1, 1].flatMap((a) => [-1, 1].map((b) => ({ x: p.x + (r.x * a * p.w) / 2 + (f.x * b * p.d) / 2, z: p.z + (r.z * a * p.w) / 2 + (f.z * b * p.d) / 2 })));
};
const holds = (room, { x, z }) => (room.round ? Math.hypot(x - room.x, z - room.z) <= room.w / 2 + HAIR : x >= room.box.x0 - HAIR && x <= room.box.x1 + HAIR && z >= room.box.z0 - HAIR && z <= room.box.z1 + HAIR);
const boxOfSolid = (s) => (s.box ? s.box : { x0: s.circle.x - s.circle.r, x1: s.circle.x + s.circle.r, z0: s.circle.z - s.circle.r, z1: s.circle.z + s.circle.r });
// how far a point stands from a solid seen from above (0 inside it)
const toSolid = (s, p) => {
  if (s.circle) return Math.max(0, Math.hypot(p.x - s.circle.x, p.z - s.circle.z) - s.circle.r);
  const dx = Math.max(s.box.x0 - p.x, 0, p.x - s.box.x1);
  const dz = Math.max(s.box.z0 - p.z, 0, p.z - s.box.z1);
  return Math.hypot(dx, dz);
};
const overlaps = (a, b) => a.x0 < b.x1 - HAIR && b.x0 < a.x1 - HAIR && a.z0 < b.z1 - HAIR && b.z0 < a.z1 - HAIR;
// the metre in front of a door, either side of it
const stripOf = (d) => (d.axis === 'x' ? { x0: d.x - d.w / 2, x1: d.x + d.w / 2, z0: d.z - 1, z1: d.z + 1 } : { x0: d.x - 1, x1: d.x + 1, z0: d.z - d.w / 2, z1: d.z + d.w / 2 });
const doorsOf = (station, room) => station.doors.filter((d) => d.a === room.id || d.b === room.id);
const placesIn = (station, room) => [
  ...Object.entries(station.spots ?? {}).filter(([, s]) => s.room === room.id).map(([name, s]) => ({ name, ...s })),
  ...Object.entries(station.starts ?? {}).filter(([, s]) => s.room === room.id).map(([side, s]) => ({ name: `${side} start`, ...s })),
];
const all = (key) => everyRoom.flatMap((e) => e.made[key].map((thing) => ({ ...e, thing })));

describe('furnish', () => {
  it('furnishes every room of both stations into solids, props and spots', () => {
    for (const { room, made } of everyRoom) {
      expect(Array.isArray(made.solids), room.id).toBe(true);
      expect(Array.isArray(made.props), room.id).toBe(true);
      expect(Array.isArray(made.spots), room.id).toBe(true);
    }
    expect(all('props').length).toBeGreaterThan(200);
  });

  it('gives every prop a kind, a place, a facing and a size, and every solid a height', () => {
    for (const { room, thing: p } of all('props')) {
      expect(typeof p.kind, room.id).toBe('string');
      for (const k of ['x', 'y', 'z', 'yaw']) expect(Number.isFinite(p[k]), `${room.id} ${p.kind}.${k}`).toBe(true);
      for (const k of ['w', 'd', 'h']) expect(p[k], `${room.id} ${p.kind}.${k}`).toBeGreaterThan(0);
    }
    for (const { room, thing: s } of all('solids')) {
      const { y0, y1 } = s.box ?? s.circle;
      expect(y1, room.id).toBeGreaterThan(y0);
      if (s.circle) expect(s.circle.r, room.id).toBeGreaterThan(0.01);
      else for (const [lo, hi] of [['x0', 'x1'], ['z0', 'z1']]) expect(s.box[hi] - s.box[lo], `${room.id}: ${JSON.stringify(s.box)}`).toBeGreaterThan(0.01);
    }
  });

  it('is the same every time it furnishes a room, and seeded by the room’s id', () => {
    for (const { station, room, made } of everyRoom) expect(furnish(room, station), room.id).toEqual(made);
    const bay = ds1.layout.rooms.get('bay327');
    const crates = (made) => made.props.filter((p) => p.kind === 'crate');
    expect(crates(furnish({ ...bay, id: 'bay328' }, DS1))).not.toEqual(crates(ds1.made.get('bay327')));
  });

  it('keeps every prop’s footprint inside its room', () => {
    for (const { room, thing: p } of all('props')) for (const c of corners(p)) expect(holds(room, c), `${room.id}: ${p.kind} at ${p.x.toFixed(2)}, ${p.z.toFixed(2)}`).toBe(true);
  });

  it('keeps every prop and solid under its room’s ceiling', () => {
    for (const { room, thing: p } of all('props')) expect(p.y + p.h, `${room.id}: ${p.kind}`).toBeLessThanOrEqual(room.y + room.h + HAIR);
    for (const { room, thing: s } of all('solids')) expect((s.box ?? s.circle).y1, room.id).toBeLessThanOrEqual(room.y + room.h + HAIR);
  });

  it('keeps every solid inside its room', () => {
    for (const { room, thing: s } of all('solids')) {
      if (room.round && s.circle) {
        expect(Math.hypot(s.circle.x - room.x, s.circle.z - room.z) + s.circle.r, room.id).toBeLessThanOrEqual(room.w / 2 + HAIR);
        continue;
      }
      const b = boxOfSolid(s);
      for (const c of [{ x: b.x0, z: b.z0 }, { x: b.x0, z: b.z1 }, { x: b.x1, z: b.z0 }, { x: b.x1, z: b.z1 }]) expect(holds(room, c), room.id).toBe(true);
    }
  });

  it('leaves the metre in front of every door clear of solids', () => {
    for (const { station, room, made } of everyRoom) {
      for (const door of doorsOf(station, room)) for (const s of made.solids) expect(overlaps(boxOfSolid(s), stripOf(door)), `${room.id}: a solid in front of ${door.id}`).toBe(false);
    }
  });

  it('puts no solid on a spot or a start, but for the spots that name the thing standing there', () => {
    const covered = [];
    for (const { station, room, made } of everyRoom) {
      for (const place of placesIn(station, room)) {
        if (!made.solids.some((s) => toSolid(s, place) < R - HAIR)) continue;
        covered.push(place.name);
        // the thing it names stands on it: the Falcon, the table, the throne
        expect(made.props.some((p) => Math.hypot(p.x - place.x, p.z - place.z) < 0.01), `${place.name} has no prop standing at it`).toBe(true);
      }
    }
    expect(covered.sort()).toEqual(['conference-table', 'escape-shuttle', 'falcon', 'meditation-pod', 'throne-armrest', 'throne-seat']);
  });

  it('keeps the use-points of every jump clear of solids', () => {
    for (const w of worlds) for (const j of w.station.jumps ?? []) for (const s of w.made.get(j.from).solids) expect(toSolid(s, j), j.id).toBeGreaterThanOrEqual(R - HAIR);
  });

  it('stands every solid on the floor under its middle, where there is one', () => {
    for (const { layout, room, thing: s } of all('solids')) {
      const b = boxOfSolid(s);
      const floor = layout.floorAt(room.id, (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
      if (floor !== null) expect((s.box ?? s.circle).y0, room.id).toBeCloseTo(floor, 6);
    }
  });

  it('makes work and post spots clear to stand on, and seats inside the chair or bench they are on', () => {
    for (const { layout, room, made, thing: spot } of all('spots')) {
      expect(['work', 'post', 'sit'], room.id).toContain(spot.kind);
      // its room, so brains.js can take it as a role’s place as it is
      expect(spot.room, spot.name).toBe(room.id);
      expect(holds(room, spot), `${spot.name} stands outside ${room.id}`).toBe(true);
      if (spot.kind === 'sit') {
        expect(made.props.some((p) => ['chair', 'bench', 'throne', 'meditation-pod'].includes(p.kind) && Math.hypot(p.x - spot.x, p.z - spot.z) < Math.max(p.w, p.d) / 2 + HAIR), spot.name).toBe(true);
        continue;
      }
      expect(layout.floorAt(room.id, spot.x, spot.z), `${spot.name} has no floor`).not.toBeNull();
      for (const s of made.solids) expect(toSolid(s, spot), `${spot.name} stands in a solid`).toBeGreaterThanOrEqual(R - HAIR);
    }
  });

  it('writes its signs without straight quotes, shouting or American spellings', () => {
    const texts = all('props').filter((e) => e.thing.text !== undefined);
    expect(texts.length).toBeGreaterThan(10);
    for (const { thing: p } of texts) {
      expect(p.text).not.toMatch(/['"]|!!/);
      expect(p.text).not.toMatch(/\b(color|center|meter|liter|gray)\b/i);
    }
  });
});

describe('what the stories and eggs use', () => {
  const TAGS = {
    ds1: {
      'ambush-panel': 'hold',
      scomp: 'ctl327',
      'beacon-spot': 'bay327',
      robe: 'bay327',
      'tractor-terminal': 'tractor',
      'aa23-desk': 'aa23',
      'chute-grate': 'cellbay2',
      'compactor-hatch': 'compactor',
      grapple: 'chasm',
      'bridge-control': 'chasm',
      'krennic-chair': 'conference',
      librarian: 'archive',
      plans: 'archive',
      'exhaust-note': 'maint',
    },
    ds2: { 'armrest-saber': 'throne', nameplate: 'command', 'st321-console': 'command', 'firing-switch': 'command' },
  };

  for (const w of worlds) {
    it(`puts each of ${w.station.id}’s tagged things once, in the room its story looks in`, () => {
      const tagged = w.rooms.flatMap(({ room, made }) => made.props.filter((p) => p.tag).map((p) => ({ room: room.id, tag: p.tag })));
      for (const [tag, room] of Object.entries(TAGS[w.station.id])) expect(tagged.filter((t) => t.tag === tag), tag).toEqual([{ room, tag }]);
    });
  }

  it('hangs a camera tagged for the story over each of AA-23’s camera spots', () => {
    const cams = ds1.made.get('aa23').props.filter((p) => p.kind === 'camera');
    expect(cams).toHaveLength(2);
    // (each tagged by its spot's name: a bolt breaks what its tag names, and the story counts the two)
    for (const name of ['aa23-camera-1', 'aa23-camera-2']) expect(cams.some((c) => c.tag === name && c.x === DS1.spots[name].x && c.z === DS1.spots[name].z), name).toBe(true);
    for (const c of cams) expect(c.y).toBeGreaterThan(DS1.rooms.find((r) => r.id === 'aa23').y + 2);
  });

  it('sets the conference table with twelve chairs and leaves the one at Krennic’s place empty', () => {
    const made = ds1.made.get('conference');
    const chairs = made.props.filter((p) => p.kind === 'chair');
    expect(chairs).toHaveLength(12);
    const spot = DS1.spots['krennic-chair'];
    const nearest = chairs.reduce((a, c) => (Math.hypot(c.x - spot.x, c.z - spot.z) < Math.hypot(a.x - spot.x, a.z - spot.z) ? c : a));
    expect(nearest.tag).toBe('krennic-chair');
    expect(made.spots.filter((s) => s.kind === 'sit')).toHaveLength(12);
    expect(made.spots.filter((s) => s.tag === 'krennic-chair')).toHaveLength(1);
  });

  it('writes the exhaust port’s note and Jerjerrod’s rank where they can be read', () => {
    const note = ds1.made.get('maint').props.find((p) => p.tag === 'exhaust-note');
    expect(note.text).toMatch(/exhaust port/i);
    expect(note.text).toMatch(/two metres/i);
    const plate = ds2.made.get('command').props.find((p) => p.tag === 'nameplate');
    expect(plate.text).toMatch(/^Moff .*Jerjerrod$/);
  });

  it('stencils the compactor’s number by its hatch', () => {
    expect(ds1.made.get('compactor').props.some((p) => p.text === '3263827')).toBe(true);
  });
});

describe('what each room is furnished with', () => {
  const DRAWN = {
    ds1: {
      hold: ['compartment', 'wall-panel'],
      bay327: ['falcon', 'crate', 'robe', 'hull-mark'],
      ctl327: ['console', 'bank', 'scomp', 'intercom', 'camera'],
      aa23: ['horseshoe', 'camera', 'intercom', 'console'],
      cellbay: ['cell-number', 'door-panel'],
      cellbay2: ['cell-number', 'door-panel', 'grate'],
      cell2187: ['bench', 'ito'],
      cell2180: ['bench'],
      compactor: ['keypad', 'stencil', 'junk'],
      chute: ['chute-mouth'],
      tractor: ['terminal', 'lever', 'beam-column'],
      chasm: ['pedestal', 'anchor'],
      conference: ['table', 'chair'],
      overbridge: ['window-frame', 'pentagon-screen', 'tulip'],
      firecontrol: ['fire-console', 'button-bank'],
      tiebay: ['tie', 'tie-rack'],
      archive: ['stacks', 'desk', 'feed', 'terminal', 'camera'],
      meditation: ['meditation-pod'],
      maint: ['pipes', 'sign'],
      maint2: ['pipes'],
    },
    ds2: {
      throne: ['throne', 'saber', 'stairs', 'window-frame', 'guard-post'],
      holding: ['guard-post', 'column'],
      command: ['station', 'desk', 'nameplate', 'screen'],
      dock: ['lambda', 'crate'],
      hangar272: ['lambda', 'crate'],
      superstructure: ['crate'],
      gallery: ['console'],
    },
  };

  for (const w of worlds) {
    for (const [id, kinds] of Object.entries(DRAWN[w.station.id])) {
      it(`gives ${id} its ${kinds.join(', ')}`, () => {
        const have = new Set(w.made.get(id).props.map((p) => p.kind));
        for (const kind of kinds) expect(have.has(kind), kind).toBe(true);
      });
    }
  }

  it('heaps junk in the compactor’s water to wade round, none of it on the walkway', () => {
    const { layout } = ds1;
    const made = ds1.made.get('compactor');
    const bottom = Math.min(...layout.rooms.get('compactor').floors.map((f) => f.y));
    const heaps = made.solids.filter((s) => s.box && made.props.some((p) => p.kind === 'junk' && Math.abs(p.x - (s.box.x0 + s.box.x1) / 2) < 1e-6 && Math.abs(p.z - (s.box.z0 + s.box.z1) / 2) < 1e-6));
    expect(heaps.length).toBeGreaterThanOrEqual(5);
    for (const s of heaps) expect(s.box.y0).toBeCloseTo(bottom, 6);
  });

  it('hovers the IT-O only in the cell someone is held in', () => {
    const itos = ds1.rooms.filter(({ made }) => made.props.some((p) => p.kind === 'ito')).map(({ room }) => room.id);
    expect(itos).toEqual(['cell2187']);
  });

  it('lines a bare wall with consoles shoulder to shoulder, corner to corner', () => {
    // fire control’s east wall has no door: its banks run unbroken along it
    const room = ds1.layout.rooms.get('firecontrol');
    const banks = ds1.made.get('firecontrol').props.filter((p) => p.kind === 'button-bank' && Math.abs(p.yaw + Math.PI / 2) < 1e-6).sort((a, b) => a.z - b.z);
    // (a console short of a corner leaves less than its own width and the corner’s clearance)
    expect(banks[0].z - banks[0].w / 2 - room.box.z0).toBeLessThan(2);
    expect(room.box.z1 - (banks.at(-1).z + banks.at(-1).w / 2)).toBeLessThan(2);
    for (let k = 1; k < banks.length; k++) expect(banks[k].z - banks[k].w / 2 - (banks[k - 1].z + banks[k - 1].w / 2)).toBeLessThan(0.1);
  });

  it('parks TIEs in rows facing the launch doors, hung clear of the deck', () => {
    const ties = ds1.made.get('tiebay').props.filter((p) => p.kind === 'tie');
    expect(ties.length).toBeGreaterThanOrEqual(6);
    for (const t of ties) {
      expect(t.yaw).toBeCloseTo(Math.PI, 6);
      expect(t.y).toBeGreaterThan(0);
    }
  });

  it('leaves the corridors, lobbies, lifts and fields bare', () => {
    for (const { room, made } of everyRoom) if (['corridor', 'lobby', 'lift', 'field'].includes(room.kind)) expect(made, room.id).toEqual({ solids: [], props: [], spots: [] });
  });

  it('furnishes a room of every kind, even one no station has yet, without blocking its door', () => {
    for (const kind of ROOM_KINDS) {
      const station = {
        id: 'test',
        name: 'Test',
        era: 'anh',
        sections: { s: 'Test' },
        rooms: [
          { id: 'r', kind, name: 'r', section: 's', x: 0, z: 0, w: 16, d: 12, y: 0, h: 6 },
          { id: 'c', kind: 'corridor', name: 'c', section: 's', x: 0, z: 7.6, w: 4, d: 3.2, y: 0, h: 3.2 },
        ],
        doors: [{ id: 'r-c', a: 'r', b: 'c', x: 0, z: 6, axis: 'x', w: 2, h: 2.6, kind: 'slide' }],
        lifts: [],
        starts: { rebel: { room: 'c', x: 0, z: 7.6, yaw: 0 }, imperial: { room: 'c', x: 0, z: 7.6, yaw: 0 } },
        spots: {},
      };
      const room = buildLayout(station).rooms.get('r');
      const made = furnish(room, station);
      for (const p of made.props) for (const c of corners(p)) expect(holds(room, c), `${kind}: ${p.kind}`).toBe(true);
      for (const s of made.solids) expect(overlaps(boxOfSolid(s), stripOf(station.doors[0])), kind).toBe(false);
    }
  });

  it('builds a reactor round its core', () => {
    const station = { id: 't', sections: { s: 'T' }, rooms: [{ id: 'core', kind: 'reactor', name: 'Core', section: 's', x: 0, z: 0, w: 20, d: 20, y: 0, h: 12 }], doors: [], spots: {}, starts: {} };
    const made = furnish(buildLayout(station).rooms.get('core'), station);
    expect(made.props.map((p) => p.kind)).toContain('reactor-core');
  });
});

describe('walking among the furniture', () => {
  it('lets you walk down the Falcon’s ramp, and stops you at her belly', () => {
    const { layout } = ds1;
    const world = { layout, open: () => true, solids: ds1.made.get('bay327').solids };
    const down = createBody({ x: -12, y: layout.floorAt('bay327', -12, -5.5), z: -5.5, room: 'bay327' });
    for (let i = 0; i < 150; i++) stepBody(down, { dir: { x: 0, z: 1 } }, TICK, world);
    expect(down.z).toBeGreaterThan(1);
    expect(down.x).toBeCloseTo(-12, 1);
    const into = createBody({ x: 3, y: 0, z: -4, room: 'bay327' });
    for (let i = 0; i < 150; i++) stepBody(into, { dir: { x: -1, z: 0 } }, TICK, world);
    expect(into.x).toBeGreaterThan(-1);
  });

  it('leaves every door, spot and work place of a room as reachable inside it as it was bare', () => {
    for (const w of worlds) {
      const nav = createNav(w.layout);
      for (const { room, made } of w.rooms) {
        // a metre into the room from each of its doors, on its own side
        const fronts = doorsOf(w.station, room).flatMap((d) => {
          const door = w.layout.doors.get(d.id);
          const n = d.axis === 'x' ? { x: 0, z: 0.6 } : { x: 0.6, z: 0 };
          const side = [1, -1].map((s) => ({ name: d.id, x: d.x + n.x * s, z: d.z + n.z * s, room: room.id })).find((p) => w.layout.roomAt(p.x, door.y + 0.1, p.z) === room.id);
          return side ? [side] : [];
        });
        // (a spot naming the thing that stands on it, like the Falcon’s, is not walked to)
        const places = placesIn(w.station, room).filter((p) => !made.solids.some((s) => toSolid(s, p) < R - HAIR));
        const ends = [...fronts, ...places.map((p) => ({ ...p, room: room.id })), ...made.spots.filter((s) => s.kind !== 'sit').map((s) => ({ ...s, room: room.id }))];
        const inside = { canPass: () => false };
        const furnished = { canPass: () => false, solidsOf: (id) => (id === room.id ? made.solids : []) };
        // one door for each part of the bare room the others can’t reach (the chasm’s upper ledge) is enough
        const sources = [];
        for (const f of fronts) if (!sources.some((s) => route(nav, s, f, inside))) sources.push(f);
        for (const a of sources) {
          for (const b of ends) {
            if (a === b || route(nav, a, b, furnished)) continue;
            expect(route(nav, a, b, inside), `${room.id}: the furniture cuts ${a.name} off from ${b.name}`).toBeNull();
          }
        }
      }
    }
  });
});
