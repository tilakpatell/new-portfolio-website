import { useEffect, useRef, useState } from 'react';
import { useAchievements } from '../Achievements';
import { audioContext } from '../../lib/audio';
import { use3D } from '../../lib/gpu';
import { local, useFrameLoop } from '../../lib/hooks';
import { capturePointer } from '../../lib/pointer';
import { WALK, newWalk, spotOf, stepWalk } from './walk';
import Scene3D from './Scene3D';
import '../../styles/lazy/middleearth.css';

const sfx = () => import('../../lib/sfx');
const clip = (id) => import('../../lib/clips').then((c) => c.playClip(id)).catch(() => null);
const BEST = 'tp-gorgoroth-best';
const typing = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

// Across Gorgoroth to Mount Doom (the rules are in ./walk.js). The Eye sweeps
// the plain from Barad-dûr. Hold to walk; let go and Frodo and Sam stand still
// under their elven cloaks, which hides them. Rest now and then, or the Ring
// gets too heavy; stand still when an orc patrol marches by.
//
// Drawn in 3D (./Gorgoroth3D.js) wherever WebGL works, over this drawing,
// which stays for browsers without it and for anything that reads the page.
const loadScene = () => import('./Gorgoroth3D').then((m) => m.createGorgoroth3D);

const PATH_Y = 238;
const EYE = { x: 560, y: 70 };
const RING_R = 13;

