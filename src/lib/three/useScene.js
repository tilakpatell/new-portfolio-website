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
//   dispose()
// ctx is { el, colors, reduced, invalidate, onLost, onSlow, ...props }
// (colours as seen inside `el`, so a scene in a .dark-scope gets dark ones):
// `el` is the scene's box (for pointer events), `invalidate()` asks for frames.

import { useEffect, useRef, useState } from 'react';
import { use3D } from '../gpu';
import { useReducedMotion } from '../hooks';
import { readTheme, watchTheme } from './theme';

const DROP_AFTER = 10000; // ms far from the viewport before the scene is let go

export function useScene(load, { enabled = true, props, id = 'scene', near: nearMargin = '100% 0px 100% 0px' } = {}) {
  const wrap = useRef(null);
  const view = useRef(null);
  const three = use3D();
  const reduced = useReducedMotion();
  const [status, setStatus] = useState('idle'); // idle | loading | ready | on | failed | slow | lost
  const [near, setNear] = useState(false);
  const visible = useRef(false);
  const loop = useRef({ raf: 0, last: 0, kick: () => {} });
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
    const stop = () => {
      cancelAnimationFrame(L.raf);
      L.raf = 0;
    };
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
      L.raf = 0;
      const v = view.current;
      if (!v || !visible.current || document.hidden) return;
      const ms = L.last ? Math.min(50, now - L.last) : 16;
      L.last = now;
      let more = false;
      try {
        more = v.render(ms, now);
      } catch (err) {
        if (import.meta.env.DEV) console.error(`[${id}] 3D frame failed`, err);
        drop('failed');
        return;
      }
      if (!shown && !dead) {
        shown = true; // drawn once: now whatever it replaces can step aside
        setStatus('on');
      }
      if (more) L.raf = requestAnimationFrame(frame);
      else L.last = 0;
    };
    L.kick = () => {
      if (!L.raf && view.current && visible.current && !document.hidden) L.raf = requestAnimationFrame(frame);
    };
    const onVis = () => (document.hidden ? stop() : L.kick());
    document.addEventListener('visibilitychange', onVis);

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
            onSlow: () => drop('slow'),
          });
          if (dead) {
            v.dispose();
            return;
          }
          view.current = v;
          const r = wrap.current?.getBoundingClientRect();
          if (r) v.resize(r.width, r.height);
          v.setVisible?.(visible.current);
          setStatus('ready');
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

  return { wrap, status, on: status === 'on', view };
}
