import { describe, expect, it, vi } from 'vitest';
import { createRuntime } from './runtime';

// stand-ins: a backend, a loop the test ticks, a host box, and a world
const fakeBackend = () => ({
  backend: 'webgl',
  renderer: { r: true },
  canvas: { remove: vi.fn(), parentNode: null },
  size: { w: 1, h: 1 },
  ratio: 2,
  setSize: vi.fn(),
  setRatio: vi.fn(),
  snapshot: vi.fn(() => ({ set: vi.fn(), remove: vi.fn() })),
  lost: false,
  dispose: vi.fn(),
});
const fakeLoop = () => {
  let fn = null;
  let can = () => true;
  return {
    create: (step, opts) => {
      fn = step;
      can = opts?.can ?? can;
      return { kick: vi.fn(), stop: vi.fn() };
    },
    tick: (now) => (can() ? fn(now) : false),
  };
};
const fakeHost = () => ({ prepend: vi.fn(), getBoundingClientRect: () => ({ width: 640, height: 360 }), appendChild: vi.fn() });
const fakeWorld = (extra = {}) => ({ resize: vi.fn(), draw: vi.fn(), dispose: vi.fn(), ...extra });
const fakeInput = () => ({ attach: vi.fn(), detach: vi.fn(), unbind: vi.fn(), sample: vi.fn(() => ({ keys: new Set() })) });
const fakeQuality = () => ({ frame: vi.fn(() => null), ratio: 2, budget: { ratio: 2 }, level: 0, on: () => () => {} });
const fakeAudio = () => ({ fadeOut: vi.fn() });
const fakeAssets = () => ({ owner: vi.fn(), drop: vi.fn() });

function make(overrides = {}) {
  const loop = fakeLoop();
  const makeBackend = vi.fn(() => fakeBackend());
  const input = fakeInput();
  const quality = fakeQuality();
  const audio = fakeAudio();
  const assets = fakeAssets();
  const rt = createRuntime({ makeBackend, loop: loop.create, input, quality, audio, assets, gpu: false, ...overrides });
  return { rt, loop, makeBackend, input, quality, audio, assets };
}
const flush = async (n = 6) => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

