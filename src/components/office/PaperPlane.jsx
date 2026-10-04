import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../lib/hooks';

// A Dunder Mifflin paper airplane that glides down the page with you: it stays
// at the middle of the screen while it swoops from side to side, turning to
// face the way it is flying, and leaves a dotted trail. It sits over the page
// but never takes a click.
//
// Every frame changes transforms only. The path only ever goes down the page,
// so the trail is revealed down to the plane by a window that slides down
// while its contents slide up by the same amount: no repaint of the page-tall
// trail, which is what made phones stutter.

function flightPath(w, h) {
  // it keeps near the middle of the page, swinging out either side
  const reach = w < 640 ? 0.3 : 0.24;
  const left = w * (0.5 - reach);
  const right = w * (0.5 + reach);
  const step = Math.max(380, Math.min(560, h / 8));
  let x = w * 0.5;
  let y = 40;
  let d = `M ${x} ${y}`;
  let i = 0;
  while (y + step < h - 40) {
    const nx = i % 2 ? left : right;
    const ny = y + step;
    d += ` C ${x} ${y + step * 0.5}, ${nx} ${ny - step * 0.5}, ${nx} ${ny}`;
    x = nx;
    y = ny;
    i += 1;
  }
  return d;
}

export default function PaperPlane() {
  const box = useRef(null);
  const path = useRef(null);
  const win = useRef(null);
  const inner = useRef(null);
  const plane = useRef(null);
  const [geo, setGeo] = useState(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const measure = () => setGeo({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  useEffect(() => {
    const p = path.current;
    const el = box.current;
    if (!p || !el || !geo) return undefined;
    // sample the path once: x and y every few pixels along it (y only ever increases)
    const total = p.getTotalLength();
    const X = [];
    const Y = [];
    for (let l = 0; l <= total; l += 4) {
      const pt = p.getPointAtLength(l);
      X.push(pt.x);
      Y.push(pt.y);
    }
    const n = Y.length;
    const still = prefersReducedMotion();
    const H = geo.h;
    let shown = null;
    let raf = 0;
    const indexAt = (y) => {
      let lo = 0;
      let hi = n - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (Y[mid] < y) lo = mid + 1;
        else hi = mid;
      }
      return Math.max(1, Math.min(n - 1, lo));
    };
    const place = (y) => {
      const i = indexAt(y);
      const k = Math.max(0, Math.min(1, (y - Y[i - 1]) / Math.max(0.001, Y[i] - Y[i - 1])));
      const x = X[i - 1] + (X[i] - X[i - 1]) * k;
      const dx = X[i] - X[i - 1];
      const dy = Y[i] - Y[i - 1];
      // nose the way it is flying, gliding down at a gentle angle
      const dir = dx >= 0 ? 1 : -1;
      const tilt = Math.max(8, Math.min(38, (Math.atan2(dy, Math.abs(dx) + 0.001) * 180) / Math.PI));
      plane.current.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scaleX(${dir}) rotate(${tilt.toFixed(1)}deg)`;
      // the trail shows down to the plane
      win.current.style.transform = `translate3d(0, ${(y - H).toFixed(1)}px, 0)`;
      inner.current.style.transform = `translate3d(0, ${(H - y).toFixed(1)}px, 0)`;
    };
    // where the plane should be: the middle of the screen, in the page's coordinates
    const target = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      return Math.max(Y[0], Math.min(Y[n - 1], window.scrollY + window.innerHeight * 0.5 - top));
    };
    const tick = () => {
      const goal = target();
      shown = shown == null || still ? goal : shown + (goal - shown) * 0.16;
      place(shown);
      raf = Math.abs(goal - shown) > 0.5 ? requestAnimationFrame(tick) : 0;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [geo]);

  const d = geo ? flightPath(geo.w, geo.h) : '';
  return (
    <>
      {/* the trail sits behind the page's cards; the plane flies over them */}
      <div ref={box} className="paper-flight paper-flight-trail" aria-hidden="true">
        {geo && (
          <div ref={win} className="paper-trail-window" style={{ height: geo.h, transform: `translate3d(0, ${-geo.h}px, 0)` }}>
            <svg ref={inner} className="paper-trail-inner" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} style={{ transform: `translate3d(0, ${geo.h}px, 0)` }}>
              <path ref={path} d={d} fill="none" stroke="none" />
              <path d={d} className="paper-trail-line" />
            </svg>
          </div>
        )}
      </div>
      <div className="paper-flight paper-flight-plane" aria-hidden="true">
        <div ref={plane} className="paper-plane">
          <svg viewBox="-28 -16 56 32" className="paper-plane-art">
            {/* nose to the right: the two wings, the keel, and a Dunder Mifflin stripe */}
            <path d="M26 0 L-24 -14 L-14 0 Z" fill="#ffffff" stroke="#8a96a8" strokeWidth="0.8" strokeLinejoin="round" />
            <path d="M26 0 L-24 12 L-14 0 Z" fill="#e9eef6" stroke="#8a96a8" strokeWidth="0.8" strokeLinejoin="round" />
            <path d="M26 0 L-14 0 L-18 6 Z" fill="#cfd8e6" stroke="#8a96a8" strokeWidth="0.6" strokeLinejoin="round" />
            <path d="M-8 -9.5 L8 -5 M-8 8.5 L8 4.5" stroke="#1f4e8c" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </>
  );
}
