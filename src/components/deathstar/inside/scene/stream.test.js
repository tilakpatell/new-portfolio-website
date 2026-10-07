import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createDoors } from '../rules/doors';
import { ROOM_KINDS, buildLayout, validateStation } from '../rules/layout';
import { DS1 } from '../rules/stations/ds1';
import { createStream, plan } from './stream';

const ds1 = buildLayout(DS1);
const shut = () => false;
const only =
  (...ids) =>
  (id) =>
    ids.includes(id);
const sorted = (set) => [...set].sort();
const numeric = (xs) => [...xs].sort((a, b) => a - b);

// A straight run of corridors, c0 to c(n − 1) west to east, each joined
// to the next by a sliding door, so c5 is five doors from c0.
function run(n = 7) {
  const rooms = Array.from({ length: n }, (_, k) => ({ id: `c${k}`, kind: 'corridor', name: `Corridor ${k}`, section: 'run', x: 4 * k, z: 0, w: 4, d: 3.2, y: 0, h: 3.2 }));
  const doors = Array.from({ length: n - 1 }, (_, k) => ({ id: `c${k}-c${k + 1}`, a: `c${k}`, b: `c${k + 1}`, x: 4 * k + 2, z: 0, axis: 'z', w: 2.4, h: 2.6, kind: 'slide' }));
  const at = { room: 'c0', x: 0, z: 0, yaw: 0 };
  const station = { id: 'run', name: 'Run', era: 'anh', sections: { run: 'The run' }, rooms, doors, lifts: [], starts: { rebel: at, imperial: at }, spots: {} };
  expect(validateStation(station)).toEqual([]);
  return buildLayout(station);
}

describe('what to build, show and free from the room you stand in', () => {
  it('shows only Docking Bay 327 from inside it with every door shut', () => {
    expect(sorted(plan(ds1, 'bay327', shut).show)).toEqual(['bay327']);
  });

  it('shows the access corridor too once the door to it is open', () => {
    expect(sorted(plan(ds1, 'bay327', only('bay327-corr')).show)).toEqual(['bay327', 'corr327']);
  });

  it('looks through one open door, not on through a second', () => {
    // from the lift lobby down the corridor; the bay’s door at its far end is open but a second door away
    expect(sorted(plan(ds1, 'lobby1', only('corr327-lobby1', 'bay327-corr')).show)).toEqual(['corr327', 'lobby1']);
  });

  it('looks one room further when the way passes an open arch', () => {
    // the field’s arch first, then the corridor’s door
    expect(sorted(plan(ds1, 'field327', only('bay327-field', 'bay327-corr')).show)).toEqual(['bay327', 'corr327', 'field327']);
    // the corridor’s door first, then the arch onto the field
    expect(sorted(plan(ds1, 'corr327', only('bay327-corr', 'bay327-field')).show)).toEqual(['bay327', 'corr327', 'field327']);
  });

  it('never looks three rooms deep, arches or not', () => {
    const open = () => true;
    // the field, the bay, the corridor; the lobby beyond the corridor is a third door away
    const { show } = plan(ds1, 'field327', open);
    expect(show.has('corr327')).toBe(true);
    expect(show.has('lobby1')).toBe(false);
  });

  it('looks out of a control room’s windows onto its bay, whatever its door', () => {
    expect(sorted(plan(ds1, 'ctl327', shut).show)).toEqual(['bay327', 'ctl327']);
  });

  it('looks out of a control room onto bays only, not a corridor behind its other wall', () => {
    const behind = { id: 'behind', kind: 'corridor', name: 'Behind', section: 'bay327', x: 28.6, z: -27.5, w: 3.2, d: 7, y: 6, h: 3 };
    expect(sorted(plan(buildLayout({ ...DS1, rooms: [...DS1.rooms, behind] }), 'ctl327', shut).show)).toEqual(['bay327', 'ctl327']);
  });

  it('sees nothing through a corridor’s wall, though it backs onto the bay', () => {
    // corr327’s south wall stands on the bay’s north wall, as the control room’s does
    expect(sorted(plan(ds1, 'corr327', shut).show)).toEqual(['corr327']);
  });

  it('builds every room within two doors, open or shut, and nothing a lift ride away', () => {
    // lobby1: the corridor, the lift and the ring a door away, the bay two; the hold, the control room and the field three;
    // lift1-l5 and lift1-l6 only by riding from lift1-l2
    expect(sorted(plan(ds1, 'lobby1', shut).build)).toEqual(['bay327', 'corr327', 'lift1-l2', 'lobby1', 'ring2']);
  });

  it('frees a built room five doors away and keeps one four doors away', () => {
    const built = new Set(['c0', 'c1', 'c3', 'c4', 'c5']);
    expect(sorted(plan(run(), 'c0', shut, built).free)).toEqual(['c5']);
  });

  it('offers every room past four doors to free when it is not told what is built', () => {
    expect(sorted(plan(run(), 'c0', shut).free)).toEqual(['c5', 'c6']);
  });

  it('frees everything on the level a lift has left, since a ride is not a door', () => {
    expect(sorted(plan(ds1, 'lift1-l5', shut, new Set(['bay327', 'corr327', 'lift1-l2', 'lift1-l5'])).free)).toEqual(['bay327', 'corr327', 'lift1-l2']);
  });

  it('has nothing to say from no room or one the station lacks', () => {
    for (const here of [null, 'nowhere']) {
      const p = plan(ds1, here, shut, new Set(['bay327']));
      expect([p.build.size, p.show.size, p.free.size]).toEqual([0, 0, 0]);
    }
  });

  it('reads only the layout and the open test, and changes neither them nor the game', () => {
    const game = { doors: createDoors(ds1), you: { x: 10, y: 0, z: -20, room: 'bay327', hp: 60 }, seen: new Set(['hold', 'bay327']) };
    const built = new Set(['bay327', 'lift1-l5']);
    const before = structuredClone({ game, built, rooms: ds1.rooms, doors: ds1.doors, walls: ds1.walls, lifts: ds1.lifts });
    const asked = [];
    const open = (id) => {
      asked.push(id);
      return game.doors[id].open > 0;
    };
    const p = plan(ds1, 'bay327', open, built);
    expect({ game, built, rooms: ds1.rooms, doors: ds1.doors, walls: ds1.walls, lifts: ds1.lifts }).toEqual(before);
    expect(asked.length).toBeGreaterThan(0);
    for (const id of asked) expect(ds1.doors.has(id)).toBe(true);
    // the arch onto the field never closes, so the game’s doors show it
    expect(sorted(p.show)).toEqual(['bay327', 'field327']);
  });
});

