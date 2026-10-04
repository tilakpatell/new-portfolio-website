// A game's 3D view, made only when it's needed: it loads when the game comes
// within a screen or so of the viewport (and 3D is on), draws only while it's
// on screen, and lets its GPU memory go once it's been far away for a while,
// so a page of seven games never holds seven contexts it isn't using.
import { useCallback, useEffect, useRef, useState } from 'react';

const DROP_AFTER = 8000; // ms far from the viewport before the view is let go

export function useStage(load, { enabled, id, forced = false }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const view = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | loading | on | failed | slow | lost
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const failed = useRef(false); // a view that failed stays failed until a retry
  const loadRef = useRef(load);
  loadRef.current = load;
  // a visitor who switched 3D on keeps it on, however slow: quality drops instead
  const forcedRef = useRef(forced);
  forcedRef.current = forced;

  // near the viewport (make it), and on screen (draw it)
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      setVisible(true);
      return undefined;
    }
    let dropTimer = 0;
    const nearIO = new IntersectionObserver(
      ([e]) => {
        clearTimeout(dropTimer);
        if (e.isIntersecting) setNear(true);
        else dropTimer = setTimeout(() => setNear(false), DROP_AFTER);
      },
      { rootMargin: '120% 0px 120% 0px' },
    );
    const seenIO = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.12 });
    nearIO.observe(el);
    seenIO.observe(el);
    return () => {
      clearTimeout(dropTimer);
      nearIO.disconnect();
      seenIO.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!enabled || !near || failed.current) {
      setStatus((s) => (s === 'on' || s === 'loading' ? 'idle' : s));
      return undefined;
    }
    let dead = false;
    const drop = (why) => {
      view.current?.dispose();
      view.current = null;
      failed.current = true;
      if (!dead) setStatus(why);
    };
    setStatus('loading');
    loadRef
      .current()
      .then(async (mod) => {
        if (dead || !canvas.current) return;
        try {
          const v = await mod.create(canvas.current, { onLost: () => drop('lost'), onSlow: () => !forcedRef.current && drop('slow') });
          if (dead) {
            v.dispose();
            return;
          }
          view.current = v;
          const r = wrap.current?.querySelector('.hq-screen')?.getBoundingClientRect();
          if (r) v.resize(r.width, r.height);
          setStatus('on');
        } catch (err) {
          if (import.meta.env.DEV) console.error(`[${id}] 3D failed`, err);
          drop('failed');
        }
      })
      .catch(() => drop('failed'));
    return () => {
      dead = true;
      view.current?.dispose();
      view.current = null;
    };
  }, [enabled, near, attempt, id]);

  // keep the view the size of its screen
  useEffect(() => {
    const el = wrap.current?.querySelector('.hq-screen');
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => view.current?.resize(e.contentRect.width, e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [status]);

  const retry = useCallback(() => {
    failed.current = false;
    setStatus('idle');
    setAttempt((n) => n + 1);
  }, []);

  return { wrap, canvas, view, status, near, visible, retry };
}

// For the browser checks: each game, its state and its view, in development.
export function register(id, api) {
  if (!import.meta.env.DEV || typeof window === 'undefined') return () => {};
  window.__HQ__ = window.__HQ__ ?? {};
  window.__HQ__[id] = api;
  return () => {
    if (window.__HQ__?.[id] === api) delete window.__HQ__[id];
  };
}
