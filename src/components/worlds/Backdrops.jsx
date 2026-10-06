import '../../styles/lazy/worlds.css';
// Background art for the fan worlds, drawn in SVG so it takes each theme's
// colours and costs nothing to load: Middle-earth's Misty Mountains (the Shire's
// hills by day, Mordor by fire) and the skyline of Cybertron.

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// A jagged ridge across the width: `base` is its floor, peaks rise `h` above it.
function ridge(rand, base, h, step, jag = 1) {
  let d = `M0 360 L0 ${base}`;
  for (let x = 0; x <= 1440; x += step) {
    const peak = base - h * (0.35 + rand() * 0.65);
    d += ` L${x + step * 0.5} ${peak} L${x + step} ${base - h * rand() * 0.35 * jag}`;
  }
  return `${d} L1440 360 Z`;
}

export function MiddleEarth({ variant = 'shire', className = '' }) {
  const rand = rng(variant === 'mordor' ? 1066 : 1937);
  const mordor = variant === 'mordor';
  return (
    <svg viewBox="0 0 1440 360" preserveAspectRatio="xMidYMax slice" className={`backdrop backdrop-me ${className}`} data-variant={variant} aria-hidden="true">
      <defs>
        <linearGradient id={`me-sky-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--me-sky-top)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--me-sky-bottom)" />
        </linearGradient>
        <linearGradient id={`me-mist-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--me-mist)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--me-mist)" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <rect width="1440" height="360" fill={`url(#me-sky-${variant})`} />
      <path d={ridge(rand, 210, 150, 96)} fill="var(--me-far)" />
      <rect y="150" width="1440" height="120" fill={`url(#me-mist-${variant})`} />
      <path d={ridge(rand, 262, 120, 70)} fill="var(--me-mid)" />
      {mordor ? (
        <g>
          {/* Mount Doom, burning */}
          <path d="M1010 300 L1120 168 L1150 176 L1270 300 Z" fill="var(--me-near)" />
          <path d="M1112 176 L1136 152 L1158 178 Z" fill="#ff6a1a" className="me-lava" />
          {/* Barad-dûr, and the Eye */}
          <path d="M300 300 L318 120 L328 92 L334 120 L344 92 L352 120 L370 300 Z" fill="var(--me-near)" />
          <ellipse cx="335" cy="84" rx="14" ry="7" fill="#ff7a1a" className="me-eye" />
          <path d={ridge(rand, 330, 70, 44, 1.4)} fill="var(--me-near)" />
        </g>
      ) : (
        <g>
          {/* the Shire: rolling hills, a round door, a tree */}
          <path d="M0 360 L0 300 C 180 250 320 250 480 290 C 620 322 760 268 920 262 C 1080 256 1240 300 1440 280 L1440 360 Z" fill="var(--me-near)" />
          <circle cx="760" cy="300" r="15" fill="#3d6b2a" stroke="#c9a227" strokeWidth="2" />
          <circle cx="760" cy="300" r="2" fill="#c9a227" />
          <path d="M1120 262 v-28" stroke="#4a3b24" strokeWidth="4" />
          <circle cx="1120" cy="226" r="22" fill="var(--me-mid)" />
        </g>
      )}
    </svg>
  );
}

// Cybertron: Aligned-style spires with lit bands of energon, and a jagged,
// Bay-style ridge of shards in front.
export function Cybertron({ faction = 'autobot', className = '' }) {
  const rand = rng(faction === 'decepticon' ? 4242 : 1984);
  const towers = [];
  for (let x = -20; x < 1460; ) {
    const w = 34 + rand() * 70;
    const h = 120 + rand() * 210;
    towers.push({ x, w, h, cap: rand() });
    x += w + 6 + rand() * 18;
  }
  const spires = Array.from({ length: 14 }, () => ({ x: rand() * 1440, h: 180 + rand() * 160, w: 10 + rand() * 18 }));
  let shard = 'M0 360 L0 320';
  for (let x = 0; x <= 1440; x += 36) shard += ` L${x + 10 + rand() * 16} ${300 - rand() * 60} L${x + 36} ${318 - rand() * 14}`;
  shard += ' L1440 360 Z';
  return (
    <svg viewBox="0 0 1440 360" preserveAspectRatio="xMidYMax slice" className={`backdrop backdrop-cy ${className}`} data-faction={faction} aria-hidden="true">
      <defs>
        <linearGradient id={`cy-glow-${faction}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--cy-light)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--cy-light)" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <rect width="1440" height="360" fill={`url(#cy-glow-${faction})`} />
      {spires.map((s, i) => (
        <path key={i} d={`M${s.x - s.w / 2} 360 L${s.x - s.w / 6} ${360 - s.h} L${s.x} ${340 - s.h} L${s.x + s.w / 6} ${360 - s.h} L${s.x + s.w / 2} 360 Z`} fill="var(--cy-far)" />
      ))}
      {towers.map((t, i) => {
        const top = 360 - t.h;
        const cap = t.cap > 0.6 ? `L${t.x + t.w * 0.5} ${top - 22} ` : t.cap > 0.3 ? `L${t.x + t.w * 0.2} ${top - 12} L${t.x + t.w * 0.8} ${top - 12} ` : '';
        return (
          <g key={i}>
            <path d={`M${t.x} 360 L${t.x} ${top} ${cap}L${t.x + t.w} ${top} L${t.x + t.w} 360 Z`} fill="var(--cy-mid)" />
            {Array.from({ length: Math.floor(t.h / 26) }, (_, k) => (
              <rect key={k} x={t.x + 5} y={top + 14 + k * 26} width={t.w - 10} height="2" fill="var(--cy-light)" opacity={((i + k) % 3 === 0 ? 0.85 : 0.25).toString()} className={(i + k) % 7 === 0 ? 'cy-blink' : undefined} />
            ))}
          </g>
        );
      })}
      <path d={shard} fill="var(--cy-near)" />
    </svg>
  );
}

// The right backdrop for the active theme, or nothing.
export function ThemeBackdrop({ theme, className = '' }) {
  if (theme === 'shire' || theme === 'mordor') return <MiddleEarth variant={theme} className={className} />;
  if (['optimus', 'bumblebee'].includes(theme)) return <Cybertron faction="autobot" className={className} />;
  if (['megatron', 'shockwave', 'soundwave'].includes(theme)) return <Cybertron faction="decepticon" className={className} />;
  return null;
}
