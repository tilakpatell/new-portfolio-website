// The Avengers HQ page at night: a dark sky with the light of the compound
// coming up from below, Stark's HUD grid faint over it, a few stars, and the
// Avengers' A. All CSS and SVG, painted once (styles/extras.css, "the look").

// The A in its ring: the right leg upright and out through the top of the
// ring, the crossbar an arrow out through its side.
export function AvengersMark({ className = '', title }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : 'true'}>
      <defs>
        <linearGradient id="hq-mark-steel" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#f4f7fa" />
          <stop offset="0.45" stopColor="#aeb8c4" />
          <stop offset="0.55" stopColor="#6c7887" />
          <stop offset="1" stopColor="#d5dce4" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#hq-mark-steel)">
        <circle cx="100" cy="104" r="76" strokeWidth="12" />
        <polyline points="52,188 127,10 127,188" strokeWidth="18" strokeLinejoin="miter" strokeMiterlimit="8" />
      </g>
      <polygon points="80,114 166,114 166,100 196,122 166,144 166,130 80,130" fill="url(#hq-mark-steel)" />
    </svg>
  );
}

export default function HQBackdrop() {
  return (
    <div className="hq-sky" aria-hidden="true">
      <div className="hq-sky-glow" />
      <div className="hq-sky-grid" />
      <div className="hq-sky-stars ds-stars" />
    </div>
  );
}
