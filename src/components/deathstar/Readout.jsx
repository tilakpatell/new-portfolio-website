import { AurebeshLine } from '../Wordmark';

// The stolen plans: a blueprint of the station, labelled in Aurebesh (point at
// a label to read it in English).
const PARTS = [
  { n: 1, name: 'Superlaser', note: 'Focus lens on the northern hemisphere', x: 128, y: 92 },
  { n: 2, name: 'Equatorial trench', note: 'Docking bays and turbolaser batteries', x: 238, y: 182 },
  { n: 3, name: 'Main reactor', note: 'Hypermatter core at the centre', x: 180, y: 180 },
  { n: 4, name: 'Thermal exhaust port', note: 'Two metres wide, ray-shielded, and unguarded', x: 214, y: 66 },
];

export default function Readout() {
  return (
    <section className="shell relative z-10 py-16 md:py-24" aria-labelledby="readout-title">
      <h2 id="readout-title" className="title">
        Technical readout
      </h2>
      <p className="lead mt-4 max-w-[52ch]">The plans, recovered. Labels are in Aurebesh; point at one to read it.</p>
      <div className="mt-10 grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <svg viewBox="0 0 360 360" className="readout-svg" role="img" aria-label="Blueprint of the Death Star with four labelled parts">
          <defs>
            <pattern id="blueprint-grid" width="18" height="18" patternUnits="userSpaceOnUse">
              <path d="M18 0H0V18" fill="none" stroke="rgba(120,170,255,0.12)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="360" height="360" fill="url(#blueprint-grid)" />
          <g fill="none" stroke="rgba(150,195,255,0.75)" strokeWidth="1.2">
            <circle cx="180" cy="180" r="140" />
            <ellipse cx="180" cy="180" rx="140" ry="18" strokeDasharray="4 4" />
            {[-100, -60, -20, 30, 70, 110].map((dy) => (
              <ellipse key={dy} cx="180" cy={180 + dy} rx={Math.sqrt(140 * 140 - dy * dy)} ry="8" opacity="0.35" />
            ))}
            <path d="M180 40 V320 M40 180 H320" opacity="0.25" />
            <circle cx="128" cy="92" r="30" />
            <circle cx="128" cy="92" r="18" opacity="0.6" />
            <circle cx="180" cy="180" r="22" strokeDasharray="3 3" />
            <path d="M214 66 l0 -4 M210 66 h8" />
          </g>
          {PARTS.map((p) => (
            <g key={p.n}>
              <circle cx={p.x} cy={p.y} r="9" fill="#05060b" stroke="#ffb347" strokeWidth="1.4" />
              <text x={p.x} y={p.y + 4} textAnchor="middle" className="readout-num">
                {p.n}
              </text>
            </g>
          ))}
        </svg>
        <ol className="grid gap-5">
          {PARTS.map((p) => (
            <li key={p.n} className="grid grid-cols-[2rem_1fr] gap-3">
              <span className="mono grid h-7 w-7 place-items-center rounded-full border border-[#ffb347] text-xs text-[#ffb347]">{p.n}</span>
              <div>
                <p className="text-xl text-ink">
                  <AurebeshLine>{p.name}</AurebeshLine>
                </p>
                <p className="mt-1 text-sm text-muted">
                  {p.name}. {p.note}.
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
