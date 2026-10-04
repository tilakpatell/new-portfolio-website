import { useEffect, useMemo, useRef, useState } from 'react';
import { audioContext } from '../../lib/audio';
import { useMediaQuery } from '../../lib/hooks';
import { chikari, frets, onSitarPluck, pluck, tarabRatios } from './engine';
import SwaraLabel from './SwaraLabel';
import { useTuning } from './useTuning';
import { capturePointer } from '../../lib/pointer';

// The sitar, played on its frets. Click or tap a fret to pluck it. Hold and
// move along the neck to slide between frets without plucking again; pull
// across it to bend the string over the fret: meend, up to a fourth.
// On a phone the neck stands upright so every fret is big enough to touch.
// Keys: 1 to 0, - and = play the frets; space strikes the chikari.

const KEYS = '1234567890-=';
const NECK = { x0: 44, x1: 836, top: 96, bottom: 204 };
const MAIN_Y = 132;
const BRIDGE = 878;
const MAX_BEND = 5; // semitones: a meend can pull up a whole fourth

// the same note in any octave, within a quarter of a semitone
const sameNote = (a, b) => {
  const c = (((1200 * Math.log2(a / b)) % 1200) + 1200) % 1200;
  return c < 25 || c > 1175;
};

export default function SitarNeck({ onPlay }) {
  const [tuning] = useTuning();
  const list = useMemo(() => frets(tuning.raga), [tuning.raga]);
  const vertical = useMediaQuery('(max-width: 639px)');
  // the stretch of the neck on screen, in neck units (along the strings)
  const view = vertical ? { x: NECK.x0 - 30, w: NECK.x1 - NECK.x0 + 100 } : { x: 0, w: 1040 };
  const n = list.length;
  const slot = (NECK.x1 - NECK.x0) / n;
  const center = (i) => NECK.x0 + slot * (i + 0.5);

  const [lit, setLit] = useState(-1);
  const [pull, setPull] = useState(0);
  const [plucks, setPlucks] = useState(0);
  // a count per sympathetic string, so its glow restarts each time it's set ringing
  const [ring, setRing] = useState(() => new Array(11).fill(0));
  const svg = useRef(null);
  const press = useRef(null);
  const raga = useRef(tuning.raga);
  raga.current = tuning.raga;

  // a note sets ringing the tarab tuned to it: they glow as they would sound
  useEffect(
    () =>
      onSitarPluck((r) => {
        const tr = tarabRatios(raga.current);
        setRing((prev) => prev.map((count, j) => (tr[j] && sameNote(tr[j], r) ? count + 1 : count)));
      }),
    [],
  );
  // the frets change with the raga; let go of whatever was held
  useEffect(() => {
    press.current = null;
    setLit(-1);
    setPull(0);
  }, [tuning.raga]);

  // where along the neck a pointer is
  const slotAt = (e) => {
    const r = svg.current.getBoundingClientRect();
    const x = vertical ? view.x + ((e.clientY - r.top) / r.height) * view.w : view.x + ((e.clientX - r.left) / r.width) * view.w;
    if (x < NECK.x0 - 12 || x > NECK.x1 + 12) return -1;
    return Math.max(0, Math.min(n - 1, Math.floor((x - NECK.x0) / slot)));
  };

  const play = async (i) => {
    if (!audioContext()) return null; // inside the gesture, before awaiting
    setLit(i);
    setPull(0);
    setPlucks((k) => k + 1);
    onPlay?.('sitar');
    return pluck(list[i].ratio, { vel: 0.9 });
  };

  const across = (e) => (vertical ? e.clientX : e.clientY);
  const onDown = (e) => {
    const i = slotAt(e);
    if (i < 0) return;
    e.preventDefault();
    capturePointer(e);
    const p = { id: e.pointerId, a0: across(e), i, handle: null };
    press.current = p;
    play(i).then((h) => {
      if (press.current === p) p.handle = h;
    });
  };
  const onMove = (e) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    const i = slotAt(e);
    if (i >= 0 && i !== p.i) {
      p.i = i;
      setLit(i);
    }
    // pull the string across the fret, either way, to bend it
    const amount = Math.max(0, Math.min(1, Math.abs(p.a0 - across(e)) / (vertical ? 70 : 90)));
    setPull(amount);
    p.handle?.slide(list[p.i].ratio * 2 ** ((amount * MAX_BEND) / 12));
  };
  const onUp = (e) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    p.handle?.slide(list[p.i].ratio);
    setPull(0);
    press.current = null;
  };
  const onKey = (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      if (audioContext()) chikari();
      onPlay?.('sitar');
      return;
    }
    const i = KEYS.indexOf(e.key);
    if (i >= 0 && i < n && !e.repeat) {
      e.preventDefault();
      play(i);
    }
  };

  const x = lit >= 0 ? center(lit) : 0;
  const mainPath = lit >= 0 && pull > 0 ? `M8 ${MAIN_Y} L${x} ${MAIN_Y + pull * 26} L${BRIDGE} ${MAIN_Y}` : `M8 ${MAIN_Y} L${BRIDGE} ${MAIN_Y}`;

  return (
    <div className="sitar-neck" data-vertical={vertical || undefined}>
      <svg
        ref={svg}
        viewBox={vertical ? `60 ${view.x} 180 ${view.w}` : `${view.x} 60 ${view.w} 180`}
        className="sitar-neck-svg"
        role="group"
        aria-label={`Sitar with ${n} frets. Keys 1 to ${KEYS[n - 1]} play them; space strikes the chikari.`}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <defs>
          <linearGradient id="sn-wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8a5530" />
            <stop offset="0.5" stopColor="#6d3f1f" />
            <stop offset="1" stopColor="#4a2914" />
          </linearGradient>
          <radialGradient id="sn-gourd" cx="40%" cy="35%" r="70%">
            <stop offset="0" stopColor="#a8693a" />
            <stop offset="0.6" stopColor="#6e3f1d" />
            <stop offset="1" stopColor="#3a1f0d" />
          </radialGradient>
          <linearGradient id="sn-brass" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#f3dc9a" />
            <stop offset="1" stopColor="#b08a3e" />
          </linearGradient>
        </defs>
        {/* upright on a phone: neck units (x along, y across) turn so x runs down the screen */}
        <g transform={vertical ? 'matrix(0 1 -1 0 300 0)' : undefined}>

        {/* the gourd and the neck */}
        <circle cx="948" cy="150" r="120" fill="url(#sn-gourd)" />
        <circle cx="948" cy="150" r="102" fill="none" stroke="#d8b06a" strokeWidth="1.5" opacity="0.55" />
        <rect x="0" y={NECK.top} width="890" height={NECK.bottom - NECK.top} rx="8" fill="url(#sn-wood)" />
        <path d={`M6 ${NECK.top + 6} H884 M6 ${NECK.bottom - 6} H884`} stroke="#efe2c4" strokeWidth="1" strokeDasharray="1 8" opacity="0.6" />

        {/* frets, one per note of the raga */}
        {list.map((f, i) => (
          <g key={`${f.s}${f.oct}`}>
            <rect x={NECK.x0 + slot * i} y={NECK.top} width={slot} height={NECK.bottom - NECK.top} className="sn-slot" data-lit={lit === i || undefined} />
            <path
              d={`M${NECK.x0 + slot * (i + 1) - 3} ${NECK.top + 4} Q${NECK.x0 + slot * (i + 1) + 6} 150 ${NECK.x0 + slot * (i + 1) - 3} ${NECK.bottom - 4}`}
              stroke="url(#sn-brass)"
              strokeWidth="3"
              fill="none"
            />
          </g>
        ))}

        {/* the tarab, under the frets, glowing as they ring */}
        {ring.map((count, i) => (
          <path key={`${i}-${count}`} d={`M${150 + i * 6} ${178 + i * 1.8} L${BRIDGE} ${178 + i * 1.8}`} className="sn-tarab" data-ring={count > 0 || undefined} />
        ))}
        {/* the chikari, the two high drones */}
        <path d={`M8 ${MAIN_Y - 16} L${BRIDGE} ${MAIN_Y - 16} M8 ${MAIN_Y - 10} L${BRIDGE} ${MAIN_Y - 10}`} stroke="#e6dcc2" strokeWidth="0.9" opacity="0.8" />
        {/* the bridge, and the main string */}
        <rect x={BRIDGE - 4} y="106" width="9" height="90" rx="2" fill="#efe6cf" />
        <path key={`m${plucks}`} d={mainPath} stroke="#f6eedb" strokeWidth="2.2" fill="none" className={lit >= 0 ? 'sitar-ring' : undefined} />
        </g>
      </svg>
      <div className="sn-labels" aria-hidden="true">
        {list.map((f, i) => (
          <span
            key={`${f.s}${f.oct}`}
            style={vertical ? { top: `${((center(i) - view.x) / view.w) * 100}%` } : { left: `${((center(i) - view.x) / view.w) * 100}%` }}
            data-lit={lit === i || undefined}
          >
            <SwaraLabel s={f.s} oct={f.oct} />
          </span>
        ))}
      </div>
    </div>
  );
}