export default function Gorgoroth({ onArrive }) {
  const { unlock } = useAchievements();
  const [phase, setPhase] = useState('ready'); // ready, walking, seen, ring, caught, there
  const [view, setView] = useState(() => ({ x: WALK.x0, spot: 265, burden: 0, patrols: [], carried: false, t: 0, walking: false, close: false }));
  const [say, setSay] = useState('');
  const [best, setBest] = useState(() => local.get(BEST, null));
  const walk = useRef(null);
  const held = useRef(false);
  const three = use3D();
  const [gl, setGl] = useState('waiting');
  const want3D = three.on && gl !== 'failed' && gl !== 'lost';
  const drawn = want3D && gl === 'on';

  const begin = () => {
    audioContext(); // in the click, so the Eye can be heard
    walk.current = newWalk();
    held.current = false;
    setPhase('walking');
    setSay('Hold to walk. Rest when the light comes near, or the Ring gets heavy.');
  };
  const hold = (on) => {
    if (phase === 'walking') held.current = on;
  };

  useFrameLoop((ms) => {
    const s = walk.current;
    if (!s) return;
    const walking = held.current;
    const ev = stepWalk(s, Math.min(0.05, ms / 1000), walking);
    const spot = spotOf(s);
    for (const e of ev) {
      if (e.type === 'seen') {
        setPhase('seen');
        setSay('The Eye sees you. Back to the start.');
        sfx().then((x) => x.roar());
      } else if (e.type === 'ring') {
        setPhase('ring');
        setSay('The Ring is too heavy. Frodo puts it on, and the Eye turns.');
        sfx().then((x) => x.roar());
      } else if (e.type === 'caught') {
        setPhase('caught');
        setSay('Orcs! They drag you off the road.');
        sfx().then((x) => x.alarm());
      } else if (e.type === 'patrol') {
        setSay('Orcs on the road ahead. Stand still under the cloaks when they pass.');
        sfx().then((x) => x.drum());
      } else if (e.type === 'passed') setSay('They march right past you.');
      else if (e.type === 'carry') {
        setSay('Sam: “I can’t carry it for you, but I can carry you!”');
        clip('carryYou'); // Sean Astin's own (lib/clips)
      }
      else if (e.type === 'there') {
        setPhase('there');
        const secs = Math.round(s.t * 10) / 10;
        const isBest = best == null || secs < best;
        if (isBest) {
          setBest(secs);
          local.set(BEST, secs);
        }
        setSay(`Mount Doom in ${secs} seconds${isBest ? ', the quickest yet' : ''}. The fire is just inside.`);
        unlock('gorgoroth');
        onArrive?.();
      }
    }
    setView({ x: s.x, spot, burden: s.burden, patrols: s.patrols.map((p) => p.x), carried: s.carried, t: s.t, walking, close: Math.abs(spot - s.x) < WALK.warn });
  }, phase === 'walking');

  // hold Space or → anywhere on the page while they walk; let go if the window loses focus
  useEffect(() => {
    if (phase !== 'walking') return undefined;
    const isKey = (e) => e.key === ' ' || e.key === 'ArrowRight';
    const down = (e) => {
      if (!isKey(e) || typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      held.current = true;
    };
    const up = (e) => {
      if (!isKey(e)) return;
      e.preventDefault();
      held.current = false;
    };
    const blur = () => {
      held.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      held.current = false;
    };
  }, [phase]);

  const { x, spot, burden, patrols, carried, t, walking, close } = view;
  const near = Math.round(((x - WALK.x0) / (WALK.x1 - WALK.x0)) * 100);
  const beam = `${EYE.x - 6},${EYE.y + 4} ${EYE.x + 6},${EYE.y + 4} ${spot + 46},${PATH_Y + 18} ${spot - 46},${PATH_Y + 18}`;
  const pupil = Math.max(-7, Math.min(7, (spot - EYE.x) / 40));
  const ringLen = 2 * Math.PI * RING_R;
  const status =
    phase === 'ready'
      ? 'The Eye is looking for them. Hold to walk, let go to hide.'
      : phase === 'walking'
        ? `${say} ${near}% of the way.`
        : say;

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:gap-14">
      <div className="gorgoroth me-stage" data-phase={phase} data-close={close ? 'true' : 'false'} data-3d={want3D || undefined} data-gl={drawn || undefined}>
        <svg viewBox="0 0 640 300" className="block h-auto w-full" role="img" aria-label="The plain of Gorgoroth, Barad-dûr and the Eye to the north east, Mount Doom ahead, two hobbits on the road">
          <defs>
            <linearGradient id="gg-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1a0b07" />
              <stop offset="1" stopColor="#4a1a0b" />
            </linearGradient>
            <radialGradient id="gg-eye">
              <stop offset="0" stopColor="#fff2b0" />
              <stop offset="0.4" stopColor="#ff9a1f" />
              <stop offset="1" stopColor="#c2310a" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="gg-beam" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffb347" stopOpacity="0.55" />
              <stop offset="1" stopColor="#ff6a1a" stopOpacity="0.18" />
            </linearGradient>
          </defs>
          <rect width="640" height="300" fill="url(#gg-sky)" />
          {/* the Ephel Dúath behind, the plain, ash */}
          <path d="M0 150 L40 120 L80 140 L130 104 L170 132 L220 112 L260 140 L300 118 L340 146 L380 126 L420 150 V300 H0 Z" fill="#241310" />
          <path d="M0 220 C160 206 320 214 640 210 V300 H0 Z" fill="#2e1712" />
          {/* Mount Doom, the road's end */}
          <path d="M440 236 L506 120 L524 116 L600 236 Z" fill="#3a1d14" />
          <path d="M500 124 L512 106 L526 118 Z" fill="#ff6a1a" className="gg-lava" />
          {/* Barad-dûr and the Eye */}
          <path d="M548 236 L552 96 L556 82 L560 70 L564 82 L568 96 L572 236 Z" fill="#170b08" />
          <g transform={`translate(${EYE.x} ${EYE.y})`}>
            <ellipse rx="22" ry="9" fill="url(#gg-eye)" className="gg-eye" />
            <ellipse rx="1.6" ry="6" fill="#140404" transform={`translate(${pupil.toFixed(1)} 0)`} />
          </g>
          <polygon points={beam} fill="url(#gg-beam)" className="gg-beam" />
          {/* the road */}
          <path d={`M${WALK.x0} ${PATH_Y + 4} C200 ${PATH_Y + 8} 340 ${PATH_Y - 2} ${WALK.x1} ${PATH_Y + 2}`} stroke="#5a2f22" strokeWidth="3" strokeDasharray="4 6" fill="none" />
          {/* orc patrols marching down it, a torch at the front */}
          {patrols.map((px, i) => (
            <g key={i} transform={`translate(${px.toFixed(1)} ${PATH_Y})`} className="gg-orcs">
              {[0, 9, 18, 27].map((dx) => (
                <g key={dx} transform={`translate(${dx} 0)`}>
                  <path d="M-4 0 L-3 -12 L3 -12 L4 0 Z" fill="#1a0f0b" />
                  <circle cy="-14.5" r="3" fill="#2a1a12" />
                  <path d="M3 -12 L6 -20" stroke="#4a3a2c" strokeWidth="1.4" />
                </g>
              ))}
              <circle cx="-6" cy="-18" r="3.2" fill="#ffb347" className="gg-torch" />
            </g>
          ))}
          {/* Frodo and Sam, cloaked; Sam carries him for the last of it */}
          <g transform={`translate(${x.toFixed(1)} ${PATH_Y})`} className="gg-hobbits">
            <g className="gg-bob" data-walking={walking || undefined}>
            {carried ? (
              <>
                <path d="M-2 0 L1 -15 L7 -15 L10 0 Z" fill="#5a6a44" />
                <circle cx="4" cy="-17" r="2.8" fill="#d9b48c" />
                <path d="M-4 -12 L-1 -22 L5 -21 L3 -12 Z" fill="#4b5a3a" />
                <circle cx="-1" cy="-23" r="2.4" fill="#d9b48c" />
              </>
            ) : (
              <>
                <path d="M-8 0 L-5 -14 L-1 -14 L2 0 Z" fill="#4b5a3a" />
                <circle cx="-3" cy="-16" r="2.6" fill="#d9b48c" />
                <path d="M4 0 L7 -13 L11 -13 L14 0 Z" fill="#5a6a44" />
                <circle cx="9" cy="-15" r="2.6" fill="#d9b48c" />
                <rect x="11" y="-12" width="5" height="7" rx="1" fill="#6b5338" />
              </>
            )}
            </g>
          </g>
          {/* the Ring's weight: it fills as Frodo walks, and drains while he rests */}
          <g transform="translate(36 36)" className="gg-ring" data-heavy={burden > 0.75 || undefined}>
            <circle r={RING_R} fill="none" stroke="#3a2210" strokeWidth="5" />
            <circle r={RING_R} fill="none" stroke="#f0c040" strokeWidth="5" strokeDasharray={`${(burden * ringLen).toFixed(1)} ${ringLen.toFixed(1)}`} transform="rotate(-90)" strokeLinecap="round" />
            <text x="22" y="4" className="gg-ring-label">
              {carried ? 'Sam has him' : 'The Ring'}
            </text>
          </g>
          {phase !== 'ready' && (
            <text x="604" y="290" textAnchor="end" className="gg-ring-label">
              {t.toFixed(1)}s{best != null ? ` · best ${best}s` : ''}
            </text>
          )}
        </svg>
        {want3D && <Scene3D name="gorgoroth" load={loadScene} read={() => ({ phase, ...view })} soft={three.info.software} onState={setGl} />}
        {drawn && (
          <>
            <p className="me-hud me-hud-left" aria-hidden="true" data-heavy={burden > 0.75 || undefined}>
              <svg viewBox="-16 -16 32 32" width="22" height="22">
                <circle r={RING_R - 2} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="4" />
                <circle r={RING_R - 2} fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray={`${(burden * 2 * Math.PI * (RING_R - 2)).toFixed(1)} 99`} transform="rotate(-90)" strokeLinecap="round" />
              </svg>
              <span>{carried ? 'Sam has him' : 'The Ring'}</span>
            </p>
            {phase !== 'ready' && (
              <p className="me-hud me-hud-time" aria-hidden="true">
                {t.toFixed(1)}s{best != null ? ` · best ${best}s` : ''}
              </p>
            )}
          </>
        )}
      </div>
      <div>
        <h2 id="gorgoroth-title" className="title">
          Gorgoroth
        </h2>
        <p className="lead mt-4 max-w-[44ch]">The last stretch: open ground, all the way to Mount Doom, under the Eye. Hold to walk. Let go, and the elven cloaks hide them. Rest when the Ring gets heavy, and hold still when the orcs march by.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          {phase === 'walking' ? (
            <button
              type="button"
              className="btn btn-primary hold-btn"
              onPointerDown={(e) => {
                capturePointer(e);
                hold(true);
              }}
              onPointerUp={() => hold(false)}
              onPointerCancel={() => hold(false)}
              onLostPointerCapture={() => hold(false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              Hold to walk
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={begin}>
              {phase === 'ready' ? 'Set out' : phase === 'there' ? 'Walk it again' : 'Try again'}
            </button>
          )}
        </div>
        <p className="mt-5 min-h-[3em] text-sm text-muted" role="status">
          {status}
        </p>
      </div>
    </div>
  );
}
