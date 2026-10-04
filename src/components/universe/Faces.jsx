import { MeeseeksFace, MortyFace, RickFace } from '../rickmorty/Faces';

// The crews' little heads for the comms box, in the same flat style as the
// Rick and Morty ones (which come from there): flat colour, a dark line, dot
// eyes.

const INK = '#1b1424';

function LukeFace({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M18 100 Q20 76 50 74 Q80 76 82 100 Z" fill="#ff8a2e" stroke={INK} strokeWidth="2" />
      <path d="M30 42 Q50 30 70 42 L68 70 Q50 86 32 70 Z" fill="#f4d2b4" stroke={INK} strokeWidth="2" />
      <path d="M26 46 Q24 18 50 16 Q78 18 74 46 Q66 30 50 32 Q36 32 26 46 Z" fill="#e2b866" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="41" cy="50" r="2.4" fill={INK} />
      <circle cx="59" cy="50" r="2.4" fill={INK} />
      <path d="M43 64 Q50 68 57 64" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function R2Face({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M20 58 Q20 20 50 20 Q80 20 80 58 Z" fill="#e9edf2" stroke={INK} strokeWidth="2" />
      <rect x="20" y="58" width="60" height="34" fill="#e9edf2" stroke={INK} strokeWidth="2" />
      <path d="M24 46 H76" stroke="#3d6fd1" strokeWidth="5" />
      <circle cx="50" cy="36" r="6.5" fill={INK} />
      <circle cx="51.5" cy="34.5" r="2" fill="#ff5a5a" />
      <rect x="30" y="66" width="16" height="10" fill="#3d6fd1" />
      <rect x="54" y="66" width="16" height="10" fill="#3d6fd1" />
      <rect x="40" y="80" width="20" height="6" fill="#9aa4b2" />
    </svg>
  );
}

function HanFace({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M18 100 Q20 76 50 74 Q80 76 82 100 Z" fill="#f2efe6" stroke={INK} strokeWidth="2" />
      <path d="M20 100 L30 76 L40 100 Z M80 100 L70 76 L60 100 Z" fill="#2b2b33" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M30 42 Q50 30 70 42 L68 70 Q50 86 32 70 Z" fill="#efc9a8" stroke={INK} strokeWidth="2" />
      <path d="M26 48 Q22 16 52 16 Q80 18 74 46 Q70 34 56 30 Q40 30 26 48 Z" fill="#6b4a2f" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="41" cy="50" r="2.4" fill={INK} />
      <circle cx="59" cy="50" r="2.4" fill={INK} />
      <path d="M42 64 Q52 68 59 61" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChewieFace({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M16 100 Q14 60 22 34 Q30 10 50 10 Q70 10 78 34 Q86 60 84 100 Z" fill="#9a6a3c" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M32 40 Q50 30 68 40 L66 72 Q50 84 34 72 Z" fill="#7a5130" />
      <path d="M22 100 L74 62 L80 70 L32 100 Z" fill="#4a3a2a" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="42" cy="48" r="3" fill={INK} />
      <circle cx="58" cy="48" r="3" fill={INK} />
      <path d="M44 58 Q50 54 56 58 Q50 62 44 58 Z" fill={INK} />
      <path d="M42 68 Q50 72 58 68" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const FACES = { rick: RickFace, morty: MortyFace, meeseeks: MeeseeksFace, luke: LukeFace, r2: R2Face, han: HanFace, chewie: ChewieFace };

export default function Face({ who, className }) {
  const F = FACES[who];
  return F ? <F className={className} /> : null;
}
