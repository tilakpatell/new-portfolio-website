import { useEffect, useRef, useState } from 'react';
import { useAchievements } from '../Achievements';
import { useFun } from '../../fun/FunProvider';
import { audioContext } from '../../lib/audio';

const sfx = () => import('../../lib/sfx');

// The Bridge of Khazad-dûm. Drums in the deep, then the Balrog comes across.
// Strike the bridge once it's well out on the span and before it reaches you.
const START = 40; // the Balrog's x, on the far ledge
const END = 490; // close enough to reach Gandalf
const CROSSING = 7500; // ms to cross
const TOO_SOON = 260; // strike before it gets this far and the bridge holds
const BRIDGE = { x0: 70, x1: 570, y: 168, piece: 25 };
const PIECES = Array.from({ length: (BRIDGE.x1 - BRIDGE.x0) / BRIDGE.piece }, (_, i) => BRIDGE.x0 + i * BRIDGE.piece);

function Balrog() {
  return (
    <g transform={`translate(${START} ${BRIDGE.y})`}>
      <path d="M-16 -76 C-50 -110 -80 -112 -98 -132 C-88 -100 -84 -80 -60 -60 C-50 -52 -36 -50 -20 -52 Z" fill="#0a0605" opacity="0.8" />
      <path d="M16 -76 C50 -110 80 -112 98 -132 C88 -100 84 -80 60 -60 C50 -52 36 -50 20 -52 Z" fill="#0a0605" opacity="0.8" />
      <g className="balrog-fire">
        <path d="M-16 -94 C-24 -118 -10 -128 -6 -144 C0 -128 8 -126 6 -112 C12 -118 16 -128 14 -138 C26 -120 20 -104 14 -94 Z" fill="url(#bal-fire)" />
        <path d="M-20 -80 C-34 -96 -30 -110 -36 -122 C-22 -110 -16 -98 -12 -86 Z M20 -80 C34 -96 30 -110 36 -122 C22 -110 16 -98 12 -86 Z" fill="url(#bal-fire)" />
      </g>
      <g fill="#1b0f0b" stroke="#ff5a1a" strokeOpacity="0.45" strokeWidth="1">
        <path d="M-14 0 L-10 -32 L-3 -32 L-6 0 Z M6 0 L3 -32 L10 -32 L14 0 Z" />
        <path d="M-22 -30 C-26 -50 -24 -70 -18 -82 L18 -82 C24 -70 26 -50 22 -30 Z" />
        <path d="M18 -78 C30 -72 38 -60 44 -48 L40 -44 C34 -54 26 -64 16 -68 Z M-18 -78 C-30 -70 -36 -58 -40 -46 L-36 -42 C-32 -54 -26 -64 -16 -68 Z" />
        <path d="M-10 -82 L-12 -96 L-6 -104 L6 -104 L12 -96 L10 -82 Z" />
        <path d="M-8 -100 C-18 -110 -26 -112 -32 -122 C-22 -116 -14 -110 -6 -104 Z M8 -100 C18 -110 26 -112 32 -122 C22 -116 14 -110 6 -104 Z" />
      </g>
      <ellipse cx="-4" cy="-94" rx="2" ry="1.4" fill="#ffe27a" />
      <ellipse cx="5" cy="-94" rx="2" ry="1.4" fill="#ffe27a" />
      <path d="M-40 -44 C-60 -30 -72 -10 -56 6 C-46 16 -60 26 -78 22" fill="none" stroke="#ff8a1f" strokeWidth="2.4" strokeLinecap="round" filter="url(#bal-glow)" />
    </g>
  );
}

function Gandalf({ white }) {
  const robe = white ? '#f6f5ef' : '#8d929b';
  return (
    <g>
      {white && <circle cx="540" cy="140" r="34" fill="url(#gandalf-light)" />}
      <path d="M531 168 L535 138 L545 138 L549 168 Z" fill={robe} />
      <circle cx="540" cy="133" r="4.6" fill="#d9c3a5" />
      <path d="M537 135 L541 149 L544 135 Z" fill="#eeeeea" />
      {white ? (
        <path d="M535.5 131 C536 126 544 126 544.5 131 L545 140 L535 140 Z" fill="#f3f3ee" />
      ) : (
        <path d="M531 131 L556 133 L547 129 L542 108 L538 129 Z" fill="#7d828c" />
      )}
      <path d="M529 170 L527 116" stroke={white ? '#f6f5ef' : '#6b5338'} strokeWidth="2" strokeLinecap="round" />
      <circle cx="527" cy="114" r="2.6" fill="#ffffff" className="staff-tip" />
    </g>
  );
}

