import '../../styles/lazy/cybertron.css';
// Team Prime, Knock Out, Breakdown and the Vehicons in vehicle mode, side on and
// facing right, in their Prime colors. Every drawing is 40 high; the bridge's
// `WIDTH` gives each one's width.

const INK = '#0d0f14';

function Wheel({ x, y, r = 8 }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#15171b" stroke={INK} strokeWidth="1.5" />
      <circle cx={x} cy={y} r={r * 0.45} fill="#9aa1aa" />
    </g>
  );
}

const ART = {
  // Arcee: a blue sport bike with pink trim
  bike: (
    <>
      <path d="M14 26 L30 15 L52 12 L70 19 L76 25 L58 27 L40 27 Z" fill="#2c6fd6" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M31 17 L52 14 L66 20" fill="none" stroke="#ff5fa2" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M58 13 L67 7 L71 18 Z" fill="#a9dcff" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M66 21 L68 30 M22 24 L16 30" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M72 21 h4 v3 h-4 Z" fill="#ffe9a8" />
      <Wheel x={16} y={30} r={9} />
      <Wheel x={68} y={30} r={9} />
    </>
  ),
  // Bumblebee: a yellow muscle car with black stripes
  muscle: (
    <>
      <path d="M3 30 L5 21 L22 18 L36 10 L64 10 L78 18 L96 21 L98 30 Z" fill="#f6c700" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M38 13 L62 13 L72 18 L32 18 Z" fill="#26303f" />
      <path d="M8 24.5 H94" stroke="#141414" strokeWidth="3" />
      <path d="M40 10.5 H62" stroke="#141414" strokeWidth="2.5" />
      <path d="M93 22 h4 v3 h-4 Z" fill="#ffe9a8" />
      <Wheel x={24} y={30} />
      <Wheel x={78} y={30} />
    </>
  ),
  // Bulkhead: a green armored off-roader
  suv: (
    <>
      <path d="M3 30 V15 L13 6 H72 L86 15 L101 17 V30 Z" fill="#3e8e3a" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M17 10 H43 V17 H13 Z M47 10 H70 L79 17 H47 Z" fill="#26303f" />
      <path d="M6 22 H98" stroke="#2a5f27" strokeWidth="2" />
      <path d="M98 19 h5 v11 h-5 Z" fill="#2d2f33" stroke={INK} strokeWidth="1" />
      <Wheel x={24} y={30} r={10} />
      <Wheel x={80} y={30} r={10} />
    </>
  ),
  // Wheeljack: a white rally car with green and red stripes
  rally: (
    <>
      <path d="M3 30 L5 20 L24 17 L34 9 L60 9 L72 17 L92 20 L94 30 Z" fill="#f2f3f5" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M37 12 L58 12 L67 17 L31 17 Z" fill="#26303f" />
      <path d="M8 22.5 H90" stroke="#2f9e44" strokeWidth="3" />
      <path d="M8 26.5 H90" stroke="#d6332b" strokeWidth="2" />
      <path d="M89 21 h4 v3 h-4 Z" fill="#ffe9a8" />
      <Wheel x={22} y={30} />
      <Wheel x={74} y={30} />
    </>
  ),
  // Smokescreen: a white race car, a blue stripe, 38 on the door
  racer: (
    <>
      <path d="M2 14 H14 V21" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M2 29 L6 22 L28 20 L40 13 L62 13 L74 19 L98 22 L102 29 Z" fill="#f5f6fa" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M42 15.5 L60 15.5 L68 19 L38 19 Z" fill="#26303f" />
      <path d="M6 25 H98" stroke="#2c5fd6" strokeWidth="3" />
      <text x="47" y="23.4" fontSize="6.5" fontWeight="800" fill="#2c5fd6" fontFamily="system-ui, sans-serif">
        38
      </text>
      <Wheel x={24} y={30} />
      <Wheel x={82} y={30} />
    </>
  ),
  // Optimus Prime: a red long-nose truck with a blue lower body
  truck: (
    <>
      <path d="M4 30 H146 V35 H4 Z" fill="#2b2f36" />
      <path d="M22 9 H58 V31 H22 Z" fill="#c8102e" stroke={INK} strokeWidth="1.5" />
      <path d="M58 4 H84 L90 15 V31 H58 Z" fill="#c8102e" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M62 8 H82 L86 15 H62 Z" fill="#a9dcff" stroke={INK} strokeWidth="1" />
      <path d="M90 15 H130 L140 20 V31 H90 Z" fill="#c8102e" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M22 24 H140 V31 H22 Z" fill="#1f4fa8" />
      <path d="M139 18 h6 v13 h-6 Z" fill="#d7dce2" stroke={INK} strokeWidth="1" />
      <path d="M55 0 h4 v15 h-4 Z" fill="#d7dce2" stroke={INK} strokeWidth="1" />
      <path d="M100 19 H128" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.2" />
      <Wheel x={34} y={32} r={8} />
      <Wheel x={52} y={32} r={8} />
      <Wheel x={122} y={32} r={8} />
    </>
  ),
  // a Vehicon: a black and purple sports car
  vehicon: (
    <>
      <path d="M2 29 L6 20 L26 17 L40 10 L62 10 L80 17 L98 21 L99 29 Z" fill="#1c1a22" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M43 13 L60 13 L71 17 L37 17 Z" fill="#6b2fa0" />
      <path d="M8 23.5 L96 24.5" stroke="#8b4dff" strokeWidth="2.5" />
      <path d="M82 19 L96 21.5" stroke="#8b4dff" strokeWidth="1.5" />
      <path d="M94 22 h4 v3 h-4 Z" fill="#ff2b4a" />
      <Wheel x={24} y={30} />
      <Wheel x={80} y={30} />
    </>
  ),
  // Knock Out: a low crimson sports car with silver trim
  knockout: (
    <>
      <path d="M2 27 L3 19.6 L9 19.2 L22 18.5 L40 11 L60 10.5 L77 16.5 L98 19.5 L102 25 L100 30 H3 Z" fill="#b3122a" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M43 13.5 L59 13.2 L70 17.4 L35 18.2 Z" fill="#26303f" />
      <path d="M6 23.5 L99 22.8" stroke="#c9ced6" strokeWidth="1.8" />
      <path d="M36 27.6 H68" stroke="#c9ced6" strokeWidth="1.4" />
      <path d="M64 19.6 h7 l-2 2 h-6 Z" fill="#c9ced6" />
      <path d="M97 20.2 h4 v2.4 h-4 Z" fill="#ffe9a8" />
      <Wheel x={23} y={30} />
      <Wheel x={83} y={30} />
    </>
  ),
  // Breakdown: a big dark-blue armored SUV with grey plating and a yellow light bar
  breakdown: (
    <>
      <path d="M3 31 V14 L11 6 H78 L91 15 L108 17 L110 31 Z" fill="#23396a" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M15 9 H41 V16 H11 Z M45 9 H75 L85 16 H45 Z" fill="#26303f" />
      <path d="M3 21 H109.5 V31 H3 Z" fill="#6b7380" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M38 21 V31 M72 21 V31" stroke="#4b525d" strokeWidth="1.2" />
      <path d="M30 2.5 H60 V6 H30 Z" fill="#ffc400" stroke={INK} strokeWidth="1" />
      <path d="M40 2.5 V6 M50 2.5 V6" stroke="#c98f00" strokeWidth="1" />
      <path d="M105 18 h6 v13 h-6 Z" fill="#3a3f47" stroke={INK} strokeWidth="1" />
      <path d="M100 17.5 h4 v3 h-4 Z" fill="#ffe9a8" />
      <Wheel x={26} y={30} r={10} />
      <Wheel x={86} y={30} r={10} />
    </>
  ),
};

export default function Vehicle({ kind, width }) {
  return (
    <svg viewBox={`0 0 ${width} 40`} className="gbr-art" aria-hidden="true">
      {ART[kind]}
    </svg>
  );
}