// Builders that make an empty group a room, with the lamps given for it,
// and keep a log of what they built.
function fakeBuilders(lampsOf = {}) {
  const log = [];
  const make = (kit, room) => {
    log.push(room.id);
    const group = new THREE.Group();
    group.name = room.id;
    return { group, lamps: lampsOf[room.id] ?? [], update: vi.fn(), dispose: vi.fn() };
  };
  return { log, builders: Object.fromEntries(ROOM_KINDS.map((k) => [k, make])) };
}

const lightsIn = (scene) => scene.children.filter((o) => o.isPointLight && o.visible);
const lit = (scene) =>
  lightsIn(scene)
    .filter((l) => l.intensity > 0)
    .map((l) => ({ x: l.position.x, y: l.position.y, z: l.position.z, intensity: l.intensity, distance: l.distance }));
const meshesIn = (group) => {
  const meshes = [];
  group.traverse((o) => o.isMesh && meshes.push(o));
  return meshes;
};

function frames(stream, n, here, open = shut, ctx = {}, dt = 1 / 60) {
  for (let i = 0; i < n; i++) stream.update(here, open, i * dt, dt, ctx);
}

describe('streaming the rooms into the scene', () => {
  it('builds one room a frame, the room you stand in first', () => {
    const { log, builders } = fakeBuilders();
    const stream = createStream({}, ds1, new THREE.Scene(), { builders });
    frames(stream, 1, 'lobby1');
    expect(log).toEqual(['lobby1']);
    frames(stream, 4, 'lobby1');
    expect(log).toHaveLength(5);
    expect(sorted(log)).toEqual(['bay327', 'corr327', 'lift1-l2', 'lobby1', 'ring2']);
    frames(stream, 3, 'lobby1');
    expect(log).toHaveLength(5);
  });

  it('builds the rooms you can see before the rest', () => {
    const { log, builders } = fakeBuilders();
    const stream = createStream({}, ds1, new THREE.Scene(), { builders });
    frames(stream, 2, 'lobby1', only('lobby1-ring2'));
    expect(log).toEqual(['lobby1', 'ring2']);
  });

  it('puts each room it builds in the scene, hidden unless it is shown', () => {
    const { builders } = fakeBuilders();
    const scene = new THREE.Scene();
    const stream = createStream({}, ds1, scene, { builders });
    frames(stream, 6, 'bay327');
    const corr = stream.built.get('corr327').group;
    expect(corr.parent).toBe(scene);
    expect(corr.visible).toBe(false);
    expect(stream.built.get('bay327').group.visible).toBe(true);
    frames(stream, 1, 'bay327', only('bay327-corr'));
    expect(corr.visible).toBe(true);
  });

  it('runs a room’s own update only while it is shown', () => {
    const { builders } = fakeBuilders();
    const stream = createStream({}, ds1, new THREE.Scene(), { builders });
    frames(stream, 6, 'bay327');
    const bay = stream.built.get('bay327');
    const corr = stream.built.get('corr327');
    const ctx = { alert: 'calm' };
    stream.update('bay327', shut, 2, 0.1, ctx);
    expect(bay.update).toHaveBeenLastCalledWith(2, 0.1, ctx);
    expect(corr.update).not.toHaveBeenCalled();
  });

  it('lights a room’s lamps only while it is shown', () => {
    const lamp = { x: 10, y: 2.8, z: -32, color: '#ffffff', intensity: 5, distance: 8 };
    const { builders } = fakeBuilders({ corr327: [lamp] });
    const scene = new THREE.Scene();
    const stream = createStream({}, ds1, scene, { builders });
    frames(stream, 6, 'bay327');
    expect(lit(scene)).toEqual([]);
    frames(stream, 2, 'bay327', only('bay327-corr'), {}, 1);
    expect(lit(scene)).toEqual([{ x: 10, y: 2.8, z: -32, intensity: 5, distance: 8 }]);
    frames(stream, 2, 'bay327', shut, {}, 1);
    expect(lit(scene)).toEqual([]);
  });

  it('brings a lamp up over a moment rather than all at once', () => {
    const lamp = { x: 10, y: 2.8, z: -32, color: '#ffffff', intensity: 5, distance: 8 };
    const { builders } = fakeBuilders({ corr327: [lamp] });
    const scene = new THREE.Scene();
    const stream = createStream({}, ds1, scene, { builders });
    frames(stream, 6, 'bay327');
    frames(stream, 1, 'bay327', only('bay327-corr'), {}, 0.05);
    const [glow] = lit(scene);
    expect(glow.intensity).toBeGreaterThan(0);
    expect(glow.intensity).toBeLessThan(5);
  });

  it('lights the nearest lamps the tier allows and no more', () => {
    const lamps = [0, 5, 10, 20, 30, 40].map((x) => ({ x: x - 20, y: 10, z: 0, color: 0xdde6ff, intensity: 40, distance: 30 }));
    const { builders } = fakeBuilders({ bay327: lamps });
    const scene = new THREE.Scene();
    const stream = createStream({}, ds1, scene, { builders, tier: 'low' });
    frames(stream, 3, 'bay327', shut, { eye: { x: -20, y: 1.6, z: 0 } }, 1);
    expect(numeric(lit(scene).map((l) => l.x + 20))).toEqual([0, 5, 10, 20]);
    frames(stream, 3, 'bay327', shut, { eye: { x: 20, y: 1.6, z: 0 } }, 1);
    expect(numeric(lit(scene).map((l) => l.x + 20))).toEqual([10, 20, 30, 40]);
  });

  it('ranks lamps from the middle of your room when it is not told where the eye is', () => {
    const lamps = [-30, -2, 3, 29, 31].map((x) => ({ x, y: 10, z: 0, color: '#ffffff', intensity: 40, distance: 30 }));
    const { builders } = fakeBuilders({ bay327: lamps });
    const scene = new THREE.Scene();
    const stream = createStream({}, ds1, scene, { builders, tier: 'low' });
    frames(stream, 3, 'bay327', shut, {}, 1);
    expect(numeric(lit(scene).map((l) => l.x))).toEqual([-30, -2, 3, 29]);
  });

  it.each([
    ['ultra', 12],
    ['high', 12],
    ['mid', 8],
    ['low', 4],
  ])('keeps %s’s %i lights in the scene whatever it builds, shows or frees', (tier, cap) => {
    const { builders } = fakeBuilders(Object.fromEntries(Array.from({ length: 7 }, (_, k) => [`c${k}`, [{ x: 4 * k, y: 3, z: 0, color: '#fff', intensity: 4, distance: 6 }]])));
    const layout = run();
    const scene = new THREE.Scene();
    const stream = createStream({}, layout, scene, { builders, tier });
    expect(lightsIn(scene)).toHaveLength(cap);
    for (const here of ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c3', 'c0']) {
      frames(stream, 4, here, () => true, {}, 0.1);
      expect(lightsIn(scene)).toHaveLength(cap);
    }
  });

  it('frees a room more than four doors behind you and takes it out of the scene', () => {
    const { builders } = fakeBuilders();
    const scene = new THREE.Scene();
    const stream = createStream({}, run(), scene, { builders });
    frames(stream, 3, 'c0');
    const c0 = stream.built.get('c0');
    for (const here of ['c1', 'c2', 'c3', 'c4']) frames(stream, 3, here);
    expect(c0.dispose).not.toHaveBeenCalled();
    frames(stream, 1, 'c5');
    expect(c0.dispose).toHaveBeenCalledTimes(1);
    expect(c0.group.parent).toBe(null);
    expect(stream.built.has('c0')).toBe(false);
    expect(stream.built.has('c1')).toBe(true);
  });

  it('builds a freed room again from the layout on the way back, and leaves the game as it was', () => {
    const { log, builders } = fakeBuilders();
    const stream = createStream({}, run(), new THREE.Scene(), { builders });
    const game = { you: { room: 'c0', hp: 40 }, people: [{ id: 'tk421', room: 'c0', hp: 60, target: 'you' }], bolts: [{ x: 1, z: 0, vx: 55 }] };
    const before = structuredClone(game);
    for (const here of ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c5', 'c4', 'c3', 'c2', 'c1', 'c0']) frames(stream, 3, here, shut, game);
    expect(log.filter((id) => id === 'c0')).toHaveLength(2);
    expect(stream.built.get('c0').group.visible).toBe(true);
    expect(game).toEqual(before);
  });

  it('goes on round the last room you were in while you stand in none', () => {
    const { builders } = fakeBuilders();
    const stream = createStream({}, ds1, new THREE.Scene(), { builders });
    frames(stream, 1, 'bay327');
    const bay = stream.built.get('bay327');
    // falling through the field, say: in no room until the walker puts you back
    frames(stream, 3, null);
    expect(bay.dispose).not.toHaveBeenCalled();
    expect(bay.group.visible).toBe(true);
    expect(stream.built.size).toBe(4);
  });

  it('gives a kind with no builder yet a plain box the size of its room', () => {
    const stream = createStream({}, ds1, new THREE.Scene(), { builders: {} });
    frames(stream, 1, 'corr327');
    const box = new THREE.Box3().setFromObject(stream.built.get('corr327').group);
    expect(box.min.toArray().map((v) => +v.toFixed(3) + 0)).toEqual([8.4, 0, -40]);
    expect(box.max.toArray().map((v) => +v.toFixed(3) + 0)).toEqual([11.6, 3.2, -24]);
  });

  it('lights a stand-in box so the room can be seen before its builder comes', () => {
    const scene = new THREE.Scene();
    const stream = createStream({}, ds1, scene, { builders: {} });
    frames(stream, 2, 'corr327', shut, {}, 1);
    const [lamp] = lit(scene);
    expect(lamp.x).toBeCloseTo(10, 6);
    expect(lamp.z).toBeCloseTo(-32, 6);
    expect(lamp.y).toBeGreaterThan(0);
    expect(lamp.y).toBeLessThan(3.2);
  });

  it('leaves the field across a bay’s mouth for the bay to draw', () => {
    const stream = createStream({}, ds1, new THREE.Scene(), { builders: {} });
    frames(stream, 1, 'field327');
    expect(meshesIn(stream.built.get('field327').group)).toEqual([]);
    expect(stream.built.get('field327').lamps).toEqual([]);
  });

  it('stands a box in for a room whose builder fails, and says why', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = () => {
      throw new Error('no plating');
    };
    const stream = createStream({}, ds1, new THREE.Scene(), { builders: { corridor: broken } });
    frames(stream, 1, 'corr327');
    expect(meshesIn(stream.built.get('corr327').group)).toHaveLength(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0].join(' '))).toContain('corr327');
    error.mockRestore();
  });

  it('waits for builders still on their way before it builds anything', async () => {
    const { log, builders } = fakeBuilders();
    let arrive;
    const coming = new Promise((resolve) => (arrive = resolve));
    const stream = createStream({}, ds1, new THREE.Scene(), { builders: coming });
    frames(stream, 3, 'bay327');
    expect(log).toEqual([]);
    arrive(builders);
    await stream.ready;
    frames(stream, 1, 'bay327');
    expect(log).toEqual(['bay327']);
  });

  it('frees every room and takes its lights out of the scene when disposed', () => {
    const { builders } = fakeBuilders();
    const scene = new THREE.Scene();
    const stream = createStream({}, ds1, scene, { builders });
    frames(stream, 6, 'bay327');
    const rooms = [...stream.built.values()];
    expect(rooms).toHaveLength(6);
    expect(lightsIn(scene)).toHaveLength(12);
    stream.dispose();
    for (const r of rooms) expect(r.dispose).toHaveBeenCalledTimes(1);
    expect(scene.children).toEqual([]);
    expect(stream.built.size).toBe(0);
  });
});
