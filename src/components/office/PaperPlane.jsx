import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../lib/hooks';

// A Dunder Mifflin paper airplane that flies down the page as you scroll,
// swooping from side to side (and once round in a loop), leaving a dotted
// trail. It sits over the page but never takes a click.

function flightPath(w, h) {
  // it keeps to the middle of the page, swinging out a little either side
  const reach = w < 640 ? 0.26 : 0.18;
  const left = w * (0.5 - reach);
  const right = w * (0.5 + reach);
  const step = Math.max(420, Math.min(640, h / 7));
  let x = right;
  let y = 90;
  let d = `M ${x} ${y}`;
  let i = 0;
  while (y + step < h - 60) {
    const nx = i % 2 ? right : left;
    const ny = y + step;
    // one loop-the-loop, a third of the way down
    if (i === 2) {
      const mx = (x + nx) / 2;
      const my = (y + ny) / 2;
      const r = Math.min(70, w * 0.09);
      d += ` C ${x} ${y + step * 0.35}, ${mx + r} ${my - r * 1.4}, ${mx} ${my - r}`;
      d += ` a ${r} ${r} 0 1 0 0.1 0`;
      d += ` C ${mx - r} ${my + r * 1.4}, ${nx} ${ny - step * 0.35}, ${nx} ${ny}`;
    } else d += ` C ${x} ${y + step * 0.55}, ${nx} ${ny - step * 0.55}, ${nx} ${ny}`;
    x = nx;
    y = ny;
    i += 1;
  }
  return d;
}

export default function PaperPlane() {
  const box = useRef(null);
  const path = useRef(null);
  const trail = useRef(null);
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
    const total = p.getTotalLength();
    const still = prefersReducedMotion();
    trail.current.style.strokeDasharray = `0 ${total}`;
    let shown = 0;
    let raf = 0;
    const place = (len) => {
      const a = p.getPointAtLength(Math.max(0, len - 1));
      const b = p.getPointAtLength(Math.min(total, len + 1));
      const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      plane.current.style.transform = `translate(${b.x}px, ${b.y}px) rotate(${angle}deg)`;
      // the dotted trail, drawn up to the plane
      trail.current.style.strokeDasharray = `${len} ${total}`;
    };
    const target = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const progress = (window.scrollY + window.innerHeight * 0.45 - top) / el.clientHeight;
      return Math.max(0, Math.min(1, progress)) * total;
    };
    const tick = () => {
      const goal = target();
      shown += (goal - shown) * (still ? 1 : 0.12);
      place(shown);
      raf = Math.abs(goal - shown) > 0.5 ? requestAnimationFrame(tick) : 0;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    shown = target();
    place(shown);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [geo]);

  const d = geo ? flightPath(geo.w, geo.h) : '';
  return (
    <>
      {/* the trail sits behind the page's cards; the plane flies over them */}
      <div ref={box} className="paper-flight paper-flight-trail" aria-hidden="true">
        {geo && (
          <svg width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`}>
            <defs>
              <mask id="paper-reveal" maskUnits="userSpaceOnUse" x="0" y="0" width={geo.w} height={geo.h}>
                <path ref={trail} d={d} fill="none" stroke="#fff" strokeWidth="8" />
              </mask>
            </defs>
            <path ref={path} d={d} fill="none" stroke="none" />
            <path d={d} className="paper-trail-line" mask="url(#paper-reveal)" />
          </svg>
        )}
      </div>
      <div className="paper-flight paper-flight-plane" aria-hidden="true">
        <div ref={plane} className="paper-plane">
          <svg viewBox="-28 -16 56 32" width="56" height="32">
            {/* nose to the right: the two wings, the keel, and a Dunder Mifflin stripe */}
            <path d="M26 0 L-24 -14 L-14 0 Z" fill="#ffffff" stroke="#9aa6b8" strokeWidth="0.8" strokeLinejoin="round" />
            <path d="M26 0 L-24 12 L-14 0 Z" fill="#e9eef6" stroke="#9aa6b8" strokeWidth="0.8" strokeLinejoin="round" />
            <path d="M26 0 L-14 0 L-18 6 Z" fill="#cfd8e6" stroke="#9aa6b8" strokeWidth="0.6" strokeLinejoin="round" />
            <path d="M-8 -9.5 L8 -5 M-8 8.5 L8 4.5" stroke="#1f4e8c" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </>
  );
}