describe('createRuntime', () => {
  it('mounts: loading, ready after create, on after the first frame, in frame order', async () => {
    const { rt, loop, makeBackend, input } = make();
    const order = [];
    const world = fakeWorld({ step: vi.fn(() => order.push('step')), draw: vi.fn(() => order.push('draw')), wants: () => true });
    const mod = { id: 'a', create: vi.fn(() => world) };
    const host = fakeHost();
    const statuses = [];
    rt.on((s) => statuses.push(s));
    const p = rt.mount(mod, { x: 1 }, host);
    expect(rt.status).toBe('loading');
    await p;
    expect(rt.status).toBe('ready');
    expect(makeBackend).toHaveBeenCalledWith('webgl', expect.anything());
    expect(host.prepend).toHaveBeenCalledWith(rt.gfx.canvas);
    expect(world.resize).toHaveBeenCalledWith(640, 360);
    expect(mod.create.mock.calls[0][1]).toEqual({ x: 1 });
    expect(input.attach).toHaveBeenCalled();
    expect(loop.tick(16)).toBe(true);
    expect(rt.status).toBe('on');
    expect(order).toEqual(['step', 'draw']);
    expect(world.draw.mock.calls[0][0]).toMatchObject({ dt: 0.016, now: 16, renderer: rt.gfx.renderer });
    expect(statuses).toEqual(['loading', 'ready', 'on']);
    expect(rt.current.module.id).toBe('a');
  });

  it('a mount during loading wins: the first world is disposed, never drawn', async () => {
    const { rt, loop } = make();
    const first = fakeWorld();
    const second = fakeWorld({ wants: () => true });
    let release;
    const slow = { id: 'slow', create: () => new Promise((r) => (release = r)) };
    const quick = { id: 'quick', create: () => second };
    const p1 = rt.mount(slow, {}, fakeHost());
    await flush(); // slow's create has begun
    const p2 = rt.mount(quick, {}, fakeHost());
    await p2;
    release(first);
    await p1;
    await flush();
    expect(first.dispose).toHaveBeenCalled();
    loop.tick(16);
    expect(first.draw).not.toHaveBeenCalled();
    expect(second.draw).toHaveBeenCalled();
    expect(rt.current.module.id).toBe('quick');
  });

  it('a frame that throws fails the world', async () => {
    const { rt, loop } = make();
    const world = fakeWorld({ draw: () => { throw new Error('boom'); } });
    await rt.mount({ id: 'a', create: () => world }, {}, fakeHost());
    expect(loop.tick(16)).toBe(false);
    expect(rt.status).toBe('failed');
    expect(world.dispose).toHaveBeenCalled();
    expect(rt.current).toBe(null);
  });

  it('a world at rest asks for no more frames until kicked', async () => {
    const { rt, loop } = make();
    let want = false;
    const world = fakeWorld({ wants: () => want });
    await rt.mount({ id: 'a', create: () => world }, {}, fakeHost());
    expect(loop.tick(16)).toBe(false);
    want = true;
    expect(loop.tick(32)).toBe(true);
    expect(world.draw.mock.calls[1][0].dt).toBeCloseTo(0.016);
  });

  it('dt is clamped to 50 ms', async () => {
    const { rt, loop } = make();
    const world = fakeWorld({ wants: () => true });
    await rt.mount({ id: 'a', create: () => world }, {}, fakeHost());
    loop.tick(16);
    loop.tick(5000);
    expect(world.draw.mock.calls[1][0].dt).toBe(0.05);
  });

  it('the first frame waits for ready, then the world is told its props again', async () => {
    const { rt } = make();
    let ready;
    const world = fakeWorld({ ready: new Promise((r) => (ready = r)), update: vi.fn() });
    const p = rt.mount({ id: 'a', create: () => world }, { n: 1 }, fakeHost());
    await flush();
    expect(rt.status).toBe('loading');
    ready();
    await p;
    expect(rt.status).toBe('ready');
    expect(world.update).toHaveBeenCalledWith({ n: 1 });
  });

  it('handover keeps the old world drawing until the new one is ready, then fades it out', async () => {
    const { rt, loop, audio, assets } = make();
    const old = fakeWorld({ wants: () => true, handoff: () => ({ pose: 7 }) });
    await rt.mount({ id: 'old', create: () => old }, {}, fakeHost());
    loop.tick(0);
    let readyNew;
    const next = fakeWorld({ wants: () => true, ready: new Promise((r) => (readyNew = r)) });
    const nextMod = { id: 'next', create: vi.fn(() => next) };
    const host2 = fakeHost();
    const p = rt.handover(nextMod, { a: 1 }, host2, { fade: 600 });
    await flush();
    expect(nextMod.create.mock.calls[0][1]).toEqual({ a: 1, from: { pose: 7 } });
    loop.tick(100);
    expect(old.draw).toHaveBeenCalledTimes(2); // still the old world
    expect(next.draw).not.toHaveBeenCalled();
    const snap = rt.gfx.snapshot.mock.results[0].value; // its frame, kept as the cover
    readyNew();
    await p;
    expect(old.dispose).toHaveBeenCalled();
    expect(audio.fadeOut).toHaveBeenCalled();
    expect(assets.drop).toHaveBeenCalledWith('old');
    expect(host2.prepend).toHaveBeenCalledWith(rt.gfx.canvas);
    expect(rt.current.module.id).toBe('next');
    loop.tick(200);
    expect(next.draw).toHaveBeenCalledTimes(1);
    expect(snap.set).toHaveBeenLastCalledWith(1);
    loop.tick(500);
    expect(snap.set).toHaveBeenLastCalledWith(0.5);
    loop.tick(900);
    expect(snap.remove).toHaveBeenCalled();
    expect(rt.status).toBe('on');
  });

  it('a handoff that throws still hands over with from null', async () => {
    const { rt } = make();
    const old = fakeWorld({ handoff: () => { throw new Error('no'); } });
    await rt.mount({ id: 'old', create: () => old }, {}, fakeHost());
    const create = vi.fn(() => fakeWorld());
    await rt.handover({ id: 'next', create }, { b: 2 }, fakeHost());
    expect(create.mock.calls[0][1]).toEqual({ b: 2, from: null });
    expect(old.dispose).toHaveBeenCalled();
  });

  it('a handover with nothing mounted is a mount', async () => {
    const { rt } = make();
    const create = vi.fn(() => fakeWorld());
    await rt.handover({ id: 'next', create }, {}, fakeHost());
    expect(create.mock.calls[0][1]).toEqual({ from: null });
    expect(rt.status).toBe('ready');
  });

  it('unmount disposes, clears input and fades audio, keeps the canvas', async () => {
    const { rt, input, audio, assets } = make();
    const world = fakeWorld();
    await rt.mount({ id: 'a', create: () => world }, {}, fakeHost());
    rt.unmount();
    expect(world.dispose).toHaveBeenCalled();
    expect(input.detach).toHaveBeenCalled();
    expect(input.unbind).toHaveBeenCalled();
    expect(audio.fadeOut).toHaveBeenCalled();
    expect(assets.drop).toHaveBeenCalledWith('a');
    expect(rt.gfx.dispose).not.toHaveBeenCalled();
    expect(rt.status).toBe('idle');
    expect(rt.current).toBe(null);
  });

  it('a lost context sets lost, and a later mount makes a new backend', async () => {
    const { rt, makeBackend } = make();
    const world = fakeWorld();
    await rt.mount({ id: 'a', create: () => world }, {}, fakeHost());
    const first = rt.gfx;
    makeBackend.mock.calls[0][1].onLost();
    expect(rt.status).toBe('lost');
    expect(world.dispose).toHaveBeenCalled();
    expect(first.dispose).toHaveBeenCalled();
    await rt.mount({ id: 'a', create: () => fakeWorld() }, {}, fakeHost());
    expect(makeBackend).toHaveBeenCalledTimes(2);
    expect(rt.status).toBe('ready');
  });

  it('a webgpu loss comes back on webgl', async () => {
    const { rt, makeBackend } = make({ gpu: true });
    await rt.mount({ id: 'n', shading: 'nodes', create: () => fakeWorld() }, {}, fakeHost());
    expect(makeBackend.mock.calls[0][0]).toBe('webgpu');
    makeBackend.mock.calls[0][1].onLost();
    await rt.mount({ id: 'n', shading: 'nodes', create: () => fakeWorld() }, {}, fakeHost());
    expect(makeBackend.mock.calls[1][0]).toBe('webgl');
  });

  it('a create that throws fails the mount', async () => {
    const { rt } = make();
    await rt.mount({ id: 'a', create: () => { throw new Error('nope'); } }, {}, fakeHost());
    expect(rt.status).toBe('failed');
    expect(rt.current).toBe(null);
  });

  it('a new quality level sets the ratio and tells the world', async () => {
    const quality = fakeQuality();
    quality.frame = vi.fn(() => 2);
    quality.ratio = 1.44;
    const { rt, loop } = make({ quality });
    const world = fakeWorld({ wants: () => true, lowerQuality: vi.fn() });
    await rt.mount({ id: 'a', create: () => world }, {}, fakeHost());
    loop.tick(16);
    expect(rt.gfx.setRatio).toHaveBeenCalledWith(1.44);
    expect(world.lowerQuality).toHaveBeenCalledWith(2);
  });

  it('events reach the page and leave with the world', async () => {
    const { rt } = make();
    const fn = vi.fn();
    const off = rt.events.on('hud', fn);
    rt.events.emit('hud', { km: 1 });
    expect(fn).toHaveBeenCalledWith({ km: 1 });
    off();
    rt.events.emit('hud', { km: 2 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
