import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { RiPauseFill, RiPlayFill } from 'react-icons/ri';
import { audioContext } from '../../lib/audio';
import { capturePointer } from '../../lib/pointer';
import { prefersReducedMotion } from '../../lib/hooks';
import { BOLS, LAYA, STROKES, TAALS, beatBols, bolLabel, planTihai } from './tablaRules';
import { playBol, setThekaLaya, setThekaTempo, startTheka, stopTheka, thekaPlaying, tihai, warmTabla } from './tabla';
import { surface } from './drumSkins';
import './music.css';
import '../../styles/lazy/music.css';

// The tabla: strike the drums yourself, or let it keep a taal. The dayan
// (right) is tuned to Sa; the bayan (left) is the bass.
//
// On the drums: the dayan's rim plays Na, the open skin Tin, the black syahi
// Tun. The bayan's skin plays Ge; keep pressing and slide away to lift its
// pitch, the gumki. Its edge plays Ke, a flat slap.
// Keys: G Dha, H Dhin, J Na, U Ta, K Tin, L Tun, ; Ti, I Te, O Ra, F Ge
// (Shift+F with gumki), D Ke, S Ga.

const PADS = [
  { bol: 'Dha', key: 'g', hint: 'Na and Ge together' },
  { bol: 'Dhin', key: 'h', hint: 'Tin and Ge together' },
  { bol: 'Na', key: 'j', hint: 'The dayan’s rim, ringing' },
  { bol: 'Ta', key: 'u', hint: 'The rim, struck fuller' },
  { bol: 'Tin', key: 'k', hint: 'The open skin, between rim and black' },
  { bol: 'Tun', key: 'l', hint: 'The black syahi, left to ring' },
  { bol: 'Ti', key: ';', hint: 'The syahi, closed with the fingers' },
  { bol: 'Te', key: 'i', hint: 'The syahi, closed with the middle fingers' },
  { bol: 'Ra', key: 'o', hint: 'The syahi, closed, the quick follow-up' },
  { bol: 'Ge', key: 'f', hint: 'The bayan, open. Shift for the gumki' },
  { bol: 'Ke', key: 'd', hint: 'The bayan, flat palm, closed' },
  { bol: 'Ga', key: 's', hint: 'The bayan, short' },
];

// The drums on the 440×260 drawing.
const BAYAN = { cx: 128, cy: 134, shell: 116, skin: 96, syahi: { cx: 110, cy: 124, r: 34 } };
const DAYAN = { cx: 330, cy: 138, shell: 86, skin: 70, kinar: 60, syahi: 26 };

const ZONE_NAMES = {
  Na: 'Rim (kinar)',
  Tin: 'Open skin (sur)',
  Tun: 'Syahi, open',
  Ge: 'Bayan, open. Press and slide away for the gumki',
  Ke: 'Bayan edge, flat palm',
};

// Which bol a point on the drawing plays, if any.
function zoneAt(x, y) {
  const dd = Math.hypot(x - DAYAN.cx, y - DAYAN.cy) / DAYAN.skin;
  if (dd <= DAYAN.syahi / DAYAN.skin) return { bol: 'Tun', drum: 'dayan' };
  if (dd <= DAYAN.kinar / DAYAN.skin) return { bol: 'Tin', drum: 'dayan' };
  if (dd <= DAYAN.shell / DAYAN.skin) return { bol: 'Na', drum: 'dayan' };
  const db = Math.hypot(x - BAYAN.cx, y - BAYAN.cy) / BAYAN.skin;
  if (db <= 0.82) return { bol: 'Ge', drum: 'bayan' };
  if (db <= BAYAN.shell / BAYAN.skin) return { bol: 'Ke', drum: 'bayan' };
  return null;
}

const drumsOf = (bol) => new Set((BOLS[bol] || []).map((p) => STROKES[p].drum));

function Lacing({ cx, cy, r0, r1, n, color }) {
  return (
    <g stroke={color} strokeLinecap="round">
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        const b = a + Math.PI / n;
        return <path key={i} d={`M${cx + Math.cos(a) * r0} ${cy + Math.sin(a) * r0} L${cx + Math.cos(b) * r1} ${cy + Math.sin(b) * r1}`} strokeWidth="2.2" />;
      })}
    </g>
  );
}

