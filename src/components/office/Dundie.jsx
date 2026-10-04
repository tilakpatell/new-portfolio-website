// A Dundie: a gold figure on a two-tier base, the way Michael hands them out
// at Chili's. `small` draws the shelf version.
export default function Dundie({ won = true, className = '' }) {
  const gold = won ? 'url(#dundie-gold)' : 'none';
  const line = won ? '#8a6414' : 'currentColor';
  return (
    <svg viewBox="0 0 80 150" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="dundie-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8a6414" />
          <stop offset="0.35" stopColor="#f6d77a" />
          <stop offset="0.55" stopColor="#fff2c4" />
          <stop offset="0.8" stopColor="#d9a93a" />
          <stop offset="1" stopColor="#8a6414" />
        </linearGradient>
      </defs>
      {/* the man, arms up, holding the world's tiniest briefcase */}
      <g fill={gold} stroke={line} strokeWidth={won ? 0.8 : 1.4} strokeLinejoin="round">
        <circle cx="40" cy="14" r="7" />
        <path d="M31 24 Q40 21 49 24 L53 54 L45 54 L44 78 L36 78 L35 54 L27 54 Z" />
        <path d="M31 26 L21 10 L25 8 L35 24 Z M49 26 L59 10 L55 8 L45 24 Z" />
        <rect x="16" y="2" width="12" height="8" rx="1.5" />
        <path d="M36 78 L34 96 L39 96 L40 82 L41 96 L46 96 L44 78 Z" />
        <rect x="30" y="96" width="20" height="5" rx="1" />
      </g>
      {/* the base, black, with its plaque */}
      <path d="M22 101 H58 L62 118 H18 Z" fill={won ? '#1c1c1e' : 'none'} stroke={won ? '#000' : 'currentColor'} strokeWidth={won ? 0.8 : 1.4} />
      <path d="M12 118 H68 V140 H12 Z" fill={won ? '#121214' : 'none'} stroke={won ? '#000' : 'currentColor'} strokeWidth={won ? 0.8 : 1.4} />
      {won && <rect x="24" y="124" width="32" height="10" rx="1" fill="url(#dundie-gold)" />}
    </svg>
  );
}