export default function Bridge() {
  const { unlock } = useAchievements();
  const { gandalf } = useFun();
  const [phase, setPhase] = useState('idle'); // idle, drums, coming, won, lost
  const [x, setX] = useState(START); // where the Balrog is drawn (moving or frozen)
  const [moving, setMoving] = useState(false);
  const [broken, setBroken] = useState(null); // the stones that fall, if any
  const [grey, setGrey] = useState('standing'); // standing, falling, gone, white
  const [strike, setStrike] = useState(0);
  const [say, setSay] = useState('Gandalf stands at the near end of the bridge.');
  const t0 = useRef(0);
  const timers = useRef([]);
  const drums = useRef(0);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    clearInterval(drums.current);
  };
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => clear, []);

  const where = () => (moving ? START + (END - START) * Math.min(1, (Date.now() - t0.current) / CROSSING) : x);

  const begin = () => {
    if (!audioContext()) return;
    clear();
    setPhase('drums');
    setBroken(null);
    setGrey('standing');
    setMoving(false);
    setX(START);
    setSay('Drums in the deep.');
    const beat = () => sfx().then((s) => s.drum());
    beat();
    drums.current = setInterval(beat, 800);
    later(() => {
      sfx().then((s) => s.roar());
      setSay('Shadow and flame. It is coming across.');
      t0.current = Date.now();
      setPhase('coming');
      setMoving(true);
      setX(END);
    }, 2400);
    later(() => setSay('It is out on the bridge.'), 2400 + CROSSING * 0.35);
    later(() => setSay('Closer.'), 2400 + CROSSING * 0.7);
    later(() => {
      clearInterval(drums.current);
      setMoving(false);
      setPhase('lost');
      setSay('It crossed the bridge. Run!');
      sfx().then((s) => s.roar());
    }, 2400 + CROSSING);
  };

  const stand = () => {
    audioContext();
    setStrike((n) => n + 1);
    const at = where();
    if (phase === 'drums' || at < TOO_SOON) {
      sfx().then((s) => s.thunder());
      setSay(phase === 'drums' ? 'Not yet. It hasn’t come.' : 'Not yet. Let it come out over the drop.');
      return;
    }
    clear();
    setMoving(false);
    setX(at);
    setBroken(PIECES.filter((p) => p + BRIDGE.piece > at - 50 && p < at + 45));
    setPhase('won');
    gandalf();
    sfx().then((s) => {
      s.crumble(undefined, undefined, 0.15);
      s.roar(undefined, undefined, 0.4);
    });
    setSay('The bridge breaks under it, and it falls.');
    later(() => {
      setGrey('falling');
      setSay('Its whip catches him as it falls. Fly, you fools!');
      unlock('balrog');
    }, 1700);
    later(() => setGrey('gone'), 3200);
  };

  const fighting = phase === 'drums' || phase === 'coming';
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:gap-14">
      <div className="bridge-stage" data-phase={phase}>
        <svg viewBox="0 0 640 300" className="block h-auto w-full" role="img" aria-label="The Bridge of Khazad-dûm: a narrow stone span over a fiery chasm, Gandalf at the near end">
          <defs>
            <linearGradient id="bal-fire" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#ff3d00" />
              <stop offset="0.6" stopColor="#ff9d1f" />
              <stop offset="1" stopColor="#ffe08a" />
            </linearGradient>
            <radialGradient id="chasm-glow" cx="50%" cy="100%" r="75%">
              <stop offset="0" stopColor="#ff6a14" stopOpacity="0.75" />
              <stop offset="0.5" stopColor="#7a1a05" stopOpacity="0.4" />
              <stop offset="1" stopColor="#000" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="gandalf-light">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
            <filter id="bal-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect width="640" height="300" fill="#0a0705" />
          <rect width="640" height="300" fill="url(#chasm-glow)" />
          {[110, 210, 330, 450].map((px) => (
            <path key={px} d={`M${px} 0 V300`} stroke="#1c1410" strokeWidth="14" opacity="0.6" />
          ))}
          <path d="M0 166 H72 L66 300 H0 Z" fill="#17100c" />
          <path d="M568 166 H640 V300 H574 Z" fill="#17100c" />
          {PIECES.map((p, i) => (
            <path
              key={p}
              d={`M${p} ${BRIDGE.y} h${BRIDGE.piece} v8 l-2 3 h${-BRIDGE.piece + 4} l-2 -3 Z`}
              className={broken?.includes(p) ? 'bridge-stone falling' : 'bridge-stone'}
              style={{ '--r': `${((i * 37) % 50) - 25}deg`, '--d': `${broken ? Math.abs(broken.indexOf(p) - broken.length / 2) * 50 : 0}ms` }}
              fill="#2a1f19"
            />
          ))}
          {/* once Gandalf comes back as the White, the Balrog is gone for good (until Again) */}
          {grey !== 'white' && (
            <g style={{ transform: `translateX(${x - START}px)`, transition: moving ? `transform ${CROSSING}ms linear` : 'none' }}>
              <g className={phase === 'won' ? 'balrog falling' : phase === 'lost' ? 'balrog flare' : 'balrog'}>
                <Balrog />
              </g>
            </g>
          )}
          {grey === 'falling' && <path d={`M${x} 250 C ${x + 90} 170 470 150 534 168`} className="balrog-whip" pathLength="1" />}
          <g className={grey === 'falling' || grey === 'gone' ? 'gandalf falling' : 'gandalf'}>
            <Gandalf white={grey === 'white'} />
          </g>
          {strike > 0 && <circle key={strike} cx="527" cy="114" r="6" className="staff-flash" />}
        </svg>
      </div>
      <div>
        <h2 id="bridge-title" className="title">
          The Bridge of Khazad-dûm
        </h2>
        <p className="lead mt-4 max-w-[46ch]">A slender bridge with no rail, and something in the dark on the other side. Let it come, then strike the bridge.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          {fighting ? (
            <button type="button" className="btn btn-primary" onClick={stand}>
              You shall not pass!
            </button>
          ) : grey === 'gone' ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setGrey('white');
                  setBroken(null);
                  setPhase('idle');
                  setX(START);
                  setSay('Gandalf the White, back at the turn of the tide.');
                }}
              >
                Wait for it
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={begin} disabled={phase === 'won'}>
              {phase === 'idle' && grey !== 'white' ? 'Face the Balrog' : 'Again'}
            </button>
          )}
        </div>
        <p className="mt-5 min-h-[1.5em] text-sm text-muted" role="status">
          {say}
        </p>
      </div>
    </div>
  );
}
