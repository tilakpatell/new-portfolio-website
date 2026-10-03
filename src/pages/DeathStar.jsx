import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDocumentTitle, useReducedMotion } from '../lib/hooks';

// The hidden page. Reachable from the terminal ('deathstar'), the footer and the Konami code.
const DS = { x: 520, y: 220, r: 150 };
const DISH = { x: 462, y: 160, r: 36 };
const FOCUS = { x: 432, y: 138 };
const PLANET = { x: 120, y: 112, r: 46 };
const BEAM = '#8dff6b';

export default function DeathStar() {
  useDocumentTitle('DS-1');
  const reduced = useReducedMotion();
  // idle → charging → firing → boom → gone
  const [phase, setPhase] = useState('idle');
  const [shots, setShots] = useState(0);

  useEffect(() => {
    const next = { charging: ['firing', 1100], firing: ['boom', 380], boom: ['gone', 1500] }[phase];
    if (!next) return undefined;
    const t = setTimeout(() => setPhase(next[0]), reduced ? 0 : next[1]);
    return () => clearTimeout(t);
  }, [phase, reduced]);

  const debris = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => {
        const a = (i / 34) * Math.PI * 2 + ((i * 37) % 10) / 20;
        const d = 70 + ((i * 53) % 90);
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.8, s: 1.5 + (i % 4), c: i % 3 === 0 ? '#ffd27a' : i % 3 === 1 ? '#9bb8ff' : '#ffffff' };
      }),
    // a fresh debris field each shot
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shots],
  );

  const fire = () => {
    setShots((n) => n + 1);
    setPhase('charging');
  };

  const rim = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    return { x: DISH.x + Math.cos(a) * (DISH.r - 6), y: DISH.y + Math.sin(a) * (DISH.r - 6) };
  });
  const charging = phase === 'charging' || phase === 'firing';
  const planetVisible = phase === 'idle' || phase === 'charging' || phase === 'firing';

  return (
    <div className="dark-scope relative z-10 min-h-[100svh] overflow-hidden" style={{ background: '#03040a' }}>
      <div className="ds-stars pointer-events-none absolute inset-0" aria-hidden="true" />
      {phase === 'boom' && !reduced && <div className="ds-flash pointer-events-none fixed inset-0 z-50 bg-white" aria-hidden="true" />}
      <div className="shell relative grid min-h-[100svh] items-center gap-10 pb-16 pt-[calc(var(--nav-h)+32px)] lg:grid-cols-[1.25fr_1fr]">
        <svg viewBox="0 0 680 400" className="block h-auto w-full overflow-visible" role="img" aria-label="The Death Star facing the planet Alderaan">
          <defs>
            <radialGradient id="ds-body" cx="38%" cy="32%" r="75%">
              <stop offset="0" stopColor="#b9bec4" />
              <stop offset="0.45" stopColor="#7d838a" />
              <stop offset="0.85" stopColor="#3a3e44" />
              <stop offset="1" stopColor="#202327" />
            </radialGradient>
            <radialGradient id="ds-dish" cx="62%" cy="64%" r="70%">
              <stop offset="0" stopColor="#a6abb1" />
              <stop offset="0.7" stopColor="#5d6268" />
              <stop offset="1" stopColor="#3c4046" />
            </radialGradient>
            <radialGradient id="alderaan" cx="35%" cy="30%" r="80%">
              <stop offset="0" stopColor="#bfe3ff" />
              <stop offset="0.35" stopColor="#4f8fd8" />
              <stop offset="0.75" stopColor="#24548f" />
              <stop offset="1" stopColor="#0d223d" />
            </radialGradient>
            <clipPath id="ds-clip">
              <circle cx={DS.x} cy={DS.y} r={DS.r} />
            </clipPath>
            <clipPath id="planet-clip">
              <circle cx={PLANET.x} cy={PLANET.y} r={PLANET.r} />
            </clipPath>
            <filter id="ds-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>

          {/* Alderaan */}
          {planetVisible && (
            <g className={phase === 'firing' ? 'planet-hit' : ''}>
              <circle cx={PLANET.x} cy={PLANET.y} r={PLANET.r + 6} fill="#6aa8ff" opacity="0.12" />
              <circle cx={PLANET.x} cy={PLANET.y} r={PLANET.r} fill="url(#alderaan)" />
              <g clipPath="url(#planet-clip)" opacity="0.85">
                <path d={`M ${PLANET.x - 40} ${PLANET.y - 14} q 18 -12 34 -2 q 14 8 30 -4 q 10 -6 20 2`} fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
                <path d={`M ${PLANET.x - 30} ${PLANET.y + 16} q 22 8 40 -2 q 12 -6 26 4`} fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.55" />
                <path d={`M ${PLANET.x - 12} ${PLANET.y - 2} q 10 -10 22 -4 q 8 4 4 12 q -10 10 -22 2 z`} fill="#3f8a4a" opacity="0.8" />
              </g>
            </g>
          )}
          {(phase === 'boom' || phase === 'gone') && (
            <g key={shots}>
              {phase === 'boom' && (
                <>
                  <circle className="ds-core" cx={PLANET.x} cy={PLANET.y} r={PLANET.r} fill="#fff6d8" />
                  <ellipse className="ds-ring" cx={PLANET.x} cy={PLANET.y} rx={PLANET.r} ry={PLANET.r * 0.28} fill="none" stroke="#ffe7a8" strokeWidth="3" />
                </>
              )}
              {debris.map((p, i) => (
                <circle
                  key={i}
                  className="ds-debris"
                  cx={PLANET.x}
                  cy={PLANET.y}
                  r={p.s}
                  fill={p.c}
                  style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, animationDelay: `${(i % 5) * 20}ms` }}
                />
              ))}
            </g>
          )}

          {/* Death Star */}
          <circle cx={DS.x} cy={DS.y} r={DS.r} fill="url(#ds-body)" />
          <g clipPath="url(#ds-clip)" opacity="0.5">
            {[90, 120, 150, 260, 290, 320, 345].map((y) => (
              <path key={y} d={`M ${DS.x - DS.r} ${y} Q ${DS.x} ${y + (y < DS.y ? 14 : -14)} ${DS.x + DS.r} ${y}`} fill="none" stroke="#2a2d31" strokeWidth="1" />
            ))}
            {Array.from({ length: 44 }).map((_, i) => (
              <rect key={i} x={DS.x - 130 + ((i * 53) % 270)} y={80 + ((i * 97) % 280)} width={4 + (i % 4) * 3} height="2" fill="#2a2d31" />
            ))}
          </g>
          <path d={`M ${DS.x - DS.r + 10} ${DS.y + 4} Q ${DS.x} ${DS.y + 26} ${DS.x + DS.r - 10} ${DS.y + 4}`} fill="none" stroke="#1d1f23" strokeWidth="6" clipPath="url(#ds-clip)" />
          <circle cx={DISH.x} cy={DISH.y} r={DISH.r} fill="url(#ds-dish)" stroke="#2a2d31" strokeWidth="1.5" />
          <circle cx={DISH.x} cy={DISH.y} r={DISH.r * 0.62} fill="none" stroke="#2f3237" strokeWidth="1" />
          <circle cx={DISH.x} cy={DISH.y} r="4" fill={charging ? BEAM : '#2f3237'} />

          {charging &&
            rim.map((p, i) => (
              <line key={i} className="ds-tributary" x1={p.x} y1={p.y} x2={FOCUS.x} y2={FOCUS.y} stroke={BEAM} strokeWidth="2" strokeLinecap="round" style={{ animationDelay: `${i * 50}ms` }} />
            ))}
          {phase === 'firing' && (
            <g>
              <line x1={FOCUS.x} y1={FOCUS.y} x2={PLANET.x} y2={PLANET.y} stroke={BEAM} strokeWidth="12" filter="url(#ds-glow)" className="ds-beam" />
              <line x1={FOCUS.x} y1={FOCUS.y} x2={PLANET.x} y2={PLANET.y} stroke="#eaffdf" strokeWidth="3" className="ds-beam" />
            </g>
          )}
          {charging && <circle cx={FOCUS.x} cy={FOCUS.y} r="7" fill="#eaffdf" filter="url(#ds-glow)" />}
          <text x={PLANET.x} y={PLANET.y + PLANET.r + 26} textAnchor="middle" fill="#9aa0a9" fontFamily="var(--font-mono)" fontSize="12" letterSpacing="2">
            {planetVisible ? 'ALDERAAN' : ''}
          </text>
        </svg>

        <div>
          <p className="eyebrow">Classified · DS-1 Orbital Battle Station</p>
          <h1 className="display mt-6 text-[clamp(2.8rem,1.6rem+5vw,5.2rem)]">That’s no moon.</h1>
          <p className="lead mt-6 max-w-xl">It’s a space station — and you found the hidden page. Alderaan is in range.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {phase === 'gone' ? (
              <button type="button" className="btn btn-primary" onClick={() => setPhase('idle')}>
                Restore Alderaan from checkpoint
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={fire} disabled={phase !== 'idle'}>
                Fire the superlaser
              </button>
            )}
            <Link to="/" className="btn btn-ghost">
              Back to the site
            </Link>
          </div>
          <p className="mono mt-6 min-h-[1.5em] text-sm text-accent" role="status">
            {phase === 'charging' && 'Charging the main reactor…'}
            {phase === 'firing' && 'Fire at will.'}
            {(phase === 'boom' || phase === 'gone') && 'Fully operational. Alderaan is no more.'}
          </p>
        </div>
      </div>
    </div>
  );
}
