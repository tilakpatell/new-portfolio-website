import { useEffect, useRef, useState } from 'react';
import { use3D } from '../../../lib/gpu';
import { prefersReducedMotion } from '../../../lib/hooks';
import { Cybertron as Skyline } from '../../worlds/Backdrops';
import './backdrop.css';

// The city behind the Cybertron page: Iacon for the Autobots, Kaon for the
// Decepticons. With a graphics chip it is in WebGL (./CybertronBackdrop3D.js),
// fixed behind the whole page: the camera glides up the boulevard toward the
// Hall of Records as the page scrolls, and climbs over the city by the end.
// Changing sides re-lights it, and the citadel of Kaon rises where the Hall
// stood. Without a chip (or with WebGL in software), the skyline in SVG.
//
// It is strongest behind the hero and quieter behind the sections below it,
// so the text stays easy to read: the --cy-quiet scrim in ./backdrop.css.

// in development, tp-gl-force=hard draws the city even on software WebGL
// (for checking the picture in a headless browser)
const forced = () => {
  try {
    return import.meta.env.DEV && window.localStorage.getItem('tp-gl-force') === 'hard';
  } catch {
    return false;
  }
};

// 0 at the top of the page, 1 at the bottom
const progress = () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.max(0, Math.min(1, window.scrollY / max)) : 0;
};

const isDark = () => document.documentElement.dataset.mode === 'dark';

export default function CybertronBackdrop({ side = 'autobot' }) {
  const three = use3D();
  const gl = three.on && (!three.info.software || forced());
  const wrap = useRef(null);
  const canvas = useRef(null);
  const api = useRef(null);
  const sideRef = useRef(side);
  sideRef.current = side;
  const kick = useRef(() => {});
  const [on, setOn] = useState(false);
  const [failed, setFailed] = useState(false);
  const flat = !gl || failed;

  // the scrim: none behind the hero, most of the way once past it
  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    let raf = 0;
    const set = () => {
      raf = 0;
      const hero = el.nextElementSibling;
      const h = hero ? hero.getBoundingClientRect().height : window.innerHeight;
      const k = Math.max(0, Math.min(1, (window.scrollY - h * 0.25) / (h * 0.6)));
      el.style.setProperty('--cy-quiet', k.toFixed(3));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(set);
    };
    set();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  useEffect(() => {
    if (flat) return undefined;
    let dead = false;
    let raf = 0;
    let last = 0;
    let drawn = 0;
    let dirty = true;
    // frame pacing, to step quality down if the GPU can't keep up
    const perf = { warm: 40, acc: 0, n: 0 };
    let slow = false;

    const size = () => {
      const c = canvas.current;
      if (c && api.current) api.current.resize(c.clientWidth, c.clientHeight);
    };
    // the camera moves while it catches up with the page; the traffic flies
    // as long as nobody has asked for less motion. Idle, it draws at 30 fps.
    const loop = (now) => {
      raf = 0;
      const a = api.current;
      if (!a || dead || document.hidden) {
        last = 0;
        return;
      }
      const ms = last ? Math.min(250, now - last) : 16;
      last = now;
      const calm = prefersReducedMotion() || slow;
      a.setCalm(calm);
      const busy = a.update(ms);
      if (dirty || busy || now - drawn > 31) {
        a.draw();
        drawn = now;
        dirty = false;
      }
      if (!calm && !forced()) {
        if (perf.warm > 0) perf.warm -= 1;
        else {
          perf.acc += ms;
          perf.n += 1;
          if (perf.n >= 90) {
            if (perf.acc / perf.n > 40 && !a.degrade()) slow = true;
            perf.acc = 0;
            perf.n = 0;
          }
        }
      }
      if (busy || !calm) raf = requestAnimationFrame(loop);
      else last = 0;
    };
    kick.current = () => {
      const a = api.current;
      if (!a) return;
      a.setProgress(progress());
      a.setDark(isDark());
      a.setSide(sideRef.current === 'decepticon' ? 1 : 0);
      dirty = true;
      if (!raf && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const fit = () => {
      size();
      kick.current();
    };

    import('./CybertronBackdrop3D')
      .then(({ createCybertronBackdrop }) => {
        if (dead || !canvas.current) return null;
        return createCybertronBackdrop(canvas.current, {
          side: sideRef.current === 'decepticon' ? 1 : 0,
          dark: isDark(),
          calm: prefersReducedMotion(),
          onLost: () => !dead && setFailed(true),
        });
      })
      .then((a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        a.setProgress(progress());
        if (import.meta.env.DEV) window.__CY__ = a; // for the browser tests
        fit();
        setOn(true);
      })
      .catch((e) => {
        if (import.meta.env.DEV) console.warn('The city behind the page could not be drawn:', e);
        if (!dead) setFailed(true);
      });

    // light or dark mode: the city by day or by night
    const modes = new MutationObserver(() => kick.current());
    modes.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onScroll = () => kick.current();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', fit);
    document.addEventListener('visibilitychange', onScroll);
    motion?.addEventListener?.('change', onScroll);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      modes.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', fit);
      document.removeEventListener('visibilitychange', onScroll);
      motion?.removeEventListener?.('change', onScroll);
      kick.current = () => {};
      api.current?.dispose();
      api.current = null;
      if (import.meta.env.DEV && window.__CY__) delete window.__CY__;
    };
  }, [flat]);

  // changing sides: the city re-lights over a second
  useEffect(() => {
    kick.current();
  }, [side]);

  return (
    <div ref={wrap} className="cy-world" data-on={on || flat || undefined} data-flat={flat || undefined} data-side={side} aria-hidden="true">
      {flat ? <Skyline faction={side} className="cy-world-skyline" /> : <canvas ref={canvas} />}
    </div>
  );
}
