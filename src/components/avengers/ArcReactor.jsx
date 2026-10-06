import { useRef, useState } from 'react';
import '../../styles/lazy/avengers.css';

// Tony Stark's arc reactor, the triangle one from Iron Man 2, inside a HUD.
// `power` 0–3 brightens the core; `blast` (a counter) fires a repulsor ring.

const COILS = Array.from({ length: 10 }, (_, i) => i * 36);

export default function ArcReactor({ power, blast }) {
  const svg = useRef(null);
  const [aim, setAim] = useState(null);
  const frame = useRef(0);
  const onMove = (e) => {
    const ctm = svg.current?.getScreenCTM();
    if (!ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => setAim({ x: Math.round(p.x), y: Math.round(p.y) }));
  };
  const level = ['0%', '100%', '200%', '400%'][power];
  return (
    <svg
      ref={svg}
      viewBox="-200 -200 400 400"
      className="reactor block h-auto w-full"
      data-power={power}
      role="img"
      aria-label={`An arc reactor, the triangular kind, at ${level} output`}
      onPointerMove={onMove}
      onPointerLeave={() => setAim(null)}
    >
      <defs>
        <radialGradient id="ar-steel" cx="40%" cy="35%" r="75%">
          <stop offset="0" stopColor="#c3ccd4" />
          <stop offset="0.5" stopColor="#6b747d" />
          <stop offset="1" stopColor="#262c32" />
        </radialGradient>
        <linearGradient id="ar-copper" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7a3d14" />
          <stop offset="0.45" stopColor="#e09a5a" />
          <stop offset="1" stopColor="#7a3d14" />
        </linearGradient>
        <radialGradient id="ar-core" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#d9fbff" />
          <stop offset="0.7" stopColor="#5fd6ff" />
          <stop offset="1" stopColor="#0b5f8f" />
        </radialGradient>
        <radialGradient id="ar-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0.45" stopColor="#7fdcff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#7fdcff" stopOpacity="0" />
        </radialGradient>
        <filter id="ar-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id="ar-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0 H0 V20" fill="none" stroke="#7fdcff" strokeOpacity="0.07" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="-200" y="-200" width="400" height="400" fill="#04070c" />
      <rect x="-200" y="-200" width="400" height="400" fill="url(#ar-grid)" />

      {/* the HUD: two rings turning against each other, and the readouts */}
      <g className="ar-hud">
        <circle className="ar-ring ar-ring-a" r="178" fill="none" stroke="#7fdcff" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="2 10 40 10" />
        <circle className="ar-ring ar-ring-b" r="164" fill="none" stroke="#7fdcff" strokeOpacity="0.3" strokeWidth="6" strokeDasharray="1 7" />
        <text x="-188" y="-176" className="ar-text">J.A.R.V.I.S.</text>
        <text x="-188" y="-162" className="ar-text ar-dim">ARC REACTOR · MK III CORE</text>
        <text x="188" y="-176" className="ar-text" textAnchor="end">OUTPUT {level}</text>
        <text x="188" y="-162" className="ar-text ar-dim" textAnchor="end">PALLADIUM: REPLACED</text>
        <text x="-188" y="186" className="ar-text ar-dim">NEW ELEMENT · STABLE</text>
        <text x="188" y="186" className="ar-text ar-dim" textAnchor="end">{power ? 'ONLINE' : 'STANDBY'}</text>
      </g>

      <circle r="200" fill="url(#ar-halo)" className="ar-halo" />
      <circle r="150" fill="url(#ar-steel)" stroke="#161b20" strokeWidth="3" />
      <circle r="122" fill="#151a1f" stroke="#2c343c" strokeWidth="2" />
      {COILS.map((a) => (
        <g key={a} transform={`rotate(${a}) translate(0 -98)`}>
          <rect x="-15" y="-18" width="30" height="36" rx="3" fill="url(#ar-copper)" stroke="#4a230b" strokeWidth="1" />
          {[-12, -6, 0, 6, 12].map((y) => (
            <line key={y} x1="-15" x2="15" y1={y} y2={y} stroke="#5a2b0e" strokeWidth="1.2" />
          ))}
        </g>
      ))}
      <circle r="70" fill="#0d1216" stroke="#3a444d" strokeWidth="2" />
      <g className="ar-core" filter="url(#ar-glow)">
        <circle r="60" fill="url(#ar-core)" />
        <path d="M0 -44 L38 22 L-38 22 Z" fill="none" stroke="#f2feff" strokeWidth="7" strokeLinejoin="round" />
        <path d="M0 -26 L22.5 13 L-22.5 13 Z" fill="#ffffff" opacity="0.85" />
      </g>

      {blast > 0 && <circle key={blast} r="60" className="ar-blast" fill="none" stroke="#bff4ff" strokeWidth="10" />}

      {aim && (
        <g className="ar-aim" transform={`translate(${aim.x} ${aim.y})`}>
          <circle r="16" fill="none" stroke="#ffcc66" strokeWidth="1.5" />
          <path d="M-26 0 H-10 M10 0 H26 M0 -26 V-10 M0 10 V26" stroke="#ffcc66" strokeWidth="1.5" />
          <text x="22" y="-20" className="ar-text" fill="#ffcc66">
            {aim.x}, {aim.y}
          </text>
        </g>
      )}
    </svg>
  );
}
