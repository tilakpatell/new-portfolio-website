// The runtime: one renderer, one loop and the services, with a world
// module mounted on it. mount() makes a module's world and draws it in a
// host box; handover() lets the next module take over without a cut (the
// old world draws on until the new one is ready, its keys its own until the new one is prepared; then its last
// frame is kept over the new one and fades out); adopt() moves a world handed over already into
// the box of the page that shows it (its canvas and the cover with it);
// unmount() disposes the world and keeps the canvas. The browser bits (the backend, the loop's rAF, the DOM) are
// passed in, so this runs in Node: index.js wires the real ones.
//
// createRuntime({ makeBackend, loop, input, quality, saves, assets, audio,
//   events, now, gpu, override, visible }) → rt
// rt: { gfx, input, quality, saves, assets, audio, events, host, status,
//   current, loading, on(fn), invalidate(), resize(w, h), setVisible(on), lost(),
//   mount(module, props, host) → shown, handover(module, props, host, { fade, held, after }) → shown,
//   adopt(module, host), unmount(), dispose() }
// (`shown`: true once the module's world is the one drawing; false when it
// failed, or something newer was asked for meanwhile)

import { createLoop } from '../lib/three/loop';
import { settle } from '../lib/settle';
import { pickBackend } from './backend';
import { createHandover } from './handover';
import { validateModule, validateWorld } from './module';

const READY_WAIT = 4000; // ms at most a world's `ready` holds back its first frame
const MAX_DT = 0.05; // s: a tab coming back doesn't leap
const HOLD_MAX = 3000; // ms at most a held cover waits for the next page to adopt its world
const SNAP_WAIT = 250; // ms at most a handover waits for the old world's last frame (none comes off screen)
const AFTER_MAX = 15000; // ms at most a handover waits on `after` once the new world is made
const PREPARE_WAIT = 30000; // ms at most a world's prepare holds back its first frame (useScene's)

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

