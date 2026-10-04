import { useCallback, useEffect, useRef, useState } from 'react';
import { RiPlayFill, RiPauseFill } from 'react-icons/ri';
import { audioContext } from '../../lib/audio';
import { prefersReducedMotion } from '../../lib/hooks';

// A day at the mandir: an illustration of a carved stone mandir in its gardens,
// on a lotus lake, from dawn to night. The slider (or Play the day) moves the
// sun across; the stone warms at dusk and the mandir is lit at night, its
// reflection in the lake. Tap the water to float a diya, the mandir to ring
// the bell, the peacock to fan its tail.
//
// The time of day is drawn with CSS variables set straight on the SVG, so
// dragging the slider never re-renders the drawing.

const sfx = () => import('../../lib/sfx');

// dawn, noon, dusk, night
const KEYS = [0, 0.35, 0.7, 1];
const PALETTE = {
  'sky-top': ['#6a7bc0', '#3e8fd9', '#3a3a7c', '#050918'],
  'sky-bottom': ['#ffc6a0', '#cbe7f8', '#ff9456', '#1b2149'],
  'hill-far': ['#a2a2c8', '#9cc0d2', '#7d5a80', '#131b38'],
  'hill-near': ['#7f957a', '#6f9c5c', '#5a4858', '#0c1427'],
  stone: ['#f2d3bf', '#f4e8d8', '#f6b97a', '#f1c27d'],
  'stone-shade': ['#caa694', '#cdb9a4', '#c27a4e', '#9a6a3f'],
  carve: ['#a5806e', '#a68e79', '#97532f', '#6b4127'],
  arch: ['#b78f7c', '#b9a08b', '#a95d36', '#ffd98a'],
  water: ['#aab6d8', '#79b6d9', '#c27a63', '#0b1532'],
  'water-deep': ['#7f90bd', '#4b8cb8', '#7a4955', '#050b1e'],
  lawn: ['#6f9b5c', '#5b9d45', '#4e6c3f', '#102118'],
  'lawn-dark': ['#567f47', '#467f35', '#3b5631', '#0a1711'],
  tree: ['#3e6a45', '#2e6b38', '#3b3f34', '#08140f'],
  'tree-light': ['#618c5b', '#4f8e45', '#6d5b3c', '#10201a'],
};
const PHASES = [
  { at: 0, name: 'Dawn', text: 'Dawn. The first light reaches the carved stone, and the lotuses begin to open.' },
  { at: 0.25, name: 'Midday', text: 'Midday. Every pillar and every carving in sharp relief.' },
  { at: 0.55, name: 'Dusk', text: 'Dusk. The stone turns gold.' },
  { at: 0.82, name: 'Night', text: 'Night. The mandir is lit, and the lake holds its reflection.' },
];
const phaseOf = (t) => [...PHASES].reverse().find((p) => t >= p.at) ?? PHASES[0];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const clamp01 = (v) => Math.max(0, Math.min(1, v));
function colorAt(stops, t) {
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1]) i++;
  const k = clamp01((t - KEYS[i]) / (KEYS[i + 1] - KEYS[i]));
  const a = hex(stops[i]);
  const b = hex(stops[i + 1]);
  return `rgb(${a.map((v, n) => Math.round(v + (b[n] - v) * k)).join(',')})`;
}

