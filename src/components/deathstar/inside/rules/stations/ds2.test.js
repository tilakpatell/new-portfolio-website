import { describe, expect, it } from 'vitest';
import { buildLayout, validateStation } from '../layout';
import { createNav, route } from '../nav';
import { DS2 } from './ds2';
import { STATIONS } from './index';

const layout = buildLayout(DS2);
const room = (id) => layout.rooms.get(id);
// a point given relative to a room’s centre, in station coordinates
const at = (id, x, z) => [room(id).x + x, room(id).z + z];
const floor = (id, x, z) => layout.floorAt(id, ...at(id, x, z));

describe('the second Death Star’s rooms', () => {
  it('is sound enough to walk', () => {
    expect(validateStation(DS2)).toEqual([]);
  });

  it('is ds2, on the start screen’s list now its rooms are drawn and its stories written', () => {
    expect(DS2.id).toBe('ds2');
    expect(STATIONS.ds2).toBe(DS2);
  });

  it('has every room the stories walk through', () => {
    for (const id of ['dock', 'command', 'hangar272', 'holding', 'towerlift', 'throne', 'reactorshaft', 'gallery', 'superstructure', 'corridors2']) expect(room(id), id).toBeDefined();
  });

  it('starts a Rebel at the dock by Vader’s shuttle and an Imperial in the command centre', () => {
    expect(DS2.starts.rebel.room).toBe('dock');
    expect(Math.hypot(DS2.starts.rebel.x - DS2.spots['dock-ramp'].x, DS2.starts.rebel.z - DS2.spots['dock-ramp'].z)).toBeLessThan(8);
    expect(DS2.starts.imperial.room).toBe('command');
  });

  it('names every spot the DS2 stories need', () => {
    const want = ['st321-console', 'dock-ramp', 'vader-arrive', 'ranks272', 'emperor-ramp', 'holding-lift', 'throne-seat', 'throne-armrest', 'under-stairs', 'shaft-edge', 'firing-switch', 'shuttle-ramp', 'escape-shuttle'];
    for (const name of want) expect(DS2.spots[name], name).toBeDefined();
  });

  it('names no spot after a room, so ?at= and teleport() can reach every one', () => {
    for (const name of Object.keys(DS2.spots)) expect(room(name), name).toBeUndefined();
  });

  it('makes Hangar 272 vast', () => {
    expect([room('hangar272').w, room('hangar272').d, room('hangar272').h]).toEqual([80, 60, 30]);
  });
});

describe('the Emperor’s Tower', () => {
  it('lifts you from the antechamber to the throne room, 36 m up', () => {
    const lift = [...layout.lifts.values()].find((l) => l.stops.includes('towerlift'));
    const top = room(lift.stops.find((s) => s !== 'towerlift'));
    expect(layout.doors.get(room('towerlift').doors[0])).toMatchObject({ a: 'holding' });
    expect(top.y).toBe(36);
    expect(top.doors.map((d) => layout.doors.get(d)).some((d) => d.a === 'throne' || d.b === 'throne')).toBe(true);
  });

  it('has a throne room about 30 m across and 14 m high, kind throne, restricted, at the top', () => {
    const t = room('throne');
    expect(t.kind).toBe('throne');
    expect(t.restricted).toBe(true);
    expect([t.w, t.d, t.h, t.y]).toEqual([30, 30, 14, 36]);
  });

  it('raises the throne on a dais reached by stairs a step at a time', () => {
    const throne = DS2.spots['throne-seat'];
    const dais = layout.floorAt('throne', throne.x, throne.z);
    expect(dais).toBeGreaterThan(room('throne').y + 2);
    // walk from the foot of the stairs up to the throne: no rise is more than a step
    let last = layout.floorAt('throne', throne.x, room('throne').z);
    for (let z = room('throne').z; z >= throne.z; z -= 0.1) {
      const y = layout.floorAt('throne', throne.x, z);
      expect(y - last).toBeLessThanOrEqual(0.4 + 1e-9);
      last = y;
    }
    expect(last).toBe(dais);
  });

  it('bridges the reactor shaft, with nothing to stand on either side of the bridge', () => {
    const edge = DS2.spots['shaft-edge'];
    expect(layout.floorAt('throne', edge.x, edge.z)).toBe(36);
    expect(layout.floorAt('throne', edge.x, edge.z - 3)).toBeNull();
    expect(layout.floorAt('throne', edge.x, edge.z + 3)).toBeNull();
    // and the shaft below is a void a long way down
    expect(layout.roomAt(edge.x, 20, edge.z - 3)).toBe('reactorshaft');
    expect(layout.floorAt('reactorshaft', edge.x, edge.z - 3)).toBeNull();
  });

  it('has the round window in its north wall, a window and not a door', () => {
    const t = room('throne');
    expect(t.window).toMatchObject({ wall: 'north', round: true });
    const north = t.box.z0;
    expect(t.doors.map((d) => layout.doors.get(d)).filter((d) => Math.abs(d.z - north) < 0.1)).toEqual([]);
  });

  it('keeps the throne, its armrest and the hiding place under the stairs inside the throne room', () => {
    for (const name of ['throne-seat', 'throne-armrest', 'under-stairs', 'shaft-edge']) expect(DS2.spots[name].room, name).toBe('throne');
    const hide = DS2.spots['under-stairs'];
    expect(layout.floorAt('throne', hide.x, hide.z)).toBe(36);
  });
});

describe('the superstructure', () => {
  it('is walkways over a void', () => {
    const s = room('superstructure');
    expect(floor('superstructure', 0, 0)).not.toBeNull();
    expect(floor('superstructure', 10, 10)).toBeNull();
    for (const f of s.floors) expect(Math.min(f.x1 - f.x0, f.z1 - f.z0)).toBeLessThanOrEqual(8);
  });

  it('glows with the reactor chamber far below', () => {
    expect(room('superstructure').glow).toBe('reactor');
  });
});

describe('the way out', () => {
  const nav = createNav(layout);
  const length = (from, to) => {
    const way = route(nav, DS2.spots[from], DS2.spots[to]);
    let metres = 0;
    for (let k = 1; k < way.length; k += 1) metres += way[k].lift ? 0 : Math.hypot(way[k].x - way[k - 1].x, way[k].z - way[k - 1].z);
    return metres;
  };

  it('lets Luke carry Vader from the throne to the escape shuttle well inside the story’s 120 s at a walk', () => {
    // walk is 1.6 m/s; keep a third of the time for crowds, quakes and the lift
    expect(length('throne-seat', 'shuttle-ramp') / 1.6).toBeLessThan(80);
  });

  it('keeps the tower’s foot nearer the dock than Hangar 272’s far wall', () => {
    expect(length('dock-ramp', 'holding-lift')).toBeLessThan(100);
  });
});
