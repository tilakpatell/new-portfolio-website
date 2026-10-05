import { useEffect, useRef, useState } from 'react';
import { use3D } from '../../lib/gpu';
import { prefersReducedMotion } from '../../lib/hooks';
import { runSwirl } from './swirl';

// A portal, wherever the site wants one: the show's swirl from ./swirl.js on
// a plain WebGL canvas (only made once it's near the screen), or a CSS swirl
// where 3D is off or WebGL won't start. It swirls open when it first
// appears; each new `shot` snaps it shut and opens it again.

// a little past full, then back: the goo settling
const settle = (k) => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2;

export default function PortalSwirl({ shot = 0, size = [0.3, 0.42], seed = 0, className = '' }) {
  const { on } = use3D();
  const [failed, setFailed] = useState(false);
  const box = useRef(null);
  const fired = useRef({ n: shot, at: -1 });
  const opts = useRef({ size, seed });
  opts.current = { size, seed };

  useEffect(() => {
    if (fired.current.n !== shot) fired.current = { n: shot, at: performance.now() };
  }, [shot]);

  useEffect(() => {
    if (!on) return undefined;
    const el = box.current;
    if (!el) return undefined;
    let run = null;
    let canvas = null;
    const start = () => {
      // a plain canvas of its own each time (./swirl.js copies the swirl onto
      // it from the one WebGL context all the page's portals share)
      canvas = document.createElement('canvas');
      el.append(canvas);
      const calm = prefersReducedMotion();
      const t0 = performance.now();
      const open = (now) => {
        if (calm) return 1;
        const born = settle(Math.min(1, (now - t0) / 900));
        const since = (now - fired.current.at) / 1000;
        if (fired.current.at < 0 || since > 0.75) return born;
        return born * (since < 0.22 ? 1 - since / 0.22 : settle(Math.min(1, (since - 0.22) / 0.53)));
      };
      // (the shader failing to link turns up a frame or so later)
      const onFail = () => {
        run?.stop();
        run = null;
        canvas?.remove();
        setFailed(true);
      };
      run = runSwirl(canvas, { ...opts.current, open, calm, onFail });
      if (!run) {
        canvas.remove();
        setFailed(true);
      }
    };
    let io = null;
    if (typeof IntersectionObserver === 'undefined') start();
    else {
      io = new IntersectionObserver(
        ([e]) => {
          if (!e.isIntersecting) return;
          io.disconnect();
          start();
        },
        { rootMargin: '300px' },
      );
      io.observe(el);
    }
    return () => {
      io?.disconnect();
      run?.stop();
      canvas?.remove();
    };
  }, [on]);

  return on && !failed ? <div ref={box} className={`portal-gl ${className}`} aria-hidden="true" /> : <div key={shot} className={`portal-css ${className}`} aria-hidden="true" />;
}
