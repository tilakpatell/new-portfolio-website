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
//   warmUp?(timeLeft) → bool draw everything once, out of sight, a slice at
//                            a time (made while the page is covered: see
//                            `covered` below); true once it's done
//   prepare?(onProgress, { alive, frame }) → Promise
//                            everything sent to the graphics chip before the
//                            first frame (lib/three/gpuWork's prepareScene),
//                            covered or not: the hook says 'preparing' with
//                            its progress meanwhile, for the page's loading
//                            screen (components/worlds/LoadingVeil); while
//                            the page is covered it goes on only when the
//                            page is idle
//   dispose()
//   ready?                   a promise: its shaders are compiled (see
//                            lib/three/renderer's precompile); the first
//                            frame waits for it (READY_WAIT at most)
// ctx is { el, colors, reduced, invalidate, onLost, onSlow, ...props }
// (colours as seen inside `el`, so a scene in a .dark-scope gets dark ones):
// `el` is the scene's box (for pointer events), `invalidate()` asks for frames.

import { useEffect, useRef, useState } from 'react';
import { use3D } from '../gpu';
import { useReducedMotion } from '../hooks';
import { settle } from '../settle';
import { nextFrame } from './gpuWork';
import { createLoop } from './loop';
import { readTheme, watchTheme } from './theme';

const DROP_AFTER = 10000; // ms far from the viewport before the scene is let go
const READY_WAIT = 4000; // ms at most a scene's `ready` holds back its first frame

// Something full screen over the whole page (the opening crawl, the cockpit)
// sets html[data-covered]: scenes underneath stay made but draw nothing until
// it's gone (App sends tp:uncover then). One made meanwhile warms up, out of
// sight, a slice at a time while the page is idle (its warmUp), so its first
// frame as it's uncovered (the cockpit's flash, for the universe) doesn't
// stop to send everything to the graphics chip.
// (and under a tour's card in the middle, html[data-tour-still]: nothing lit to watch)
const covered = () => typeof document !== 'undefined' && ('covered' in document.documentElement.dataset || 'tourStill' in document.documentElement.dataset);
// fn(timeLeft) when the page has a moment; timeLeft() is the ms it can spare
const whenIdle = (fn) => {
  if (typeof requestIdleCallback === 'function') return requestIdleCallback((deadline) => fn(() => deadline.timeRemaining()), { timeout: 500 });
  return setTimeout(() => {
    const t = performance.now();
    fn(() => Math.max(0, 12 - (performance.now() - t)));
  }, 50);
};
// a prepare's next step: the next frame, or while covered the next idle moment
const prepFrame = () => (covered() ? new Promise((resolve) => whenIdle(() => resolve())) : nextFrame());

export function useScene(load, { enabled = true, props, id = 'scene', near: nearMargin = '100% 0px 100% 0px' } = {}) {
  const wrap = useRef(null);
  const view = useRef(null);
  const three = use3D();
  const reduced = useReducedMotion();
  const [status, setStatus] = useState('idle'); // idle | loading | preparing | ready | on | failed | slow | lost
  const [progress, setProgress] = useState({ value: 0, step: 'load' });
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
    if (!on || !near || failed.current) {
      setStatus((s) => (s === 'failed' || s === 'slow' || s === 'lost' ? s : 'idle'));
      return undefined;
    }
    let dead = false;
    let shown = false;
    const L = loop.current;
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
          // everything sent to the graphics chip before it's first seen
          if (v.prepare) {
            setStatus('preparing');
            let shown = { value: -1, step: '' };
            const report = (value, step) => {
              // (a step's change, or a percent's worth: the page re-renders no more than that)
              if (step === shown.step && value - shown.value < 0.01 && value < 1) return;
              shown = { value, step };
              if (!dead) setProgress(shown);
            };
            try {
              await v.prepare(report, { alive: () => !dead && !failed.current, frame: prepFrame });
            } catch (err) {
              if (import.meta.env.DEV) console.warn(`[${id}] prepare failed`, err);
            }
            if (dead || failed.current) {
              v.dispose();
              return;
            }
            v.update?.(propsRef.current);
          }
          view.current = v;
          v.setVisible?.(visible.current);
          setStatus('ready');
          if (v.warmUp && !v.prepare && covered()) {
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
      L.kick = () => {};
      release();
    };
    // `reduced` is read at creation; a change mid-visit re-creates the scene
  }, [on, near, id, reduced, attempt]);

  // its size, its colours and the page's props, without re-rendering anything
  useEffect(() => {
    const el = wrap.current;
    if (!el || status === 'idle' || status === 'loading') return undefined;
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
  // its box carries data-gl="loading" and then "on", so the page can hide the
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
