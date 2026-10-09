import { useEffect, useRef, useState } from 'react';
import { useAchievements } from '../Achievements';
import { useFun } from '../../fun/FunProvider';
import { audioContext } from '../../lib/audio';
import { use3D } from '../../lib/gpu';
import { local, useFrameLoop } from '../../lib/hooks';
import Scene3D from './Scene3D';
import { DUEL, block, newDuel, stepDuel, strike } from './duel';
import '../../styles/lazy/middleearth.css';

const sfx = () => import('../../lib/sfx');
const BEST = 'tp-balrog-best';
const buzz = (ms) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no vibration */
  }
};
const typing = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

// The Bridge of Khazad-dûm, a duel (the rules are in ./duel.js). Drums in the
// deep, then the Balrog comes across. When it raises its whip, raise the
// staff as it falls. Strike the bridge with the Balrog out over the deepest
// part of the drop. Win, and it comes again, faster.
//
// Drawn in 3D (./Bridge3D.js) wherever WebGL works, over this drawing, which
// stays for browsers without it and for anything that reads the page.
const loadScene = () => import('./Bridge3D').then((m) => m.createBridge3D);
const BRIDGE = { x0: 70, x1: 570, y: 168, piece: 25 };
const PIECES = Array.from({ length: (BRIDGE.x1 - BRIDGE.x0) / BRIDGE.piece }, (_, i) => BRIDGE.x0 + i * BRIDGE.piece);
const GRADES = { perfect: 'Perfect. Right over the deep.', good: 'Good. The bridge goes under it.', close: 'Close. Very close.' };

