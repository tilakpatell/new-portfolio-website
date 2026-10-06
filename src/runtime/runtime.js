// The runtime: one renderer, one loop and the services, with a world
// module mounted on it. mount() makes a module's world and draws it in a
// host box; handover() lets the next module take over without a cut (the
// old world draws until the new one is ready, then its last frame fades
// out over the new one); unmount() disposes the world and keeps the
// canvas. The browser bits (the backend, the loop's rAF, the DOM) are
// passed in, so this runs in Node: index.js wires the real ones.
//
// createRuntime({ makeBackend, loop, input, quality, saves, assets, audio,
//   events, now, gpu, override, visible }) → rt
// rt: { gfx, input, quality, saves, assets, audio, events, host, status,
//   current, on(fn), invalidate(), resize(w, h), setVisible(on), lost(),
//   mount(module, props, host), handover(module, props, host, { fade }),
//   unmount(), dispose() }

import { createLoop } from '../lib/three/loop';
import { settle } from '../lib/settle';
import { pickBackend } from './backend';
import { createHandover } from './handover';
import { validateModule, validateWorld } from './module';

const READY_WAIT = 4000; // ms at most a world's `ready` holds back its first frame
const MAX_DT = 0.05; // s: a tab coming back doesn't leap

export function createEvents() {
  const by = new Map();
  const any = new Set();
  return {
    emit(type, data) {
      for (const fn of by.get(type) ?? []) fn(data);
      for (const fn of any) fn(type, data);
    },
    on(type, fn) {
      if (!by.has(type)) by.set(type, new Set());
      by.get(type).add(fn);
      return () => by.get(type)?.delete(fn);
    },
    onAny(fn) {
      any.add(fn);
      return () => any.delete(fn);
    },
  };
}

