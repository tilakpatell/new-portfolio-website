import { useEffect, useRef, useState } from 'react';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

export function useReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

// Visible-in-viewport flag. `once` keeps it true after the first sighting.
export function useInView({ once = false, rootMargin = '0px 0px -10% 0px', threshold = 0 } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { rootMargin, threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, rootMargin, threshold]);
  return [ref, inView];
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | Tilak Patel` : 'Tilak Patel | Software Engineer';
  }, [title]);
}

// Runs `tick(dt, now)` every animation frame while `active`; pauses when the tab is hidden.
export function useFrameLoop(tick, active) {
  const tickRef = useRef(tick);
  tickRef.current = tick;
  useEffect(() => {
    if (!active) return undefined;
    let raf = 0;
    let last = 0;
    const loop = (now) => {
      const dt = last ? Math.min(50, now - last) : 16;
      last = now;
      tickRef.current(dt, now);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!raf && !document.hidden) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVis = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [active]);
}

// Steps through a scripted sequence on a timer while `active` (for the project stages).
export function useScript(steps, active, { loop = true } = {}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const step = steps[index];
    if (!step) return undefined;
    const t = setTimeout(() => {
      setIndex((i) => (i + 1 < steps.length ? i + 1 : loop ? 0 : i));
    }, step.ms);
    return () => clearTimeout(t);
  }, [index, active, steps, loop]);
  return [index, setIndex];
}

export const storage = {
  get(key, fallback = null) {
    try {
      const v = window.sessionStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  },
};