function Drums({ struck, ripples, hover, onPointerDown, onPointerMove, onPointerUp, onPointerLeave, svgRef }) {
  // its SVG's ids, its own (the music planet opens a second tabla)
  const idBase = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const uid = (name) => `${name}-${idBase}`;
  const s = useMemo(() => ({ dayanSkin: surface('dayanSkin'), bayanSkin: surface('bayanSkin'), syahi: surface('syahi'), copper: surface('copper') }), []);
  const B = BAYAN;
  const D = DAYAN;
  return (
    <svg
      ref={svgRef}
      viewBox="0 0 440 260"
      className="tb2-svg"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerLeave}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={uid('tb2-bayan-shell')}>
          <circle cx={B.cx} cy={B.cy} r={B.shell} />
        </clipPath>
        <clipPath id={uid('tb2-bayan-skin')}>
          <circle cx={B.cx} cy={B.cy} r={B.skin} />
        </clipPath>
        <clipPath id={uid('tb2-bayan-syahi')}>
          <circle cx={B.syahi.cx} cy={B.syahi.cy} r={B.syahi.r} />
        </clipPath>
        <clipPath id={uid('tb2-dayan-shell')}>
          <circle cx={D.cx} cy={D.cy} r={D.shell} />
        </clipPath>
        <clipPath id={uid('tb2-dayan-skin')}>
          <circle cx={D.cx} cy={D.cy} r={D.skin} />
        </clipPath>
        <clipPath id={uid('tb2-dayan-syahi')}>
          <circle cx={D.cx} cy={D.cy} r={D.syahi} />
        </clipPath>
        <radialGradient id={uid('tb2-shade')} cx="50%" cy="50%" r="50%">
          <stop offset="0.82" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.32" />
        </radialGradient>
        <radialGradient id={uid('tb2-floor')} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#000" stopOpacity="0.28" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* shadows on the floor cloth */}
      <ellipse cx={B.cx + 8} cy={B.cy + 14} rx={B.shell + 12} ry={B.shell + 6} fill={`url(#${uid('tb2-floor')})`} />
      <ellipse cx={D.cx + 6} cy={D.cy + 12} rx={D.shell + 10} ry={D.shell + 6} fill={`url(#${uid('tb2-floor')})`} />

      {/* bayan: hammered copper shell, leather lacing, the skin and its off-centre syahi */}
      <g className="tb2-drum" data-struck={struck.bayan || undefined} key={`b${struck.bayanN}`}>
        <image href={s.copper} x={B.cx - B.shell} y={B.cy - B.shell} width={B.shell * 2} height={B.shell * 2} clipPath={`url(#${uid('tb2-bayan-shell')})`} preserveAspectRatio="none" />
        <circle cx={B.cx} cy={B.cy} r={B.shell} fill={`url(#${uid('tb2-shade')})`} />
        <circle cx={B.cx} cy={B.cy} r={B.skin + 9} fill="#2d1a10" />
        <Lacing cx={B.cx} cy={B.cy} r0={B.skin + 2} r1={B.skin + 8} n={28} color="#6a4426" />
        <image href={s.bayanSkin} x={B.cx - B.skin} y={B.cy - B.skin} width={B.skin * 2} height={B.skin * 2} clipPath={`url(#${uid('tb2-bayan-skin')})`} preserveAspectRatio="none" />
        <circle cx={B.cx} cy={B.cy} r={B.skin - 7} fill="none" stroke="#8a6a44" strokeOpacity="0.35" strokeWidth="1" />
        <image href={s.syahi} x={B.syahi.cx - B.syahi.r} y={B.syahi.cy - B.syahi.r} width={B.syahi.r * 2} height={B.syahi.r * 2} clipPath={`url(#${uid('tb2-bayan-syahi')})`} preserveAspectRatio="none" />
        <circle cx={B.cx} cy={B.cy} r={B.skin} className="tb2-zone" data-on={hover === 'Ge' || undefined} />
        <circle cx={B.cx} cy={B.cy} r={B.skin * 0.82} fill="none" className="tb2-zone-line" data-on={hover === 'Ge' || hover === 'Ke' || undefined} />
      </g>

      {/* dayan: rosewood shell, braided gajra, kinar, sur and syahi */}
      <g className="tb2-drum" data-struck={struck.dayan || undefined} key={`d${struck.dayanN}`}>
        <image href="/textures/music/rosewood.webp" x={D.cx - D.shell} y={D.cy - D.shell} width={D.shell * 2} height={D.shell * 2} clipPath={`url(#${uid('tb2-dayan-shell')})`} preserveAspectRatio="none" />
        <circle cx={D.cx} cy={D.cy} r={D.shell} fill={`url(#${uid('tb2-shade')})`} />
        <circle cx={D.cx} cy={D.cy} r={D.skin + 8} fill="#2a150b" />
        <Lacing cx={D.cx} cy={D.cy} r0={D.skin + 1} r1={D.skin + 7} n={32} color="#8a6a48" />
        <image href={s.dayanSkin} x={D.cx - D.skin} y={D.cy - D.skin} width={D.skin * 2} height={D.skin * 2} clipPath={`url(#${uid('tb2-dayan-skin')})`} preserveAspectRatio="none" />
        {/* the kinar is a separate ring of skin, laid over the main one */}
        <circle cx={D.cx} cy={D.cy} r={(D.skin + D.kinar) / 2} fill="none" stroke="#e9dcbc" strokeOpacity="0.55" strokeWidth={D.skin - D.kinar} />
        <circle cx={D.cx} cy={D.cy} r={D.kinar} fill="none" stroke="#7a5a3a" strokeOpacity="0.45" strokeWidth="1" />
        <image href={s.syahi} x={D.cx - D.syahi} y={D.cy - D.syahi} width={D.syahi * 2} height={D.syahi * 2} clipPath={`url(#${uid('tb2-dayan-syahi')})`} preserveAspectRatio="none" />
        <circle cx={D.cx} cy={D.cy} r={D.syahi} className="tb2-zone" data-on={hover === 'Tun' || undefined} />
        <circle cx={D.cx} cy={D.cy} r={(D.kinar + D.syahi) / 2} fill="none" className="tb2-zone-band" strokeWidth={D.kinar - D.syahi} data-on={hover === 'Tin' || undefined} />
        <circle cx={D.cx} cy={D.cy} r={(D.skin + D.kinar) / 2} fill="none" className="tb2-zone-band" strokeWidth={D.skin - D.kinar} data-on={hover === 'Na' || undefined} />
      </g>

      {/* where the hand landed */}
      {ripples.map((r) => (
        <g key={r.id} className="tb2-ripple" style={{ transformOrigin: `${r.x}px ${r.y}px` }}>
          <circle cx={r.x} cy={r.y} r="14" />
          <text x={r.x} y={r.y - 20} textAnchor="middle">
            {r.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function Tabla({ onPlay }) {
  const [taal, setTaal] = useState('teentaal');
  const [bpm, setBpm] = useState(TAALS.teentaal.bpm);
  const [laya, setLaya] = useState('thah');
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(-1);
  const [tihaiState, setTihaiState] = useState(null); // null | 'set'
  const [landed, setLanded] = useState(0);
  const [struck, setStruck] = useState({ dayan: false, bayan: false, dayanN: 0, bayanN: 0 });
  const [ripples, setRipples] = useState([]);
  const [hover, setHover] = useState(null);
  const box = useRef(null);
  const svg = useRef(null);
  const press = useRef(null);
  const rid = useRef(0);
  const t = TAALS[taal];
  const still = useMemo(() => prefersReducedMotion(), []);

  useEffect(() => () => stopTheka(), []);
  // fetch and decode the strokes as the drums come into view, before the first one
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      warmTabla();
      return undefined;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        warmTabla();
        io.disconnect();
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const flash = (bol) => {
    const d = drumsOf(bol);
    setStruck((s) => ({
      dayan: d.has('dayan'),
      bayan: d.has('bayan'),
      dayanN: s.dayanN + (d.has('dayan') ? 1 : 0),
      bayanN: s.bayanN + (d.has('bayan') ? 1 : 0),
    }));
  };
  const ripple = (x, y, label) => {
    if (still) return;
    const id = ++rid.current;
    setRipples((list) => [...list.slice(-5), { id, x, y, label }]);
    setTimeout(() => setRipples((list) => list.filter((r) => r.id !== id)), 700);
  };

  const strike = (bol, opts = {}) => {
    if (!audioContext()) return null; // in the gesture, before anything else
    const h = playBol(bol, { human: false, ...opts });
    flash(bol);
    onPlay?.('tabla');
    return h;
  };

  // ── on the drums ──
  const toDrawing = (e) => {
    const r = svg.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 440, y: ((e.clientY - r.top) / r.height) * 260 };
  };
  const onDown = (e) => {
    const p = toDrawing(e);
    const z = zoneAt(p.x, p.y);
    if (!z) return;
    e.preventDefault();
    capturePointer(e);
    const handle = strike(z.bol, { vel: 0.95 });
    ripple(p.x, p.y, z.bol);
    press.current = { id: e.pointerId, x: p.x, y: p.y, bol: z.bol, handle, bent: 0 };
  };
  const onMove = (e) => {
    const pr = press.current;
    if (pr && pr.id === e.pointerId) {
      // the gumki: the further the heel of the hand slides while pressing, the higher the Ge
      if (pr.bol !== 'Ge') return;
      const p = toDrawing(e);
      const st = Math.min(6, Math.hypot(p.x - pr.x, p.y - pr.y) / 9);
      if (Math.abs(st - pr.bent) > 0.15) {
        pr.handle?.bend?.(st);
        pr.bent = st;
      }
      return;
    }
    if (e.pointerType !== 'mouse') return;
    const p = toDrawing(e);
    setHover(zoneAt(p.x, p.y)?.bol || null);
  };
  const onUp = (e) => {
    const pr = press.current;
    if (!pr || pr.id !== e.pointerId) return;
    if (pr.bent > 0) pr.handle?.bend?.(0); // pressure off: the pitch falls back
    press.current = null;
  };

  // ── keys ──
  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const pad = PADS.find((p) => p.key === e.key.toLowerCase());
    if (!pad) return;
    e.preventDefault();
    strike(pad.bol, { gumki: pad.bol === 'Ge' && e.shiftKey });
  };

  // ── the theka ──
  const taalRef = useRef(taal);
  const layaRef = useRef(laya);
  taalRef.current = taal;
  layaRef.current = laya;
  const onBeat = (i) => {
    setBeat(i);
    // the drums move with the beat's first bol
    const first = beatBols(TAALS[taalRef.current], i, LAYA[layaRef.current])[0]?.[1];
    if (first) flash(first);
  };
  const onTihai = (s) => {
    if (s === 'set') setTihaiState('set');
    else {
      setTihaiState(null);
      setLanded((n) => n + 1);
    }
  };
  const begin = (id, tempo, l) => {
    startTheka(id, tempo, onBeat, { laya: l, onTihai });
    setPlaying(true);
    setTihaiState(null);
  };
  const toggle = () => {
    if (!audioContext()) return;
    if (thekaPlaying()) {
      stopTheka();
      setPlaying(false);
      setBeat(-1);
      setTihaiState(null);
      return;
    }
    begin(taal, bpm, laya);
    onPlay?.('tabla');
  };
  const pickTaal = (id) => {
    setTaal(id);
    setBpm(TAALS[id].bpm);
    setBeat(-1);
    if (thekaPlaying()) begin(id, TAALS[id].bpm, laya);
  };
  const pickLaya = (l) => {
    setLaya(l);
    setThekaLaya(l);
  };
  const askTihai = () => {
    if (tihai()) setTihaiState('asked');
  };

  // where each vibhag starts, for the clap marks
  const starts = [];
  t.vibhag.reduce((at, len) => {
    starts.push(at);
    return at + len;
  }, 0);
  const plan = useMemo(() => planTihai(t.theka.length), [t]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
      <div
        ref={box}
        onKeyDown={onKey}
        role="group"
        aria-label="Tabla. On the drums: the right drum’s rim plays Na, its open skin Tin, its black centre Tun; the left drum plays Ge, its edge Ke. Keys: G Dha, H Dhin, J Na, U Ta, K Tin, L Tun, semicolon Ti, I Te, O Ra, F Ge, Shift F Ge with gumki, D Ke, S Ga."
        tabIndex={0}
        className="tabla-play"
      >
        <Drums
          svgRef={svg}
          struck={struck}
          ripples={ripples}
          hover={hover}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={() => setHover(null)}
        />
        <p className="tb2-caption" aria-hidden="true">
          {hover ? `${ZONE_NAMES[hover]}: ${hover}` : 'Play on the drums, the bols below, or the keys.'}
        </p>
        <div className="tb2-pads mt-3" role="group" aria-label="Bols">
          {PADS.map((p) => (
            <button
              key={p.bol}
              type="button"
              className="tabla-pad"
              title={p.hint}
              data-drum={[...drumsOf(p.bol)].join(' ')}
              onPointerDown={(e) => {
                e.preventDefault();
                strike(p.bol);
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                e.stopPropagation();
                strike(p.bol);
              }}
            >
              <span className="text-base font-semibold text-ink">{p.bol}</span>
              <kbd className="palette-kbd">{p.key === ';' ? ';' : p.key.toUpperCase()}</kbd>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="seg flex-wrap" role="group" aria-label="Taal">
          {Object.entries(TAALS).map(([id, tl]) => (
            <button key={id} type="button" aria-pressed={taal === id} onClick={() => pickTaal(id)}>
              {tl.name} <span className="text-muted">{tl.theka.length}</span>
            </button>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" onClick={toggle} aria-pressed={playing}>
            {playing ? <RiPauseFill className="h-4 w-4" aria-hidden="true" /> : <RiPlayFill className="h-4 w-4" aria-hidden="true" />}
            {playing ? 'Stop' : `Play ${t.name}`}
          </button>
          <button type="button" className="btn btn-ghost" onClick={askTihai} disabled={!playing || tihaiState !== null}>
            {tihaiState ? 'Tihai coming…' : 'Land a tihai'}
          </button>
          <div className="seg" role="group" aria-label="Laya: bols to a beat">
            {[
              ['thah', 'Thah'],
              ['dugun', 'Dugun'],
              ['chaugun', 'Chaugun'],
            ].map(([id, name]) => (
              <button key={id} type="button" aria-pressed={laya === id} onClick={() => pickLaya(id)}>
                {name}
              </button>
            ))}
          </div>
        </div>
        <label className="mt-4 flex items-center gap-3 text-sm text-body">
          <span className="whitespace-nowrap">Tempo</span>
          <input
            type="range"
            min="40"
            max="320"
            step="1"
            value={bpm}
            onChange={(e) => {
              const v = Number(e.target.value);
              setBpm(v);
              setThekaTempo(v);
            }}
            className="min-w-0 flex-1"
            aria-valuetext={`${bpm} beats a minute`}
          />
          <span className="mono w-16 text-right tabular-nums">{bpm} bpm</span>
        </label>
        <ol className="taal-grid tb2-grid mt-6" aria-label={`${t.name}: ${t.theka.length} beats`} style={{ '--beats': Math.min(t.theka.length, 8) }} data-tihai={tihaiState === 'set' || undefined}>
          {t.theka.map((cell, i) => {
            const v = starts.indexOf(i);
            return (
              <li
                key={i}
                className="taal-beat"
                data-now={beat === i || undefined}
                data-sam={i === 0 || undefined}
                data-vibhag={v >= 0 || undefined}
                data-tihai={(tihaiState === 'set' && i + 1 > plan.start) || undefined}
              >
                <span className="taal-mark" aria-hidden="true">
                  {v >= 0 ? t.marks[v] : ''}
                </span>
                <span className="taal-bol">{Array.isArray(cell) ? cell.map(bolLabel).join(' ') : bolLabel(cell)}</span>
                <span className="taal-n" aria-hidden="true">
                  {i + 1}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-sm text-muted">
          X is sam, the first beat, where the cycle lands. 0 is khali, the empty section, played without the bass. The numbers are claps. Dugun and chaugun fit two
          and four bols to each beat; a tihai plays a phrase three times so its last Dha falls on sam.
        </p>
        <p className="sr-only" aria-live="polite">
          {tihaiState === 'set' ? 'A tihai is coming, landing on sam.' : landed ? 'The tihai landed on sam.' : ''}
        </p>
      </div>
    </div>
  );
}