// the mandir, drawn once: parikrama wings, the plinth of elephants, the
// pillared body, the upper storey, chhatris, side domes and the central dome
function MandirShape() {
  const wing = (side) => {
    const x0 = side < 0 ? 150 : 630;
    return (
      <g key={side}>
        <rect x={x0} y="266" width="180" height="34" fill="var(--ak-stone)" />
        <rect x={x0 - 4} y="261" width="188" height="6" fill="var(--ak-stone-shade)" />
        {Array.from({ length: 9 }, (_, i) => {
          const x = x0 + 6 + i * 19.5;
          return <path key={i} d={`M${x} 298 V282 Q${x + 6.5} 272 ${x + 13} 282 V298 Z`} fill="var(--ak-arch)" />;
        })}
        {Array.from({ length: 5 }, (_, i) => {
          const x = x0 + 18 + i * 36;
          return <path key={i} d={`M${x - 7} 261 Q${x - 7} 251 ${x} 248 Q${x + 7} 251 ${x + 7} 261 Z`} fill="var(--ak-stone)" stroke="var(--ak-carve)" strokeWidth="0.6" />;
        })}
      </g>
    );
  };
  const dome = (cx, base, s) => (
    <g transform={`translate(${cx} ${base}) scale(${s})`}>
      <rect x="-40" y="-18" width="80" height="18" fill="var(--ak-stone-shade)" />
      <path d="M-48 -16 C-52 -46 -34 -70 -10 -80 Q0 -84 10 -80 C34 -70 52 -46 48 -16 Z" fill="var(--ak-stone)" />
      {[-30, -14, 0, 14, 30].map((x) => (
        <path key={x} d={`M${x} -16 C${x * 0.85} -46 ${x * 0.5} -68 0 -80`} fill="none" stroke="var(--ak-carve)" strokeWidth="1" opacity="0.55" />
      ))}
      <path d="M-48 -16 H48" stroke="var(--ak-carve)" strokeWidth="1.6" />
      <ellipse cx="0" cy="-84" rx="5" ry="3" fill="var(--ak-stone-shade)" />
      <path d="M-3 -86 Q0 -100 3 -86 Z" fill="#d9a441" />
      <circle cx="0" cy="-101" r="2.6" fill="#d9a441" />
    </g>
  );
  const chhatri = (cx) => (
    <g key={cx}>
      <path d={`M${cx - 14} 170 V150 M${cx + 14} 170 V150 M${cx - 5} 170 V150 M${cx + 5} 170 V150`} stroke="var(--ak-stone-shade)" strokeWidth="2.2" />
      <rect x={cx - 17} y="146" width="34" height="5" fill="var(--ak-stone)" />
      <path d={`M${cx - 15} 146 Q${cx - 15} 130 ${cx} 124 Q${cx + 15} 130 ${cx + 15} 146 Z`} fill="var(--ak-stone)" stroke="var(--ak-carve)" strokeWidth="0.7" />
      <circle cx={cx} cy="121" r="2" fill="#d9a441" />
    </g>
  );
  return (
    <g>
      {wing(-1)}
      {wing(1)}
      {/* the plinth, with its frieze of elephants */}
      <rect x="326" y="294" width="308" height="26" fill="var(--ak-stone)" />
      <rect x="326" y="292" width="308" height="4" fill="var(--ak-stone-shade)" />
      {Array.from({ length: 13 }, (_, i) => {
        const x = 336 + i * 22.5;
        return <path key={i} d={`M${x} 316 V309 Q${x} 302 ${x + 7} 302 Q${x + 14} 302 ${x + 15} 307 L${x + 17} 312 L${x + 15} 312 L${x + 14} 309 V316 H${x + 11} V312 H${x + 4} V316 Z`} fill="var(--ak-carve)" opacity="0.7" />;
      })}
      {/* the body: pillars and arches */}
      <rect x="360" y="214" width="240" height="80" fill="var(--ak-stone)" />
      {Array.from({ length: 5 }, (_, i) => {
        const x = 374 + i * 44;
        return (
          <g key={i}>
            <path d={`M${x} 294 V250 Q${x + 16} 230 ${x + 32} 250 V294 Z`} fill="var(--ak-arch)" />
            <path d={`M${x - 4} 294 V222 M${x + 36} 294 V222`} stroke="var(--ak-carve)" strokeWidth="1.4" opacity="0.6" />
          </g>
        );
      })}
      <rect x="352" y="206" width="256" height="9" fill="var(--ak-stone-shade)" />
      <path d="M356 210 H604" stroke="var(--ak-carve)" strokeWidth="1" strokeDasharray="2 3" />
      {/* the upper storey */}
      <rect x="382" y="176" width="196" height="30" fill="var(--ak-stone)" />
      {Array.from({ length: 7 }, (_, i) => {
        const x = 390 + i * 27;
        return <path key={i} d={`M${x} 206 V192 Q${x + 9} 183 ${x + 18} 192 V206 Z`} fill="var(--ak-arch)" />;
      })}
      <rect x="374" y="170" width="212" height="7" fill="var(--ak-stone-shade)" />
      {chhatri(374)}
      {chhatri(586)}
      {/* side domes and the central dome, with its finial and flag */}
      {dome(424, 170, 0.5)}
      {dome(536, 170, 0.5)}
      <rect x="440" y="150" width="80" height="20" fill="var(--ak-stone-shade)" />
      {dome(480, 152, 1)}
      <path d="M480 52 V30" stroke="#8a6a3a" strokeWidth="1.4" />
      <path className="ak-flag" d="M480 30 L500 35 L480 41 Z" fill="#f08a24" />
      {/* the steps */}
      <path d="M446 320 H514 L530 338 H430 Z" fill="var(--ak-stone)" />
      <path d="M440 326 H520 M435 332 H525" stroke="var(--ak-carve)" strokeWidth="0.8" opacity="0.6" />
    </g>
  );
}

