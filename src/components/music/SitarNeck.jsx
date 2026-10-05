import { useEffect, useMemo, useRef, useState } from 'react';
import { audioContext } from '../../lib/audio';
import { useMediaQuery } from '../../lib/hooks';
import { capturePointer } from '../../lib/pointer';
import { damp, holdChikari, onSitarChikari, onSitarPluck, pluck, warmNeck } from './sitar';
import { CHIKARI, chikariLevel, chikariSpeed } from './sitarRules';
import { fretForKey, fretOf, keyForFret, meendTarget, sameNote, tarabHz } from './sitarRules';
import { CHROMATIC, FRET_SETS, customNotes, frets, isFretSet, ragaOf } from './tuning';
import SwaraLabel from './SwaraLabel';
import { useTuning } from './useTuning';
import './music.css';

// The sitar, played on its frets, set the way a player sets them (tuning.js
// FRET_SETS): every swara from mandra Pa to taar Ga, a regular sitar's Sa to
// taar Sa, set for Darbari or Bhairavi, the raga's own, or the player's own
// choice. The raga's notes are lit.
// Click or tap a fret to pluck it (Da and Ra in turn when you play quickly).
// Hold and move along the neck to slide between frets without plucking again;
// pull across it to bend the string over the fret: meend, up to a fourth.
// On a phone the neck stands upright so every fret is big enough to touch.
// Keys: 1 to = then Q to ] play the frets in order; Shift with a fret key
// moves to it without a new stroke (krintan); hold ↑ to pull the note to the
// raga's next one (meend); Space strikes the chikari, and held, rolls it on at
// its speed (play frets over it for a jhala); Esc stops the string. With auto
// chikari on (the default), the right hand strikes the chikari in the rests
// between the notes played here, following the music (the player's pulse, the
// tabla's beat) or at a speed set below the neck.

const NECK = { x0: 44, x1: 836, top: 96, bottom: 204 };
const MAIN_Y = 132;
const BRIDGE = 878;
const MAX_BEND = 5; // semitones: a meend can pull up a whole fourth
const TARAB_Y = (i) => 178 + i * 1.8;

// Bone inlay along the neck's edges: a vine of leaves and dots.
function Inlay({ y, flip = false }) {
  const leaves = [];
  for (let x = 70; x < 860; x += 34) {
    const s = flip ? -1 : 1;
    leaves.push(<path key={x} d={`M${x} ${y} q 7 ${-6 * s} 14 0 q -7 ${6 * s} -14 0 Z`} className="sn2-inlay-leaf" />);
    leaves.push(<circle key={`d${x}`} cx={x + 24} cy={y} r="1.4" className="sn2-inlay-dot" />);
  }
  return (
    <g aria-hidden="true">
      <path d={`M14 ${y} H884`} className="sn2-inlay-line" />
      {leaves}
    </g>
  );
}

