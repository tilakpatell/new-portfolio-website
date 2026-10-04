import { useEffect, useRef, useState } from 'react';
import { useFrameLoop } from '../../../lib/hooks';

// The 3D room, as a canvas that fills its box. Three.js and the scene load
// only when this mounts; it draws `live` every frame while `active`, and
// reports how it's going: loading, on, slow (still on, at its lowest
// settings), lost (the graphics chip reset) or failed.
export default function View3D({ live, active, onState, onFrame }) {
  const canvas = useRef(null);
  const api = useRef(null);
  const [state, setState] = useState('loading');
  const report = useRef(onState);
  report.current = onState;
  const frame = useRef(onFrame);
  frame.current = onFrame;

  useEffect(() => {
    report.current?.(state);
  }, [state]);

  useEffect(() => {
    let dead = false;
    const fail = (why) => {
      api.current?.dispose();
      api.current = null;
      if (!dead) setState(why);
    };
    const fit = () => {
      const c = canvas.current;
      if (!c || !api.current) return;
      const r = c.getBoundingClientRect();
      api.current.resize(Math.round(r.width), Math.round(r.height));
    };
    import('./scene')
      .then(({ createMetherria3D }) => {
        if (dead || !canvas.current) return;
        try {
          api.current = createMetherria3D(canvas.current, { onLost: () => fail('lost'), onSlow: () => !dead && setState('slow') });
          if (import.meta.env.DEV) window.__METH_GL__ = api.current; // renderer counts for the QA scripts
          fit();
          setState('on');
        } catch {
          fail('failed');
        }
      })
      .catch(() => fail('failed'));
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (canvas.current) ro?.observe(canvas.current);
    window.addEventListener('resize', fit);
    return () => {
      dead = true;
      ro?.disconnect();
      window.removeEventListener('resize', fit);
      api.current?.dispose();
      api.current = null;
    };
  }, []);

  useFrameLoop((ms) => {
    const a = api.current;
    if (!a || a.lost) return;
    try {
      a.render(live.current, ms);
      frame.current?.(a);
    } catch {
      // a driver that falls over mid-shift: say so, and let them retry
      a.dispose();
      api.current = null;
      setState('failed');
    }
  }, active && (state === 'on' || state === 'slow'));

  return <canvas ref={canvas} className="wm-canvas" data-on={state === 'on' || state === 'slow' || undefined} aria-hidden="true" />;
}