const STARS = Array.from({ length: 46 }, (_, i) => {
  const r = Math.sin(i * 12.9898) * 43758.5453;
  const f = r - Math.floor(r);
  const r2 = Math.sin(i * 78.233) * 12345.678;
  const g = r2 - Math.floor(r2);
  return [20 + f * 920, 12 + g * 200, f > 0.85 ? 1.6 : 0.9];
});
const PADS = [
  [196, 420, 1],
  [262, 452, 0.8],
  [356, 398, 0.7],
  [612, 404, 0.75],
  [700, 446, 0.9],
  [784, 414, 1],
];

export default function AkshardhamScene() {
  const svg = useRef(null);
  const tRef = useRef(0.3);
  const [t, setT] = useState(0.3);
  const [phase, setPhase] = useState(phaseOf(0.3));
  const [diyas, setDiyas] = useState([]);
  const [fanned, setFanned] = useState(false);
  const [ringing, setRinging] = useState(0);
  const [playing, setPlaying] = useState(false);
  const anim = useRef(0);

  // draw a time of day: colors, the sun and moon, the lights, the lotuses
  const apply = useCallback((v) => {
    const el = svg.current;
    if (!el) return;
    tRef.current = v;
    for (const [name, stops] of Object.entries(PALETTE)) el.style.setProperty(`--ak-${name}`, colorAt(stops, v));
    const u = clamp01(v / 0.75);
    const sx = 110 + u * 740;
    const sy = 300 - Math.sin(u * Math.PI) * 236;
    el.style.setProperty('--ak-sun-x', `${sx.toFixed(1)}px`);
    el.style.setProperty('--ak-sun-y', `${sy.toFixed(1)}px`);
    el.style.setProperty('--ak-sun', String(v < 0.7 ? 1 : clamp01((0.78 - v) / 0.08)));
    el.style.setProperty('--ak-moon', String(clamp01((v - 0.74) / 0.12)));
    el.style.setProperty('--ak-stars', String(clamp01((v - 0.78) / 0.18)));
    el.style.setProperty('--ak-glow', String(clamp01((v - 0.72) / 0.16)));
    el.style.setProperty('--ak-birds', String(clamp01(1 - Math.abs(v - 0.3) / 0.32)));
    const bloom = v < 0.15 ? 0.45 + (v / 0.15) * 0.55 : v < 0.62 ? 1 : Math.max(0.4, 1 - ((v - 0.62) / 0.3) * 0.6);
    el.style.setProperty('--ak-bloom', bloom.toFixed(3));
    const p = phaseOf(v);
    setPhase((old) => (old.name === p.name ? old : p));
  }, []);

  useEffect(() => {
    apply(tRef.current);
    return () => cancelAnimationFrame(anim.current);
  }, [apply]);

  const onSlide = (e) => {
    const v = Number(e.target.value) / 100;
    cancelAnimationFrame(anim.current);
    setPlaying(false);
    setT(v);
    apply(v);
  };

  // a timelapse from wherever the slider is, through to night
  const playDay = () => {
    if (playing) {
      cancelAnimationFrame(anim.current);
      setPlaying(false);
      setT(tRef.current);
      return;
    }
    audioContext();
    const from = tRef.current >= 0.98 ? 0 : tRef.current;
    if (prefersReducedMotion()) {
      setT(1);
      apply(1);
      return;
    }
    const dur = 16000 * (1 - from);
    const start = performance.now();
    setPlaying(true);
    const step = (now) => {
      const v = Math.min(1, from + ((now - start) / dur) * (1 - from));
      apply(v);
      if (v < 1) anim.current = requestAnimationFrame(step);
      else {
        setPlaying(false);
        setT(1);
      }
    };
    anim.current = requestAnimationFrame(step);
  };

  const float = (x) => {
    audioContext();
    sfx().then((s) => s.plop());
    const id = Date.now() + Math.random();
    const y = 392 + Math.random() * 66;
    setDiyas((d) => [...d.slice(-11), { id, x: Math.max(60, Math.min(860, x)), y }]);
  };
  const onWater = (e) => {
    const el = svg.current;
    if (!el) return;
    const pt = el.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(el.getScreenCTM().inverse());
    float(p.x);
  };
  const ring = () => {
    audioContext();
    sfx().then((s) => s.ghanta());
    setRinging(Date.now());
  };
  const fan = () => {
    audioContext();
    setFanned((f) => !f);
  };

  return (
    <div className="ak">
      <div className="ak-frame">
        <svg ref={svg} viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" className="ak-scene" role="img" aria-label={`An illustrated mandir on a lotus lake, at ${phase.name.toLowerCase()}`}>
          <defs>
            <linearGradient id="ak-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--ak-sky-top)" />
              <stop offset="1" stopColor="var(--ak-sky-bottom)" />
            </linearGradient>
            <linearGradient id="ak-water" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--ak-water)" />
              <stop offset="1" stopColor="var(--ak-water-deep)" />
            </linearGradient>
            <linearGradient id="ak-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask id="ak-reflect-mask" maskUnits="userSpaceOnUse" x="0" y="338" width="960" height="134">
              <rect x="0" y="338" width="960" height="134" fill="url(#ak-fade)" />
            </mask>
            <radialGradient id="ak-sunglow">
              <stop offset="0" stopColor="#fff6d6" />
              <stop offset="0.35" stopColor="#ffe3a0" stopOpacity="0.8" />
              <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="ak-lit">
              <stop offset="0" stopColor="#ffd98a" stopOpacity="0.75" />
              <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
            </radialGradient>
            <g id="ak-mandir">
              <MandirShape />
            </g>
          </defs>

          {/* sky, stars, moon and sun */}
          <rect width="960" height="540" fill="url(#ak-sky)" />
          <g className="ak-stars">
            {STARS.map(([x, y, r], i) => (
              <circle key={i} cx={x} cy={y} r={r} fill="#ffffff" />
            ))}
          </g>
          <g className="ak-moon">
            <circle cx="800" cy="84" r="22" fill="#f4eed8" />
            <circle cx="811" cy="78" r="20" fill="var(--ak-sky-top)" />
          </g>
          <g className="ak-sun">
            <circle r="70" fill="url(#ak-sunglow)" />
            <circle r="24" fill="#fff4d1" />
          </g>
          <g className="ak-birds" fill="none" stroke="#2a2f3a" strokeWidth="2" strokeLinecap="round">
            <path className="ak-bird ak-bird-a" d="M0 0 q6 -6 12 0 q6 -6 12 0" />
            <path className="ak-bird ak-bird-b" d="M0 0 q5 -5 10 0 q5 -5 10 0" />
            <path className="ak-bird ak-bird-c" d="M0 0 q4 -4 8 0 q4 -4 8 0" />
          </g>

          {/* far hills and the tree line */}
          <path d="M0 282 C90 250 170 262 250 246 C330 232 400 250 470 240 C560 228 650 248 730 236 C820 222 900 246 960 238 V340 H0 Z" fill="var(--ak-hill-far)" />
          <path d="M0 312 C60 296 120 304 180 292 C250 280 300 300 360 296 L600 296 C660 294 720 280 790 290 C850 298 910 286 960 294 V340 H0 Z" fill="var(--ak-hill-near)" />

          {/* the mandir's glow at night, then the mandir */}
          <ellipse className="ak-glow" cx="480" cy="230" rx="300" ry="170" fill="url(#ak-lit)" />
          <use href="#ak-mandir" className="ak-mandir" data-ring={ringing || undefined} onClick={ring} />
          <g key={ringing} className="ak-ring-wave" data-on={ringing || undefined} aria-hidden="true">
            <circle cx="480" cy="110" r="40" fill="none" stroke="#ffe3a0" strokeWidth="3" />
          </g>

          {/* the lake, the mandir's reflection, lotuses and floating diyas */}
          <rect className="ak-water" x="0" y="338" width="960" height="134" fill="url(#ak-water)" onClick={onWater} />
          <g mask="url(#ak-reflect-mask)" pointerEvents="none">
            <use href="#ak-mandir" transform="translate(0 676) scale(1 -1)" />
          </g>
          <g className="ak-ripples" pointerEvents="none" stroke="#ffffff" strokeLinecap="round">
            {[
              [120, 352, 70],
              [420, 366, 120],
              [700, 360, 90],
              [240, 388, 60],
              [560, 392, 80],
              [820, 400, 60],
              [380, 430, 90],
              [640, 440, 70],
            ].map(([x, y, w], i) => (
              <path key={i} d={`M${x} ${y} h${w}`} strokeWidth="1.2" opacity="0.25" />
            ))}
          </g>
          {PADS.map(([x, y, s], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${s})`} pointerEvents="none">
              <ellipse cx="0" cy="0" rx="26" ry="8" fill="#3f7a47" />
              <path d="M0 0 L22 -3" stroke="#2c5a34" strokeWidth="1.4" />
              {i % 2 === 0 && (
                <g className="ak-lotus" transform="translate(-4 -4)">
                  <path d="M0 0 C-8 -6 -9 -14 -4 -18 C-1 -12 0 -6 0 0 Z M0 0 C8 -6 9 -14 4 -18 C1 -12 0 -6 0 0 Z" fill="#f2a3c0" />
                  <path d="M0 0 C-3 -8 -3 -16 0 -22 C3 -16 3 -8 0 0 Z" fill="#f7c4d6" />
                </g>
              )}
            </g>
          ))}
          {diyas.map((d) => (
            <g key={d.id} transform={`translate(${d.x.toFixed(1)} ${d.y.toFixed(1)})`} pointerEvents="none">
              <g className="ak-diya" onAnimationEnd={() => setDiyas((list) => list.filter((x) => x.id !== d.id))}>
                <ellipse cx="0" cy="3" rx="16" ry="4" fill="#ffd27a" opacity="0.35" />
                <path d="M-11 0 Q0 10 11 0 Z" fill="#b5652e" />
                <path d="M-11 0 H11" stroke="#7a3f1c" strokeWidth="1.4" />
                <path className="ak-flame" d="M0 -1 C-3 -6 -2 -10 0 -14 C2 -10 3 -6 0 -1 Z" fill="#ffcc4d" />
                <circle cx="0" cy="-7" r="9" fill="#ffd27a" opacity="0.35" />
              </g>
            </g>
          ))}

          {/* the lawn, the hedge and its marigolds, lamp posts and trees */}
          <rect x="0" y="470" width="960" height="70" fill="var(--ak-lawn)" />
          <rect x="0" y="468" width="960" height="12" fill="var(--ak-lawn-dark)" />
          <g>
            {Array.from({ length: 64 }, (_, i) => (
              <circle key={i} cx={8 + i * 15} cy={474 + (i % 2) * 3} r="3.2" fill={i % 3 ? '#f59e0b' : '#facc15'} />
            ))}
          </g>
          {[322, 638].map((x) => (
            <g key={x}>
              <path d={`M${x} 470 V430`} stroke="#3b3f46" strokeWidth="3" />
              <rect x={x - 6} y="420" width="12" height="12" rx="2" fill="#3b3f46" />
              <circle className="ak-lamp" cx={x} cy="426" r="16" fill="url(#ak-lit)" />
              <rect className="ak-lamp" x={x - 4} y="422" width="8" height="8" rx="1.5" fill="#ffe7a3" />
            </g>
          ))}
          {[
            [70, 470, 1.15],
            [890, 470, 1.25],
            [178, 470, 0.7],
            [786, 470, 0.75],
          ].map(([x, y, s], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
              <path d="M-5 0 V-60 M5 0 V-60" stroke="#4a3527" strokeWidth="5" />
              <circle cx="0" cy="-92" r="44" fill="var(--ak-tree)" />
              <circle cx="-30" cy="-70" r="30" fill="var(--ak-tree)" />
              <circle cx="32" cy="-72" r="30" fill="var(--ak-tree)" />
              <circle cx="-12" cy="-106" r="22" fill="var(--ak-tree-light)" opacity="0.8" />
              <circle cx="22" cy="-90" r="14" fill="var(--ak-tree-light)" opacity="0.6" />
            </g>
          ))}

          {/* a peacock on the lawn: tap it and it fans its tail */}
          <svg x="250" y="512" overflow="visible" className="ak-peacock" data-fanned={fanned || undefined} onClick={fan}>
            <g className="ak-fan">
              {Array.from({ length: 13 }, (_, i) => {
                const a = -170 + i * (160 / 12);
                return (
                  <g key={i} transform={`rotate(${a})`}>
                    <path d="M0 0 L56 -4 L56 4 Z" fill="#1f7a62" />
                    <circle cx="54" cy="0" r="6" fill="#0f5a8a" />
                    <circle cx="54" cy="0" r="3" fill="#e0b54a" />
                    <circle cx="54" cy="0" r="1.4" fill="#0b2d4a" />
                  </g>
                );
              })}
            </g>
            <path className="ak-train" d="M-6 2 C-30 6 -58 10 -84 6 C-60 16 -30 14 -4 8 Z" fill="#1f7a62" />
            <path d="M-8 0 C-8 -10 2 -14 10 -10 C14 -8 14 2 6 6 C0 8 -8 6 -8 0 Z" fill="#1d4fa8" />
            <path d="M6 -8 C8 -16 10 -22 14 -28" stroke="#1d4fa8" strokeWidth="5" strokeLinecap="round" fill="none" />
            <circle cx="15" cy="-29" r="4" fill="#1d4fa8" />
            <path d="M18 -30 L23 -28 L18 -27 Z" fill="#c9a04a" />
            <path d="M14 -33 L12 -40 M15 -33 L15 -41 M16 -33 L18 -40" stroke="#1d4fa8" strokeWidth="1" />
            <path d="M2 6 V14 M6 6 V14" stroke="#7a5a3a" strokeWidth="1.6" />
          </svg>
        </svg>
      </div>

      <div className="ak-controls">
        <label className="ak-slider">
          <span className="label">Time of day</span>
          <input type="range" min="0" max="100" step="1" value={Math.round(t * 100)} onChange={onSlide} aria-valuetext={phase.name} />
          <span className="ak-ticks" aria-hidden="true">
            {PHASES.map((p) => (
              <span key={p.name}>{p.name}</span>
            ))}
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary btn-sm" onClick={playDay}>
            {playing ? <RiPauseFill className="h-4 w-4" aria-hidden="true" /> : <RiPlayFill className="h-4 w-4" aria-hidden="true" />}
            {playing ? 'Pause' : 'Play the day'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => float(140 + Math.random() * 680)}>
            Float a diya
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={ring}>
            Ring the bell
          </button>
          <button type="button" className="btn btn-ghost btn-sm" aria-pressed={fanned} onClick={fan}>
            {fanned ? 'Fold the tail' : 'Fan the peacock'}
          </button>
        </div>
      </div>
      <p className="ak-caption" aria-live="polite">
        {phase.text} <span className="text-muted">Tap the lake to float a diya, the mandir to ring the bell.</span>
      </p>
    </div>
  );
}
