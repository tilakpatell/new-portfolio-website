// A page's 3D scene, made only when it's needed. It loads (three.js and the
// scene module) when its box comes within a screen or so of the viewport,
// draws only while it's on screen and only while the scene asks for frames
// (a scene that has finished its entrance costs nothing until something
// changes), follows the theme without re-rendering React, and lets its GPU
// memory go once it has been far away for a while.
//
// The hook puts a fresh <canvas class="scene-canvas"> first in the box for
// each scene it makes. A scene module exports `create(canvas, ctx)`, sync or
// async, returning:
//   resize(w, h)            the canvas's CSS size
//   render(ms, now) → bool   draw a frame; true asks for another
//   setColors?(colors)       lib/three/theme colours changed
//   setVisible?(on)          its box came on or went off screen
//   update?(props)           new props from the page
//   lowerQuality?()          still slow at the lowest sharpness: simplify
//   prepare?(onProgress, alive) → promise
//                            get everything onto the graphics chip before
//                            the first frame (lib/three/gpuWork's
//                            prepareScene); onProgress(fraction, step) moves
//                            the page's loading veil, and alive() turns false
//                            once the scene is let go, so it can stop
//   warmUp?(timeLeft) → bool the older way: draw everything once, out of
//                            sight, a slice at a time; true once it's done
//   dispose()
//   ready?                   a promise: its shaders are compiled (see
//                            lib/three/renderer's precompile); the first
//                            frame waits for it (READY_WAIT at most)
// After `ready` the hook says 'preparing' while prepare (or, on a page that
// isn't covered, warmUp a slice a frame) runs, and hands back `progress`
// ({ value 0..1, step }) for the page's LoadingVeil; then 'ready', then 'on'.
// A prepare or warm-up that fails or throws is passed over, never a reason
// not to show the scene.
// ctx is { el, colors, reduced, invalidate, onLost, onSlow, ...props }
// (colours as seen inside `el`, so a scene in a .dark-scope gets dark ones):
// `el` is the scene's box (for pointer events), `invalidate()` asks for frames.

import { useEffect, useRef, useState } from 'react';
import { use3D } from '../gpu';
import { useReducedMotion } from '../hooks';
import { settle } from '../settle';
import { createLoop } from './loop';
import { readTheme, watchTheme } from './theme';

const DROP_AFTER = 10000; // ms far from the viewport before the scene is let go
const READY_WAIT = 4000; // ms at most a scene's `ready` holds back its first frame
const PREPARE_WAIT = 30000; // ms at most a scene's prepare holds back its first frame

// Something full screen over the whole page (the opening crawl, the cockpit)
// sets html[data-covered]: scenes underneath stay made but draw nothing until
// it's gone (App sends tp:uncover then). One made meanwhile warms up, out of
// sight, a slice at a time while the page is idle (its warmUp), so its first
// frame as it's uncovered (the cockpit's flash, for the universe) doesn't
// stop to send everything to the graphics chip. One made on an uncovered page
// has its warmUp driven a slice a frame before it's shown (driveWarmUp).
const covered = () => typeof document !== 'undefined' && 'covered' in document.documentElement.dataset;
// fn(timeLeft) when the page has a moment; timeLeft() is the ms it can spare
const whenIdle = (fn) => {
  if (typeof requestIdleCallback === 'function') return requestIdleCallback((deadline) => fn(() => deadline.timeRemaining()), { timeout: 500 });
  return setTimeout(() => {
    const t = performance.now();
    fn(() => Math.max(0, 12 - (performance.now() - t)));
  }, 50);
};

// the next frame, or 100 ms on if frames have stopped (a hidden tab); the
// same as lib/three/gpuWork's, kept here so pages don't load three.js for it
const nextFrame = () =>
  new Promise((resolve) => {
    let timer = 0;
    const go = () => {
      clearTimeout(timer);
      resolve();
    };
    if (typeof requestAnimationFrame === 'function') {
      timer = setTimeout(go, 100);
      requestAnimationFrame(go);
    } else setTimeout(go, 16);
  });

// A scene's warmUp(timeLeft) run a slice a frame, each slice given `budget`
// ms, until it says it's done (anything but false). Resolves true when it's
// over (finished, or threw: a warm-up only makes things smoother, so a
// broken one is simply over), false when it stopped first: alive() turned
// false (the scene was let go) or it had run `cap` ms of frames. Never
// rejects.
export async function driveWarmUp(warmUp, { frame = nextFrame, alive = () => true, budget = 10, cap = 20000 } = {}) {
  const began = performance.now();
  for (;;) {
    if (!alive()) return false;
    const start = performance.now();
    let done = true;
    try {
      done = warmUp(() => Math.max(0, budget - (performance.now() - start))) !== false;
    } catch (err) {
      if (import.meta.env.DEV) console.warn('3D warm-up failed', err);
    }
    if (done) return true;
    if (performance.now() - began >= cap) return false;
    await frame();
  }
}

