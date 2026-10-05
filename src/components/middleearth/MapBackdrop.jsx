import { useEffect, useRef, useState } from 'react';
import { use3D } from '../../lib/gpu';
import { settle } from '../../lib/settle';
import { opened } from './opening';
import { SHEET } from './mapData';

// The map of Middle-earth behind the whole page. With a graphics chip it is
// in WebGL (./MapBackdrop3D.js): the sheet on a table, a camera gliding over
// it. Without one, the painted sheet is drawn flat, and pans and zooms the
// same way. On the hub (`spot` null) it shows the whole sheet and leans
// towards the pointer; with a `spot` ([x, y] on the sheet) it flies down to
// it and stays there, close, behind the chapter.
//
// `opening` is the films' beginning: the map alone, with the title over it,
// before the page comes in. Any key, click, tap or scroll ends it early.
// `api` is a ref the hub keeps, to ask where places are on the screen
// (`api.current.project(x, y)`); `onFrame` is called after every frame drawn,
// so the hub can move its markers with the camera.

const HOLD = 3000;

// The flat sheet, for browsers without a graphics chip: drawn into the canvas
// at a scale and offset that ease towards where they should be.
function createFlat(canvas, sheet) {
  const ctx = canvas.getContext('2d');
  let W = 1;
  let H = 1;
  let ratio = 1;
  const cur = { x: SHEET.w / 2, y: SHEET.h / 2, z: 1 };
  const goal = { ...cur };
  const base = { ...cur };
  const user = { x: 0, y: 0, z: 1 };
  let hub = false;
  const apply = () => {
    const z = base.z * (hub ? user.z : 1);
    [goal.x, goal.y] = clampView(base.x + (hub ? user.x : 0), base.y + (hub ? user.y : 0), z);
    goal.z = z;
  };
  let first = true;
  const scale = () => Math.max(W / SHEET.w, H / SHEET.h) * cur.z;
  const clampView = (x, y, z) => {
    const s = Math.max(W / SHEET.w, H / SHEET.h) * z;
    const hw = W / s / 2;
    const hh = H / s / 2;
    return [Math.min(SHEET.w - hw, Math.max(hw, x)), Math.min(SHEET.h - hh, Math.max(hh, y))];
  };
  return {
    setView({ at = null, zoom = null, alive = false }) {
      // `zoom` is the 3D camera's height (smaller is closer): turn it round
      base.z = zoom != null ? 2.75 / zoom : at ? 2.6 : 1.08;
      [base.x, base.y] = at || [SHEET.w / 2, SHEET.h / 2];
      hub = !at && alive;
      apply();
    },
    // the visitor's hands: drag and zoom (on the map itself only)
    panBy(dx, dy) {
      const s = scale();
      user.x -= dx / s;
      user.y -= dy / s;
      apply();
      // a pan past the edge goes no further
      user.x = goal.x - base.x;
      user.y = goal.y - base.y;
      first = true;
    },
    zoomBy(f) {
      user.z = Math.max(1, Math.min(3.2, user.z / f));
      apply();
      first = true;
    },
    resize(w, h) {
      ratio = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(1, w);
      H = Math.max(1, h);
      canvas.width = Math.round(W * ratio);
      canvas.height = Math.round(H * ratio);
      first = true;
    },
    project(x, y) {
      const s = scale();
      return { x: W / 2 + (x - cur.x) * s, y: H / 2 + (y - cur.y) * s, on: true };
    },
    unproject(sx, sy) {
      const s = scale();
      return { x: cur.x + (sx - W / 2) / s, y: cur.y + (sy - H / 2) / s };
    },
    render(ms = 16) {
      const k = 1 - Math.exp(-3 * Math.min(0.05, ms / 1000));
      const far = Math.abs(goal.x - cur.x) + Math.abs(goal.y - cur.y) + Math.abs(goal.z - cur.z) * 200;
      if (!first && far < 0.05) return false;
      first = false;
      cur.x += (goal.x - cur.x) * k;
      cur.y += (goal.y - cur.y) * k;
      cur.z += (goal.z - cur.z) * k;
      const s = scale() * ratio;
      const sx = sheet.width / SHEET.w;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#1a110a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(s / sx, 0, 0, s / sx, (W * ratio) / 2 - cur.x * s, (H * ratio) / 2 - cur.y * s);
      ctx.drawImage(sheet, 0, 0);
      return true;
    },
    dispose() {},
    lost: false,
  };
}

