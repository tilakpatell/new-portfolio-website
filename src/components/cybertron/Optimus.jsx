// Optimus Prime, front on, who folds into a cab-over truck and back. Every
// part is drawn where it sits in robot mode; `--truck` is the transform that
// tucks it into the truck. Transitions run in an order (wheels and legs, then
// the body, the stacks, the arms, the head) and the other way back, so the
// change reads as a transformation rather than a fade. `side` recolours him as
// a Decepticon; `matrix` opens his chest on the Matrix of Leadership.

const P = (truck, origin, toRobot, toTruck) => ({ '--truck': truck, '--o': origin, '--d-robot': toRobot, '--d-truck': toTruck });

export default function Optimus({ mode = 'truck', side = 'autobot', matrix = false, className = '' }) {
  return (
    <svg viewBox="0 0 300 380" className={`tf-bot ${className}`} data-mode={mode} data-side={side} data-matrix={matrix || undefined} role="img" aria-label={mode === 'truck' ? 'A red cab-over truck, seen from the front' : side === 'autobot' ? 'Optimus Prime, standing' : 'A Decepticon, standing'}>
      <defs>
        <linearGradient id="tf-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--tf-glass-1)" />
          <stop offset="1" stopColor="var(--tf-glass-2)" />
        </linearGradient>
        <linearGradient id="tf-chrome" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8d949c" />
          <stop offset="0.45" stopColor="#eef1f4" />
          <stop offset="1" stopColor="#7d848c" />
        </linearGradient>
        <radialGradient id="tf-matrix-glow">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#9fe9ff" />
          <stop offset="1" stopColor="#1d7fd1" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="150" cy="370" rx="118" ry="7" fill="#000" opacity="0.28" />

      {/* legs, behind everything in truck mode */}
      <g className="tf-part" style={P('translate(0px, 70px) scale(1, 0.45)', '150px 220px', '0.05s', '0.42s')}>
        <path d="M108 220 h38 v132 h-38 Z M154 220 h38 v132 h-38 Z" fill="var(--tf-trim)" stroke="#0d1525" strokeWidth="2" />
        <path d="M114 262 h26 M160 262 h26 M114 300 h26 M160 300 h26" stroke="#0d1525" strokeWidth="2" opacity="0.5" />
        <path d="M102 350 h48 v18 h-48 Z M150 350 h48 v18 h-48 Z" fill="var(--tf-trim-dark)" stroke="#0d1525" strokeWidth="2" />
      </g>

      {/* the head, which hides behind the cab */}
      <g className="tf-part" style={P('translate(0px, 190px)', '150px 66px', '0.5s', '0s')}>
        <path d="M124 46 h6 v26 h-6 Z M170 46 h6 v26 h-6 Z" fill="var(--tf-trim)" stroke="#0d1525" strokeWidth="1.5" />
        <path d="M128 92 V58 L136 44 H164 L172 58 V92 Z" fill="var(--tf-trim)" stroke="#0d1525" strokeWidth="2" />
        <path d="M144 44 l3 -8 h6 l3 8 Z" fill="var(--tf-trim)" stroke="#0d1525" strokeWidth="1.5" />
        <path d="M136 58 h28 v32 h-28 Z" fill="url(#tf-chrome)" stroke="#0d1525" strokeWidth="1.5" />
        <rect className="tf-eye" x="139" y="63" width="9" height="5" rx="1.5" />
        <rect className="tf-eye" x="152" y="63" width="9" height="5" rx="1.5" />
        <path d="M140 76 h20 v14 h-20 Z" fill="#b9c0c8" stroke="#0d1525" strokeWidth="1.2" />
        <path d="M145 77 v12 M150 77 v12 M155 77 v12" stroke="#5e666f" strokeWidth="1.2" />
      </g>

      {/* the arms, folded behind the cab's sides in truck mode */}
      <g className="tf-part" style={P('translate(32px, 140px) scale(1, 0.5)', '78px 96px', '0.35s', '0.1s')}>
        <path d="M64 96 h28 v62 h-28 Z" fill="var(--tf-body)" stroke="#0d1525" strokeWidth="2" />
        <path d="M62 158 h28 v56 h-28 Z" fill="#9aa1aa" stroke="#0d1525" strokeWidth="2" />
        <path d="M62 214 h28 v24 h-28 Z" fill="var(--tf-trim)" stroke="#0d1525" strokeWidth="2" />
        <path className="tf-cannon" d="M58 198 h-14 v10 h14" fill="#4b5058" stroke="#0d1525" strokeWidth="1.5" />
      </g>
      <g className="tf-part" style={P('translate(-32px, 140px) scale(1, 0.5)', '222px 96px', '0.35s', '0.1s')}>
        <path d="M208 96 h28 v62 h-28 Z" fill="var(--tf-body)" stroke="#0d1525" strokeWidth="2" />
        <path d="M210 158 h28 v56 h-28 Z" fill="#9aa1aa" stroke="#0d1525" strokeWidth="2" />
        <path d="M210 214 h28 v24 h-28 Z" fill="var(--tf-trim)" stroke="#0d1525" strokeWidth="2" />
      </g>

      {/* the exhaust stacks: up beside the cab, then on the shoulders */}
      <g className="tf-part" style={P('translate(14px, 138px)', '75px 80px', '0.2s', '0.25s')}>
        <rect x="70" y="48" width="10" height="64" rx="2" fill="url(#tf-chrome)" stroke="#0d1525" strokeWidth="1.5" />
        <rect x="68" y="46" width="14" height="6" rx="2" fill="#5e666f" />
      </g>
      <g className="tf-part" style={P('translate(-14px, 138px)', '225px 80px', '0.2s', '0.25s')}>
        <rect x="220" y="48" width="10" height="64" rx="2" fill="url(#tf-chrome)" stroke="#0d1525" strokeWidth="1.5" />
        <rect x="218" y="46" width="14" height="6" rx="2" fill="#5e666f" />
      </g>

      {/* the waist, which becomes the bumper with its headlights */}
      <g className="tf-part" style={P('translate(0px, 125px) scale(1.35, 1.15)', '150px 214px', '0.1s', '0.3s')}>
        <path d="M106 206 h88 v16 h-88 Z" fill="#6b727b" stroke="#0d1525" strokeWidth="2" />
        <rect className="tf-light" x="110" y="209" width="12" height="9" rx="2" />
        <rect className="tf-light" x="178" y="209" width="12" height="9" rx="2" />
      </g>

      {/* the abdomen, which becomes the grille */}
      <g className="tf-part" style={P('translate(0px, 125px) scale(1.6, 1)', '150px 187px', '0.1s', '0.3s')}>
        <path d="M114 168 h72 v38 h-72 Z" fill="url(#tf-chrome)" stroke="#0d1525" strokeWidth="2" />
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`M${120 + i * 7.5} 172 v30`} stroke="#5e666f" strokeWidth="2" />
        ))}
      </g>

      {/* the chest: the cab, its windscreen, and the Matrix inside */}
      <g className="tf-part" style={P('translate(0px, 126px)', '150px 130px', '0.1s', '0.3s')}>
        <path d="M90 92 h120 v76 h-120 Z" fill="var(--tf-body)" stroke="#0d1525" strokeWidth="2" />
        <g className="tf-matrix">
          <rect x="110" y="98" width="80" height="44" fill="#071222" />
          <circle cx="150" cy="120" r="26" fill="url(#tf-matrix-glow)" className="tf-matrix-glow" />
          <path d="M138 106 h24 l4 8 v12 l-4 8 h-24 l-4 -8 v-12 Z" fill="none" stroke="#dfe7ee" strokeWidth="3" />
          <circle cx="150" cy="120" r="6" fill="#e9fbff" />
        </g>
        <path className="tf-pane tf-pane-l" d="M98 98 h48 v44 h-48 Z" fill="url(#tf-glass)" stroke="#0d1525" strokeWidth="2" />
        <path className="tf-pane tf-pane-r" d="M154 98 h48 v44 h-48 Z" fill="url(#tf-glass)" stroke="#0d1525" strokeWidth="2" />
        <path d="M102 102 l12 0 l-8 14 Z M158 102 l12 0 l-8 14 Z" fill="#ffffff" opacity="0.35" />
        {[110, 130, 150, 170, 190].map((x) => (
          <rect key={x} x={x - 3} y="86" width="6" height="5" rx="1" fill="#f5b041" />
        ))}
        <path d="M90 150 h120" stroke="#0d1525" strokeWidth="1.5" opacity="0.4" />
      </g>

      {/* the wheels: the truck's front pair, then on his shins */}
      <g className="tf-part" style={P('translate(-8px, 48px)', '100px 300px', '0s', '0.45s')}>
        <circle cx="100" cy="300" r="15" fill="#15171a" stroke="#000" strokeWidth="2" />
        <circle cx="100" cy="300" r="6" fill="url(#tf-chrome)" />
      </g>
      <g className="tf-part" style={P('translate(8px, 48px)', '200px 300px', '0s', '0.45s')}>
        <circle cx="200" cy="300" r="15" fill="#15171a" stroke="#000" strokeWidth="2" />
        <circle cx="200" cy="300" r="6" fill="url(#tf-chrome)" />
      </g>
    </svg>
  );
}
