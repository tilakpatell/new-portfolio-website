import { useRef, useState } from 'react';
import { audioContext } from '../../lib/audio';
import '../../styles/lazy/avengers.css';

const sfx = () => import('../../lib/sfx');

// Hawkeye's range. Click anywhere on it: he never misses, so wherever you
// aim, the arrow finds the nearest bullseye.
const TARGETS = [
  { x: 150, y: 110, r: 34 },
  { x: 330, y: 80, r: 26 },
  { x: 500, y: 130, r: 20 },
];

export default function Range() {
  const svg = useRef(null);
  const [arrows, setArrows] = useState([]);
  const shoot = (e) => {
    audioContext(); // in the click, so the bow can be heard
    const ctm = svg.current?.getScreenCTM();
    const p = ctm ? new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse()) : { x: 300, y: 100 };
    const t = TARGETS.reduce((best, tg) => (Math.hypot(tg.x - p.x, tg.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y) ? tg : best));
    sfx().then((s) => {
      s.twang();
      s.knock(undefined, undefined, 0.22);
    });
    setArrows((a) => [...a.slice(-8), { id: Date.now(), x: t.x + (Math.random() * 4 - 2), y: t.y + (Math.random() * 4 - 2) }]);
  };
  return (
    <div>
      <div className="floor-stage">
        <svg ref={svg} viewBox="0 0 600 220" className="block h-auto w-full cursor-crosshair" role="img" aria-label="An archery range with three targets" onClick={shoot}>
          <rect width="600" height="220" fill="#151b14" />
          <path d="M0 190 H600" stroke="#2b3528" strokeWidth="2" />
          {TARGETS.map((t) => (
            <g key={t.x}>
              <path d={`M${t.x} ${t.y + t.r} L${t.x - t.r * 0.6} 190 M${t.x} ${t.y + t.r} L${t.x + t.r * 0.6} 190`} stroke="#5a4a32" strokeWidth="4" />
              {[1, 0.75, 0.5, 0.25].map((k, i) => (
                <circle key={k} cx={t.x} cy={t.y} r={t.r * k} fill={i % 2 ? '#f4f1e8' : '#c0392b'} stroke="#2b2b2b" strokeWidth="0.8" />
              ))}
            </g>
          ))}
          {arrows.map((a) => (
            <g key={a.id} className="range-arrow">
              <path d={`M${a.x} ${a.y} l-40 18`} stroke="#3a2a16" strokeWidth="3" strokeLinecap="round" />
              <path d={`M${a.x - 40} ${a.y + 18} l-6 -6 M${a.x - 40} ${a.y + 18} l-2 8`} stroke="#7d1f1f" strokeWidth="3" strokeLinecap="round" />
            </g>
          ))}
        </svg>
      </div>
      <p className="mt-3 min-h-[1.5em] text-sm text-muted" role="status">
        {arrows.length ? `${arrows.length} for ${arrows.length}. He never misses.` : 'Aim anywhere on the range.'}
      </p>
    </div>
  );
}
