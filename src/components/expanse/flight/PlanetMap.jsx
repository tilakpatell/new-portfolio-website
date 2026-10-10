import { useEffect, useRef } from 'react';
import { far, fitCanvas } from '../../../runtime/hud';
import { FULL_SCALES, FULL_START, bearingOf, cellAddress, compassPoint, isTap, panBy, pinchStep, poiRows, unproject, zoomStep } from './mapRules';

const REDRAW_MS = 250; // the ship, the pilots and the squares coming in; a pan draws at once

// The full planet map, a card over the world (the frame's pointer-events
// back on inside it): the loaded ground at 32, 16 or 8 m a px, panned by a
// drag or a finger, zoomed by the wheel, a pinch or the buttons; the
// planet's places on the right (under the map on a phone), each with its
// bearing and distance, 44 px rows; a tap on a place, a pilot or the ground
// sets the waypoint. Everything that moves is drawn or written through refs.
//
//   <PlanetMap spec source markers={(world) => …} waypoint onWaypoint onClose />
export default function PlanetMap({ spec, source, markers, waypoint, onWaypoint, onClose }) {
  const canvas = useRef(null);
  const close = useRef(null);
  const cell = useRef(null);
  const rows = useRef({});
  const view = useRef({ follow: true, centre: null, zoom: FULL_START, dirty: true });
  const hands = useRef({ down: new Map(), start: null, pinch: 0 });
  const places = poiRows(spec, source()?.ship ?? { x: 0, z: 0, yaw: 0 });

  useEffect(() => close.current?.focus(), []);

  useEffect(() => {
    let raf = 0;
    let last = -Infinity;
    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      const v = view.current;
      if (!v.dirty && t - last < REDRAW_MS) return;
      last = t;
      v.dirty = false;
      const w = source();
      const c = canvas.current;
      const box = fitCanvas(c);
      const ctx = box && w?.map && c.getContext('2d');
      if (!ctx) return;
      const ship = w.ship;
      if (v.follow || !v.centre) v.centre = [ship.x, ship.z];
      ctx.setTransform(box.s, 0, 0, box.s, 0, 0);
      w.map.drawFull(ctx, { ship, markers: markers(w) }, { w: box.w, h: box.h, centre: v.centre, scale: FULL_SCALES[v.zoom] });
      const text = `Cell ${cellAddress(ship.x, ship.z)}`;
      if (cell.current && cell.current.textContent !== text) cell.current.textContent = text;
      for (const p of spec.pois ?? []) {
        const el = rows.current[p.id];
        if (!el) continue;
        const b = bearingOf(ship, p.at);
        const words = `${compassPoint(b.compass)} · ${far(b.dist)}`;
        if (el.textContent !== words) el.textContent = words;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [source, markers, spec]);

  const redraw = () => (view.current.dirty = true);
  const zoom = (dir) => {
    view.current.zoom = zoomStep(view.current.zoom, dir);
    redraw();
  };
  const geometry = () => {
    const c = canvas.current;
    const v = view.current;
    return { w: c.clientWidth, h: c.clientHeight, centre: v.centre ?? [0, 0], scale: FULL_SCALES[v.zoom] };
  };
  const local = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const onDown = (e) => {
    const h = hands.current;
    canvas.current.setPointerCapture?.(e.pointerId);
    h.down.set(e.pointerId, local(e));
    if (h.down.size === 1) h.start = local(e);
    if (h.down.size === 2) {
      const [a, b] = [...h.down.values()];
      h.pinch = Math.hypot(a[0] - b[0], a[1] - b[1]);
      h.start = null;
    }
  };
  const onMove = (e) => {
    const h = hands.current;
    const was = h.down.get(e.pointerId);
    if (!was) return;
    const now = local(e);
    h.down.set(e.pointerId, now);
    const v = view.current;
    if (h.down.size === 2) {
      const [a, b] = [...h.down.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const step = pinchStep(h.pinch, d);
      if (step) {
        zoom(step);
        h.pinch = d;
      }
      return;
    }
    // (a drag: the map stops following the ship and moves with the finger)
    if (h.start && !isTap(h.start, now)) v.follow = false;
    if (!v.follow) {
      v.centre = panBy(v.centre, [now[0] - was[0], now[1] - was[1]], FULL_SCALES[v.zoom]);
      redraw();
    }
  };
  const onUp = (e) => {
    const h = hands.current;
    const at = local(e);
    const start = h.down.size === 1 ? h.start : null;
    h.down.delete(e.pointerId);
    if (!start || !isTap(start, at)) return;
    const w = source();
    if (!w) return;
    const g = geometry();
    const hit = w.map.hit(markers(w), at, g);
    if (hit && hit.kind !== 'waypoint') onWaypoint({ id: hit.id, name: hit.label, at: hit.at });
    else if (!hit) onWaypoint({ id: 'marked', name: 'Marked point', at: unproject([at[0] - g.w / 2, at[1] - g.h / 2], g) });
    redraw();
  };
  const onWheel = (e) => {
    const t = performance.now();
    // (one step a flick: a trackpad sends dozens of wheel events for one)
    if (t - (hands.current.wheel ?? 0) < 180) return;
    hands.current.wheel = t;
    zoom(e.deltaY < 0 ? 1 : -1);
  };

  return (
    <div className="fly-map" role="dialog" aria-modal="true" aria-label={`Map of ${spec.name}`}>
      <div className="fly-map-card">
        <header className="fly-map-head">
          <div>
            <p className="fly-map-eyebrow">Planet map</p>
            <h2 className="fly-map-title">{spec.name}</h2>
          </div>
          <p className="fly-map-cell" ref={cell} />
          <div className="fly-map-tools">
            <button type="button" className="fly-map-btn" onClick={() => ((view.current.follow = true), redraw())}>
              Centre on the ship
            </button>
            <button type="button" className="fly-map-btn" ref={close} onClick={onClose}>
              Close
            </button>
          </div>
        </header>
        <div className="fly-map-body">
          <div className="fly-map-view">
            <canvas ref={canvas} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={(e) => hands.current.down.delete(e.pointerId)} onWheel={onWheel} aria-label="The ground round the ship: drag to look about, tap to set a waypoint" role="img" />
            <div className="fly-map-zoom">
              <button type="button" className="fly-map-btn" onClick={() => zoom(1)} aria-label="Zoom in">
                +
              </button>
              <button type="button" className="fly-map-btn" onClick={() => zoom(-1)} aria-label="Zoom out">
                −
              </button>
            </div>
          </div>
          <aside className="fly-map-list" aria-label={`Places on ${spec.name}`}>
            <h3 className="fly-map-list-head">Places</h3>
            {places.length ? (
              <ul>
                {places.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="fly-map-place" aria-pressed={waypoint?.id === p.id} onClick={() => onWaypoint(waypoint?.id === p.id ? null : { id: p.id, name: p.name, at: p.at })}>
                      <span className="fly-map-place-name">{p.name}</span>
                      <span className="fly-map-place-way" ref={(el) => (rows.current[p.id] = el)}>
                        {p.point} · {p.far}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="fly-map-none">No named places here yet: tap the ground to mark one.</p>
            )}
            {waypoint && (
              <button type="button" className="fly-map-btn fly-map-clear" onClick={() => onWaypoint(null)}>
                Clear the waypoint
              </button>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
