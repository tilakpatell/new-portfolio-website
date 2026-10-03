import { STONES, VIEW } from './stones';

// The Infinity Gauntlet, back of the left hand, with each stone in its MCU
// socket: Time on the thumb, Power, Space, Reality and Soul across the
// knuckles from index to little finger, and Mind in the middle of the hand.

function Stone({ s, on }) {
  const rx = s.big ? 9.5 : 6.6;
  const ry = s.big ? 11.5 : 8.2;
  return (
    <g className="ig-stone" data-on={on || undefined} style={{ '--glow': s.color }}>
      {/* the gold socket */}
      <ellipse cx={s.x} cy={s.y} rx={rx + 2.6} ry={ry + 2.6} fill="url(#ig-socket)" stroke="#5c3d0c" strokeWidth="0.8" />
      {on ? (
        <>
          <ellipse cx={s.x} cy={s.y} rx={rx} ry={ry} fill={`url(#ig-${s.id})`} />
          {/* facets: a lit table on top, a darker pavilion below */}
          <path d={`M${s.x - rx * 0.62} ${s.y - ry * 0.18} L${s.x} ${s.y - ry * 0.7} L${s.x + rx * 0.62} ${s.y - ry * 0.18} L${s.x} ${s.y + ry * 0.12} Z`} fill={s.light} opacity="0.55" />
          <path d={`M${s.x - rx * 0.62} ${s.y - ry * 0.18} L${s.x} ${s.y + ry * 0.12} L${s.x} ${s.y + ry * 0.92} Z`} fill={s.dark} opacity="0.35" />
          <ellipse cx={s.x - rx * 0.32} cy={s.y - ry * 0.45} rx={rx * 0.22} ry={ry * 0.14} fill="#ffffff" opacity="0.9" transform={`rotate(-25 ${s.x - rx * 0.32} ${s.y - ry * 0.45})`} />
        </>
      ) : (
        <ellipse cx={s.x} cy={s.y} rx={rx} ry={ry} fill="#1a1206" stroke="#3a2a10" strokeWidth="0.6" />
      )}
    </g>
  );
}


export default function Gauntlet({ have, all }) {
  return (
    <svg viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} className="gauntlet" data-all={all || undefined} aria-hidden="true">
      <defs>
        <linearGradient id="ig-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe39a" />
          <stop offset="0.35" stopColor="#e9b44c" />
          <stop offset="0.7" stopColor="#b9822a" />
          <stop offset="1" stopColor="#7a5216" />
        </linearGradient>
        <linearGradient id="ig-edge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff0bf" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff0bf" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="ig-socket" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#f7d27a" />
          <stop offset="1" stopColor="#8a5c18" />
        </radialGradient>
        {STONES.map((s) => (
          <radialGradient key={s.id} id={`ig-${s.id}`} cx="38%" cy="32%" r="75%">
            <stop offset="0" stopColor={s.light} />
            <stop offset="0.45" stopColor={s.color} />
            <stop offset="1" stopColor={s.dark} />
          </radialGradient>
        ))}
      </defs>

      {/* fingers: little, ring, middle, index (left hand, seen from the back) */}
      {[
        [94, 40, 17, 56],
        [113, 22, 18, 72],
        [133, 14, 18, 80],
        [153, 22, 18, 72],
      ].map(([x, y, w, h], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height={h} rx={w / 2} fill="url(#ig-gold)" stroke="#5c3d0c" strokeWidth="1" />
          <path d={`M${x + 3} ${y + h * 0.42} H${x + w - 3} M${x + 3} ${y + h * 0.7} H${x + w - 3}`} stroke="#7a5216" strokeWidth="1" opacity="0.7" />
          <rect x={x + 3} y={y + 3} width={w / 3} height={h * 0.3} rx={w / 6} fill="url(#ig-edge)" opacity="0.5" />
        </g>
      ))}
      {/* thumb */}
      <path d="M182 116 C196 104 208 90 218 78 C224 72 233 76 230 85 C222 102 212 120 196 134 Z" fill="url(#ig-gold)" stroke="#5c3d0c" strokeWidth="1" />
      {/* back of the hand */}
      <path d="M90 92 C90 84 96 80 104 80 H170 C180 80 186 86 188 96 L192 142 C192 150 186 156 178 156 H104 C96 156 90 150 90 142 Z" fill="url(#ig-gold)" stroke="#5c3d0c" strokeWidth="1.2" />
      <path d="M100 100 C130 94 160 94 182 102" stroke="#fff0bf" strokeWidth="1.2" fill="none" opacity="0.45" />
      {/* the cuff */}
      <path d="M100 154 H182 L190 176 H92 Z" fill="url(#ig-gold)" stroke="#5c3d0c" strokeWidth="1.2" />
      <path d="M100 162 H184" stroke="#7a5216" strokeWidth="1.4" />

      {STONES.map((s) => (
        <Stone key={s.id} s={s} on={have.includes(s.id)} />
      ))}
    </svg>
  );
}
