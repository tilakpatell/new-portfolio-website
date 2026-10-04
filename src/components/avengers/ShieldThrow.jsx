import { useEffect, useRef, useState } from 'react';
import { audioContext } from '../../lib/audio';
import { prefersReducedMotion } from '../../lib/hooks';

const sfx = () => import('../../lib/sfx');

// Cap's training floor: throw the shield and it ricochets off the far wall
// and the ceiling, knocks the two dummies down, and comes back to the hand.
const PATH = [
  [70, 196],
  [560, 120],
  [400, 22],
  [70, 196],
];
const BOUNCES = [1, 2]; // indices where it hits something hard
const DUMMIES = [
  { x: 330, y: 150 },
  { x: 470, y: 64 },
];

export default function ShieldThrow() {
  const shield = useRef(null);
  const [flying, setFlying] = useState(false);
  const [down, setDown] = useState([false, false]);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const place = (x, y, spin) => shield.current?.setAttribute('transform', `translate(${x} ${y}) rotate(${spin})`);
  useEffect(() => place(...PATH[0], 0), []);

  const lengths = PATH.slice(1).map((p, i) => Math.hypot(p[0] - PATH[i][0], p[1] - PATH[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0);

  const throwIt = () => {
    if (flying) return;
    audioContext(); // in the click, so the clangs can be heard
    setFlying(true);
    setDown([false, false]);
    const still = prefersReducedMotion();
    const duration = still ? 300 : 1500;
    const start = performance.now();
    let seg = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      let d = t * total;
      let i = 0;
      while (i < lengths.length - 1 && d > lengths[i]) d -= lengths[i++];
      if (i > seg) {
        if (BOUNCES.includes(i)) sfx().then((s) => s.clang());
        seg = i;
      }
      const [x0, y0] = PATH[i];
      const [x1, y1] = PATH[i + 1];
      const k = Math.min(1, d / lengths[i]);
      const x = x0 + (x1 - x0) * k;
      const y = y0 + (y1 - y0) * k;
      place(x, y, t * 1440);
      DUMMIES.forEach((m, j) => {
        if (Math.hypot(m.x - x, m.y - y) < 34)
          setDown((prev) => {
            if (prev[j]) return prev;
            sfx().then((s) => s.knock());
            const next = [...prev];
            next[j] = true;
            return next;
          });
      });
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else {
        place(...PATH[0], 0);
        sfx().then((s) => s.clang(undefined, undefined, 0));
        setFlying(false);
      }
    };
    raf.current = requestAnimationFrame(tick);
  };

  return (
    <div>
      <div className="floor-stage">
        <svg viewBox="0 0 600 240" className="block h-auto w-full" role="img" aria-label="A training floor: Captain America’s shield ready to throw, two dummies across the room">
          <rect width="600" height="240" fill="#121821" />
          <path d="M0 210 H600" stroke="#2c3644" strokeWidth="2" />
          {Array.from({ length: 11 }, (_, i) => (
            <path key={i} d={`M${i * 60} 210 V240`} stroke="#1d2532" strokeWidth="2" />
          ))}
          {DUMMIES.map((m, j) => (
            <g key={j} className="dummy" data-down={down[j] || undefined} style={{ transformOrigin: `${m.x}px ${m.y + 46}px` }}>
              <path d={`M${m.x} ${m.y + 46} V${m.y + 4}`} stroke="#6b5338" strokeWidth="5" />
              <circle cx={m.x} cy={m.y - 6} r="12" fill="#c9b18a" stroke="#6b5338" strokeWidth="2" />
              <rect x={m.x - 14} y={m.y + 6} width="28" height="30" rx="5" fill="#b89d73" stroke="#6b5338" strokeWidth="2" />
            </g>
          ))}
          <g ref={shield}>
            <circle r="26" fill="#c0392b" />
            <circle r="20" fill="#e8ecf0" />
            <circle r="14" fill="#c0392b" />
            <circle r="9" fill="#2350a8" />
            <path d="M0 -7 L2 -2 L7 -2 L3 1 L4.5 6.5 L0 3.2 L-4.5 6.5 L-3 1 L-7 -2 L-2 -2 Z" fill="#ffffff" />
          </g>
        </svg>
      </div>
      <button type="button" className="btn btn-primary mt-5" onClick={throwIt} disabled={flying}>
        Throw the shield
      </button>
      <p className="mt-3 min-h-[1.5em] text-sm text-muted" role="status">
        {down.every(Boolean) ? 'Two for two. He could do this all day.' : down.some(Boolean) ? 'One down.' : ''}
      </p>
    </div>
  );
}
