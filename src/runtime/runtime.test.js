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
const settled = () => new Promise((r) => setTimeout(r, 0)); // (every microtask run: a build that's done has asked for its cover)

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
    expect(rt.current.module).toBe(mod); // the very object the page mounted, so useWorld can tell its own
  });

  it('a module with a label makes the canvas a picture', async () => {
    const { rt } = make();
    const canvas = { remove: vi.fn(), parentNode: null, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } };
    const gfx = fakeBackend();
    gfx.canvas = canvas;
    const { rt: rt2 } = make({ makeBackend: () => gfx });
    await rt2.mount({ id: 'a', label: 'The Earth in 3D', create: () => fakeWorld() }, {}, fakeHost());
    expect(canvas.attrs).toEqual({ role: 'img', 'aria-label': 'The Earth in 3D' });
    await rt2.mount({ id: 'b', create: () => fakeWorld() }, {}, fakeHost());
    expect(canvas.attrs).toEqual({});
    expect(rt.status).toBe('idle');
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

  it('two mounts while the backend is made share it: one context, and the one kept is the one given the ratio', async () => {
    const quality = fakeQuality();
    quality.ratioUnder = vi.fn((cap) => Math.min(cap ?? Infinity, 2));
    const made = [];
    const makeBackend = vi.fn(() => {
      let resolve;
      const p = new Promise((r) => (resolve = r));
      made.push({ gfx: fakeBackend(), resolve });
      return p;
    });
    const { rt, loop } = make({ quality, makeBackend });
    const mod = { id: 'galaxy', ratio: 1.5, create: () => fakeWorld({ wants: () => true }) };
    // (React's second run of an effect in development mounts the same module again at once)
    const p1 = rt.mount(mod, {}, fakeHost());
    const p2 = rt.mount(mod, {}, fakeHost());
    await flush();
    expect(makeBackend).toHaveBeenCalledTimes(1);
    made[0].resolve(made[0].gfx);
    expect(await p1).toBe(false);
    expect(await p2).toBe(true);
    expect(rt.gfx).toBe(made[0].gfx);
    expect(made[0].gfx.setRatio).toHaveBeenCalledWith(1.5);
    expect(made[0].gfx.dispose).not.toHaveBeenCalled();
    loop.tick(16);
    expect(rt.status).toBe('on');
  });

  it('a backend of another kind asked for meanwhile wins, whichever arrives first, and the other goes', async () => {
    const made = {};
    const makeBackend = vi.fn((kind) => {
      let resolve;
      const p = new Promise((r) => (resolve = r));
      made[kind] = { gfx: { ...fakeBackend(), backend: kind }, resolve };
      return p;
    });
    const { rt } = make({ makeBackend, gpu: true });
    const p1 = rt.mount({ id: 'old', create: () => fakeWorld() }, {}, fakeHost());
    const p2 = rt.mount({ id: 'new', shading: 'nodes', create: () => fakeWorld() }, {}, fakeHost());
    await flush();
    expect(makeBackend.mock.calls.map((c) => c[0])).toEqual(['webgl', 'webgpu']);
    made.webgpu.resolve(made.webgpu.gfx);
    expect(await p2).toBe(true);
    made.webgl.resolve(made.webgl.gfx);
    expect(await p1).toBe(false);
    await flush();
    expect(rt.gfx).toBe(made.webgpu.gfx);
    expect(made.webgpu.gfx.setRatio).toHaveBeenCalled();
    expect(made.webgl.gfx.dispose).toHaveBeenCalled(); // (not left holding a context)
    expect(made.webgpu.gfx.dispose).not.toHaveBeenCalled();
  });

  it('a backend that fails to make fails the mount, and the next mount tries again', async () => {
    let fails = true;
    const makeBackend = vi.fn(() => (fails ? Promise.reject(new Error('no context')) : fakeBackend()));
    const { rt } = make({ makeBackend });
    expect(await rt.mount({ id: 'a', create: () => fakeWorld() }, {}, fakeHost())).toBe(false);
    expect(rt.status).toBe('failed');
    fails = false;
    expect(await rt.mount({ id: 'a', create: () => fakeWorld() }, {}, fakeHost())).toBe(true);
    expect(makeBackend).toHaveBeenCalledTimes(2);
  });

  it("the last world's box out of sight doesn't keep the next world from drawing", async () => {
    const { rt, loop } = make();
    await rt.mount({ id: 'a', create: () => fakeWorld() }, {}, fakeHost());
    rt.setVisible(false); // (its box scrolled away)
    rt.unmount();
    const next = fakeWorld({ wants: () => true, setVisible: vi.fn() });
    await rt.mount({ id: 'b', create: () => next }, {}, fakeHost());
    expect(next.setVisible).toHaveBeenLastCalledWith(true);
    expect(loop.tick(16)).toBe(true);
    expect(next.draw).toHaveBeenCalled();
    expect(rt.status).toBe('on');
    // and its own box going out of sight still stops it
    rt.setVisible(false);
    expect(loop.tick(32)).toBe(false);
    expect(next.draw).toHaveBeenCalledTimes(1);
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
    expect(old.draw).toHaveBeenCalledTimes(2); // still the old world, and seen: no cover over it yet
    expect(next.draw).not.toHaveBeenCalled();
    expect(rt.gfx.snapshot).not.toHaveBeenCalled();
    readyNew();
    await settled();
    loop.tick(150); // the old world's last frame, kept as the cover
    expect(old.draw).toHaveBeenCalledTimes(3);
    const snap = rt.gfx.snapshot.mock.results[0].value;
    expect(await p).toBe(true);
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

  it('a handover says whether its world is the one drawing now', async () => {
    const { rt, loop } = make();
    await rt.mount({ id: 'old', create: () => fakeWorld() }, {}, fakeHost());
    // something newer asked for while it was made: no
    let readyNew;
    const p = rt.handover({ id: 'next', create: () => fakeWorld({ ready: new Promise((r) => (readyNew = r)) }) }, {}, fakeHost());
    await settled();
    rt.unmount();
    readyNew();
    expect(await p).toBe(false);
    expect(rt.current).toBe(null);
    // failed: no, and the old world stays up with nothing over it
    const old = fakeWorld({ wants: () => true });
    expect(await rt.mount({ id: 'old', create: () => old }, {}, fakeHost())).toBe(true);
    expect(await rt.handover({ id: 'bad', create: () => { throw new Error('no'); } }, {}, fakeHost())).toBe(false);
    expect(rt.current.module.id).toBe('old');
    expect(rt.gfx.snapshot).not.toHaveBeenCalled();
    loop.tick(10);
    expect(old.draw).toHaveBeenCalled();
    // over: yes
    expect(await rt.handover({ id: 'next', create: () => fakeWorld() }, {}, fakeHost())).toBe(true);
    expect(rt.current.module.id).toBe('next');
    expect(old.dispose).toHaveBeenCalledTimes(1);
  });

  it('a handover off screen, where no frame comes, goes on without a cover after a moment', async () => {
    let seen = false;
    const { rt, loop } = make({ visible: () => seen });
    await rt.mount({ id: 'old', create: () => fakeWorld() }, {}, fakeHost());
    const next = fakeWorld({ wants: () => false });
    const t0 = Date.now();
    expect(await rt.handover({ id: 'next', create: () => next }, {}, fakeHost())).toBe(true);
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(rt.gfx.snapshot).not.toHaveBeenCalled();
    seen = true;
    expect(loop.tick(10)).toBe(false); // (no cover to fade, a world at rest)
    expect(next.draw).toHaveBeenCalledTimes(1);
  });

  it('a handover with `after` keeps the old world drawing until that is done, then takes the cover', async () => {
    const { rt, loop } = make();
    const old = fakeWorld({ wants: () => true });
    await rt.mount({ id: 'old', create: () => old }, {}, fakeHost());
    loop.tick(0);
    let done;
    const after = new Promise((r) => (done = r));
    const next = fakeWorld({ wants: () => true });
    const p = rt.handover({ id: 'next', create: () => next }, {}, fakeHost(), { fade: 600, after });
    await settled();
    loop.tick(100);
    loop.tick(200);
    expect(old.draw).toHaveBeenCalledTimes(3); // made, and still the old world's moment
    expect(rt.gfx.snapshot).not.toHaveBeenCalled();
    done();
    await settled();
    loop.tick(300); // the cover
    expect(rt.gfx.snapshot).toHaveBeenCalledTimes(1);
    expect(await p).toBe(true);
    loop.tick(400);
    expect(next.draw).toHaveBeenCalledTimes(1);
    expect(old.draw).toHaveBeenCalledTimes(4);
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

  it('a new quality level is set before the frame is drawn, so the resized buffer is never shown cleared', async () => {
    const order = [];
    const quality = fakeQuality();
    let next = null;
    quality.frame = vi.fn(() => {
      const l = next;
      next = null;
      return l;
    });
    const gfx = fakeBackend();
    gfx.setRatio = vi.fn(() => order.push('setRatio'));
    const { rt, loop } = make({ quality, makeBackend: () => gfx });
    const world = fakeWorld({ wants: () => true, lowerQuality: vi.fn(() => order.push('lowerQuality')), draw: vi.fn(() => order.push('draw')) });
    await rt.mount({ id: 'a', create: () => world }, {}, fakeHost());
    loop.tick(16);
    order.length = 0;
    next = 1;
    loop.tick(33);
    expect(order).toEqual(['setRatio', 'lowerQuality', 'draw']);
  });

  it('a frame whose draw throws after a level change still fails the world', async () => {
    const quality = fakeQuality();
    quality.frame = vi.fn(() => 1);
    const { rt, loop } = make({ quality });
    const world = fakeWorld({ lowerQuality: vi.fn(), draw: () => { throw new Error('boom'); } });
    await rt.mount({ id: 'a', create: () => world }, {}, fakeHost());
    expect(loop.tick(16)).toBe(false);
    expect(world.lowerQuality).toHaveBeenCalledWith(1);
    expect(rt.status).toBe('failed');
    expect(world.dispose).toHaveBeenCalled();
  });

  it('each world gives the governor a fresh start: reset and held before its ratio is set, so that ratio is the sharpest', async () => {
    const order = [];
    const quality = fakeQuality();
    let scale = 0.72; // (the last world had it softened)
    quality.ratioUnder = (cap) => Math.min(cap ?? Infinity, 2) * scale;
    quality.reset = vi.fn(() => {
      order.push('reset');
      scale = 1;
    });
    quality.hold = vi.fn((ms) => order.push(`hold ${ms}`));
    const gfx = fakeBackend();
    gfx.setRatio = vi.fn((r) => order.push(`setRatio ${r}`));
    const { rt } = make({ quality, makeBackend: () => gfx });
    await rt.mount({ id: 'galaxy', ratio: 1.5, create: () => fakeWorld() }, {}, fakeHost());
    expect(order).toEqual(['reset', 'hold 3000', 'setRatio 1.5']);
  });

  it("the governor isn't fed the old world's frames while the next world is made", async () => {
    const { rt, loop, quality } = make();
    await rt.mount({ id: 'old', create: () => fakeWorld({ wants: () => true }) }, {}, fakeHost());
    loop.tick(0);
    expect(quality.frame).toHaveBeenCalledTimes(1);
    let readyNew;
    const p = rt.handover({ id: 'next', create: () => fakeWorld({ wants: () => true, ready: new Promise((r) => (readyNew = r)) }) }, {}, fakeHost());
    await flush();
    loop.tick(100);
    loop.tick(200); // (the old world drawing on, its frames carrying the new one's making)
    expect(quality.frame).toHaveBeenCalledTimes(1);
    readyNew();
    await settled();
    loop.tick(300); // (the cover)
    await p;
    loop.tick(400); // the new world's first frame: its own from here
    expect(quality.frame).toHaveBeenCalledTimes(2);
    expect(quality.frame).toHaveBeenLastCalledWith(400);
  });

  it('a module that softens through its own post chain keeps its canvas as it is, and is told the level', async () => {
    const quality = fakeQuality();
    let scale = 1;
    quality.ratioUnder = vi.fn((cap, { unscaled = false } = {}) => Math.min(cap ?? Infinity, 2) * (unscaled ? 1 : scale));
    quality.frame = vi.fn(() => {
      scale = 0.72;
      return 2;
    });
    const { rt, loop } = make({ quality });
    const world = fakeWorld({ wants: () => true, lowerQuality: vi.fn() });
    await rt.mount({ id: 'galaxy', ratio: 1.5, soften: 'post', create: () => world }, {}, fakeHost());
    expect(rt.gfx.setRatio).toHaveBeenLastCalledWith(1.5);
    loop.tick(16);
    expect(world.lowerQuality).toHaveBeenCalledWith(2);
    for (const [r] of rt.gfx.setRatio.mock.calls) expect(r).toBe(1.5); // (never the scaled 1.08)
    // a module without it is drawn at the scaled ratio, as before
    const plain = fakeWorld({ wants: () => true, lowerQuality: vi.fn() });
    scale = 1;
    await rt.mount({ id: 'surface', ratio: 1.5, create: () => plain }, {}, fakeHost());
    loop.tick(32);
    expect(rt.gfx.setRatio).toHaveBeenLastCalledWith(1.5 * 0.72);
    expect(plain.lowerQuality).toHaveBeenCalledWith(2);
  });

  it("a module's ratio caps the sharpness it's drawn at", async () => {
    const quality = fakeQuality();
    quality.ratioUnder = vi.fn((cap) => Math.min(cap ?? Infinity, 2));
    const { rt } = make({ quality });
    await rt.mount({ id: 'a', ratio: 1.5, create: () => fakeWorld() }, {}, fakeHost());
    expect(rt.gfx.setRatio).toHaveBeenLastCalledWith(1.5);
    await rt.mount({ id: 'b', create: () => fakeWorld() }, {}, fakeHost());
    expect(rt.gfx.setRatio).toHaveBeenLastCalledWith(2);
  });

  it('a handover keeps the keys the new world bound as it was made', async () => {
    const { rt, input } = make();
    input.bind = vi.fn();
    input.bindings = vi.fn(() => ({ actions: { old: ['KeyO'] }, axes: {} }));
    await rt.mount({ id: 'old', create: () => fakeWorld() }, {}, fakeHost());
    input.unbind.mockClear();
    let order = [];
    input.unbind.mockImplementation(() => order.push('unbind'));
    const create = vi.fn(() => {
      order.push('create');
      rt.input.bind({ fly: ['KeyW'] });
      return fakeWorld();
    });
    await rt.handover({ id: 'next', create }, {}, fakeHost());
    expect(order).toEqual(['unbind', 'create']); // (never unbound after it bound them)
    // and a handover that fails gives the old world its keys back
    order = [];
    await rt.handover({ id: 'bad', create: () => { throw new Error('no'); } }, {}, fakeHost());
    expect(input.bind).toHaveBeenLastCalledWith({ old: ['KeyO'] }, { axes: {} });
  });

  it('a held cover waits for the page to adopt the world, then fades in its box', async () => {
    const { rt, loop, input } = make();
    const old = fakeWorld({ wants: () => true });
    const host1 = fakeHost();
    await rt.mount({ id: 'old', create: () => old }, {}, host1);
    loop.tick(0);
    const nextMod = { id: 'next', create: () => fakeWorld({ wants: () => true }) };
    const p = rt.handover(nextMod, {}, host1, { fade: 600, held: true });
    await settled();
    loop.tick(16); // (the old world's last frame, kept as the cover)
    await p;
    const snap = rt.gfx.snapshot.mock.results[0].value;
    snap.el = { parentNode: host1 };
    loop.tick(100);
    loop.tick(700);
    expect(snap.set).not.toHaveBeenCalled(); // still covering: no page has it yet
    expect(snap.remove).not.toHaveBeenCalled();
    const host2 = fakeHost();
    expect(rt.adopt({ id: 'other' }, host2)).toBe(false);
    input.attach.mockClear();
    expect(rt.adopt(nextMod, host2)).toBe(true);
    expect(host2.prepend).toHaveBeenCalledWith(rt.gfx.canvas);
    expect(host2.appendChild).toHaveBeenCalledWith(snap.el);
    expect(input.attach).toHaveBeenCalledWith(expect.objectContaining({ host: host2 }));
    expect(rt.host).toBe(host2);
    loop.tick(800);
    loop.tick(1100);
    expect(snap.set).toHaveBeenLastCalledWith(0.5);
    loop.tick(1500);
    expect(snap.remove).toHaveBeenCalled();
  });

  it('a held cover gives up waiting after a few seconds', async () => {
    const { rt, loop } = make();
    await rt.mount({ id: 'old', create: () => fakeWorld({ wants: () => true }) }, {}, fakeHost());
    loop.tick(0);
    const p = rt.handover({ id: 'next', create: () => fakeWorld({ wants: () => true }) }, {}, fakeHost(), { fade: 600, held: true });
    await settled();
    loop.tick(16); // (the old world's last frame, kept as the cover)
    await p;
    const snap = rt.gfx.snapshot.mock.results[0].value;
    loop.tick(100);
    loop.tick(3200);
    loop.tick(3300);
    loop.tick(4000);
    expect(snap.remove).toHaveBeenCalled();
  });

  it('says which module is being made, so a page that leaves drops only its own', async () => {
    const { rt } = make();
    let done;
    const mod = { id: 'a', create: () => new Promise((r) => (done = r)) };
    expect(rt.loading).toBe(null);
    const p = rt.mount(mod, {}, fakeHost());
    expect(rt.loading).toBe(mod);
    await flush();
    done(fakeWorld());
    await p;
    expect(rt.loading).toBe(null);
    const bad = { id: 'b', create: () => { throw new Error('no'); } };
    await rt.mount(bad, {}, fakeHost());
    expect(rt.loading).toBe(null);
    const slow = { id: 'c', create: () => new Promise(() => {}) };
    rt.mount(slow, {}, fakeHost());
    rt.unmount();
    expect(rt.loading).toBe(null); // (dropped)
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
