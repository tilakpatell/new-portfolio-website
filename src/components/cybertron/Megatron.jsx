import { DECEPTICON_PATH, DECEPTICON_VIEWBOX } from '../marks';
import '../../styles/lazy/cybertron.css';

// Megatron as he is in Prime: gunmetal, a crested helmet with swept horns, red
// optics, spiked shoulders, the fusion cannon on his right arm and a blade on
// his left. He transforms into a Cybertronian jet, seen from above with its nose
// to the top: wings unfold from his back, the arms swing up into forward pods
// (the cannon still leading), the legs close into the engines and the shoulder
// spikes flip back as tail fins. Most parts are drawn where they sit in robot
// mode and `--jet` moves them; the wings and the nose are drawn as the jet has
// them and `--robot` folds them away. `firing` raises the cannon and fires it.

const P = ({ robot = 'none', jet = 'none', o, toRobot = '0s', toJet = '0s' }) => ({ '--robot': robot, '--jet': jet, '--o': o, '--d-robot': toRobot, '--d-jet': toJet });

const INK = '#101216';

export default function Megatron({ mode = 'robot', firing = false, className = '' }) {
  return (
    <svg
      viewBox="0 0 300 380"
      className={`mg-bot ${className}`}
      data-mode={mode}
      data-firing={firing || undefined}
      role="img"
      aria-label={mode === 'jet' ? 'A gunmetal Cybertronian jet, seen from above' : 'Megatron, standing, his fusion cannon on his right arm'}
    >
      <defs>
        <linearGradient id="mg-steel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--mg-hi)" />
          <stop offset="0.5" stopColor="var(--mg-steel)" />
          <stop offset="1" stopColor="var(--mg-steel-2)" />
        </linearGradient>
        <linearGradient id="mg-canopy" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff6b8a" />
          <stop offset="0.5" stopColor="#7a1838" />
          <stop offset="1" stopColor="#2a0914" />
        </linearGradient>
        <linearGradient id="mg-beam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8b4dff" stopOpacity="0" />
          <stop offset="0.3" stopColor="#b98bff" />
          <stop offset="0.5" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#b98bff" />
          <stop offset="1" stopColor="#8b4dff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="mg-glow">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#c9a6ff" />
          <stop offset="1" stopColor="#8b4dff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse className="mg-shadow" cx="150" cy="372" rx="112" ry="7" fill="#000" opacity="0.3" />

      {/* the wings: folded flat behind his back until he transforms */}
      <g className="mg-part mg-wing" style={P({ robot: 'translate(12px, -46px) scale(0.2, 0.45)', o: '140px 190px', toRobot: '0.3s', toJet: '0.25s' })}>
        <path d="M140 146 L28 236 L22 258 L138 230 Z" fill="url(#mg-steel)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <path d="M132 160 L38 238" stroke="var(--mg-purple)" strokeWidth="3" strokeLinecap="round" />
        <path d="M128 190 L60 242 M134 214 L84 240" stroke={INK} strokeWidth="1.2" opacity="0.45" />
      </g>
      <g className="mg-part mg-wing" style={P({ robot: 'translate(-12px, -46px) scale(0.2, 0.45)', o: '160px 190px', toRobot: '0.3s', toJet: '0.25s' })}>
        <path d="M160 146 L272 236 L278 258 L162 230 Z" fill="url(#mg-steel)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <path d="M168 160 L262 238" stroke="var(--mg-purple)" strokeWidth="3" strokeLinecap="round" />
        <path d="M172 190 L240 242 M166 214 L216 240" stroke={INK} strokeWidth="1.2" opacity="0.45" />
      </g>

      {/* the legs, which close together into the engines */}
      {[1, -1].map((s) => {
        const x = (v) => (s === 1 ? v : 300 - v);
        return (
          <g key={s} className="mg-part" style={P({ jet: `translate(${14 * s}px, -10px) scale(0.62, 0.8)`, o: `${x(131)}px 220px`, toRobot: '0s', toJet: '0.4s' })}>
            <ellipse className="mg-exhaust" cx={x(128)} cy="370" rx="16" ry="8" fill="url(#mg-glow)" />
            <path d={`M${x(116)} 220 L${x(146)} 220 L${x(144)} 270 L${x(120)} 270 Z`} fill="url(#mg-steel)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            <path d={`M${x(112)} 266 L${x(150)} 266 L${x(146)} 286 L${x(131)} 298 L${x(116)} 286 Z`} fill="var(--mg-dark)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            <path d={`M${x(112)} 292 L${x(150)} 292 L${x(155)} 342 L${x(107)} 342 Z`} fill="url(#mg-steel)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            <path d={`M${x(119)} 300 L${x(143)} 300 L${x(146)} 332 L${x(116)} 332 Z`} fill="var(--mg-steel-2)" stroke={INK} strokeWidth="1.2" />
            <path d={`M${x(122)} 308 H${x(140)} M${x(122)} 316 H${x(140)} M${x(122)} 324 H${x(140)}`} stroke="var(--mg-purple)" strokeWidth="1.6" opacity="0.8" />
            <path d={`M${x(100)} 342 L${x(158)} 342 L${x(162)} 358 L${x(152)} 366 L${x(104)} 366 L${x(96)} 358 Z`} fill="var(--mg-dark)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            <path className="mg-robot-only" d={`M${x(98)} 362 L${x(92)} 370 L${x(108)} 366 Z M${x(160)} 362 L${x(166)} 370 L${x(150)} 366 Z`} fill="var(--mg-darker)" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
          </g>
        );
      })}

      {/* the hips, which narrow into the fuselage */}
      <g className="mg-part" style={P({ jet: 'scale(0.55, 1)', o: '150px 210px', toRobot: '0.05s', toJet: '0.35s' })}>
        <path d="M118 196 L182 196 L176 222 L124 222 Z" fill="var(--mg-dark)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <path d="M141 198 L159 198 L155 220 L145 220 Z" fill="url(#mg-steel)" stroke={INK} strokeWidth="1.2" />
      </g>

      {/* the jet's nose and canopy, folded inside his chest in robot mode */}
      <g className="mg-part" style={P({ robot: 'translate(0px, 62px) scale(0.75)', o: '150px 70px', toRobot: '0.3s', toJet: '0.2s' })}>
        <path d="M150 22 L163 60 L169 116 L131 116 L137 60 Z" fill="url(#mg-steel)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <path d="M150 22 L155 38 L145 38 Z" fill="var(--mg-darker)" />
        <path d="M150 64 L158 80 L157 106 L143 106 L142 80 Z" fill="url(#mg-canopy)" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M149 70 L146 82 L147 96" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </g>

      {/* the head, which ducks into the body */}
      <g className="mg-part" style={P({ jet: 'translate(0px, 75px) scale(0.5)', o: '150px 70px', toRobot: '0.5s', toJet: '0s' })}>
        <path d="M143 90 H157 V102 H143 Z" fill="var(--mg-darker)" />
        <path d="M136 64 L121 36 L130 39 L142 58 Z M164 64 L179 36 L170 39 L158 58 Z" fill="var(--mg-steel-2)" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M132 56 L150 48 L168 56 L170 76 L162 94 L138 94 L130 76 Z" fill="url(#mg-steel)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <path d="M145.5 56 L150 24 L154.5 56 Z" fill="url(#mg-steel)" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M139 64 L150 61 L161 64 L159 84 L150 90 L141 84 Z" fill="var(--mg-face)" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M138 65 L150 70 L162 65 L161 70 L150 75 L139 70 Z" fill="var(--mg-darker)" />
        <path className="mg-eye" d="M141 70.5 L148 73.5 L147.5 76.5 L141.5 74 Z M159 70.5 L152 73.5 L152.5 76.5 L158.5 74 Z" />
        <path d="M141 77 L145 83 M159 77 L155 83" stroke={INK} strokeWidth="1.1" />
        <path d="M144 82 L156 82 L154 87 L146 87 Z" fill="var(--mg-darker)" />
        <path d="M147 82 V87 M150 82 V87 M153 82 V87" stroke="var(--mg-face)" strokeWidth="0.9" />
      </g>

      {/* his right arm (on our left): the fusion cannon, which leads in jet mode */}
      <g className="mg-part mg-arm-l" style={P({ jet: 'translate(12px, 40px) rotate(180deg) scale(0.8)', o: '82px 140px', toRobot: '0.2s', toJet: '0.1s' })}>
        <rect className="mg-beam" x="44" y="276" width="14" height="420" rx="7" fill="url(#mg-beam)" />
        <path d="M68 138 L94 138 L92 186 L72 186 Z" fill="var(--mg-steel-2)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <circle className="mg-robot-only" cx="82" cy="190" r="7" fill="var(--mg-dark)" stroke={INK} strokeWidth="1.5" />
        <path className="mg-jet-only" d="M66 248 L98 248 L82 290 Z" fill="url(#mg-steel)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <path d="M64 196 L100 196 L96 250 L68 250 Z" fill="url(#mg-steel)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <g className="mg-robot-only">
          <path d="M70 250 L94 250 L92 270 L72 270 Z" fill="var(--mg-dark)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M77 262 V272 M82 262 V273 M87 262 V272" stroke={INK} strokeWidth="1.5" />
        </g>
        <rect x="41" y="198" width="22" height="74" rx="4" fill="var(--mg-dark)" stroke={INK} strokeWidth="2" />
        <rect x="39" y="212" width="26" height="7" rx="2" fill="var(--mg-steel)" stroke={INK} strokeWidth="1.2" />
        <rect x="39" y="262" width="26" height="12" rx="3" fill="var(--mg-steel-2)" stroke={INK} strokeWidth="1.5" />
        <path d="M46 226 V254 M52 226 V254 M58 226 V254" stroke="var(--mg-purple)" strokeWidth="1.6" opacity="0.75" />
        <circle className="mg-muzzle" cx="52" cy="276" r="7" fill="url(#mg-glow)" />
      </g>

      {/* his left arm (on our right), with its blade */}
      <g className="mg-part" style={P({ jet: 'translate(-12px, 40px) rotate(-180deg) scale(0.8)', o: '218px 140px', toRobot: '0.2s', toJet: '0.1s' })}>
        <path d="M232 138 L206 138 L208 186 L228 186 Z" fill="var(--mg-steel-2)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <circle className="mg-robot-only" cx="218" cy="190" r="7" fill="var(--mg-dark)" stroke={INK} strokeWidth="1.5" />
        <g className="mg-blade">
          <path d="M238 200 L252 208 L254 290 L246 304 L240 252 Z" fill="var(--mg-blade)" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M244 214 L248 292" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.2" />
        </g>
        <path className="mg-jet-only" d="M234 248 L202 248 L218 290 Z" fill="url(#mg-steel)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <path d="M236 196 L200 196 L204 250 L232 250 Z" fill="url(#mg-steel)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <g className="mg-robot-only">
          <path d="M230 250 L206 250 L208 270 L228 270 Z" fill="var(--mg-dark)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M213 262 V272 M218 262 V273 M223 262 V272" stroke={INK} strokeWidth="1.5" />
        </g>
      </g>

      {/* the chest, with the insignia, and the abdomen */}
      <g className="mg-part" style={P({ jet: 'translate(0px, 12px) scale(0.36, 0.95)', o: '150px 150px', toRobot: '0.1s', toJet: '0.3s' })}>
        <path d="M126 166 L174 166 L168 198 L132 198 Z" fill="var(--mg-dark)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <path d="M130 176 H170 M131 184 H169 M132 192 H168" stroke="var(--mg-darker)" strokeWidth="2" />
        <path d="M92 100 L208 100 L202 140 L176 168 L124 168 L98 140 Z" fill="url(#mg-steel)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <path d="M100 107 L145 107 L143 142 L113 138 Z M200 107 L155 107 L157 142 L187 138 Z" fill="var(--mg-hi)" opacity="0.55" />
        <path d="M120 100 L180 100 L172 109 L128 109 Z" fill="var(--mg-dark)" stroke={INK} strokeWidth="1.2" />
        <svg className="mg-insignia" x="134" y="116" width="32" height="33" viewBox={DECEPTICON_VIEWBOX}>
          <path fill="var(--mg-purple)" fillRule="evenodd" d={DECEPTICON_PATH} />
        </svg>
        <path className="mg-spine" d="M150 104 V196" stroke="var(--mg-purple)" strokeWidth="7" strokeLinecap="round" />
      </g>

      {/* the shoulders and their spikes, which flip back into tail fins */}
      {[1, -1].map((s) => {
        const x = (v) => (s === 1 ? v : 300 - v);
        return (
          <g key={s} className="mg-part" style={P({ jet: `translate(${40 * s}px, 175px) scale(0.65, -0.65)`, o: `${x(78)}px 115px`, toRobot: '0.25s', toJet: '0.15s' })}>
            <path d={`M${x(60)} 110 L${x(44)} 54 L${x(80)} 100 Z`} fill="var(--mg-steel-2)" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
            <path d={`M${x(80)} 98 L${x(75)} 68 L${x(93)} 95 Z`} fill="var(--mg-steel-2)" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
            <path d={`M${x(56)} 70 L${x(62)} 100`} stroke="var(--mg-hi)" strokeWidth="1.4" opacity="0.8" />
            <path d={`M${x(54)} 106 L${x(92)} 92 L${x(108)} 104 L${x(104)} 142 L${x(70)} 146 L${x(52)} 128 Z`} fill="url(#mg-steel)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            <path d={`M${x(60)} 122 L${x(98)} 108`} stroke="var(--mg-purple)" strokeWidth="2.4" strokeLinecap="round" />
            <path d={`M${x(54)} 128 L${x(70)} 146 L${x(104)} 142`} fill="none" stroke="var(--mg-darker)" strokeWidth="3" strokeLinejoin="round" />
          </g>
        );
      })}
    </svg>
  );
}
