import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CAM, DIVE, FIRST_DIVE, SUN } from './module';
import earth from './module';
import { WORLD_MB } from '../worlds/worlds';
import { ALT, HOME_V, bearingOf, newFlight } from './rules';

// the drawing, stood in for (its API as scene.js's createEarth returns it)
const api = { ready: Promise.resolve(), warm: vi.fn(() => Promise.resolve()), render: vi.fn(), resize: vi.fn(), screenOf: vi.fn(() => ({ x: 0, y: 0, on: false })), pick: vi.fn(() => null), snap: vi.fn(), dispose: vi.fn() };
vi.mock('./scene', () => ({ createEarth: vi.fn(() => api) }));
vi.mock('./sounds', () => ({ setBus: vi.fn(), rush: vi.fn(), roll: vi.fn(), chime: vi.fn(), stamp: vi.fn(), engine: vi.fn(() => ({ set: vi.fn(), stop: vi.fn() })) }));
vi.mock('../travel/globe3d/data', () => ({ globeData: () => ({ xyz: new Float32Array(3), owner: [0], count: 1 }), countryName: () => 'Nowhere' }));

const store = () => {
  const m = new Map();
  return { get: (k, fb = null) => (m.has(k) ? m.get(k) : fb), set: (k, v) => m.set(k, v), map: m };
};
const fakeRt = () => {
  const emitted = [];
  const saves = store();
  return {
    saves,
    emitted,
    events: { emit: (type, data) => emitted.push({ type, ...data }) },
    audio: { bus: () => null, context: vi.fn() },
    input: { bind: vi.fn() },
    gfx: { renderer: {}, lost: false },
  };
};
const snapshot = ({ keys = [], pressed = [], pad = null, tapped = {}, stick = { x: 0, y: 0 }, pointer = { x: 0, y: 0, down: false, drag: null } } = {}) => {
  const held = new Set(keys);
  const action = (name) => ({ left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], boost: ['ShiftLeft'] })[name]?.some((c) => held.has(c)) ?? false;
  return { keys: held, pressed: new Set(pressed), pad, tapped, stick, pointer, action, axis: (name) => (name === 'turn' ? (action('right') ? 1 : 0) - (action('left') ? 1 : 0) : name === 'climb' ? (action('up') ? 1 : 0) - (action('down') ? 1 : 0) : 0) };
};
const run = (world, seconds, input = snapshot(), dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) {
    world.step(dt, input, t * 1000);
    world.draw({ dt, now: t * 1000, renderer: {} });
  }
};

