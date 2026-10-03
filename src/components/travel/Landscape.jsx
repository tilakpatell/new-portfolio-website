import { useOnceVisible } from '../ui';

// Mountains over a lake: three ridges made by midpoint displacement from fixed
// seeds (so they're the same on every visit), rising into place the first time
// they're seen. Day shows a low sun; dark mode turns it to a moon and stars.
// Colours come from the theme, so the range retints with every theme.

const W = 1440;
const H = 320;
const SHORE = 252;

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A mountain range: peaks and valleys at seeded positions, each slope then
// roughened by midpoint displacement so the silhouette reads as rock, not waves.
function range({ seed, base, peaks, low, high, rough }) {
  const rand = mulberry32(seed);
  const control = [[-60, base - rand() * low]];
  let x = -60;
  while (x < W + 60) {
    const span = (W / peaks) * (0.65 + rand() * 0.7);
    control.push([x + span * (0.35 + rand() * 0.3), base - (low + rand() * (high - low))]);
    x += span;
    control.push([x, base - rand() * low * 0.7]);
  }
  const pts = [];
  for (let i = 0; i < control.length - 1; i++) {
    let seg = [control[i], control[i + 1]];
    let disp = Math.abs(control[i + 1][0] - control[i][0]) * rough;
    for (let level = 0; level < 4; level++) {
      const next = [];
      for (let k = 0; k < seg.length - 1; k++) {
        const [x1, y1] = seg[k];
        const [x2, y2] = seg[k + 1];
        next.push(seg[k], [(x1 + x2) / 2, (y1 + y2) / 2 + (rand() - 0.5) * disp]);
      }
      next.push(seg[seg.length - 1]);
      seg = next;
      disp *= 0.5;
    }
    pts.push(...(i === 0 ? seg : seg.slice(1)));
  }
  return pts.map(([px, py]) => [Math.round(px * 10) / 10, Math.round(Math.min(SHORE, py) * 10) / 10]);
}

const toPath = (pts) => `M-60 ${SHORE}L${pts.map(([x, y]) => `${x} ${y}`).join('L')}L${W + 60} ${SHORE}Z`;

const FAR = range({ seed: 11, base: 236, peaks: 6, low: 50, high: 196, rough: 0.16 });
const MID = range({ seed: 23, base: 246, peaks: 9, low: 24, high: 104, rough: 0.14 });
const NEAR = range({ seed: 5, base: 252, peaks: 15, low: 6, high: 44, rough: 0.12 });
const SNOWLINE = range({ seed: 3, base: 112, peaks: 22, low: 0, high: 14, rough: 0.2 });
const SNOW_CLIP = `M-60 0L${W + 60} 0L${[...SNOWLINE].reverse().map(([x, y]) => `${x} ${y}`).join('L')}Z`;

const starRand = mulberry32(99);
const STARS = Array.from({ length: 34 }, () => [Math.round(starRand() * W), Math.round(starRand() * 130 + 8), starRand() * 1.1 + 0.5, Math.round(starRand() * 4000)]);
const GLINTS = [
  [268, 0.42],
  [281, 0.3],
  [296, 0.36],
  [309, 0.22],
];

export default function Landscape({ className = '' }) {
  const ref = useOnceVisible('seen');
  return (
    <div ref={ref} className={`ls ${className}`} aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className="block h-full w-full">
        <defs>
          <clipPath id="ls-snow">
            <path d={SNOW_CLIP} />
          </clipPath>
          <clipPath id="ls-lake">
            <rect x="0" y={SHORE} width={W} height={H - SHORE} />
          </clipPath>
          <radialGradient id="ls-glow" cx="1064" cy="128" r="420" gradientUnits="userSpaceOnUse">
            <stop offset="0" className="ls-glow-in" />
            <stop offset="1" className="ls-glow-out" />
          </radialGradient>
          <linearGradient id="ls-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="ls-water-top" />
            <stop offset="1" className="ls-water-bottom" />
          </linearGradient>
        </defs>

        <rect className="ls-sky" x="0" y="0" width={W} height={SHORE} fill="url(#ls-glow)" />
        <g className="ls-stars">
          {STARS.map(([x, y, r, d], i) => (
            <circle key={i} cx={x} cy={y} r={r} style={{ animationDelay: `${d}ms` }} />
          ))}
        </g>
        <circle className="ls-sun" cx="1064" cy="128" r="38" />

        <g className="ls-layer ls-far">
          <path d={toPath(FAR)} />
          <path className="ls-snow" d={toPath(FAR)} clipPath="url(#ls-snow)" />
        </g>
        <g className="ls-layer ls-mid">
          <path d={toPath(MID)} />
        </g>
        <g className="ls-layer ls-near">
          <path d={toPath(NEAR)} />
        </g>

        <g className="ls-lake">
          <rect x="0" y={SHORE} width={W} height={H - SHORE} fill="url(#ls-water)" />
          <g clipPath="url(#ls-lake)" className="ls-reflection">
            <g transform={`translate(0 ${SHORE * 2}) scale(1 -1)`}>
              <path className="ls-mid-fill" d={toPath(MID)} />
              <path className="ls-near-fill" d={toPath(NEAR)} />
            </g>
          </g>
          {GLINTS.map(([y, o], i) => (
            <line key={y} className="ls-glint" x1="0" y1={y} x2={W} y2={y} style={{ opacity: o, animationDelay: `${i * -2.4}s` }} />
          ))}
        </g>
      </svg>
    </div>
  );
}