export default function SitarNeck({ onPlay }) {
  const [tuning, setTuning] = useTuning();
  const fretSet = isFretSet(tuning.frets) ? tuning.frets : 'all';
  const custom = customNotes(tuning.customFrets || ragaOf(tuning.raga).notes);
  const auto = tuning.autoChikari !== false;
  const follow = tuning.chikariFollow !== false;
  const speed = chikariSpeed(tuning.chikariSpeed);
  const level = chikariLevel(tuning.chikariLevel);
  const list = useMemo(() => frets(tuning.raga, { set: fretSet, custom }), [tuning.raga, fretSet, custom]);
  const vertical = useMediaQuery('(max-width: 639px)');
  // the stretch of the neck on screen, in neck units (along the strings)
  const view = vertical ? { x: NECK.x0 - 30, w: NECK.x1 - NECK.x0 + 100 } : { x: 0, w: 1040 };
  const n = list.length;
  const slot = (NECK.x1 - NECK.x0) / n;
  const center = (i) => NECK.x0 + slot * (i + 0.5);

  const [lit, setLit] = useState(-1);
  const [pull, setPull] = useState(0);
  const [plucks, setPlucks] = useState(0);
  const [played, setPlayed] = useState([]); // the last few notes, for the notation strip
  // a count per sympathetic string, so its glow restarts each time it's set ringing
  const [ring, setRing] = useState(() => new Array(11).fill(0));
  const svg = useRef(null);
  const press = useRef(null);
  const keyHeld = useRef(null); // the last fret played from the keyboard, and its handle
  const spaceHeld = useRef(false); // the chikari, held from the keyboard
  const chikPath = useRef(null);
  const listRef = useRef(list);
  listRef.current = list;
  const raga = useRef(tuning.raga);
  raga.current = tuning.raga;

  // every note sets ringing the tarab tuned to it, and lights its fret (phrases too)
  useEffect(
    () =>
      onSitarPluck((r) => {
        const tr = tarabHz(raga.current, 1);
        setRing((prev) => prev.map((count, j) => (tr[j] && sameNote(tr[j], r) ? count + 1 : count)));
        const i = fretOf(r, listRef.current);
        if (i >= 0) {
          setLit(i);
          setPlucks((k) => k + 1);
          const f = listRef.current[i];
          setPlayed((p) => [...p.slice(-9), { s: f.s, oct: f.oct, ati: f.ati, id: Math.random() }]);
        }
      }),
    [],
  );
  // the chikari strings flash as they're struck; drawn straight onto the path,
  // since a roll can strike ten times a second and the neck needn't redraw for it
  useEffect(
    () =>
      onSitarChikari(() => {
        const el = chikPath.current;
        if (!el?.animate) return;
        el.animate([{ stroke: '#fff4d6', opacity: 1 }, { stroke: '#e6dcc2', opacity: 0.85 }], { duration: 650, easing: 'ease-out' });
      }),
    [],
  );
  // a chikari held from the keyboard or the button is let go of when the page loses focus
  useEffect(() => {
    const letGo = () => {
      spaceHeld.current = false;
      holdChikari(false, 'space');
      holdChikari(false, 'button');
    };
    const hidden = () => document.hidden && letGo();
    window.addEventListener('blur', letGo);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('blur', letGo);
      document.removeEventListener('visibilitychange', hidden);
      letGo();
    };
  }, []);
  // the frets change with the raga; let go of whatever was held
  useEffect(() => {
    press.current = null;
    keyHeld.current = null;
    setLit(-1);
    setPull(0);
  }, [list]);
  // the recordings for the whole neck, as the sitar comes into view
  useEffect(() => {
    const el = svg.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        warmNeck();
        io.disconnect();
      },
      { rootMargin: '500px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // where along the neck a pointer is
  const slotAt = (e) => {
    const r = svg.current.getBoundingClientRect();
    const x = vertical ? view.x + ((e.clientY - r.top) / r.height) * view.w : view.x + ((e.clientX - r.left) / r.width) * view.w;
    if (x < NECK.x0 - 12 || x > NECK.x1 + 12) return -1;
    return Math.max(0, Math.min(n - 1, Math.floor((x - NECK.x0) / slot)));
  };

  const play = (i) => {
    if (!audioContext()) return null; // inside the gesture, before awaiting
    setLit(i);
    setPull(0);
    onPlay?.('sitar');
    return pluck(list[i].ratio, { vel: 0.9, byHand: true });
  };

  const across = (e) => (vertical ? e.clientX : e.clientY);
  const onDown = (e) => {
    const i = slotAt(e);
    if (i < 0) return;
    e.preventDefault();
    capturePointer(e);
    const p = { id: e.pointerId, a0: across(e), i, handle: null };
    press.current = p;
    play(i)?.then((h) => {
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
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === ' ') {
      e.preventDefault();
      if (e.repeat || spaceHeld.current) return;
      spaceHeld.current = true;
      holdChikari(true, 'space'); // struck now, and rolling on while it's held
      onPlay?.('sitar');
      return;
    }
    if (e.key === 'Escape') {
      damp();
      setLit(-1);
      return;
    }
    const held = keyHeld.current;
    if (e.key === 'ArrowUp' && held) {
      e.preventDefault();
      if (e.repeat) return;
      // meend: pull the held note up to the raga's next one
      const st = meendTarget(list[held.i].ratio, tuning.raga);
      held.handle?.slide(list[held.i].ratio * 2 ** (st / 12), 0.09);
      setPull(Math.min(1, st / MAX_BEND));
      return;
    }
    const i = fretForKey(e.key === '{' ? '[' : e.key === '}' ? ']' : e.key);
    if (i < 0 || i >= n || e.repeat) return;
    e.preventDefault();
    if (e.shiftKey && held?.handle) {
      // krintan: the left hand moves to the fret, no new stroke
      held.handle.slide(list[i].ratio, 0.012);
      held.i = i;
      setLit(i);
      return;
    }
    const k = { i, handle: null };
    keyHeld.current = k;
    setLit(i);
    play(i)?.then((h) => {
      if (keyHeld.current === k) k.handle = h;
    });
  };
  const letGoOfSpace = () => {
    if (!spaceHeld.current) return;
    spaceHeld.current = false;
    holdChikari(false, 'space');
  };
  const onKeyUp = (e) => {
    if (e.key === ' ') letGoOfSpace();
    const held = keyHeld.current;
    if (e.key === 'ArrowUp' && held) {
      held.handle?.slide(list[held.i].ratio, 0.12);
      setPull(0);
    }
  };

  const x = lit >= 0 ? center(lit) : 0;
  const mainPath = lit >= 0 && pull > 0 ? `M8 ${MAIN_Y} L${x} ${MAIN_Y + pull * 26} L${BRIDGE} ${MAIN_Y}` : `M8 ${MAIN_Y} L${BRIDGE} ${MAIN_Y}`;
  const phoneHeight = `clamp(420px, ${n * 34}px, 92vh)`;
  const ragaName = ragaOf(tuning.raga).name;
  const lights = `${ragaName}’s notes are lit.`;
  const about = {
    all: `${n} frets, mandra Pa to taar Ga. ${lights}`,
    regular: `${n} frets, Sa to taar Sa, as a sitar usually comes: the shuddha notes and komal Ni. ${lights}`,
    darbari: `${n} frets set for Darbari: Ga and Dha tied on lower, ati komal (two lines under), for its slow andolan. ${lights}`,
    bhairavi: `${n} frets set for Bhairavi: komal Re, Ga, Dha and Ni. ${lights}`,
    raga: `${n} frets, set for ${ragaName}.`,
    custom: `${n} frets of your own: tap a note to tie its fret on or take it off. ${lights}`,
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="seg seg-wrap" role="group" aria-label="Frets set for">
          {Object.entries(FRET_SETS).map(([id, set]) => (
            <button
              key={id}
              type="button"
              aria-pressed={fretSet === id}
              // a custom setting starts from the raga's frets
              onClick={() => setTuning(id === 'custom' ? { frets: id, customFrets: custom } : { frets: id })}
            >
              {id === 'raga' ? `${ragaName}’s own` : set.name}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">{about[fretSet]}</p>
      </div>
      {fretSet === 'custom' && (
        <div className="seg seg-wrap mb-4" role="group" aria-label="Your frets: tap a note to tie its fret on or take it off">
          {CHROMATIC.map((s) => {
            const on = custom.includes(s);
            return (
              <button key={s} type="button" aria-pressed={on} onClick={() => setTuning({ customFrets: customNotes(on ? custom.replace(s, '') : custom + s) })}>
                <SwaraLabel s={s} />
              </button>
            );
          })}
        </div>
      )}
      <div className="sn2-chikari-bar mb-4" role="group" aria-label="Chikari">
        <span className="label">Chikari</span>
        <div className="seg">
          <button type="button" aria-pressed={auto} onClick={() => setTuning({ autoChikari: !auto })}>
            Auto
          </button>
        </div>
        <div className="seg" role="group" aria-label="Chikari speed">
          <button type="button" aria-pressed={follow} onClick={() => setTuning({ chikariFollow: true })}>
            Follow the music
          </button>
          <button type="button" aria-pressed={!follow} onClick={() => setTuning({ chikariFollow: false })}>
            Set speed
          </button>
        </div>
        <label className="sn2-slider" data-off={follow || undefined}>
          <span>Speed</span>
          <input
            type="range"
            min={CHIKARI.speeds[0]}
            max={CHIKARI.speeds[1]}
            step="10"
            value={speed}
            onChange={(e) => setTuning({ chikariSpeed: chikariSpeed(e.target.value), chikariFollow: false })}
            aria-valuetext={follow ? `Following the music; set to ${speed} strokes a minute` : `${speed} strokes a minute`}
          />
          <span className="mono tabular-nums">{follow ? 'follows' : `${speed}/min`}</span>
        </label>
        <label className="sn2-slider">
          <span>Strength</span>
          <input
            type="range"
            min={CHIKARI.level[0]}
            max={CHIKARI.level[1]}
            step="0.05"
            value={level}
            onChange={(e) => setTuning({ chikariLevel: chikariLevel(e.target.value) })}
            aria-valuetext={`${Math.round(level * 100)} percent`}
          />
          <span className="mono tabular-nums">{Math.round(level * 100)}%</span>
        </label>
      </div>
      <div className="sitar-neck" data-vertical={vertical || undefined} style={vertical ? { '--sn2-h': phoneHeight } : undefined}>
        <svg
          ref={svg}
          viewBox={vertical ? `60 ${view.x} 180 ${view.w}` : `${view.x} 32 ${view.w} 236`}
          className="sitar-neck-svg sn2-svg"
          role="group"
          aria-label={`Sitar with ${n} frets. Keys 1 to ${keyForFret(n - 1).toUpperCase()} play them in order; Shift with a key moves there without a new stroke; hold the up arrow for meend; space strikes the chikari, and held, rolls it; Escape stops the string.`}
          tabIndex={0}
          onKeyDown={onKey}
          onKeyUp={onKeyUp}
          onBlur={letGoOfSpace}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <defs>
            <clipPath id="sn2-neck">
              <rect x="0" y={NECK.top} width="890" height={NECK.bottom - NECK.top} rx="9" />
            </clipPath>
            <clipPath id="sn2-gourd">
              <circle cx="950" cy="150" r="116" />
            </clipPath>
            <linearGradient id="sn2-lacquer" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
              <stop offset="0.18" stopColor="#fff" stopOpacity="0.04" />
              <stop offset="0.6" stopColor="#000" stopOpacity="0.06" />
              <stop offset="1" stopColor="#000" stopOpacity="0.38" />
            </linearGradient>
            <radialGradient id="sn2-gourd-shade" cx="38%" cy="32%" r="72%">
              <stop offset="0" stopColor="#fff" stopOpacity="0.18" />
              <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.55" />
            </radialGradient>
            <linearGradient id="sn2-fret" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#8c7a52" />
              <stop offset="0.45" stopColor="#f6ecc8" />
              <stop offset="1" stopColor="#a48a4e" />
            </linearGradient>
            <linearGradient id="sn2-bone" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#e9dfc6" />
              <stop offset="1" stopColor="#cbbd9b" />
            </linearGradient>
          </defs>
          {/* upright on a phone: neck units (x along, y across) turn so x runs down the screen */}
          <g transform={vertical ? 'matrix(0 1 -1 0 300 0)' : undefined}>
            {/* the gourd (tumba), rosewood with an inlaid ring */}
            <g clipPath="url(#sn2-gourd)">
              <image href="/textures/music/rosewood.webp" x="834" y="34" width="232" height="232" preserveAspectRatio="xMidYMid slice" />
              <circle cx="950" cy="150" r="116" fill="url(#sn2-gourd-shade)" />
            </g>
            <circle cx="950" cy="150" r="98" fill="none" className="sn2-inlay-line" />
            {Array.from({ length: 36 }, (_, k) => {
              const a = (k / 36) * Math.PI * 2;
              return <circle key={k} cx={950 + Math.cos(a) * 106} cy={150 + Math.sin(a) * 106} r="2.2" className="sn2-inlay-dot" />;
            })}
            {/* the neck (dand) */}
            <g clipPath="url(#sn2-neck)">
              <image href="/textures/music/rosewood-neck.webp" x="0" y={NECK.top} width="890" height={NECK.bottom - NECK.top} preserveAspectRatio="none" />
              <rect x="0" y={NECK.top} width="890" height={NECK.bottom - NECK.top} fill="url(#sn2-lacquer)" />
            </g>
            <Inlay y={NECK.top + 7} />
            <Inlay y={NECK.bottom - 7} flip />
            {/* the nut */}
            <rect x={NECK.x0 - 10} y={NECK.top + 2} width="7" height={NECK.bottom - NECK.top - 4} rx="2" fill="url(#sn2-bone)" />

            {/* frets, one per note; the raga's notes are bright */}
            {list.map((f, i) => {
              const fx = NECK.x0 + slot * (i + 1);
              return (
                <g key={`${f.s}${f.oct}`} data-out={!f.inRaga || undefined} className="sn2-fret">
                  <rect x={NECK.x0 + slot * i} y={NECK.top} width={slot} height={NECK.bottom - NECK.top} className="sn-slot" data-lit={lit === i || undefined} />
                  <path d={`M${fx - 3} ${NECK.top + 4} Q${fx + 6} 150 ${fx - 3} ${NECK.bottom - 4}`} stroke="url(#sn2-fret)" strokeWidth="3.2" fill="none" />
                  {/* the silk thread that ties each fret on */}
                  <path d={`M${fx - 4} ${NECK.top + 3} v4 M${fx - 4} ${NECK.bottom - 7} v4`} stroke="#d9cdb0" strokeWidth="2" opacity="0.7" />
                </g>
              );
            })}

            {/* the tarab, under the frets, glowing as they ring */}
            {ring.map((count, i) => (
              <path key={`${i}-${count}`} d={`M${150 + i * 6} ${TARAB_Y(i)} L${BRIDGE} ${TARAB_Y(i)}`} className="sn-tarab" data-ring={count > 0 || undefined} />
            ))}
            {/* the chikari, the two high drones */}
            <path ref={chikPath} d={`M8 ${MAIN_Y - 16} L${BRIDGE} ${MAIN_Y - 16} M8 ${MAIN_Y - 10} L${BRIDGE} ${MAIN_Y - 10}`} className="sn2-chikari" />
            {/* the bridge (jawari), and the main string */}
            <rect x={BRIDGE - 5} y="106" width="11" height="90" rx="2.5" fill="url(#sn2-bone)" />
            <path key={`m${plucks}`} d={mainPath} stroke="#f6eedb" strokeWidth="2.2" fill="none" className={lit >= 0 ? 'sitar-ring' : undefined} />
          </g>
        </svg>
        <div className="sn-labels sn2-labels" aria-hidden="true">
          {list.map((f, i) => (
            <span
              key={`${f.s}${f.oct}`}
              style={vertical ? { top: `${((center(i) - view.x) / view.w) * 100}%` } : { left: `${((center(i) - view.x) / view.w) * 100}%` }}
              data-lit={lit === i || undefined}
              data-out={!f.inRaga || undefined}
            >
              <SwaraLabel s={f.s} oct={f.oct} ati={f.ati} />
              {!vertical && <kbd className="sn2-key">{keyForFret(i).toUpperCase()}</kbd>}
            </span>
          ))}
        </div>
      </div>
      <div className="sn2-strip mt-3" aria-live="off">
        <span className="sn2-strip-label">You played</span>
        {played.length ? (
          played.map((p) => (
            <span key={p.id} className="sn2-strip-note">
              <SwaraLabel s={p.s} oct={p.oct} ati={p.ati} />
            </span>
          ))
        ) : (
          <span className="text-muted">nothing yet</span>
        )}
      </div>
    </div>
  );
}