export function createRuntime({ makeBackend, loop: makeLoop = createLoop, input, quality, saves = null, store = null, assets, audio, events = createEvents(), gpu = false, override = null, visible = () => true }) {
  let gfx = null;
  let kind = null; // the backend asked for
  let lostWebGPU = false;
  let status = 'idle';
  let current = null; // { module, world, host, props }
  let seq = 0; // the latest mount or handover: an older one arriving is dropped
  let making = null; // { module, token }: the one being made now
  let last = 0; // the previous frame's time
  let kicked = false;
  let shown = true; // the host on screen (setVisible)
  let snap = null; // the old world's last frame, fading out
  let takeSnap = false; // take it after the next draw
  let snapped = null; // a handover waiting for that frame
  let timeline = null;
  let fading = false; // the cover's fade has begun
  let holding = false; // the cover waits for adopt() (a handover across a route change)
  let holdSince = null;
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
      snapped?.();
    }
    const level = quality.frame(t);
    if (level !== null) {
      gfx.setRatio(ratioFor(current.module));
      world.lowerQuality?.(level);
    }
    if (status === 'ready') setStatus('on');
    if (snap && timeline && holding) {
      if (holdSince === null) holdSince = t;
      else if (t - holdSince > HOLD_MAX) holding = false;
    }
    if (snap && timeline && !holding) {
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
    snapped?.();
    holding = false;
    holdSince = null;
  };
  // the next frame drawn, kept as the cover (taken in the frame's own task,
  // so no preserveDrawingBuffer is needed); over after SNAP_WAIT with no
  // cover when no frame comes (the host off screen, the tab hidden)
  const cover = () =>
    new Promise((resolve) => {
      const done = () => {
        if (snapped !== done) return;
        snapped = null;
        takeSnap = false;
        resolve();
      };
      snapped = done;
      takeSnap = true;
      loop.kick();
      setTimeout(done, SNAP_WAIT);
    });
  const fail = () => {
    const was = current;
    current = null;
    clearHost();
    letGo(was);
    loop.stop();
    setStatus('failed');
  };

  // the sharpness to draw a module at: the quality's, under the module's own cap
  const ratioFor = (mod) => (quality.ratioUnder ? quality.ratioUnder(mod?.ratio) : quality.ratio);

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
    // (its frame guard readied something it held back: draw again, even a
    // world that has stopped asking for frames)
    const { canvas } = gfx;
    canvas?.addEventListener?.('tp:redraw', () => {
      if (gfx?.canvas === canvas) rt.invalidate();
    });
    return gfx;
  };

  // make a module's world; null if something newer came meanwhile (`own`:
  // the status is this build's to set, a mount's; a handover's old world is
  // still the one on)
  // (`keys`, a handover's: the old world's bindings, { kept }. The new world
  // binds its keys as it's made; the old one gets its own back from then
  // until the new one's prepare is over, since it draws on, and is flown,
  // all that while; then the new world's are bound again.)
  const build = async (module, props, host, token, own = false, keys = null) => {
    await backendFor(module);
    if (token !== seq) return null;
    gfx.setRatio?.(ratioFor(module));
    rt.host = host;
    assets.owner?.(module.id);
    let world = validateWorld(await module.create(rt, props));
    if (token !== seq) {
      world.dispose();
      return null;
    }
    const fresh = keys ? (input.bindings?.() ?? null) : null;
    if (keys?.kept) input.bind(keys.kept.actions, { axes: keys.kept.axes });
    const ours = () => {
      if (keys && token === seq) {
        if (fresh) input.bind(fresh.actions, { axes: fresh.axes });
        else input.unbind();
      }
    };
    if (world.ready) {
      await settle(world.ready, READY_WAIT);
      if (token !== seq) {
        world.dispose();
        return null;
      }
      world.update?.(props);
    }
    // get it onto the graphics chip before its first frame: its prepare,
    // a slice at a time, telling the page how far it's got (rt.events
    // 'prepare'). It stops at its next slice once this build is no longer the
    // newest (a newer mount or handover, an unmount) or the context is gone.
    // In a handover the old world draws on meanwhile, so the flight is the
    // loading screen; a mount says 'preparing' while it runs. One that throws,
    // or is still going after PREPARE_WAIT, is passed over: the world begins.
    if (world.prepare) {
      const g = gfx;
      let gaveUp = false;
      const alive = () => !gaveUp && token === seq && gfx === g && !g.lost;
      let step = null;
      const report = (value, s) => {
        if (!alive()) return;
        step = s ?? null;
        events.emit('prepare', { value: Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0, step });
      };
      // sized as its box is now, so what it prepares is what it will draw
      // (its cameras only: the canvas may still be the old world's)
      const r = host?.getBoundingClientRect?.();
      if (r) world.resize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)));
      if (own) setStatus('preparing');
      report(0, null);
      const work = Promise.resolve()
        .then(() => world.prepare(report, alive))
        .catch((err) => {
          if (dev) console.warn(`[${module.id}] prepare failed`, err);
        });
      await settle(work, PREPARE_WAIT);
      if (token === seq && gfx === g) report(1, step);
      gaveUp = true; // (one still going after PREPARE_WAIT stops at its next slice)
      if (token !== seq || gfx !== g) {
        world.dispose();
        return null;
      }
      world.update?.(props);
    }
    ours();
    return world;
  };
  const place = (world, host, mod) => {
    if (gfx.canvas.parentNode !== host) host.prepend(gfx.canvas);
    // (the canvas is the picture: a module may say what it shows)
    if (gfx.canvas.setAttribute) {
      if (mod.label) {
        gfx.canvas.setAttribute('role', 'img');
        gfx.canvas.setAttribute('aria-label', mod.label);
      } else {
        gfx.canvas.removeAttribute?.('role');
        gfx.canvas.removeAttribute?.('aria-label');
      }
    }
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
    store,
    assets,
    audio,
    events,
    host: null,
    get status() {
      return status;
    },
    // the module being made (a mount or a handover still on its way), or null
    get loading() {
      return making && making.token === seq ? making.module : null;
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
      making = { module, token };
      const was = current;
      current = null;
      clearHost();
      letGo(was);
      setStatus('loading');
      try {
        const world = await build(mod, props, host, token, true);
        if (!world) return false;
        making = null;
        place(world, host, mod);
        begin(module, world, host, props); // (the object the page mounted, so it can tell its own)
        return true;
      } catch (err) {
        if (dev) console.error(`[${mod.id}] 3D failed`, err);
        if (token === seq) {
          making = null;
          current = null;
          setStatus('failed');
        }
        return false;
      }
    },
    // `held`: the cover stays up until the page that shows the new world
    // adopts it (rt.adopt, HOLD_MAX at most), for a handover the route
    // changes after. `after`: a promise the old world's last moment waits
    // on once the new one is made (a dive flown to its end while the next
    // world was built behind it), AFTER_MAX at most.
    async handover(module, props = {}, host, { fade = 600, held = false, after = null } = {}) {
      if (!current) return this.mount(module, { ...props, from: null }, host);
      const mod = validateModule(module);
      const token = ++seq;
      making = { module, token };
      const old = current;
      let from = null;
      try {
        from = old.world.handoff?.() ?? null;
      } catch (err) {
        if (dev) console.warn(`[${old.module.id}] handoff failed`, err);
      }
      // (the new world's keys are bound as it's made, from a clean slate; the
      // old one has its own back while the new one is readied, as it draws
      // on and is flown meanwhile, and the new world's are bound once it's
      // prepared: build's `keys`)
      const kept = input.bindings?.() ?? null;
      input.unbind();
      try {
        const world = await build(mod, { ...props, from }, host, token, false, { kept });
        if (!world) return false;
        if (after) {
          await settle(after, AFTER_MAX);
          if (token !== seq) {
            world.dispose();
            return false;
          }
        }
        // the old world's last frame, kept over the new one while it fades
        await cover();
        if (token !== seq) {
          world.dispose();
          return false;
        }
        making = null;
        if (current === old) letGo(old); // (unless a thrown frame took it already)
        current = null;
        input.detach();
        place(world, host, mod);
        begin(module, world, host, props);
        timeline = snap ? createHandover({ fade }) : null; // (nothing drawn to fade: straight in)
        fading = false;
        holding = Boolean(held && snap);
        holdSince = null;
        return true;
      } catch (err) {
        if (dev) console.error(`[${mod.id}] 3D failed`, err);
        if (token === seq) {
          making = null;
          // the old world stays up: better than black (and nothing over it)
          current = old;
          takeSnap = false;
          snap?.remove();
          snap = null;
          if (kept) input.bind(kept.actions, { axes: kept.axes });
          setStatus(old ? 'on' : 'failed');
        }
        return false;
      }
    },
    // the world handed over before this page was up, into its box: the
    // canvas, the cover and the pointer move there, and the cover's fade
    // can begin
    adopt(module, host) {
      if (!gfx || !host || current?.module !== module) return false;
      if (current.host !== host) {
        current.host = host;
        rt.host = host;
        if (gfx.canvas.parentNode !== host) host.prepend(gfx.canvas);
        if (snap?.el && snap.el.parentNode !== host) host.appendChild(snap.el);
        input.attach({ win: typeof window !== 'undefined' ? window : host, host });
      }
      holding = false;
      const r = host.getBoundingClientRect?.();
      if (r) this.resize(r.width, r.height);
      loop.kick();
      return true;
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
