// Avengers Tower at night, over Midtown: the glass shaft (lit face and shadow
// face, its floors and windows), the curved spine sweeping up its right side
// to the cantilevered landing pad, the crown with its glowing penthouse band
// and the A, the mast and its beacon, the arc reactor's glow, a Quinjet coming
// in, and Manhattan behind (the Empire State and the lit Chrysler crown among
// it). `floors` are the stops from the top down; `current` lights the lift at
// that floor.

const W = 400;
const H = 900;

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const r = rng(1938);

// the shaft: a lit front face and a darker side face, tapering as it rises
const FRONT = { bl: 150, br: 206, tl: 160, tr: 206, top: 334 };
const SIDE = { bl: 206, br: 250, tl: 206, tr: 238, top: 334 };
const frontL = (y) => FRONT.bl + ((H - y) * (FRONT.tl - FRONT.bl)) / (H - FRONT.top);
const sideR = (y) => SIDE.br + ((H - y) * (SIDE.tr - SIDE.br)) / (H - SIDE.top);

const FLOORS_Y = Array.from({ length: 70 }, (_, i) => 344 + i * 8);
const WINDOWS = Array.from({ length: 170 }, () => {
  const y = 346 + r() * 520;
  const side = r() < 0.32;
  const x = side ? 208 + r() * (sideR(y) - 214) : frontL(y) + 3 + r() * (FRONT.br - frontL(y) - 8);
  return { x, y: Math.round((y - 344) / 8) * 8 + 346, side, warm: r() < 0.82, o: 0.45 + r() * 0.5 };
});
const STARS = Array.from({ length: 46 }, () => ({ x: r() * W, y: r() * 470, s: r() < 0.15 ? 1.4 : 0.8, o: 0.3 + r() * 0.6 }));

// Manhattan: a far layer, a middle layer (with the Empire State Building and
// the Chrysler Building), and the near blocks along the bottom
const FAR = Array.from({ length: 22 }, (_, i) => ({ x: i * 19 - 8, w: 16 + r() * 14, top: 610 + r() * 120 }));
const MID = [
  { x: 4, w: 26, top: 700 },
  { x: 100, w: 30, top: 690 },
  { x: 126, w: 22, top: 735 },
  { x: 262, w: 26, top: 705 },
  { x: 286, w: 30, top: 680 },
  { x: 360, w: 44, top: 690 },
];
const NEAR = [
  { x: -6, w: 64, top: 800 },
  { x: 54, w: 46, top: 830 },
  { x: 96, w: 58, top: 786 },
  { x: 244, w: 52, top: 812 },
  { x: 292, w: 60, top: 790 },
  { x: 348, w: 60, top: 822 },
];
const lights = (b, n, seed) => {
  const q = rng(seed);
  return Array.from({ length: n }, () => ({ x: b.x + 3 + q() * (b.w - 7), y: b.top + 6 + q() * (H - b.top - 12), o: 0.35 + q() * 0.6 }));
};
const MID_LIGHTS = MID.flatMap((b, i) => lights(b, 14, 50 + i));
const NEAR_LIGHTS = NEAR.flatMap((b, i) => lights(b, 9, 90 + i));
const FAR_LIGHTS = FAR.flatMap((b, i) => lights(b, 3, 140 + i));