function Balrog() {
  return (
    <g transform={`translate(${DUEL.start} ${BRIDGE.y})`}>
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
  const duel = useRef(null);
  const balrog = useRef(null);
  const [phase, setPhase] = useState('idle'); // idle, drums, coming, won, lost
  const [x, setX] = useState(DUEL.start); // where the Balrog is drawn once it stops
  const [whip, setWhip] = useState(null); // 'up' while it winds up, 'lash' as it falls
  const [will, setWill] = useState(DUEL.will);
  const [broken, setBroken] = useState(null); // the stones that fall, if any
  const [grey, setGrey] = useState('standing'); // standing, falling, gone, white
  const [flash, setFlash] = useState(0);
  const [say, setSay] = useState('Gandalf stands at the near end of the bridge.');
  const [round, setRound] = useState(0);
  const [run, setRun] = useState(0); // points this streak
  const [best, setBest] = useState(() => {
    const b = local.get(BEST, null);
    return b && typeof b === 'object' ? { streak: Number(b.streak) || 0, score: Number(b.score) || 0 } : { streak: 0, score: 0 };
  });
  const three = use3D();
  const [gl, setGl] = useState('waiting');
  const want3D = three.on && gl !== 'failed' && gl !== 'lost';
  const view = useRef(null); // the 3D scene, once it is up
  const timers = useRef([]);
  const drums = useRef(0);
  const said = useRef({});

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    clearInterval(drums.current);
  };
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => clear, []);

  const place = (bx) => balrog.current?.setAttribute('transform', `translate(${(bx - DUEL.start).toFixed(1)} 0)`);
  const keepBest = (streak, score) => {
    if (streak > best.streak || score > best.score) {
      const next = { streak: Math.max(streak, best.streak), score: Math.max(score, best.score) };
      setBest(next);
      local.set(BEST, next);
    }
  };

  const begin = (next = 0) => {
    audioContext(); // in the click, so the drums can be heard (and the duel runs either way)
    clear();
    const white = grey === 'white';
    duel.current = newDuel({ round: next, white });
    said.current = {};
    setRound(next);
    if (!next) setRun(0);
    setPhase('drums');
    setBroken(null);
    setWhip(null);
    setWill(duel.current.will);
    if (!white) setGrey('standing');
    setX(DUEL.start);
    place(DUEL.start);
    setSay(next ? `Again, and faster. Round ${next + 1}.` : 'Drums in the deep.');
    const beat = () => sfx().then((s) => s.drum());
    beat();
    drums.current = setInterval(beat, 800);
  };

  const lost = (reason) => {
    clearInterval(drums.current);
    const d = duel.current;
    setPhase('lost');
    setWhip(null);
    setX(d.x);
    keepBest(round, run);
    setSay(reason === 'beaten' ? 'Gandalf is beaten back off the bridge. Run!' : 'It crossed the bridge. Run!');
    sfx().then((s) => s.roar());
  };

  // the duel, frame by frame
  useFrameLoop((ms) => {
    const d = duel.current;
    if (!d) return;
    // (a block or a lash holds the duel a moment: the scene's hitstop, ./feel.js)
    const real = Math.min(0.05, ms / 1000);
    const ev = stepDuel(d, real * (view.current?.timeScale?.(real) ?? 1));
    place(d.x);
    const k = (d.x - DUEL.start) / (DUEL.end - DUEL.start);
    for (const e of ev) {
      if (e.type === 'coming') {
        sfx().then((s) => s.roar());
        setPhase('coming');
        setSay('Shadow and flame. It is coming across.');
      } else if (e.type === 'windup') {
        setWhip('up');
        setSay('It raises its whip!');
        sfx().then((s) => s.sizzle?.());
      } else if (e.type === 'lashed') {
        setWhip('lash');
        setWill(e.will);
        setSay(e.will > 0 ? 'The whip catches him. Raise the staff as it falls!' : 'The whip catches him.');
        sfx().then((s) => s.zip());
        view.current?.fx('lash');
        buzz(80);
        later(() => setWhip(null), 300);
      } else if (e.type === 'lost') lost(e.reason);
    }
    if (d.whip == null && whip === 'up') setWhip(null);
    if (d.phase === 'coming') {
      if (k > 0.35 && !said.current.out) {
        said.current.out = true;
        setSay('It is out on the bridge.');
      }
      if (k > 0.62 && !said.current.deep) {
        said.current.deep = true;
        setSay('Over the deep. Now!');
      }
    }
  }, (phase === 'drums' || phase === 'coming') && !!duel.current);

  const raise = () => {
    const d = duel.current;
    if (!d || d.phase !== 'coming') return;
    audioContext();
    const r = block(d);
    if (r.ok) {
      setFlash((n) => n + 1);
      setWhip(null);
      setSay('The staff turns the whip.');
      sfx().then((s) => s.clang(undefined, undefined, 0));
      view.current?.fx('block');
      buzz(30);
    } else {
      view.current?.fx('miss');
      setSay(r.recovering ? 'The staff is still down.' : 'Nothing to turn. The staff is down for a moment.');
    }
  };

  const stand = () => {
    const d = duel.current;
    if (!d || (d.phase !== 'drums' && d.phase !== 'coming')) return;
    audioContext();
    setFlash((n) => n + 1);
    const r = strike(d);
    if (r.grade === 'soon') {
      sfx().then((s) => s.thunder());
      view.current?.fx('soon');
      setWill(d.will);
      buzz(60);
      if (d.phase === 'lost') lost('beaten');
      else setSay(d.phase === 'drums' ? 'Not yet. It hasn’t come.' : 'Not yet. Let it come out over the drop.');
      return;
    }
    clear();
    view.current?.fx('strike');
    setX(d.x);
    setWhip(null);
    setBroken(PIECES.filter((p) => p + BRIDGE.piece > d.x - 50 && p < d.x + 45));
    setPhase('won');
    const total = run + r.score;
    setRun(total);
    keepBest(round + 1, total);
    gandalf();
    sfx().then((s) => {
      s.crumble(undefined, undefined, 0.15);
      s.roar(undefined, undefined, 0.4);
    });
    setSay(`${GRADES[r.grade]} +${r.score}. The bridge breaks under it, and it falls.`);
    unlock('balrog');
    if (grey === 'white') return;
    later(() => {
      setGrey('falling');
      setSay('Its whip catches him as it falls. Fly, you fools!');
      import('../../lib/clips').then((c) => c.playClip('flyYouFools', { when: 0.6 }));
    }, 1700);
    later(() => setGrey('gone'), 3200);
  };

  // Space raises the staff, Enter strikes, while the duel is on
  const fighting = phase === 'drums' || phase === 'coming';
  const keys = useRef({ raise, stand });
  keys.current = { raise, stand };
  useEffect(() => {
    if (!fighting) return undefined;
    const onKey = (e) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (e.key === ' ') {
        e.preventDefault();
        keys.current.raise();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        keys.current.stand();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fighting]);

  const will0 = grey === 'white' ? DUEL.will + 1 : DUEL.will;
  // what the 3D scene draws from, read fresh each frame
  const read = () => ({ phase, x: fighting && duel.current ? duel.current.x : x, whip, grey, broken });
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:gap-14">
      <div className="bridge-stage me-stage" data-phase={phase} data-whip={whip || undefined} data-3d={want3D || undefined} data-gl={(want3D && gl === 'on') || undefined}>
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
          {/* the deepest part of the drop, faintly marked while it comes */}
          {fighting && <rect x={DUEL.sweet[0] - 20} y={BRIDGE.y + 12} width={DUEL.sweet[1] - DUEL.sweet[0] + 40} height="3" rx="1.5" className="bridge-deep" />}
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
          {!(grey === 'white' && phase === 'idle') && (
            <g ref={balrog} transform={`translate(${x - DUEL.start} 0)`}>
              <g className={phase === 'won' ? 'balrog falling' : phase === 'lost' ? 'balrog flare' : 'balrog'}>
                <Balrog />
              </g>
              {/* the whip, raised over its head, then down at Gandalf */}
              {whip === 'up' && <path d={`M${DUEL.start - 40} ${BRIDGE.y - 44} C ${DUEL.start - 70} ${BRIDGE.y - 120} ${DUEL.start + 20} ${BRIDGE.y - 150} ${DUEL.start + 60} ${BRIDGE.y - 110}`} className="balrog-whip-up" />}
            </g>
          )}
          {whip === 'lash' && <path d={`M${x - 40} ${BRIDGE.y - 44} C ${x + 120} ${BRIDGE.y - 120} 470 ${BRIDGE.y - 80} 532 ${BRIDGE.y - 30}`} className="balrog-whip" pathLength="1" />}
          {grey === 'falling' && <path d={`M${x} 250 C ${x + 90} 170 470 150 534 168`} className="balrog-whip" pathLength="1" />}
          <g className={grey === 'falling' || grey === 'gone' ? 'gandalf falling' : 'gandalf'}>
            <Gandalf white={grey === 'white'} />
          </g>
          {flash > 0 && <circle key={flash} cx="527" cy="114" r="6" className="staff-flash" />}
          {/* Gandalf's will, as lights over the near ledge */}
          <g aria-hidden="true">
            {Array.from({ length: will0 }, (_, i) => (
              <circle key={i} cx={590 + (i % 2) * 14} cy={40 + Math.floor(i / 2) * 14} r="4.5" className="bridge-will" data-on={i < will || undefined} />
            ))}
          </g>
        </svg>
        {want3D && <Scene3D name="bridge" load={loadScene} read={read} api={view} soft={three.info.software} onState={setGl} />}
        {want3D && gl === 'on' && (
          <p className="me-hud" aria-hidden="true">
            <span>Will</span>
            {Array.from({ length: will0 }, (_, i) => (
              <i key={i} data-on={i < will || undefined} />
            ))}
          </p>
        )}
      </div>
      <div>
        <h2 id="bridge-title" className="title">
          The Bridge of Khazad-dûm
        </h2>
        <p className="lead mt-4 max-w-[46ch]">A slender bridge with no rail, and something in the dark on the other side. When it raises its whip, raise the staff. Let it come out over the deep, then strike the bridge.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          {fighting ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={raise} disabled={phase !== 'coming'}>
                Raise the staff <kbd className="bridge-kbd">Space</kbd>
              </button>
              <button type="button" className="btn btn-primary" onClick={stand}>
                You shall not pass! <kbd className="bridge-kbd">Enter</kbd>
              </button>
            </>
          ) : grey === 'gone' ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                // the streak goes on: he's back, and stronger
                setGrey('white');
                setBroken(null);
                setWill(DUEL.will + 1);
                setSay('Gandalf the White, back at the turn of the tide. Stronger, too.');
              }}
            >
              Wait for it
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => begin(phase === 'won' ? round + 1 : 0)} disabled={phase === 'won' && grey !== 'white'}>
              {phase === 'idle' && grey !== 'white' ? 'Face the Balrog' : phase === 'won' ? 'Again, faster' : phase === 'lost' ? 'Try again' : 'Face it again'}
            </button>
          )}
        </div>
        <p className="mono mt-4 text-xs text-muted">
          {round > 0 || run > 0 ? `Round ${round + 1} · ${run} points` : 'Round 1'}
          {best.streak > 0 ? ` · best ${best.streak} in a row, ${best.score} points` : ''}
        </p>
        <p className="mt-3 min-h-[1.5em] text-sm text-muted" role="status">
          {say}
        </p>
      </div>
    </div>
  );
}
