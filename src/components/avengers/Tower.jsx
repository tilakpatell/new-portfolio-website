// Avengers Tower, drawn tall and narrow the way it stands over Manhattan: a
// tapering glass shaft that leans into a crown with a landing deck and the A.
// `floors` lists the stops from the top down; the lit band shows where you are,
// so scrolling down the page rides the lift down the tower. With `onPick`, the
// floor names are a building directory you can click.

const BASE = 560; // where the shaft meets the street
const TOP = 70; // the crown

export default function Tower({ floors, current, onPick, className = '' }) {
  const step = (BASE - TOP - 110) / Math.max(1, floors.length - 1);
  const yAt = (i) => TOP + 110 + i * step;
  return (
    <svg viewBox="0 0 240 600" preserveAspectRatio="xMidYMax slice" className={`tower-svg ${className}`} aria-hidden={onPick ? undefined : 'true'} role={onPick ? 'group' : undefined} aria-label={onPick ? 'Building directory' : undefined}>
      <defs>
        <linearGradient id="tw-glass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5b6b7d" />
          <stop offset="0.35" stopColor="#c7d3df" />
          <stop offset="0.6" stopColor="#8394a6" />
          <stop offset="1" stopColor="#3d4957" />
        </linearGradient>
        <linearGradient id="tw-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--tw-sky-top)" />
          <stop offset="1" stopColor="var(--tw-sky-bottom)" />
        </linearGradient>
      </defs>
      <rect width="240" height="600" fill="url(#tw-sky)" />
      {/* the city around its feet */}
      {[
        [6, 430, 34],
        [44, 470, 28],
        [176, 450, 30],
        [204, 400, 32],
      ].map(([x, y, w]) => (
        <rect key={x} x={x} y={y} width={w} height={600 - y} fill="var(--tw-city)" />
      ))}
      {/* the shaft, wider at the foot, leaning into the crown */}
      <path d={`M80 ${BASE + 40} L96 ${TOP + 90} L150 ${TOP + 60} L168 ${BASE + 40} Z`} fill="url(#tw-glass)" stroke="#2d3742" strokeWidth="1.5" />
      <path d={`M150 ${TOP + 60} C176 ${TOP + 200} 168 ${BASE - 120} 182 ${BASE + 40} L168 ${BASE + 40} Z`} fill="#6e7f91" stroke="#2d3742" strokeWidth="1" />
      {Array.from({ length: 34 }, (_, i) => {
        const y = TOP + 100 + i * 14;
        return <path key={i} d={`M${95 - i * 0.45} ${y} L${152 + i * 0.5} ${y - 8}`} stroke="#2d3742" strokeOpacity="0.35" strokeWidth="1" />;
      })}
      {/* the crown: the deck out to the right, the cantilevered top, the A */}
      <path d={`M88 ${TOP + 96} L94 ${TOP + 40} L158 ${TOP + 22} L170 ${TOP + 70} Z`} fill="url(#tw-glass)" stroke="#2d3742" strokeWidth="1.5" />
      <path d={`M150 ${TOP + 64} C190 ${TOP + 58} 214 ${TOP + 62} 226 ${TOP + 70} L156 ${TOP + 84} Z`} fill="#9fb0c2" stroke="#2d3742" strokeWidth="1.2" />
      <path d={`M110 ${TOP + 40} L128 ${TOP - 30} L134 ${TOP - 28} L120 ${TOP + 38} Z`} fill="#8a9bad" stroke="#2d3742" strokeWidth="1" />
      <circle cx="116" cy={TOP + 70} r="14" fill="#1b2430" stroke="#c7d3df" strokeWidth="2" />
      <path d={`M109 ${TOP + 78} L116 ${TOP + 60} L123 ${TOP + 78} M112 ${TOP + 72} H121`} stroke="#c7d3df" strokeWidth="2.2" fill="none" />

      {/* the lift: one lit band per floor, the current one bright */}
      {floors.map((f, i) => (
        <g key={f.id} className={onPick ? 'tw-stop tw-stop-link' : 'tw-stop'} onClick={onPick ? () => onPick(f.id) : undefined} tabIndex={onPick ? 0 : undefined} role={onPick ? 'link' : undefined} aria-label={onPick ? `Go to ${f.title}` : undefined} onKeyDown={onPick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPick(f.id)) : undefined}>
          <rect x="96" y={yAt(i) - 3} width="58" height="6" rx="1" className="tw-floor" data-on={i === current || undefined} />
          <text x="72" y={yAt(i) + 3} textAnchor="end" className="tw-label" data-on={i === current || undefined}>
            {f.short}
          </text>
        </g>
      ))}
    </svg>
  );
}