export default function Tower({ floors, current = 0, className = '' }) {
  const n = Math.max(1, (floors?.length ?? 1) - 1);
  const liftY = 300 + (current * (872 - 300)) / n;
  const liftL = liftY < FRONT.top ? 150 : frontL(liftY);
  const liftR = liftY < SIDE.top ? 244 : sideR(liftY);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className={`tower-svg ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id="tw-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#050816" />
          <stop offset="0.45" stopColor="#0c1433" />
          <stop offset="0.72" stopColor="#241a45" />
          <stop offset="0.9" stopColor="#5a2c4c" />
          <stop offset="1" stopColor="#a8513f" />
        </linearGradient>
        <linearGradient id="tw-front" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6f8fb8" />
          <stop offset="0.5" stopColor="#3d5679" />
          <stop offset="1" stopColor="#24354f" />
        </linearGradient>
        <linearGradient id="tw-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1d2a42" />
          <stop offset="1" stopColor="#0f1626" />
        </linearGradient>
        <linearGradient id="tw-front-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9fd8ff" stopOpacity="0.28" />
          <stop offset="0.35" stopColor="#9fd8ff" stopOpacity="0" />
          <stop offset="0.85" stopColor="#ff9a5c" stopOpacity="0" />
          <stop offset="1" stopColor="#ff9a5c" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id="tw-crown-front" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8aa7cc" />
          <stop offset="1" stopColor="#34496a" />
        </linearGradient>
        <linearGradient id="tw-crown-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#24324c" />
          <stop offset="1" stopColor="#121a2c" />
        </linearGradient>
        <linearGradient id="tw-band" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e9fbff" />
          <stop offset="0.6" stopColor="#8fe3ff" />
          <stop offset="1" stopColor="#47b6ff" />
        </linearGradient>
        <linearGradient id="tw-steel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5d6e86" />
          <stop offset="0.5" stopColor="#a9b9cc" />
          <stop offset="1" stopColor="#3c4a5e" />
        </linearGradient>
        <linearGradient id="tw-streak" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="tw-beam" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#dfe9ff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#dfe9ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="tw-glowline" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff9a5c" stopOpacity="0" />
          <stop offset="1" stopColor="#ff9a5c" stopOpacity="0.35" />
        </linearGradient>
        <radialGradient id="tw-reactor" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#7fe0ff" stopOpacity="0.5" />
          <stop offset="0.45" stopColor="#3aa6ff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#3aa6ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tw-moon" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f3f0ff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#f3f0ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tw-lift" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff4c4" />
          <stop offset="1" stopColor="#ffb020" stopOpacity="0" />
        </radialGradient>
        <filter id="tw-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id="tw-blur-big" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      {/* the night, the moon, the stars */}
      <rect width={W} height={H} fill="url(#tw-sky)" />
      <circle cx="72" cy="128" r="60" fill="url(#tw-moon)" />
      <circle cx="72" cy="128" r="15" fill="#efeaff" opacity="0.92" />
      <circle cx="78" cy="123" r="13" fill="#0b1230" opacity="0.88" />
      {STARS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#ffffff" opacity={s.o} />
      ))}

      {/* two searchlights sweeping up behind the tower */}
      <g className="tw-beams">
        <path d="M118 900 L40 0 L96 0 Z" fill="url(#tw-beam)" />
        <path d="M300 900 L322 0 L380 0 Z" fill="url(#tw-beam)" />
      </g>

      {/* the far skyline in the city's glow */}
      <rect y="560" width={W} height={H - 560} fill="url(#tw-glowline)" />
      {FAR.map((b, i) => (
        <rect key={i} x={b.x} y={b.top} width={b.w} height={H - b.top} fill="#1b1838" />
      ))}
      {FAR_LIGHTS.map((l, i) => (
        <rect key={i} x={l.x} y={l.y} width="1.6" height="1.6" fill="#ffd98a" opacity={l.o * 0.5} />
      ))}

      {/* the arc reactor's glow, around the crown */}
      <circle cx="198" cy="282" r="130" fill="url(#tw-reactor)" className="tw-reactor" />

      {/* the mast and its beacon */}
      <path d="M193 242 L200.5 74 L204.5 74 L203 242 Z" fill="url(#tw-steel)" />
      <path d="M197.6 150 h6.6 M198.6 120 h5 M196.5 190 h8" stroke="#8fa3bb" strokeWidth="1.2" />
      <circle cx="202.5" cy="70" r="9" fill="#ff3b3b" opacity="0.35" filter="url(#tw-blur)" className="tw-beacon" />
      <circle cx="202.5" cy="70" r="2.6" fill="#ff5a5a" className="tw-beacon" />

      {/* the shaft: the lit face, the side in shadow, floors and windows */}
      <path d={`M${FRONT.bl} ${H} L${FRONT.tl} ${FRONT.top} L${FRONT.tr} ${FRONT.top - 10} L${FRONT.br} ${H} Z`} fill="url(#tw-front)" />
      <path d={`M${FRONT.bl} ${H} L${FRONT.tl} ${FRONT.top} L${FRONT.tr} ${FRONT.top - 10} L${FRONT.br} ${H} Z`} fill="url(#tw-front-fade)" />
      <path d={`M${SIDE.bl} ${H} L${SIDE.tl} ${SIDE.top - 10} L${SIDE.tr} ${SIDE.top - 2} L${SIDE.br} ${H} Z`} fill="url(#tw-side)" />
      <g stroke="#cfe6ff" strokeOpacity="0.12" strokeWidth="0.7">
        {FLOORS_Y.map((y) => (
          <path key={y} d={`M${frontL(y)} ${y} H${FRONT.br} L${sideR(y)} ${y + 2.5}`} fill="none" />
        ))}
      </g>
      <g stroke="#cfe6ff" strokeOpacity="0.1" strokeWidth="0.8">
        {[0.3, 0.55, 0.78].map((k) => (
          <path key={k} d={`M${FRONT.bl + (FRONT.br - FRONT.bl) * k} ${H} L${FRONT.tl + (FRONT.tr - FRONT.tl) * k} ${FRONT.top - 4}`} />
        ))}
        <path d={`M228 ${H} L222 ${SIDE.top}`} />
      </g>
      <path d={`M166 ${H} L172 ${FRONT.top + 4} L180 ${FRONT.top + 2} L176 ${H} Z`} fill="url(#tw-streak)" />
      <g>
        {WINDOWS.map((w, i) => (
          <rect key={i} x={w.x} y={w.y} width={w.side ? 2.4 : 3.4} height="2.2" fill={w.warm ? '#ffd98a' : '#bfe8ff'} opacity={w.side ? w.o * 0.6 : w.o} />
        ))}
      </g>

      {/* the spine: a ribbed arm sweeping up the right side to hold the pad */}
      <path d="M250 900 L266 900 C264 730 270 560 258 432 C250 352 256 300 276 262 L264 256 C244 294 238 352 244 432 C254 560 252 730 250 900 Z" fill="#141c2c" />
      <path d="M258 900 C257 730 262 560 251 432 C244 352 249 300 270 259" fill="none" stroke="#5b7090" strokeWidth="7" strokeDasharray="1.4 7" />
      <path d="M264 900 C262 730 268 560 256 432 C249 354 255 302 275 262" fill="none" stroke="#7f95b3" strokeOpacity="0.6" strokeWidth="1" />

      {/* the crown: its two faces, the penthouse band glowing, the A */}
      <path d="M154 338 L148 258 L204 236 L206 326 Z" fill="url(#tw-crown-front)" />
      <path d="M206 326 L204 236 L246 248 L240 334 Z" fill="url(#tw-crown-side)" />
      <path d="M148 258 L204 236 L246 248" fill="none" stroke="#d8ecff" strokeOpacity="0.55" strokeWidth="1.2" />
      <g filter="url(#tw-blur-big)" opacity="0.9">
        <path d="M149 276 L204 256 L245 266 L244 282 L205 272 L150 292 Z" fill="#7fe0ff" />
      </g>
      <path d="M149 276 L204 256 L205 272 L150 292 Z" fill="url(#tw-band)" />
      <path d="M204 256 L245 266 L244 280 L205 272 Z" fill="#6cc8f0" opacity="0.8" />
      <path d="M160 288 V273 M172 284 V269 M184 280 V265 M196 276 V261 M216 271 V259 M228 275 V262" stroke="#13324a" strokeOpacity="0.35" strokeWidth="1" />
      <g className="tw-logo">
        <circle cx="176" cy="312" r="16" fill="#7fdcff" opacity="0.35" filter="url(#tw-blur)" />
        <circle cx="176" cy="312" r="12.5" fill="#0d1a2c" stroke="#e9fbff" strokeWidth="2.2" />
        <path d="M168.5 322.5 L176.5 300 L184.5 322.5 M171.4 314.6 L192 314.6" fill="none" stroke="#e9fbff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* the landing pad, cantilevered out to the right, its edge lit */}
      <path d="M240 254 C280 246 330 244 354 250 C332 258 282 262 242 262 Z" fill="#a8b8cc" />
      <path d="M242 262 C282 262 332 258 354 250 L352 257 C330 267 282 270 243 270 Z" fill="#2a3448" />
      <path d="M246 255 C286 249 326 248 346 251" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="0.8" />
      <g className="tw-pad-lights">
        {[256, 270, 284, 298, 312, 326, 340].map((x, i) => (
          <circle key={x} cx={x} cy={265 - i * 0.6} r="1.3" fill="#bff1ff" />
        ))}
      </g>

      {/* a Quinjet, coming in to land */}
      <g className="tw-quinjet">
        <path d="M334 186 L302 196 L310 199 L300 206 L314 202 L336 194 Z" fill="#1a2233" stroke="#5a6a82" strokeWidth="0.6" strokeLinejoin="round" />
        <path d="M330 187 L338 180 L338 191 Z" fill="#1a2233" />
        <circle cx="337" cy="192" r="4" fill="#7fdcff" opacity="0.55" filter="url(#tw-blur)" />
        <circle cx="337" cy="192" r="1.4" fill="#e9fbff" />
      </g>

      {/* the city in front: the Empire State, the Chrysler crown, the blocks */}
      {MID.map((b, i) => (
        <rect key={i} x={b.x} y={b.top} width={b.w} height={H - b.top} fill="#110f27" />
      ))}
      <path d="M30 900 V712 H38 V676 H46 V640 H54 V610 H60 V578 H64 V540 H66 V500 H67 V540 H70 V578 H74 V610 H80 V640 H88 V676 H96 V712 H104 V900 Z" fill="#100e25" />
      <path d="M318 900 V666 H356 V900 Z M320 666 Q337 640 354 666 Z M324 650 Q337 628 350 650 Z M328 636 Q337 618 346 636 Z M333 622 L337 588 L341 622 Z" fill="#100e25" />
      <g fill="none" stroke="#f1ecff" strokeLinecap="round" className="tw-chrysler">
        <path d="M321 665 Q337 641 353 665" strokeWidth="1.2" />
        <path d="M325 649 Q337 629 349 649" strokeWidth="1.1" />
        <path d="M329 635 Q337 619 345 635" strokeWidth="1" />
        <path d="M337 622 L337 592" strokeWidth="0.9" />
      </g>
      {MID_LIGHTS.map((l, i) => (
        <rect key={i} x={l.x} y={l.y} width="2" height="1.8" fill="#ffd98a" opacity={l.o * 0.7} />
      ))}
      <rect y="760" width={W} height="140" fill="#2a1b3a" opacity="0.25" />
      {NEAR.map((b, i) => (
        <rect key={i} x={b.x} y={b.top} width={b.w} height={H - b.top} fill="#07060f" />
      ))}
      {NEAR_LIGHTS.map((l, i) => (
        <rect key={i} x={l.x} y={l.y} width="2.6" height="2.2" fill="#ffe2a0" opacity={l.o} />
      ))}

      {/* the lift, at the current floor */}
      {floors?.length > 0 && (
        <g className="tw-liftcar" style={{ transform: `translateY(${liftY}px)` }}>
          <ellipse cx={(liftL + liftR) / 2} cy="0" rx={(liftR - liftL) / 2 + 14} ry="8" fill="url(#tw-lift)" />
          <rect x={liftL + 2} y="-1.6" width={Math.max(10, liftR - liftL - 4)} height="3.2" rx="1.6" fill="#ffd25a" />
        </g>
      )}
    </svg>
  );
}