describe('earth module', () => {
  beforeEach(() => {
    api.render.mockClear();
    api.dispose.mockClear();
  });

  it('is a nodes module that makes a whole world', async () => {
    expect(earth).toMatchObject({ id: 'earth', shading: 'nodes', mb: WORLD_MB['/earth'] });
    const rt = fakeRt();
    const world = await earth.create(rt, {});
    await world.ready;
    expect(api.warm).toHaveBeenCalled();
    expect(rt.input.bind).toHaveBeenCalled();
    expect(world.sim.mode).toBe('orbit');
    world.resize(640, 360);
    expect(api.resize).toHaveBeenCalledWith(640, 360);
    world.dispose();
    expect(api.dispose).toHaveBeenCalled();
  });

  it('tunes behind ?debug: the exposure, the sun and the camera, read and written live', async () => {
    const rt = fakeRt();
    rt.gfx.renderer.toneMappingExposure = 1.05;
    const world = await earth.create(rt, {});
    const groups = world.tune();
    expect(groups.map((g) => g.name)).toEqual(['earth', 'flight', 'look']);
    const item = (k) => groups[0].items.find((i) => i.key === k);
    expect(item('exposure').get()).toBe(1.05);
    item('exposure').set(1.4);
    expect(rt.gfx.renderer.toneMappingExposure).toBe(1.4);
    expect(item('sun')).toMatchObject({ type: 'select', options: ['day', 'real'] });
    expect(item('sun').get()).toBe('day');
    item('sun').set('real');
    expect(rt.saves.get(SUN)).toBe('real');
    item('sun').set('real'); // (the same choice again changes nothing)
    expect(item('sun').get()).toBe('real');
    expect(item('cockpit')).toMatchObject({ type: 'bool' });
    expect(item('cockpit').get()).toBe(false);
    item('cockpit').set(true);
    expect(rt.saves.get(CAM)).toBe('cockpit');
    expect(item('cockpit').get()).toBe(true);
    world.dispose();
  });

  it('puts the flight’s own numbers on the panel, read and written live', async () => {
    const world = await earth.create(fakeRt(), {});
    const cruise = world.tune()[1].items.find((i) => i.key === 'cruise');
    const was = cruise.get();
    expect(was).toBeGreaterThan(0);
    cruise.set(was * 2);
    expect(cruise.get()).toBe(was * 2);
    cruise.set(was);
    world.dispose();
  });

  it('dives on its own after a moment over the globe, unless touched', async () => {
    const rt = fakeRt();
    const world = await earth.create(rt, {});
    run(world, FIRST_DIVE - 0.5);
    expect(world.sim.mode).toBe('orbit');
    run(world, 0.6);
    expect(world.sim.mode).toBe('dive');
    expect(rt.emitted.some((e) => e.type === 'mode' && e.mode === 'dive')).toBe(true);
    run(world, DIVE + 0.1);
    expect(world.sim.mode).toBe('fly');
    const other = await earth.create(fakeRt(), {});
    other.touched();
    run(other, FIRST_DIVE + 1);
    expect(other.sim.mode).toBe('orbit');
  });

  it('flies on the throttle, and the log adds up', async () => {
    const rt = fakeRt();
    const world = await earth.create(rt, {});
    world.dive();
    run(world, DIVE + 0.1);
    const km0 = world.sim.f.km;
    run(world, 5, snapshot({ keys: ['KeyW', 'ShiftLeft'] }));
    expect(world.sim.f.km).toBeGreaterThan(km0 + 20);
    expect(api.render).toHaveBeenCalled();
    const hud = rt.emitted.filter((e) => e.type === 'hud');
    expect(hud.length).toBeGreaterThan(0);
    expect(hud.at(-1).km).toBeGreaterThan(0);
    world.dispose();
    expect(rt.saves.get('tp-earth-flown')).toBeGreaterThan(0);
  });

  it('M in flight goes back to orbit; N and V toggle and are kept', async () => {
    const rt = fakeRt();
    const world = await earth.create(rt, {});
    world.dive();
    run(world, DIVE + 0.1);
    world.step(1 / 60, snapshot({ pressed: ['KeyM'] }), 0);
    expect(world.sim.mode).toBe('rise');
    world.step(1 / 60, snapshot({ pressed: ['KeyN', 'KeyV'] }), 0);
    expect(rt.saves.get(SUN)).toBe('real');
    expect(rt.saves.get(CAM)).toBe('cockpit');
    expect(rt.emitted.filter((e) => e.type === 'sun' || e.type === 'cam').length).toBe(2);
    world.step(1 / 60, snapshot({ pressed: ['KeyP'] }), 0);
    expect(rt.emitted.at(-1).type).toBe('passport');
  });

  it('a pad flies it too, and its buttons act once', async () => {
    const rt = fakeRt();
    const world = await earth.create(rt, {});
    world.dive();
    run(world, DIVE + 0.1);
    const km0 = world.sim.f.km;
    run(world, 3, snapshot({ pad: { lx: 0, ly: -1, rx: 0, ry: 0, a: true }, tapped: {} }));
    expect(world.sim.f.km).toBeGreaterThan(km0);
    world.step(1 / 60, snapshot({ pad: { lx: 0, ly: 0, rx: 0, ry: 0 }, tapped: { start: true } }), 0);
    expect(world.sim.mode).toBe('rise');
  });

  it('a click in orbit on a place flies there; a drag turns the globe', async () => {
    const rt = fakeRt();
    const world = await earth.create(rt, {});
    world.resize(200, 100);
    api.pick.mockReturnValueOnce('paris');
    const before = [...world.sim.orbit];
    world.step(1 / 60, snapshot({ pointer: { x: 100, y: 50, down: true, drag: null } }), 0);
    world.step(1 / 60, snapshot({ pointer: { x: 100, y: 50, down: false, drag: null } }), 16);
    expect(api.pick).toHaveBeenCalledWith(0, 0);
    expect(world.sim.target).toBe('paris');
    expect(world.sim.mode).toBe('dive');
    const other = await earth.create(fakeRt(), {});
    other.step(1 / 60, snapshot({ pointer: { x: 10, y: 10, down: true, drag: null } }), 0);
    other.step(1 / 60, snapshot({ pointer: { x: 50, y: 10, down: true, drag: { dx: 40, dy: 0 } } }), 16);
    expect(other.sim.orbit).not.toEqual(before);
    other.step(1 / 60, snapshot({ pointer: { x: 50, y: 10, down: false, drag: null } }), 32);
    expect(other.sim.mode).toBe('orbit'); // a drag isn't a click
    expect(other.sim.touched).toBe(true);
  });

  it('pauses for a dialog: nothing flies, the engines stop', async () => {
    const rt = fakeRt();
    const world = await earth.create(rt, {});
    world.dive();
    run(world, DIVE + 0.1);
    world.setPaused(true);
    const km0 = world.sim.f.km;
    run(world, 2, snapshot({ keys: ['KeyW'] }));
    expect(world.sim.f.km).toBe(km0);
    expect(world.sim.engine).toBe(null);
  });

  it('in development, a named view puts the world somewhere fixed and holds it still (the parity check’s)', async () => {
    const rt = fakeRt();
    const world = await earth.create(rt, {});
    run(world, 1);
    world.view('orbit');
    expect(world.sim).toMatchObject({ mode: 'orbit', view: 0, paused: true, touched: true });
    expect(world.sim.f.p).toEqual(newFlight().p);
    run(world, 0.5);
    expect(world.sim.mode).toBe('orbit'); // (no dive of its own)
    const at = api.render.mock.calls.at(-1)[0];
    run(world, 0.2);
    expect(api.render.mock.calls.at(-1)[0].t).toBe(at.t); // (the clouds' drift held too)
    expect(at.t).toBeTypeOf('number');

    world.view('low');
    expect(world.sim).toMatchObject({ mode: 'fly', view: 1, paused: true });
    expect(world.sim.f.alt).toBe(ALT.min);
    expect(world.sim.f.p).toEqual(HOME_V);
    expect(Math.round(bearingOf(world.sim.f.p, world.sim.f.h))).toBe(90);
    expect(api.snap).toHaveBeenCalled(); // (the chase camera straight to its place, not eased there)
    const p = [...world.sim.f.p];
    run(world, 0.5);
    expect(world.sim.f.p).toEqual(p);
    expect(() => world.view('nowhere')).toThrow(/view/);
  });
});
