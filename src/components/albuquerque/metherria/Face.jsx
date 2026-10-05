import '../../../styles/lazy/albuquerque.css';
// The lab's customers, as simple portraits whose faces change: content while
// they wait, restless when they've waited too long, and pleased or furious
// with what they get.

const LOOK = {
  jesse: { skin: '#e8b88f', top: '#b8322a', hat: 'beanie', hatColor: '#3b3d42', hair: null, beard: 'stubble', hairColor: '#7a5a3a' },
  badger: { skin: '#e3b089', top: '#6f7276', hat: 'flaps', hatColor: '#7a5230', hair: null, beard: 'full', hairColor: '#6b4a2b' },
  pete: { skin: '#ecc4a0', top: '#33373f', hat: 'stripe', hatColor: '#2f4f6f', hair: null, beard: 'goatee', hairColor: '#5a4632', long: true },
  tuco: { skin: '#c08a5b', top: '#f2f2f2', hat: null, hair: null, beard: 'goatee', hairColor: '#1a1a1a', chain: true, shades: true },
  mike: { skin: '#e4b593', top: '#6b5544', hat: null, hair: 'fringe', beard: 'stubble', hairColor: '#d8d8d8' },
  gus: { skin: '#8a5a3b', top: '#f2c318', hat: null, hair: 'short', beard: null, hairColor: '#1e1a18', glasses: true, tie: '#3a3a3a' },
  lydia: { skin: '#f0c9a6', top: '#c9a7c7', hat: null, hair: 'long', beard: null, hairColor: '#6b4428' },
  declan: { skin: '#e2b28c', top: '#2b2f36', hat: null, hair: 'slick', beard: 'full', hairColor: '#2b2420', shades: true },
  saul: { skin: '#e8b88f', top: '#3c5a8a', hat: null, hair: 'comb', beard: null, hairColor: '#8a5a2b', tie: '#e0a020' },
};

const MOUTH = {
  great: 'M24 43 q8 8 16 0',
  good: 'M25 43 q7 5 14 0',
  okay: 'M26 44 h12',
  wait: 'M26 44 h12',
  restless: 'M26 45 q6 -3 12 0',
  bad: 'M25 47 q7 -7 14 0',
};
const BROW = {
  great: ['M22 27 q4 -3 8 0', 'M34 27 q4 -3 8 0'],
  good: ['M22 28 h8', 'M34 28 h8'],
  okay: ['M22 28 h8', 'M34 28 h8'],
  wait: ['M22 28 h8', 'M34 28 h8'],
  restless: ['M22 27 l8 2', 'M34 29 l8 -2'],
  bad: ['M22 26 l8 4', 'M34 30 l8 -4'],
};

