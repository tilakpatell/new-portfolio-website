// The planets the station can jump to, drawn in plain SVG. Each sits at the
// same spot in the scene: centre (120, 112), radius 46.
// eslint-disable-next-line react-refresh/only-export-components
export const PLANET_AT = { x: 120, y: 112, r: 46 };

// eslint-disable-next-line react-refresh/only-export-components
export const PLANETS = {
  alderaan: { name: 'Alderaan', glow: '#6aa8ff', stops: ['#bfe3ff', '#4f8fd8', '#24548f', '#0d223d'], line: 'Peaceful, with no weapons. Usually.' },
  yavin: { name: 'Yavin 4', glow: '#7ccf7a', stops: ['#d6f0b8', '#5fa04e', '#2e6b33', '#0f2a14'], line: 'The Rebel base, in the jungle moon’s temples.' },
  tatooine: { name: 'Tatooine', glow: '#f0c27a', stops: ['#fbe7c0', '#e0b16d', '#a8743a', '#4a2d12'], line: 'Two suns, a lot of sand and one farm boy.' },
  hoth: { name: 'Hoth', glow: '#cfe6ff', stops: ['#ffffff', '#dceaf7', '#9fb8d0', '#3d5670'], line: 'Ice, wind and tauntauns.' },
  endor: { name: 'Endor', glow: '#86c27a', stops: ['#cfe8b8', '#4f8a42', '#265322', '#0c1f0b'], line: 'A forest moon. Mind the Ewoks.' },
};

export function PlanetArt({ id, className }) {
  const p = PLANETS[id] ?? PLANETS.alderaan;
  const { x, y, r } = PLANET_AT;
  const grad = `planet-${id}`;
  const clip = `planet-clip-${id}`;
  return (
    <g className={className}>
      <defs>
        <radialGradient id={grad} cx="35%" cy="30%" r="80%">
          {p.stops.map((c, i) => (
            <stop key={c} offset={[0, 0.35, 0.75, 1][i]} stopColor={c} />
          ))}
        </radialGradient>
        <clipPath id={clip}>
          <circle cx={x} cy={y} r={r} />
        </clipPath>
      </defs>

      {id === 'yavin' && <circle cx={x - 70} cy={y + 150} r="120" fill="#c8732e" opacity="0.55" />}
      {id === 'tatooine' && (
        <g>
          <circle cx={x - 80} cy={y - 70} r="14" fill="#ffd27a" />
          <circle cx={x - 46} cy={y - 84} r="9" fill="#ffb067" />
        </g>
      )}

      <circle cx={x} cy={y} r={r + 6} fill={p.glow} opacity="0.12" />
      <circle cx={x} cy={y} r={r} fill={`url(#${grad})`} />
      <g clipPath={`url(#${clip})`} opacity="0.85">
        {id === 'alderaan' && (
          <>
            <path d={`M ${x - 40} ${y - 14} q 18 -12 34 -2 q 14 8 30 -4 q 10 -6 20 2`} fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
            <path d={`M ${x - 30} ${y + 16} q 22 8 40 -2 q 12 -6 26 4`} fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.55" />
            <path d={`M ${x - 12} ${y - 2} q 10 -10 22 -4 q 8 4 4 12 q -10 10 -22 2 z`} fill="#3f8a4a" opacity="0.8" />
          </>
        )}
        {(id === 'yavin' || id === 'endor') && (
          <>
            <path d={`M ${x - 46} ${y - 8} q 20 -14 40 -4 q 18 8 36 -6 q 12 -8 20 2 v 30 q -40 16 -96 0 z`} fill="#16361a" opacity="0.35" />
            <path d={`M ${x - 30} ${y - 26} q 14 -6 26 0`} fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.35" />
          </>
        )}
        {id === 'tatooine' && (
          <>
            <path d={`M ${x - 46} ${y + 6} q 30 -10 60 0 q 20 6 32 -2`} fill="none" stroke="#8a5a28" strokeWidth="6" opacity="0.35" />
            <path d={`M ${x - 40} ${y - 18} q 26 -8 50 0`} fill="none" stroke="#fff3d6" strokeWidth="3" opacity="0.4" />
          </>
        )}
        {id === 'hoth' && (
          <>
            <path d={`M ${x - 44} ${y - 10} q 30 -8 58 2 q 18 6 30 -2`} fill="none" stroke="#ffffff" strokeWidth="6" opacity="0.6" />
            <path d={`M ${x - 36} ${y + 18} q 24 6 50 -2`} fill="none" stroke="#9fb8d0" strokeWidth="4" opacity="0.6" />
          </>
        )}
      </g>
    </g>
  );
}
