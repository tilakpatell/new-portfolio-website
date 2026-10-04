import { useEffect, useRef, useState } from 'react';
import { audioContext } from '../../lib/audio';
import { local, prefersReducedMotion } from '../../lib/hooks';

const sfx = () => import('../../lib/sfx');

// The superlab under the laundry. Hold to heat, let go and it cools. The cook
// starts the moment the needle first reaches the green; from then on every
// moment outside it costs purity (more, the further out), and the tray fills
// as the time in the green adds up. The green narrows as the cook goes on, and
// now and then the burner flares or a draft comes in and pushes the heat for a
// second or so: let go or hold to ride it out. Walt wants 99; the best cook is
// remembered.
const MID = 0.66;
const WIDE = 0.08; // half the green at the start
const NARROW = 0.05; // and at the end
const COOK = 9; // seconds in the green to finish
const WARM = 4; // seconds to bring it up before being cold starts to cost
const TOP = 99.1;
const CRYSTALS = 14;
const BEST = 'tp-cook-best';
const bandAt = (k) => {
  const half = WIDE - (WIDE - NARROW) * Math.min(1, k);
  return [MID - half, MID + half];
};
const KICKS = [
  [0.14, 'The burner flares.'],
  [0.12, 'Jesse knocks the regulator.'],
  [-0.12, 'A draft from the loading door.'],
  [-0.14, 'The coolant kicks in.'],
];
const fresh = () => ({ heat: 0.3, on: false, t: 0, good: 0, last: 0, wob: Math.random() * 10, started: false, purity: TOP, kick: 2.4 + Math.random(), drift: 0, driftLeft: 0 });

