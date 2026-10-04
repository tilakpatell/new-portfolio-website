import { useEffect, useRef, useState } from 'react';
import { RiAddLine, RiArrowGoBackLine, RiArrowLeftSLine, RiArrowRightSLine, RiSubtractLine } from 'react-icons/ri';
import { STAFF } from './layout';

// The office in 3D, over the 2D map it replaces: the same people, as pins
// that follow their desks (real buttons, so the keyboard and screen readers
// use it as they use the map). Drag to look round it, or use the controls.
// `onState` hears 'loading', 'on', or why it gave up ('failed' or 'lost'),
// so the map can come back.

// Push overlapping pins apart (a few passes of pairwise separation).
function declutter(list, gap) {
  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= gap) continue;
        const push = (gap - d) / 2 + 0.5;
        const ux = d > 0.01 ? dx / d : 1;
        const uy = d > 0.01 ? dy / d : 0;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
        moved = true;
      }
    if (!moved) break;
  }
}

const initials = (name) =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('');

export default function OfficeTour3D({ sel, onPick, onState }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const tour = useRef(null);
  const pins = useRef(new Map());
  const raf = useRef(0);
  const kickRef = useRef(() => {});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dead = false;
    let last = 0;
    const loop = (now) => {
      const t = tour.current;
      if (!t) return;
      const ms = last ? now - last : 16;
      last = now;
      const more = t.render(ms);
      // pins follow their desks, smaller from further away, nudged apart where
      // desks back onto each other so every one can be pressed
      const list = t.anchors().filter((a) => a.front);
      const size = Math.max(22, Math.min(34, 34 * t.closeness));
      declutter(list, size + 3);
      const shown = new Set(list.map((a) => a.id));
      for (const [id, el] of pins.current) {
        const a = list.find((q) => q.id === id);
        el.style.visibility = shown.has(id) ? 'visible' : 'hidden';
        if (!a) continue;
        el.style.width = el.style.height = `${size}px`;
        el.style.fontSize = `${Math.round(size * 0.34)}px`;
        el.style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      }
      raf.current = more ? requestAnimationFrame(loop) : 0;
      if (!more) last = 0;
    };
    const kick = () => {
      if (!raf.current && tour.current) raf.current = requestAnimationFrame(loop);
    };
    kickRef.current = kick;
    onState?.('loading');
    const give = (why) => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      tour.current?.dispose();
      tour.current = null;
      if (!dead) onState?.(why);
    };
    import('./Tour3D')
      .then(({ createTour3D }) => createTour3D(canvas.current, { onLost: () => give('lost'), onChange: () => kickRef.current() }))
      .then((t) => {
        if (dead) {
          t.dispose();
          return;
        }
        tour.current = t;
        if (import.meta.env.DEV) window.__TOUR__ = t; // for the browser tests
        const r = wrap.current.getBoundingClientRect();
        t.resize(r.width, r.height);
        t.focus(sel, { move: false }); // open on the whole office
        setReady(true);
        onState?.('on');
        kick();
      })
      .catch(() => give('failed'));
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
      const r = wrap.current?.getBoundingClientRect();
      if (r && tour.current) {
        tour.current.resize(r.width, r.height);
        kick();
      }
    }) : null;
    ro?.observe(wrap.current);
    return () => {
      dead = true;
      ro?.disconnect();
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      tour.current?.dispose();
      tour.current = null;
    };
    // built once; the selection follows below
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    tour.current?.focus(sel);
    kickRef.current();
  }, [sel]);

  // drag to look round; a click (without dragging) picks a desk
  const drag = useRef(null);
  const onDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) {
      drag.current = { x: e.clientX, y: e.clientY, moved: 0, touch: true };
      return;
    }
    drag.current = { x: e.clientX, y: e.clientY, moved: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.moved += Math.abs(dx) + Math.abs(dy);
    d.x = e.clientX;
    d.y = e.clientY;
    if (d.touch) return; // a finger scrolls the page; the buttons turn the view
    tour.current?.orbit(-dx * 0.006, -dy * 0.004, { now: true });
    kickRef.current();
  };
  const onUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved > 6) return;
    const who = tour.current?.pick(e.clientX, e.clientY);
    if (who) onPick(who);
  };
  const control = (fn) => () => {
    fn(tour.current);
    kickRef.current();
  };

  return (
    <div ref={wrap} className="office3d" data-ready={ready || undefined}>
      <canvas ref={canvas} className="office3d-canvas" aria-hidden="true" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => (drag.current = null)} />
      {!ready && <p className="office3d-loading">Setting up the office…</p>}
      <div className="office3d-pins">
        {STAFF.map((s) => (
          <button
            key={s.id}
            ref={(el) => (el ? pins.current.set(s.id, el) : pins.current.delete(s.id))}
            type="button"
            className="office-mark office3d-pin"
            aria-pressed={sel === s.id}
            aria-label={`${s.name}, ${s.role}`}
            onClick={() => onPick(s.id)}
          >
            {initials(s.name)}
          </button>
        ))}
      </div>
      <div className="office3d-controls" role="group" aria-label="View">
        <button type="button" onClick={control((t) => t?.orbit(-0.3))} aria-label="Turn left">
          <RiArrowLeftSLine aria-hidden="true" />
        </button>
        <button type="button" onClick={control((t) => t?.orbit(0.3))} aria-label="Turn right">
          <RiArrowRightSLine aria-hidden="true" />
        </button>
        <button type="button" onClick={control((t) => t?.zoom(0.75))} aria-label="Closer">
          <RiAddLine aria-hidden="true" />
        </button>
        <button type="button" onClick={control((t) => t?.zoom(1.33))} aria-label="Further">
          <RiSubtractLine aria-hidden="true" />
        </button>
        <button type="button" onClick={control((t) => t?.reset())} aria-label="The whole office">
          <RiArrowGoBackLine aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
