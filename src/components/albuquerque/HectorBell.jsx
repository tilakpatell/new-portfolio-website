import { useEffect, useRef, useState } from 'react';
import { audioContext } from '../../lib/audio';
import { prefersReducedMotion } from '../../lib/hooks';

const sfx = () => import('../../lib/sfx');

// Casa Tranquila: Hector in his wheelchair, his bell on the tray, and a visitor
// in a suit. Three rings, and the room goes up. Gus walks out, and straightens
// his tie.
export default function HectorBell() {
  const [rings, setRings] = useState(0);
  const [boom, setBoom] = useState(false);
  const [after, setAfter] = useState(false);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const ring = () => {
    if (boom) return;
    audioContext(); // in the click, so the bell can be heard
    sfx().then((s) => s.ding());
    const n = rings + 1;
    setRings(n);
    if (n < 3) return;
    const still = prefersReducedMotion();
    timers.current.push(
      setTimeout(() => {
        setBoom(true);
        sfx().then((s) => {
          s.boom();
          s.crumble(undefined, undefined, 0.2);
        });
      }, 450),
      setTimeout(() => setAfter(true), still ? 700 : 2600),
    );
  };
  const reset = () => {
    setRings(0);
    setBoom(false);
    setAfter(false);
  };

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-14">
      <div className="hector-stage" data-boom={boom || undefined} data-after={after || undefined}>
        <svg viewBox="0 0 600 320" className="block h-auto w-full" role="img" aria-label={boom ? 'A nursing home room after an explosion, full of smoke' : 'A nursing home room: an old man in a wheelchair with a bell, a visitor in a suit'}>
          <rect width="600" height="320" fill="#d9d2bf" />
          <rect y="240" width="600" height="80" fill="#9b8e74" />
          <rect x="60" y="50" width="140" height="100" fill="#bcd6e8" stroke="#8a7f68" strokeWidth="6" />
          <path d="M130 50 V150 M60 100 H200" stroke="#8a7f68" strokeWidth="4" />
          <text x="430" y="60" textAnchor="middle" fontFamily="Georgia, serif" fontSize="16" fill="#6b604c" className="hector-sign">
            Casa Tranquila
          </text>
          {/* Hector, in his wheelchair, the bell on the tray */}
          <g className="hector">
            <circle cx="230" cy="262" r="32" fill="none" stroke="#3a3a3a" strokeWidth="5" />
            <circle cx="300" cy="270" r="18" fill="none" stroke="#3a3a3a" strokeWidth="4" />
            <path d="M210 230 h80 v-60 h-14 v46 h-66 Z" fill="#4a4a4a" />
            <rect x="222" y="168" width="44" height="60" rx="8" fill="#8a7f6a" />
            <circle cx="244" cy="152" r="17" fill="#c9a27e" />
            <path d="M228 146 c6 -14 26 -14 32 0" fill="#e9e5dc" />
            <rect x="262" y="206" width="48" height="6" fill="#6b6b6b" />
            <g className="hector-bell" data-ring={rings || undefined} key={rings}>
              <path d="M280 206 c0 -12 4 -18 10 -18 s10 6 10 18 Z" fill="#d6b24a" stroke="#8a6d1c" strokeWidth="1.5" />
              <circle cx="290" cy="186" r="2.4" fill="#8a6d1c" />
            </g>
          </g>
          {/* the visitor */}
          <g className="gus">
            <rect x="398" y="150" width="40" height="92" rx="6" fill="#d9c9a0" />
            <path d="M412 150 L418 168 L424 150" fill="#f4f1e8" />
            <path d="M417 160 L419 188 L421 160 Z" fill="#7a1f2b" className="gus-tie" />
            <circle cx="418" cy="132" r="16" fill="#6b4a32" />
            <path d="M406 130 h10 M420 130 h10" stroke="#222" strokeWidth="2" />
            <rect x="402" y="242" width="14" height="22" fill="#3a3a3a" />
            <rect x="422" y="242" width="14" height="22" fill="#3a3a3a" />
          </g>
          {/* the blast, and the smoke after */}
          <circle className="hector-flash" cx="290" cy="220" r="40" fill="#fff4cc" />
          <g className="hector-smoke">
            {[
              [250, 200, 70],
              [330, 180, 80],
              [200, 150, 60],
              [380, 230, 70],
              [300, 120, 60],
            ].map(([x, y, rr], i) => (
              <circle key={i} cx={x} cy={y} r={rr} style={{ '--i': i }} />
            ))}
          </g>
        </svg>
      </div>
      <div>
        <h2 id="hector-title" className="title">
          Face Off
        </h2>
        <p className="lead mt-4 max-w-[44ch]">Casa Tranquila. Hector Salamanca says what he needs to with his bell. Gus has come to visit.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          {after ? (
            <button type="button" className="btn btn-ghost" onClick={reset}>
              Again
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={ring} disabled={boom}>
              Ring the bell
            </button>
          )}
        </div>
        <p className="mt-5 min-h-[1.5em] text-sm text-muted" role="status">
          {after ? 'The smoke clears. Gus walks out and straightens his tie.' : boom ? '' : rings ? `Ding. ${'Ding. '.repeat(rings - 1)}`.trim() : 'Ring it three times.'}
        </p>
      </div>
    </div>
  );
}