export function useScene(load, { enabled = true, props, id = 'scene', near: nearMargin = '100% 0px 100% 0px' } = {}) {
  const wrap = useRef(null);
  const view = useRef(null);
  const three = use3D();
  const reduced = useReducedMotion();
  const [status, setStatus] = useState('idle'); // idle | loading | preparing | ready | on | failed | slow | lost
  // how far its prepare has got, for the page's loading veil
  const [progress, setProgressState] = useState({ value: 0, step: null });
  const progressRef = useRef(progress);
  const [near, setNear] = useState(false);
  const visible = useRef(false);
  const loop = useRef({ last: 0, kick: () => {} });
  const loadRef = useRef(load);
  loadRef.current = load;
  const propsRef = useRef(props);
  propsRef.current = props;
  const failed = useRef(false); // why it stopped: 'failed' and 'slow' stay; 'lost' retries
  const [attempt, setAttempt] = useState(0);
  const on = enabled && three.on;

  // near the viewport (make it) and on screen (draw it)
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      visible.current = true;
      return undefined;
    }
    let dropTimer = 0;
    const nearIO = new IntersectionObserver(
      ([e]) => {
        clearTimeout(dropTimer);
        if (e.isIntersecting) {
          setNear(true);
          // a context the browser took back (too many at once, a GPU reset)
          // gets one more try when the scene comes near again
          if (failed.current === 'lost') {
            failed.current = false;
            setAttempt((n) => n + 1);
          }
        } else dropTimer = setTimeout(() => setNear(false), DROP_AFTER);
      },
      { rootMargin: nearMargin },
    );
    const seenIO = new IntersectionObserver(([e]) => {
      visible.current = e.isIntersecting;
      view.current?.setVisible?.(e.isIntersecting);
      if (e.isIntersecting) loop.current.kick();
    });
    nearIO.observe(el);
    seenIO.observe(el);
    return () => {
      clearTimeout(dropTimer);
      nearIO.disconnect();
      seenIO.disconnect();
    };
  }, [nearMargin]);

  // make the scene, and drop it when it's far away, turned off or broken
  useEffect(() => {
    // a scene made again starts its veil from the beginning, not at the last one's 1
    if (progressRef.current.value !== 0 || progressRef.current.step !== null) {
      progressRef.current = { value: 0, step: null };
      setProgressState(progressRef.current);
    }
    if (!on || !near || failed.current) {
      setStatus((s) => (s === 'failed' || s === 'slow' || s === 'lost' ? s : 'idle'));
      return undefined;
    }
    let dead = false;
    let shown = false;
    const L = loop.current;
    const setProgress = (value, step) => {
      const p = progressRef.current;
      if (dead || (p.value === value && p.step === step)) return;
      progressRef.current = { value, step };
      setProgressState(progressRef.current);
    };
    const stop = () => chain.stop();
    // a fresh canvas for every scene: a context that has been let go can't
    // be had again from the same element
    const canvas = document.createElement('canvas');
    canvas.className = 'scene-canvas';
    const release = () => {
      view.current?.dispose();
      view.current = null;
      canvas.remove();
    };
    const drop = (why) => {
      stop();
      release();
      failed.current = why;
      if (!dead) setStatus(why);
    };
    const frame = (now) => {
      const v = view.current;
      if (!v || !visible.current || document.hidden || covered()) return false;
      const ms = L.last ? Math.min(50, now - L.last) : 16;
      L.last = now;
      let more = false;
      try {
        more = v.render(ms, now);
      } catch (err) {
        if (import.meta.env.DEV) console.error(`[${id}] 3D frame failed`, err);
        drop('failed');
        return false;
      }
      if (!shown && !dead) {
        shown = true; // drawn once: now whatever it replaces can step aside
        setStatus('on');
      }
      if (!more) L.last = 0;
      return more;
    };
    // one chain of frames: a kick from inside a frame (a shot fired with the
    // trigger held) is folded into it, not a second chain drawing beside it
    const chain = createLoop(frame, { can: () => Boolean(view.current && visible.current && !document.hidden && !covered()) });
    L.kick = () => chain.kick();
    const onVis = () => (document.hidden ? stop() : L.kick());
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('tp:uncover', onVis);
    // (the renderer's frame guard readied what it held back: draw it)
    const onRedraw = () => L.kick();
    canvas.addEventListener('tp:redraw', onRedraw);

    setStatus('loading');
    Promise.resolve()
      .then(() => loadRef.current())
      .then(async (mod) => {
        if (dead || !wrap.current) return;
        try {
          wrap.current.prepend(canvas);
          const v = await mod.create(canvas, {
            ...propsRef.current,
            el: wrap.current,
            colors: readTheme(wrap.current),
            reduced,
            invalidate: () => L.kick(),
            onLost: () => drop('lost'),
            // at its lowest sharpness and still slow: the scene may simplify
            onSlow: () => view.current?.lowerQuality?.(),
          });
          if (dead) {
            v.dispose();
            return;
          }
          const r = wrap.current?.getBoundingClientRect();
          if (r) v.resize(r.width, r.height);
          // its shaders compiling in the background: the first frame waits
          // for them (still 'loading'), so drawing it doesn't stall the page
          if (v.ready) {
            await settle(v.ready, READY_WAIT);
            if (dead || failed.current) {
              v.dispose();
              return;
            }
            // props the page changed meanwhile (update() runs on every render, so it's safe to repeat)
            v.update?.(propsRef.current);
          }
          // get it onto the graphics chip before it's shown, behind the
          // page's veil: its prepare, or its warmUp a slice a frame (on a
          // covered page the warmUp waits for idle moments instead, below)
          let warmed = false;
          if (v.prepare || (v.warmUp && !covered())) {
            // sized as its box is now (it may have changed while it loaded), so
            // what it prepares is what it will draw
            const box = wrap.current?.getBoundingClientRect();
            if (box) v.resize(box.width, box.height);
            let gaveUp = false;
            const alive = () => !dead && !gaveUp && !failed.current;
            setProgress(0, v.prepare ? null : 'first draw');
            setStatus('preparing');
            const onProgress = (value, step) => {
              if (alive()) setProgress(Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0, step ?? null);
            };
            // a prepare counts as the warm-up whatever happens to it
            const work = v.prepare ? Promise.resolve().then(() => v.prepare(onProgress, alive)).then(() => true) : driveWarmUp(v.warmUp, { alive });
            let timer = 0;
            warmed = await Promise.race([
              work.catch((err) => {
                if (import.meta.env.DEV) console.warn(`[${id}] 3D prepare failed`, err);
                return true;
              }),
              new Promise((resolve) => {
                timer = setTimeout(() => resolve(Boolean(v.prepare)), PREPARE_WAIT);
              }),
            ]);
            clearTimeout(timer);
            gaveUp = true; // one still going after PREPARE_WAIT stops at its next slice
            if (dead || failed.current) {
              v.dispose();
              return;
            }
            setProgress(1, progressRef.current.step);
            v.update?.(propsRef.current);
          }
          view.current = v;
          v.setVisible?.(visible.current);
          setStatus('ready');
          if (v.warmUp && !warmed && covered()) {
            const slice = (timeLeft) => {
              if (dead || view.current !== v || !covered()) return;
              let done = true;
              try {
                done = v.warmUp(timeLeft) !== false;
              } catch (err) {
                if (import.meta.env.DEV) console.warn(`[${id}] warm-up failed`, err);
              }
              if (!done) whenIdle(slice);
            };
            whenIdle(slice);
          }
          L.kick();
        } catch (err) {
          if (import.meta.env.DEV) console.error(`[${id}] 3D failed`, err);
          drop('failed');
        }
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.error(`[${id}] 3D module failed to load`, err);
        drop('failed');
      });

    return () => {
      dead = true;
      stop();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('tp:uncover', onVis);
      canvas.removeEventListener('tp:redraw', onRedraw);
      L.kick = () => {};
      release();
    };
    // `reduced` is read at creation; a change mid-visit re-creates the scene
  }, [on, near, id, reduced, attempt]);

  // its size, its colours and the page's props, without re-rendering anything
  useEffect(() => {
    const el = wrap.current;
    if (!el || status === 'idle' || status === 'loading' || status === 'preparing') return undefined;
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(([e]) => {
            view.current?.resize(e.contentRect.width, e.contentRect.height);
            loop.current.kick();
          })
        : null;
    ro?.observe(el);
    const unwatch = watchTheme((colors) => {
      view.current?.setColors?.(colors);
      loop.current.kick();
    }, el);
    return () => {
      ro?.disconnect();
      unwatch();
    };
  }, [status]);

  useEffect(() => {
    if (!view.current?.update) return;
    view.current.update(props);
    loop.current.kick();
  });

  // 3D first: while the scene is meant to show (3D on, not failed or lost),
  // its box carries data-gl="loading" (preparing too) and then "on", so the page can hide the
  // fallback from the start instead of flashing it before the 3D arrives
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const meant = on && status !== 'failed' && status !== 'slow' && status !== 'lost';
    if (meant) el.dataset.gl = status === 'on' ? 'on' : 'loading';
    else delete el.dataset.gl;
  }, [on, status]);

  return { wrap, status, progress, on: status === 'on', meant: on && status !== 'failed' && status !== 'slow' && status !== 'lost', view };
}