export default function Cook() {
  const [phase, setPhase] = useState('ready'); // ready, cooking, done
  const [started, setStarted] = useState(false);
  const [purity, setPurity] = useState(TOP);
  const [progress, setProgress] = useState(0);
  const [heat, setHeat] = useState(0.3);
  const [inBand, setInBand] = useState(false);
  const [band, setBand] = useState(bandAt(0));
  const [event, setEvent] = useState('');
  const [best, setBest] = useState(() => local.get(BEST, null));
  const s = useRef(fresh());
  const raf = useRef(0);
  const doneAt = useRef(0);
  const again = useRef(null);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  // the Hold button goes when the cook ends; keep the keyboard on the page
  useEffect(() => {
    if (phase === 'done' && document.activeElement === document.body) again.current?.focus({ preventScroll: true });
  }, [phase]);

  const start = () => {
    // a press still held from the cook that just ended doesn't start another
    if (performance.now() - doneAt.current < 350) return;
    audioContext(); // in the click, so the lab can be heard
    cancelAnimationFrame(raf.current);
    s.current = fresh();
    setPhase('cooking');
    setStarted(false);
    setPurity(TOP);
    setProgress(0);
    setEvent('');
    setBand(bandAt(0));
    const tick = (now) => {
      const st = s.current;
      const dt = st.last ? Math.min(0.05, (now - st.last) / 1000) : 0.016;
      st.last = now;
      st.wob += dt;
      st.t += dt;
      // now and then something pushes the heat one way for a moment
      if (st.started) {
        st.kick -= dt;
        if (st.kick <= 0) {
          const [push, what] = KICKS[Math.floor(Math.random() * KICKS.length)];
          st.drift = push;
          st.driftLeft = 1.2 + Math.random() * 0.6;
          st.kick = 2.8 + Math.random() * 1.8;
          setEvent(what);
        }
        if (st.driftLeft > 0) {
          st.driftLeft -= dt;
          if (st.driftLeft <= 0) {
            st.drift = 0;
            setEvent('');
          }
        }
      }
      // heat rises while held, falls on its own, and wanders a little
      st.heat += ((st.on ? 0.34 : -0.2) + st.drift) * dt + Math.sin(st.wob * 3.1) * 0.05 * dt;
      st.heat = Math.max(0, Math.min(1, st.heat));
      const b = bandAt(st.good / COOK);
      const good = st.heat >= b[0] && st.heat <= b[1];
      if (good && !st.started) {
        st.started = true;
        setStarted(true);
      }
      if (st.started || st.t > WARM) {
        if (good) st.good += dt;
        else {
          const off = st.heat < b[0] ? b[0] - st.heat : st.heat - b[1];
          st.purity = Math.max(0, st.purity - dt * (0.5 + 20 * off));
        }
      }
      setBand(b);
      setHeat(st.heat);
      setInBand(good);
      setPurity(st.purity);
      setProgress(Math.min(1, st.good / COOK));
      if (st.good >= COOK) {
        const final = Math.round(st.purity * 10) / 10;
        setPurity(final);
        setPhase('done');
        setEvent('');
        st.on = false;
        doneAt.current = performance.now();
        sfx().then((x) => x.ding());
        if (best == null || final > best) {
          setBest(final);
          local.set(BEST, final);
        }
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

  const verdict = purity >= 99 ? 'Yeah, science!' : purity >= 95 ? 'Close. Walt says close is not good enough.' : 'Jesse, what are you doing?';
  const angle = -120 + heat * 240;
  const arc = (v) => {
    const a = ((-120 + v * 240 - 90) * Math.PI) / 180;
    return `${Math.cos(a) * 42} ${Math.sin(a) * 42}`;
  };
  const still = prefersReducedMotion();
  const crystals = phase === 'done' ? CRYSTALS : Math.floor(progress * CRYSTALS);
  const status =
    phase === 'done'
      ? verdict
      : phase === 'cooking'
        ? !started
          ? 'Bring it up to temperature.'
          : `${inBand ? 'Steady.' : heat > band[1] ? 'Too hot.' : 'Too cold.'}${event ? ` ${event}` : ''}`
        : '';

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
            <path d={`M${arc(band[0])} A42 42 0 0 1 ${arc(band[1])}`} stroke="#3fae5c" strokeWidth="9" fill="none" />
            <path d="M0 0 L0 -40" stroke="#ff5b4a" strokeWidth="3" strokeLinecap="round" style={{ transform: `rotate(${angle}deg)`, transition: still ? 'none' : 'transform 0.08s linear' }} />
            <circle r="5" fill="#e8ecef" />
            <text y="34" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="#9aa4ab">
              TEMP
            </text>
          </g>
          {/* the tray fills with blue as the cook goes on */}
          <rect x="300" y="268" width="180" height="30" rx="3" fill="#3a4246" stroke="#5b646a" strokeWidth="2" />
          <g className="cook-blue">
            {Array.from({ length: CRYSTALS }, (_, i) => (
              <path key={i} className="cook-crystal" data-on={i < crystals || undefined} d={`M${310 + i * 12} 292 l5 -14 l6 14 Z`} fill={i % 3 ? '#5ec8f0' : '#a6ecff'} />
            ))}
          </g>
        </svg>
      </div>
      <div>
        <h2 id="cook-title" className="title">
          The superlab
        </h2>
        <p className="lead mt-4 max-w-[44ch]">Under the laundry. Hold to heat, let go to cool, and keep the needle in the green until the tray is full. The green narrows as you go, and the lab won’t sit still. Walt won’t settle for less than 99.</p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          {/* separate buttons (keys), so letting go of Hold at the end can't press Cook again */}
          {phase === 'cooking' ? (
            <button
              key="hold"
              type="button"
              className="btn btn-primary hold-btn"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                hold(true);
              }}
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
            <button key="start" ref={again} type="button" className="btn btn-primary" onClick={start}>
              {phase === 'done' ? 'Cook again' : 'Start the cook'}
            </button>
          )}
          <span className="mono text-sm text-body">
            {phase === 'ready' ? (best != null ? `Best ${best.toFixed(1)}%` : 'Purity —') : `Purity ${purity.toFixed(1)}%${phase === 'cooking' ? ` · cook ${Math.round(progress * 100)}%` : best != null ? ` · best ${best.toFixed(1)}%` : ''}`}
          </span>
        </div>
        <p className="mt-5 min-h-[1.5em] text-sm font-semibold text-ink" role="status">
          {status}
        </p>
      </div>
    </div>
  );
}
