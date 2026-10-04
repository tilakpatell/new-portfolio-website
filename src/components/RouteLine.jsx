import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../lib/hooks';

// The scroll-drawn connector that runs down every page. Each [data-waypoint]
// inside the container is a stop; the line routes between stops with rounded
// right-angle turns and draws itself up to a point 60% down the viewport.
//
// Performance: the route is built from small absolutely-positioned pieces.
// Scrolling only changes a transform on the piece being drawn and moves the
// kyber-crystal head — no layout reads and no large repaints per frame.
//
// Waypoint attributes:
//   data-node="false"     no node at this stop (a pure corner)
//   data-node-color="#…"  node colour when lit (defaults to the theme accent)
//   data-trigger="-120"   draw-trigger offset in px (spreads a horizontal run over scroll)

const HEAD_AT = 0.6;
const TURN_GAP = 56;
const RADIUS = 18;
const HALF_PI = Math.PI / 2;

function build(points) {
  const segs = [];
  let len = 0;
  const lens = [0];
  const push = (seg) => {
    if (seg.len <= 0.01) return;
    seg.start = len;
    len += seg.len;
    segs.push(seg);
  };
  const line = (x0, y0, x1, y1) => {
    if (Math.abs(x1 - x0) < 0.5) push({ kind: 'v', x: x0, y0, y1, len: Math.abs(y1 - y0) });
    else push({ kind: 'h', y: y0, x0, x1, len: Math.abs(x1 - x0) });
  };
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) < 1) line(a.x, a.y, a.x, b.y);
    else if (Math.abs(dy) < 1) line(a.x, a.y, b.x, a.y);
    else if (dy < 0) {
      line(a.x, a.y, b.x, a.y);
      line(b.x, a.y, b.x, b.y);
    } else {
      const dir = Math.sign(dx);
      const ym = b.y - Math.min(TURN_GAP, dy / 2);
      const r = Math.max(0, Math.min(RADIUS, Math.abs(dx) / 2, ym - a.y, b.y - ym));
      const arcLen = r * HALF_PI;
      line(a.x, a.y, a.x, ym - r);
      push({ kind: 'arc', cx: a.x + dir * r, cy: ym - r, r, t0: dir > 0 ? Math.PI : 0, t1: HALF_PI, sweep: dir > 0 ? 0 : 1, len: arcLen });
      line(a.x + dir * r, ym, b.x - dir * r, ym);
      push({ kind: 'arc', cx: b.x - dir * r, cy: ym + r, r, t0: -HALF_PI, t1: dir > 0 ? 0 : -Math.PI, sweep: dir > 0 ? 1 : 0, len: arcLen });
      line(b.x, ym + r, b.x, b.y);
    }
    lens.push(len);
  }
  return { segs, total: len, lens };
}

function pointOn(seg, d) {
  if (seg.kind === 'v') return { x: seg.x, y: seg.y0 + Math.sign(seg.y1 - seg.y0) * d };
  if (seg.kind === 'h') return { x: seg.x0 + Math.sign(seg.x1 - seg.x0) * d, y: seg.y };
  const t = seg.t0 + (seg.t1 - seg.t0) * (d / seg.len);
  return { x: seg.cx + seg.r * Math.cos(t), y: seg.cy + seg.r * Math.sin(t) };
}

function arcPath(seg, ox, oy) {
  const p0 = pointOn(seg, 0);
  const p1 = pointOn(seg, seg.len);
  return `M ${p0.x - ox} ${p0.y - oy} A ${seg.r} ${seg.r} 0 0 ${seg.sweep} ${p1.x - ox} ${p1.y - oy}`;
}

