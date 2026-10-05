import { useState } from 'react';
import { audioContext } from '../../lib/audio';

const sfx = () => import('../../lib/sfx');
const BLOCKS = 9;

// The web shooter, for a browser without 3D: each thwip catches the next
// building, on alternate sides, and swings him on down the avenue.
export default function WebShooter() {
  const [n, setN] = useState(0);
  const at = Math.min(n, BLOCKS);
  const x = 40 + at * 60;
  const side = at % 2 ? 1 : -1;
  const thwip = () => {
    audioContext();
    sfx().then((s) => s.zip());
    setN((v) => (v >= BLOCKS ? 0 : v + 1));
  };
  return (
    <div className="tw-toy">
      <svg viewBox="0 0 600 220" role="img" aria-label={at >= BLOCKS ? 'Spider-Man has swung all the way down the avenue to school.' : `Spider-Man, ${at} buildings down the avenue.`}>
        {Array.from({ length: BLOCKS + 1 }, (_, i) => (
          <g key={i}>
            <rect x={20 + i * 60} y={40 + ((i * 37) % 50)} width="34" height={140 - ((i * 37) % 50)} fill={i % 2 ? '#5a6478' : '#7a5248'} />
            <rect x={36 + i * 60} y={70 + ((i * 53) % 60)} width="30" height={110 - ((i * 53) % 60)} fill={i % 2 ? '#8a5a48' : '#4e5a70'} opacity="0.85" />
          </g>
        ))}
        <rect x="0" y="180" width="600" height="40" fill="#3a3c3f" />
        {at > 0 && <line x1={x} y1="110" x2={x + 24} y2={side < 0 ? 50 : 62} stroke="#ffffff" strokeWidth="2" />}
        <circle cx={x} cy="112" r="7" fill="#c8102e" />
        <circle cx={x} cy="112" r="3" fill="#1d3fa0" />
        {at >= BLOCKS && (
          <text x="540" y="30" textAnchor="middle" fontFamily="var(--font-sans)" fontWeight="700" fontSize="13" fill="#0d2a5a">
            SCHOOL
          </text>
        )}
      </svg>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={thwip}>
          {at >= BLOCKS ? 'Again' : 'Thwip'}
        </button>
        <span className="text-sm text-muted" role="status">
          {at >= BLOCKS ? 'Made it to school. Barely.' : `${BLOCKS - at} buildings to school.`}
        </span>
      </div>
    </div>
  );
}
