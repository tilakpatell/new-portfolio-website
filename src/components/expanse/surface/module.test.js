import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import expanse, { KEYS, RADIUS } from './module';
import { landJob } from './job';
import { WORLD_MB } from '../../worlds/worlds';
import { validateModule, validateWorld } from '../../../runtime/module';
import { createOrigin } from '../../../runtime/origin';
import { CAR } from '../../../lib/physics/vehicle';

const flush = () => new Promise((r) => setTimeout(r, 0));

const fakeRenderer = () => ({
  toneMapping: THREE.NoToneMapping,
  toneMappingExposure: 1,
  shadowMap: { enabled: false, type: THREE.PCFShadowMap },
  render: vi.fn(),
  setRenderTarget: vi.fn(),
  getRenderTarget: () => null,
  getClearColor: (c) => c,
  getClearAlpha: () => 1,
  setClearColor: () => {},
  clear: () => {},
  getDrawingBufferSize: (v) => v.set(640, 360),
});
const fakeRt = ({ tier = 'mid' } = {}) => {
  const emitted = [];
  const defined = [];
  return {
    emitted,
    defined,
    gfx: { renderer: fakeRenderer() },
    quality: { tier },
    input: { bind: vi.fn() },
    events: { emit: (type, data) => emitted.push({ type, ...data }) },
    origin: createOrigin(),
    workers: {
      define: (name, make) => defined.push([name, make]),
      request: (name, msg) => Promise.resolve(landJob(msg)?.reply ?? null),
      cancel: () => {},
    },
  };
};
const snap = ({ keys = [], pressed = [], stick = { x: 0, y: 0 } } = {}) => {
  const held = new Set(keys);
  return { keys: held, pressed: new Set(pressed), pad: null, stick, action: (name) => (KEYS[name] ?? []).some((c) => held.has(c)) };
};
async function run(world, seconds, input = snap()) {
  for (let t = 0; t < seconds; t += 1 / 60) {
    world.step(1 / 60, input, t * 1000);
    world.draw({});
    await flush();
  }
}

describe('the Expanse surface module', () => {
  it('is a whole glsl module of the size the gate says', () => {
    const m = validateModule(expanse);
    expect(m).toMatchObject({ id: 'expanse-surface', shading: 'glsl' });
    expect(m.mb).toBe(WORLD_MB['/universe/expanse']);
    expect(RADIUS).toEqual({ ultra: 7, high: 6, mid: 4, low: 3 });
  });

  it('streams the land round the car, stands it on four wheels and drives it', async () => {
    const rt = fakeRt();
    const world = validateWorld(await expanse.create(rt, { seed: 7, type: 'temperate' }));
    await world.ready;
    expect(rt.defined.map((d) => d[0])).toEqual(['land']);
    expect(rt.input.bind).toHaveBeenCalledWith(KEYS);
    // (in the visitor's worlds, as a planet)
    const row = await world.registered;
    expect(row).toMatchObject({ id: 'planet:7', kind: 'planet', seed: '7' });
    world.resize(640, 360);
    await run(world, 3);
    const stats = world.stream.stats();
    expect(stats.built).toBeGreaterThan(9);
    expect(stats.solid).toBe(9);
    // standing, on its four wheels
    expect(world.vehicle.state.wheels.every((w) => w.contact)).toBe(true);
    expect(world.vehicle.state.speed).toBeLessThan(0.3);
    const before = world.anchor();
    await run(world, 2, snap({ keys: ['KeyW'] }));
    const after = world.anchor();
    expect(Math.hypot(after[0] - before[0], after[2] - before[2])).toBeGreaterThan(3);
    // the HUD hears of it
    const hud = rt.emitted.filter((e) => e.type === 'hud').at(-1);
    expect(hud.speed).toBeGreaterThan(5);
    expect(hud.seed).toBe('7');
    expect(rt.gfx.renderer.render).toHaveBeenCalled();
    world.dispose();
    expect(world.scene.cells()).toBe(0);
  }, 30000);

  it('moves everything by a floating-origin shift, and nothing jumps', async () => {
    const rt = fakeRt({ tier: 'low' });
    const world = await expanse.create(rt, { seed: 7 });
    await run(world, 1);
    const at = world.anchor();
    const local = world.vehicle.chassis.position();
    // (the origin moves when the car strays a cell of 50 km from it: here, by hand)
    rt.origin.check([at[0] + 60000, 0, at[2]]);
    expect(rt.origin.at[0]).toBe(50000);
    expect(world.vehicle.chassis.position()[0]).toBeCloseTo(local[0] - 50000, 1);
    expect(world.scene.land.position.x).toBe(-50000);
    const after = world.anchor();
    expect(after[0]).toBeCloseTo(at[0], 1);
    await run(world, 0.5);
    expect(world.vehicle.state.wheels.some((w) => w.contact)).toBe(true);
    world.dispose();
  }, 30000);

  it('brings the car back on R', async () => {
    const rt = fakeRt({ tier: 'low' });
    const world = await expanse.create(rt, { seed: 7 });
    await run(world, 1);
    world.step(1 / 60, snap({ pressed: ['KeyR'] }), 0);
    expect(rt.emitted.some((e) => e.type === 'respawn')).toBe(true);
    world.dispose();
  }, 30000);

  it('draws the buggy in two halves: it squashes landing, leans back pulling away, and whips its antenna', async () => {
    const rt = fakeRt({ tier: 'low' });
    const world = await expanse.create(rt, { seed: 7 });
    const seen = [];
    const step = world.feel.step;
    world.feel.step = (input, dt) => {
      const out = step(input, dt);
      seen.push({ ...out, antenna: [...out.antenna], landed: input.landed });
      return out;
    };
    // (it spawns a little above the hill and drops onto it)
    await run(world, 3);
    expect(Math.max(...seen.map((o) => o.squash))).toBeGreaterThan(0.02);
    const settled = seen.at(-1);
    expect(Math.abs(settled.squash)).toBeLessThan(0.02);
    seen.length = 0;
    await run(world, 1, snap({ keys: ['KeyW'] }));
    expect(Math.min(...seen.map((o) => o.pitch))).toBeLessThan(-0.005);
    expect(Math.max(...seen.map((o) => Math.abs(o.antenna[0])))).toBeGreaterThan(0.05);
    // the chassis's numbers stay the car's own
    expect(world.vehicle.spec).not.toBe(CAR);
    world.dispose();
  }, 30000);

  it('lowers its quality step by step', async () => {
    const rt = fakeRt({ tier: 'high' });
    const world = await expanse.create(rt, { seed: 7 });
    expect(world.scene.water.blur).toBe(true);
    world.lowerQuality(1);
    expect(world.scene.water.uniforms.uBlur.value).toBe(0);
    world.lowerQuality(2);
    expect(world.scene.sun.castShadow).toBe(false);
    world.dispose();
    // the renderer as it was
    expect(rt.gfx.renderer.toneMapping).toBe(THREE.NoToneMapping);
  }, 30000);
});
