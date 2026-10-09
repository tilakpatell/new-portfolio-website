import { describe, expect, it } from 'vitest';
import flight, { AXES, KEYS, inputOf, spawnOf, tierAt } from './module';
import { WORLD_MB } from '../../worlds/worlds';
import { planetSpecOf } from '../../../lib/land/flight/planetSpec';
import { createOrigin } from '../../../runtime/origin';
import { createEvents } from '../../../runtime/runtime';

function fakeRt() {
  const renderer = { toneMapping: 0, toneMappingExposure: 1, shadowMap: { enabled: true }, drawn: 0, render() {
    this.drawn++;
  } };
  const bound = { keys: null };
  const asked = [];
  return {
    renderer,
    bound,
    asked,
    gfx: { renderer },
    quality: { tier: 'mid' },
    input: { bind: (k, o) => Object.assign(bound, { keys: k, axes: o.axes }), unbind: () => (bound.keys = null), setStick() {} },
    workers: { define() {}, request: (name, msg) => (asked.push(msg), new Promise(() => {})), cancel() {}, close() {} },
    origin: createOrigin(),
    events: createEvents(),
  };
}
const snap = (axes = {}) => ({ axis: (n) => axes[n] ?? 0, stick: { x: 0, y: 0 } });

describe('the flight module', () => {
  it('is whole: glsl, its download as WORLD_MB says', () => {
    expect(flight).toMatchObject({ id: 'flight', shading: 'glsl', mb: WORLD_MB['/fly'] });
    expect(WORLD_MB['/fly']).toBe(1);
  });

  it('binds its keys, and flies the ship from them', async () => {
    const rt = fakeRt();
    const world = await flight.create(rt, { spec: planetSpecOf('hoth') });
    expect(rt.bound.keys).toEqual(KEYS);
    expect(rt.bound.axes).toEqual(AXES);
    const z0 = world.ship.z;
    for (let i = 0; i < 30; i++) world.step(1 / 30, snap({ throttle: 1 }));
    expect(world.ship.z).toBeLessThan(z0 - 100);
    expect(world.ship.speed).toBeGreaterThan(200);
    world.draw({});
    expect(rt.renderer.drawn).toBe(1);
    // the ground was asked for, coarse first
    expect(rt.asked.length).toBe(6);
    expect(rt.asked[0].leaf.d).toBe(0);
    world.dispose();
  });

  it('starts south of Echo Base, heading for it, well over the ground', () => {
    const s = spawnOf(planetSpecOf('hoth'), () => 12);
    expect(s).toMatchObject({ x: 1200, z: -800 + 3400, yaw: 0, y: 312 });
  });

  it('reads the stick into the axes', () => {
    expect(inputOf({ axis: (n) => (n === 'pitch' ? -1 : 0), stick: { x: 0.5, y: -0.5 } })).toEqual({ pitch: -1, roll: 0.5, yaw: 0, throttle: 0 });
  });

  it('sheds a tier as the pace steps down', () => {
    expect(tierAt('high', 0)).toBe('high');
    expect(tierAt('high', 2)).toBe('mid');
    expect(tierAt('high', 4)).toBe('low');
    expect(tierAt('low', 4)).toBe('low');
  });

  it('puts the renderer back as it found it', async () => {
    const rt = fakeRt();
    const world = await flight.create(rt, { spec: planetSpecOf('tatooine') });
    world.dispose();
    expect(rt.renderer).toMatchObject({ toneMapping: 0, toneMappingExposure: 1, shadowMap: { enabled: true } });
    expect(rt.bound.keys).toBeNull();
  });

  it('follows the origin when the ship goes far', async () => {
    const rt = fakeRt();
    const world = await flight.create(rt, { spec: planetSpecOf('hoth') });
    world.ship = { x: 120000 };
    rt.origin.check(world.anchor());
    expect(rt.origin.at[0]).toBe(100000);
    world.step(1 / 60, snap());
    world.dispose();
  });
});