// a dev-only way to see the WebGL map in a browser that draws in software
const forced = () => {
  try {
    return import.meta.env.DEV && window.localStorage.getItem('tp-map3d') === 'force';
  } catch {
    return false;
  }
};

export default function MapBackdrop({ spot = null, zoom = null, hover = null, mordor = false, dark = false, hub = false, opening = false, onOpened, api: outer, onFrame }) {
  const three = use3D();
  const gl = three.on && (!three.info.software || forced());
  const canvas = useRef(null);
  const api = useRef(null);
  const state = useRef({});
  state.current = { spot, zoom, hover, mordor, dark, hub, opening };
  const lean = useRef([0, 0]);
  const done = useRef(onOpened);
  done.current = onOpened;
  const frame = useRef(onFrame);
  frame.current = onFrame;
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
    const view = () => {
      const s = state.current;
      api.current?.setView({ at: s.spot, zoom: s.zoom, hover: s.hover, mordor: s.mordor, dark: s.dark, alive: s.hub, lean: s.hub ? lean.current : [0, 0] });
    };
    // draw while the camera is on its way, then stop until something changes
    const loop = (now) => {
      raf = 0;
      const a = api.current;
      if (!a || dead) return;
      const ms = last ? Math.min(50, now - last) : 16;
      last = now;
      if (a.render(ms, state.current.opening ? 0.3 : 1)) {
        frame.current?.();
        raf = requestAnimationFrame(loop);
      } else last = 0;
    };
    kick.current = () => {
      view();
      if (!raf && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const fit = () => {
      size();
      kick.current();
    };
    const ready = (a) => {
      api.current = a;
      if (outer) outer.current = a;
      if (import.meta.env.DEV) window.__ME__ = { ...window.__ME__, map: a }; // for the browser tests
      fit();
      setOn(true);
    };
    const flat = async () => {
      // no graphics chip: the sheet itself, drawn flat
      const { mapFont, paintMap } = await import('./mapPaint');
      await mapFont();
      if (dead || !canvas.current) return;
      canvas.current.dataset.flat = 'true';
      ready(createFlat(canvas.current, paintMap(2048)));
    };
    if (gl) {
      import('./MapBackdrop3D')
        .then(async ({ createMapBackdrop, mapFont }) => {
          await mapFont();
          // only now, and only if still wanted: a canvas has one context to give
          if (dead || !canvas.current) return;
          const a = createMapBackdrop(canvas.current, { onLost: () => setOn(false) });
          // its shaders link in the background (the page's own map meanwhile),
          // so its first frame doesn't stop the page
          await settle(a.ready);
          if (dead || a.lost) return a.dispose();
          ready(a);
        })
        .catch(() => !dead && setOn(false));
    } else flat().catch(() => {});
    // anything the visitor does to the map wakes the loop
    const onMove = () => kick.current();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', fit);
    document.addEventListener('visibilitychange', kick.current);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', fit);
      document.removeEventListener('visibilitychange', kick.current);
      api.current?.dispose();
      api.current = null;
      if (outer) outer.current = null;
    };
    // `outer` is a ref, the same one throughout
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  // somewhere new to go: a place, the hub, Mordor, the dark, the opening ending
  useEffect(() => {
    kick.current();
  }, [spot, zoom, hover, mordor, dark, hub, opening]);

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
    <div className="me-atlas" data-on={on || undefined} data-hub={hub || undefined} data-opening={(opening && on) || undefined} aria-hidden="true">
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
