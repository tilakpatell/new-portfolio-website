import { useEffect, useRef, useState } from 'react';
import { use3D } from '../../lib/gpu';
import { opened } from './opening';

// The map of Middle-earth behind the whole page. With a graphics chip it is
// in WebGL (./MapBackdrop3D.js): the sheet on a table, a camera gliding over
// it, following the Ring's road as the page scrolls and stepping back to the
// whole map at the end. Without one, the painted sheet lies flat and still.
//
// `opening` is the films' beginning: the map alone, with the title over it,
// before the page comes in. Any key, click, tap or scroll ends it early.

const HOLD = 3000;

// How far down the road the page has come: 0 at the top, 1 where the Ring's
// section ends, then `after` counts up to 1 over the screen that follows.
function progress() {
  const end = document.getElementById('ring');
  const full = (end ? end.getBoundingClientRect().bottom + window.scrollY : document.documentElement.scrollHeight) - window.innerHeight * 0.7;
  const y = window.scrollY;
  return { p: Math.max(0, Math.min(1, y / Math.max(1, full))), after: Math.max(0, Math.min(1, (y - full) / (window.innerHeight * 0.8))) };
}

export default function MapBackdrop({ mordor = false, opening = false, onOpened }) {
  const three = use3D();
  const gl = three.on && !three.info.software;
  const canvas = useRef(null);
  const api = useRef(null);
  const state = useRef({ mordor, opening });
  state.current = { mordor, opening };
  const done = useRef(onOpened);
  done.current = onOpened;
  const kick = useRef(() => {});
  const [on, setOn] = useState(false);

  useEffect(() => {
    let dead = false;
    let raf = 0;
    let last = 0;
    const size = () => {
      const c = canvas.current;
      if (c && api.current) api.current.resize(c.clientWidth, c.clientHeight);
    };
    const view = () => api.current?.setView({ ...progress(), mordor: state.current.mordor, whole: false });
    // draw while the camera is on its way, then stop until something changes
    const loop = (now) => {
      raf = 0;
      const a = api.current;
      if (!a || dead) return;
      const ms = last ? Math.min(50, now - last) : 16;
      last = now;
      if (a.render(ms, state.current.opening ? 0.3 : 1)) raf = requestAnimationFrame(loop);
      else last = 0;
    };
    kick.current = () => {
      view();
      if (!raf && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const fit = () => {
      size();
      kick.current();
    };
    const flat = async () => {
      // no graphics chip: the sheet itself, still
      const { mapFont, paintMap } = await import('./mapPaint');
      await mapFont();
      if (dead || !canvas.current) return;
      const sheet = paintMap(1400);
      const c = canvas.current;
      c.width = sheet.width;
      c.height = sheet.height;
      c.getContext('2d')?.drawImage(sheet, 0, 0);
      c.dataset.flat = 'true';
      setOn(true);
    };
    if (gl) {
      import('./MapBackdrop3D')
        .then(async ({ createMapBackdrop, mapFont }) => {
          await mapFont();
          // only now, and only if still wanted: a canvas has one context to give
          if (dead || !canvas.current) return;
          api.current = createMapBackdrop(canvas.current, { onLost: () => setOn(false) });
          if (import.meta.env.DEV) window.__ME__ = { ...window.__ME__, map: api.current }; // for the browser tests
          fit();
          setOn(true);
        })
        .catch(() => !dead && setOn(false));
    } else flat().catch(() => {});
    window.addEventListener('scroll', kick.current, { passive: true });
    window.addEventListener('resize', fit);
    document.addEventListener('visibilitychange', kick.current);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', kick.current);
      window.removeEventListener('resize', fit);
      document.removeEventListener('visibilitychange', kick.current);
      api.current?.dispose();
      api.current = null;
    };
  }, [gl]);

  // Mordor, or the opening ending: the camera has somewhere new to go
  useEffect(() => {
    kick.current();
  }, [mordor, opening]);

  // the opening: hold on the map, then let the page in
  useEffect(() => {
    if (!opening) return undefined;
    const end = () => {
      opened();
      done.current?.();
    };
    // if the map hasn't come up in a moment, don't keep the page waiting for it
    const timer = setTimeout(end, on ? HOLD : 1800);
    const skip = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    skip.forEach((e) => window.addEventListener(e, end, { passive: true, once: true }));
    return () => {
      clearTimeout(timer);
      skip.forEach((e) => window.removeEventListener(e, end));
    };
  }, [opening, on]);

  return (
    <div className="me-atlas" data-on={on || undefined} data-opening={(opening && on) || undefined} aria-hidden="true">
      <canvas ref={canvas} />
      {opening && on && (
        <div className="me-atlas-title">
          <p>The Third Age</p>
          <strong>Middle-earth</strong>
          <span>A map, a road, and a ring</span>
        </div>
      )}
    </div>
  );
}