export function createRuntime({ makeBackend, loop: makeLoop = createLoop, input, quality, saves = null, assets, audio, events = createEvents(), gpu = false, override = null, visible = () => true }) {
  let gfx = null;
  let kind = null; // the backend asked for
  let lostWebGPU = false;
  let status = 'idle';
  let current = null; // { module, world, host, props }
  let seq = 0; // the latest mount or handover: an older one arriving is dropped
  let last = 0; // the previous frame's time
  let kicked = false;
  let shown = true; // the host on screen (setVisible)
  let snap = null; // the old world's last frame, fading out
  let takeSnap = false; // take it after the next draw
  let timeline = null;
  let fading = false; // the cover's fade has begun
  const listeners = new Set();
  const dev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

  const setStatus = (s) => {
    if (s === status) return;
    status = s;
    for (const fn of listeners) fn(s);
  };

  const frame = (t) => {
    if (!current) return false;
    const dt = last ? Math.min(MAX_DT, (t - last) / 1000) : 0.016;
    last = t;
    const { world } = current;
    try {
      const snapshot = input.sample(t);
      world.step?.(dt, snapshot, t);
      world.draw({ dt, now: t, renderer: gfx.renderer, quality });
    } catch (err) {
      if (dev) console.error(`[${current.module.id}] frame failed`, err);
      fail();
      return false;
    }
    if (takeSnap) {
      takeSnap = false;
      snap?.remove();
      snap = gfx.snapshot(current.host);
      timeline = null;
    }
    const level = quality.frame(t);
    if (level !== null) {
      gfx.setRatio(quality.ratio);
      world.lowerQuality?.(level);
    }
    if (status === 'ready') setStatus('on');
    if (snap && timeline) {
      if (!fading) {
        fading = true;
        timeline.start(t);
      }
      const { opacity, done } = timeline.frame(t);
      snap.set(opacity);
      if (done) {
        snap.remove();
        snap = null;
        timeline = null;
        fading = false;
      }
    }
    const more = (world.wants ? world.wants() !== false : true) || Boolean(snap && timeline) || kicked;
    kicked = false;
    if (!more) last = 0;
    return more;
  };
  const loop = makeLoop(frame, { can: () => Boolean(current) && shown && visible() });

  const letGo = (entry) => {
    if (!entry) return;
    try {
      entry.world.dispose();
    } catch (err) {
      if (dev) console.warn(`[${entry.module.id}] dispose failed`, err);
    }
    audio.fadeOut?.();
    assets.drop?.(entry.module.id);
  };
  const clearHost = () => {
    input.unbind();
    input.detach();
    snap?.remove();
    snap = null;
    timeline = null;
    fading = false;
    takeSnap = false;
  };
  const fail = () => {
    const was = current;
    current = null;
    clearHost();
    letGo(was);
    loop.stop();
    setStatus('failed');
  };

  const backendFor = async (module) => {
    const want = pickBackend({ gpu, shading: module.shading, override, lost: lostWebGPU });
    if (gfx && kind === want && !gfx.lost) return gfx;
    // (a backend of the other kind can't share the canvas: the old one goes)
    if (gfx) {
      gfx.dispose();
      gfx = null;
    }
    kind = want;
    gfx = await makeBackend(want, { budget: quality.budget, onLost: () => rt.lost() });
    gfx.setRatio?.(quality.ratio);
    return gfx;
  };

  // make a module's world; null if something newer came meanwhile
  const build = async (module, props, host, token) => {
    await backendFor(module);
    if (token !== seq) return null;
    rt.host = host;
    assets.owner?.(module.id);
    let world = validateWorld(await module.create(rt, props));
    if (token !== seq) {
      world.dispose();
      return null;
    }
    if (world.ready) {
      await settle(world.ready, READY_WAIT);
      if (token !== seq) {
        world.dispose();
        return null;
      }
      world.update?.(props);
    }
    return world;
  };
  const place = (world, host) => {
    if (gfx.canvas.parentNode !== host) host.prepend(gfx.canvas);
    const r = host.getBoundingClientRect?.();
    const w = Math.max(1, Math.round(r?.width ?? 1));
    const h = Math.max(1, Math.round(r?.height ?? 1));
    gfx.setSize(w, h);
    world.resize(w, h);
  };
  const begin = (module, world, host, props) => {
    input.attach({ win: typeof window !== 'undefined' ? window : host, host });
    current = { module, world, host, props };
    world.setVisible?.(shown);
    last = 0;
    setStatus('ready');
    loop.kick();
  };

  const rt = {
    get gfx() {
      return gfx;
    },
    input,
    quality,
    saves,
    assets,
    audio,
    events,
    host: null,
    get status() {
      return status;
    },
    get current() {
      return current;
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    invalidate() {
      kicked = true;
      loop.kick();
    },
    resize(w, h) {
      if (!gfx || !current) return;
      gfx.setSize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
      current.world.resize(gfx.size.w, gfx.size.h);
      loop.kick();
    },
    setVisible(on) {
      shown = Boolean(on);
      current?.world.setVisible?.(shown);
      if (shown) loop.kick();
    },
    // the context is gone: the world with it; the next mount makes a backend afresh
    lost() {
      if (kind === 'webgpu') lostWebGPU = true;
      const was = current;
      current = null;
      clearHost();
      letGo(was);
      loop.stop();
      gfx?.dispose();
      gfx = null;
      setStatus('lost');
    },
    async mount(module, props = {}, host) {
      const mod = validateModule(module);
      const token = ++seq;
      const was = current;
      current = null;
      clearHost();
      letGo(was);
      setStatus('loading');
      try {
        const world = await build(mod, props, host, token);
        if (!world) return;
        place(world, host);
        begin(mod, world, host, props);
      } catch (err) {
        if (dev) console.error(`[${mod.id}] 3D failed`, err);
        if (token === seq) {
          current = null;
          setStatus('failed');
        }
      }
    },
    async handover(module, props = {}, host, { fade = 600 } = {}) {
      if (!current) return this.mount(module, { ...props, from: null }, host);
      const mod = validateModule(module);
      const token = ++seq;
      const old = current;
      let from = null;
      try {
        from = old.world.handoff?.() ?? null;
      } catch (err) {
        if (dev) console.warn(`[${old.module.id}] handoff failed`, err);
      }
      // its next frame is kept as the cover (in the frame's own task, so no
      // preserveDrawingBuffer is needed)
      takeSnap = true;
      loop.kick();
      try {
        const world = await build(mod, { ...props, from }, host, token);
        if (!world) return;
        current = null;
        letGo(old);
        input.unbind();
        input.detach();
        takeSnap = false;
        place(world, host);
        begin(mod, world, host, props);
        timeline = snap ? createHandover({ fade }) : null; // (nothing drawn to fade: straight in)
        fading = false;
      } catch (err) {
        if (dev) console.error(`[${mod.id}] 3D failed`, err);
        if (token === seq) {
          // the old world stays up: better than black
          current = old;
          takeSnap = false;
          setStatus(old ? 'on' : 'failed');
        }
      }
    },
    unmount() {
      seq += 1;
      const was = current;
      current = null;
      clearHost();
      letGo(was);
      loop.stop();
      last = 0;
      setStatus('idle');
    },
    dispose() {
      this.unmount();
      gfx?.dispose();
      gfx = null;
    },
  };
  return rt;
}
