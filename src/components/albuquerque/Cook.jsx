import { useEffect, useRef, useState } from 'react';
import { audioContext } from '../../lib/audio';
import { prefersReducedMotion } from '../../lib/hooks';

const sfx = () => import('../../lib/sfx');

// The superlab under the laundry. Hold to heat, let go and it cools; keep the
// needle in the band for the whole cook and the purity climbs. Walt wants 99.
const BAND = [0.58, 0.74];
const COOK = 9; // seconds in the band to finish

export default function Cook() {
  const [phase, setPhase] = useState('ready'); // ready, cooking, done
  const [purity, setPurity] = useState(0);
  const [heat, setHeat] = useState(0.3);
  const [inBand, setInBand] = useState(false);
  const s = useRef({ heat: 0.3, on: false, time: 0, good: 0, total: 0, last: 0, wob: 0 });
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const start = () => {
    audioContext(); // in the click, so the lab can be heard
    cancelAnimationFrame(raf.current);
    s.current = { heat: 0.3, on: false, time: 0, good: 0, total: 0, last: 0, wob: Math.random() * 10 };
    setPhase('cooking');
    setPurity(0);
    const tick = (now) => {
      const st = s.current;
      const dt = st.last ? Math.min(0.05, (now - st.last) / 1000) : 0.016;
      st.last = now;
      st.wob += dt;
      // heat rises while held, falls on its own, and wanders a little
      st.heat += (st.on ? 0.34 : -0.2) * dt + Math.sin(st.wob * 3.1) * 0.05 * dt;
      st.heat = Math.max(0, Math.min(1, st.heat));
      const good = st.heat >= BAND[0] && st.heat <= BAND[1];
      st.total += dt;
      if (good) st.good += dt;
      setHeat(st.heat);
      setInBand(good);
      setPurity(Math.min(99.1, (st.good / Math.max(1, st.total)) * 100 * Math.min(1, st.good / COOK)));
      if (st.good >= COOK) {
        setPurity(Math.round(Math.min(99.1, 70 + (st.good / st.total) * 29.1) * 10) / 10);
        setPhase('done');
        sfx().then((x) => x.ding());
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  const hold = (on) => {
    if (phase === 'cooking') s.current.on = on;
  };
  const key = (on) => (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      hold(on);
    }
  };

  const verdict = purity >= 99 ? 'Yeah, science!' : purity >= 90 ? 'Close. Walt says close is not good enough.' : 'Jesse, what are you doing?';
  const angle = -120 + heat * 240;
  const still = prefersReducedMotion();

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-14">
      <div className="cook-stage" data-in={inBand || undefined} data-done={phase === 'done' || undefined}>
        <svg viewBox="0 0 600 320" className="block h-auto w-full" role="img" aria-label="The superlab: steel vats, two cooks in yellow suits, a temperature gauge">
          <rect width="600" height="320" fill="#1d2326" />
          <rect y="250" width="600" height="70" fill="#2b3236" />
          {[60, 170].map((x) => (
            <g key={x}>
              <rect x={x} y="90" width="90" height="160" rx="10" fill="#9aa4ab" stroke="#5b646a" strokeWidth="3" />
              <ellipse cx={x + 45} cy="92" rx="45" ry="10" fill="#c3cbd1" />
              <path d={`M${x + 90} 140 h30 v-40`} stroke="#5b646a" strokeWidth="6" fill="none" />
            </g>
          ))}
          {/* two cooks in yellow */}
          {[330, 400].map((x) => (
            <g key={x} className="cook-suit">
              <rect x={x} y="150" width="46" height="100" rx="14" fill="#f2c318" stroke="#b08b0c" strokeWidth="2" />
              <circle cx={x + 23} cy="136" r="20" fill="#f2c318" stroke="#b08b0c" strokeWidth="2" />
              <rect x={x + 10} y="128" width="26" height="14" rx="4" fill="#1a2a33" />
            </g>
          ))}
          {/* the gauge */}
          <g transform="translate(520 120)">
            <circle r="52" fill="#0f1416" stroke="#8a949a" strokeWidth="4" />
            <path d={`M${Math.cos(((-120 + BAND[0] * 240 - 90) * Math.PI) / 180) * 42} ${Math.sin(((-120 + BAND[0] * 240 - 90) * Math.PI) / 180) * 42} A42 42 0 0 1 ${Math.cos(((-120 + BAND[1] * 240 - 90) * Math.PI) / 180) * 42} ${Math.sin(((-120 + BAND[1] * 240 - 90) * Math.PI) / 180) * 42}`} stroke="#3fae5c" strokeWidth="9" fill="none" />
            <path d="M0 0 L0 -40" stroke="#ff5b4a" strokeWidth="3" strokeLinecap="round" style={{ transform: `rotate(${angle}deg)`, transition: still ? 'none' : 'transform 0.08s linear' }} />
            <circle r="5" fill="#e8ecef" />
            <text y="34" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="#9aa4ab">
              TEMP
            </text>
          </g>
          {/* the tray: blue when it's done */}
          <rect x="300" y="268" width="180" height="30" rx="3" fill="#3a4246" stroke="#5b646a" strokeWidth="2" />
          <g className="cook-blue">
            {Array.from({ length: 14 }, (_, i) => (
              <path key={i} d={`M${310 + i * 12} 292 l5 -14 l6 14 Z`} fill={i % 3 ? '#5ec8f0' : '#a6ecff'} />
            ))}
          </g>
        </svg>
      </div>
      <div>
        <h2 id="cook-title" className="title">
          The superlab
        </h2>
        <p className="lead mt-4 max-w-[44ch]">Under the laundry. Hold to heat, let go to cool, and keep the needle in the green for the whole cook. Walt won’t settle for less than 99.</p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          {phase === 'cooking' ? (
            <button
              type="button"
              className="btn btn-primary select-none"
              onPointerDown={() => hold(true)}
              onPointerUp={() => hold(false)}
              onPointerLeave={() => hold(false)}
              onPointerCancel={() => hold(false)}
              onKeyDown={key(true)}
              onKeyUp={key(false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              Hold to heat
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={start}>
              {phase === 'done' ? 'Cook again' : 'Start the cook'}
            </button>
          )}
          <span className="mono text-sm text-body">Purity {purity.toFixed(1)}%</span>
        </div>
        <p className="mt-5 min-h-[1.5em] text-sm font-semibold text-ink" role="status">
          {phase === 'done' ? verdict : phase === 'cooking' ? (inBand ? 'Steady.' : heat > BAND[1] ? 'Too hot.' : 'Too cold.') : ''}
        </p>
      </div>
    </div>
  );
}