export default function Face({ who, mood = 'wait', className = '', title }) {
  const L = LOOK[who] ?? LOOK.jesse;
  const brows = BROW[mood] ?? BROW.wait;
  const jaw = L.long ? 26 : 22;
  return (
    <svg viewBox="0 0 64 64" className={`wm-face ${className}`} data-mood={mood} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : 'true'}>
      {/* shoulders */}
      <path d="M8 64 c0 -12 10 -16 24 -16 s24 4 24 16 Z" fill={L.top} />
      {L.tie && <path d="M30 50 l2 12 l2 -12 Z" fill={L.tie} />}
      {L.chain && <path d="M22 52 q10 8 20 0" fill="none" stroke="#e7c34a" strokeWidth="2" />}
      {/* hair behind the head */}
      {L.hair === 'long' && <path d="M14 30 c0 -16 8 -22 18 -22 s18 6 18 22 v18 h-8 v-14 h-20 v14 h-8 Z" fill={L.hairColor} />}
      {/* head */}
      <ellipse cx="32" cy="34" rx="15" ry={jaw - 6} fill={L.skin} />
      <ellipse cx="17" cy="35" rx="2.5" ry="3.5" fill={L.skin} />
      <ellipse cx="47" cy="35" rx="2.5" ry="3.5" fill={L.skin} />
      {/* beards */}
      {L.beard === 'stubble' && <path d={`M20 40 q12 ${jaw - 6} 24 0`} fill="none" stroke={L.hairColor} strokeOpacity="0.45" strokeWidth="4" strokeDasharray="1 1.6" />}
      {L.beard === 'full' && <path d={`M18 36 q2 ${jaw - 2} 14 ${jaw - 4} q12 -2 14 -${jaw - 4} q-4 8 -14 9 q-10 -1 -14 -9 Z`} fill={L.hairColor} />}
      {L.beard === 'goatee' && <path d="M27 47 q5 7 10 0 q-5 2 -10 0 Z" fill={L.hairColor} />}
      {/* hair and hats */}
      {L.hair === 'short' && <path d="M17 30 c0 -12 6 -16 15 -16 s15 4 15 16 c-4 -6 -10 -8 -15 -8 s-11 2 -15 8 Z" fill={L.hairColor} />}
      {L.hair === 'slick' && <path d="M17 31 c0 -13 7 -17 15 -17 s15 4 15 17 c-2 -8 -9 -11 -15 -11 c-6 0 -12 2 -15 11 Z" fill={L.hairColor} />}
      {L.hair === 'comb' && <path d="M17 30 c1 -11 8 -15 16 -15 s13 3 14 9 c-8 -3 -20 -2 -30 6 Z" fill={L.hairColor} />}
      {L.hair === 'long' && <path d="M17 30 c2 -10 8 -14 15 -14 s13 4 15 14 c-6 -6 -10 -7 -15 -4 c-5 -3 -10 -2 -15 4 Z" fill={L.hairColor} />}
      {L.hair === 'fringe' && <path d="M17 34 c0 -4 1 -7 3 -9 M47 34 c0 -4 -1 -7 -3 -9" stroke={L.hairColor} strokeWidth="3" fill="none" strokeLinecap="round" />}
      {L.hat && <path d="M16 30 c0 -14 7 -20 16 -20 s16 6 16 20 Z" fill={L.hatColor} />}
      {L.hat === 'flaps' && <path d="M15 28 v12 h5 v-12 Z M44 28 v12 h5 v-12 Z" fill={L.hatColor} />}
      {L.hat === 'stripe' && <path d="M16.5 25 h31" stroke="#d8d8d8" strokeWidth="2.4" />}
      {L.hat === 'beanie' && <path d="M16 29 h32" stroke="#26282c" strokeWidth="3" />}
      {/* eyes, brows, mouth: the mood */}
      {L.shades ? (
        <path d="M19 31 h11 v5 q-5 3 -11 0 Z M34 31 h11 v5 q-6 3 -11 0 Z M30 32 h4" fill="#14161a" stroke="#14161a" strokeWidth="1" />
      ) : (
        <>
          <circle cx="26" cy="33" r="1.8" fill="#1d1a18" />
          <circle cx="38" cy="33" r="1.8" fill="#1d1a18" />
          <g stroke={L.hairColor === '#d8d8d8' ? '#8a8a8a' : L.hairColor} strokeWidth="2" strokeLinecap="round" fill="none">
            <path d={brows[0]} />
            <path d={brows[1]} />
          </g>
        </>
      )}
      {L.glasses && (
        <g fill="none" stroke="#1d1a18" strokeWidth="1.4">
          <rect x="20" y="29" width="11" height="8" rx="2" />
          <rect x="33" y="29" width="11" height="8" rx="2" />
          <path d="M31 32 h2" />
        </g>
      )}
      <path d={MOUTH[mood] ?? MOUTH.wait} fill="none" stroke="#5a2a20" strokeWidth="2" strokeLinecap="round" />
      {mood === 'bad' && <path d="M45 22 l3 -5 M48 24 l5 -2" stroke="#e04a3a" strokeWidth="2" strokeLinecap="round" />}
      {mood === 'great' && <path d="M50 16 l1.5 3.5 l3.5 1.5 l-3.5 1.5 l-1.5 3.5 l-1.5 -3.5 l-3.5 -1.5 l3.5 -1.5 Z" fill="#f2c318" />}
    </svg>
  );
}