export default function RouteLine({ containerRef }) {
  const [geo, setGeo] = useState(null);
  const geoRef = useRef(null);
  const doneRefs = useRef([]);
  const nodeRefs = useRef([]);
  const kyberRef = useRef(null);
  const state = useRef({ f: [], lit: [], top: 0 });
  const reduced = useRef(prefersReducedMotion());

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const stops = [...el.querySelectorAll('[data-waypoint]')].filter((n) => n.offsetParent !== null);
    if (stops.length < 2) {
      setGeo(null);
      return;
    }
    const points = stops.map((n) => {
      const r = n.getBoundingClientRect();
      return {
        x: Math.round(r.left + r.width / 2 - box.left),
        y: Math.round(r.top + r.height / 2 - box.top),
        node: n.dataset.node !== 'false',
        color: n.dataset.nodeColor || null,
        trigger: Number(n.dataset.trigger || 0),
      };
    });
    const route = build(points);
    const triggers = [];
    points.forEach((p, i) => {
      const t = p.y + p.trigger;
      triggers.push(i === 0 ? t : Math.max(t, triggers[i - 1] + 1));
    });
    state.current = { f: [], lit: [], top: box.top + window.scrollY };
    setGeo({ ...route, points, triggers, height: Math.ceil(el.scrollHeight) });
  }, [containerRef]);

  const update = useCallback(() => {
    const g = geoRef.current;
    if (!g) return;
    const s = state.current;
    let L = g.total;
    if (!reduced.current) {
      const headY = window.scrollY + window.innerHeight * HEAD_AT - s.top;
      const t = g.triggers;
      if (headY <= t[0]) L = 0;
      else if (headY < t[t.length - 1]) {
        let i = 0;
        while (i < t.length - 2 && headY >= t[i + 1]) i++;
        L = g.lens[i] + ((headY - t[i]) / (t[i + 1] - t[i])) * (g.lens[i + 1] - g.lens[i]);
      }
    }
    let head = null;
    g.segs.forEach((seg, i) => {
      const f = Math.max(0, Math.min(1, (L - seg.start) / seg.len));
      if (f > 0 && f < 1) head = pointOn(seg, f * seg.len);
      if (s.f[i] === f) return;
      s.f[i] = f;
      const el = doneRefs.current[i];
      if (!el) return;
      if (seg.kind === 'arc') el.style.strokeDashoffset = String(seg.len * (1 - f));
      else el.style.transform = seg.kind === 'v' ? `scaleY(${f})` : `scaleX(${f})`;
    });
    g.points.forEach((p, i) => {
      const lit = L >= g.lens[i] - 0.5;
      if (s.lit[i] === lit) return;
      s.lit[i] = lit;
      const el = nodeRefs.current[i];
      if (el) el.dataset.lit = lit ? 'true' : 'false';
    });
    const k = kyberRef.current;
    if (k) {
      if (!head && L > 0 && L < g.total) {
        const seg = g.segs.find((sg) => L >= sg.start && L <= sg.start + sg.len);
        if (seg) head = pointOn(seg, L - seg.start);
      }
      k.style.opacity = head ? '1' : '0';
      if (head) k.style.transform = `translate3d(${head.x}px, ${head.y}px, 0)`;
    }
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    ro?.observe(el);
    // A phone's toolbar sliding in and out as you scroll resizes the window's
    // height only; the route doesn't change, so only a new width re-measures
    // (the observer above still catches the page itself changing size).
    let width = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      schedule();
    };
    window.addEventListener('resize', onResize);
    document.fonts?.ready?.then(schedule).catch(() => {});
    const late = setTimeout(schedule, 1000);
    return () => {
      cancelAnimationFrame(frame);
      ro?.disconnect();
      window.removeEventListener('resize', onResize);
      clearTimeout(late);
    };
  }, [containerRef, measure]);

  useEffect(() => {
    geoRef.current = geo;
    update();
  }, [geo, update]);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, [update]);

  if (!geo) return null;

  return (
    <div className="route" style={{ height: geo.height }} aria-hidden="true">
      {geo.segs.map((seg, i) => {
        if (seg.kind === 'arc') {
          const ox = seg.cx - seg.r - 2;
          const oy = seg.cy - seg.r - 2;
          const d = arcPath(seg, ox, oy);
          const size = seg.r * 2 + 4;
          return (
            <svg key={i} className="route-arc" style={{ left: ox, top: oy }} width={size} height={size}>
              <path className="plan" d={d} />
              <path
                ref={(n) => (doneRefs.current[i] = n)}
                className="done"
                d={d}
                style={{ strokeDasharray: `${seg.len} ${seg.len}`, strokeDashoffset: seg.len }}
              />
            </svg>
          );
        }
        if (seg.kind === 'v') {
          const top = Math.min(seg.y0, seg.y1);
          const rev = seg.y1 < seg.y0;
          return (
            <Fragment key={i}>
              <div className="route-seg route-plan v" style={{ left: seg.x - 0.5, top, height: seg.len }} />
              <div
                ref={(n) => (doneRefs.current[i] = n)}
                className="route-seg route-done v"
                style={{ left: seg.x - 1, top, height: seg.len, transformOrigin: rev ? '0 100%' : '0 0' }}
              />
            </Fragment>
          );
        }
        const left = Math.min(seg.x0, seg.x1);
        const rev = seg.x1 < seg.x0;
        return (
          <Fragment key={i}>
            <div className="route-seg route-plan h" style={{ left, top: seg.y - 0.5, width: seg.len }} />
            <div
              ref={(n) => (doneRefs.current[i] = n)}
              className="route-seg route-done h"
              style={{ left, top: seg.y - 1, width: seg.len, transformOrigin: rev ? '100% 0' : '0 0' }}
            />
          </Fragment>
        );
      })}
      {geo.points.map((p, i) =>
        p.node ? (
          <span
            key={`n${i}`}
            ref={(n) => (nodeRefs.current[i] = n)}
            className="route-node"
            data-lit="false"
            style={{ left: p.x, top: p.y, ...(p.color ? { '--node-color': p.color } : null) }}
          />
        ) : null,
      )}
      {!reduced.current && (
        // the glow is drawn in, not a CSS filter: a filtered element that moves
        // every frame can leave a ghost of itself behind in some browsers
        <svg ref={kyberRef} className="kyber" viewBox="-6 -6 24 30" style={{ opacity: 0 }}>
          <polygon points="6,-4 15,3.5 12,22 0,22 -3,3.5" style={{ fill: 'var(--saber)', opacity: 0.18 }} />
          <polygon points="6,-2 13.5,4.2 10.8,20 1.2,20 -1.5,4.2" style={{ fill: 'var(--saber)', opacity: 0.22 }} />
          <polygon points="6,0 12,5 9.5,18 2.5,18 0,5" style={{ fill: 'var(--saber)' }} />
          <polygon points="6,0.8 8.6,5 6,16.5 3.4,5" style={{ fill: '#ffffff', opacity: 0.6 }} />
        </svg>
      )}
    </div>
  );
}
