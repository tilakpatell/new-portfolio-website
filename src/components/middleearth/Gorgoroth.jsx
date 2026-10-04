import { useEffect, useRef, useState } from 'react';
import { useAchievements } from '../Achievements';
import { audioContext } from '../../lib/audio';
import { prefersReducedMotion } from '../../lib/hooks';

const sfx = () => import('../../lib/sfx');

// Across Gorgoroth to Mount Doom. The Eye sweeps the plain from Barad-dûr.
// Hold to walk; let go and Frodo and Sam stand still under their elven cloaks,
// which hides them. Walk while the light is on them and the Eye sees you.

const PATH = { x0: 60, x1: 470, y: 238 }; // the road across the plain, west to east
const SPEED = 52; // plain units a second while walking
const EYE = { x: 560, y: 70 };

export default function Gorgoroth({ onArrive }) {
  const { unlock } = useAchievements();
  const [phase, setPhase] = useState('ready'); // ready, walking, seen, there
  const beam = useRef(null);
  const hobbits = useRef(null);
  const pupil = useRef(null);
  const state = useRef({ x: PATH.x0, walking: false, t: 0, last: 0, phase: 0, exposed: 0 });
  const wrapEl = useRef(null);
  const raf = useRef(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const draw = (spot) => {
    const s = state.current;
    hobbits.current?.setAttribute('transform', `translate(${s.x} ${PATH.y})`);
    // the beam: from the Eye down to a spot on the plain
    beam.current?.setAttribute('points', `${EYE.x - 6},${EYE.y + 4} ${EYE.x + 6},${EYE.y + 4} ${spot + 46},${PATH.y + 18} ${spot - 46},${PATH.y + 18}`);
    const dx = spot - EYE.x;
    pupil.current?.setAttribute('transform', `translate(${Math.max(-7, Math.min(7, dx / 40))} 0)`);
  };

  const run = () => {
    const s = state.current;
    s.last = 0;
    const tick = (now) => {
      const dt = s.last ? Math.min(0.05, (now - s.last) / 1000) : 0.016;
      s.last = now;
      s.t += dt;
      // the Eye sweeps a little faster as they get closer
      const near = (s.x - PATH.x0) / (PATH.x1 - PATH.x0);
      s.phase += dt * (0.55 + near * 0.5);
      const spot = 265 + Math.sin(s.phase) * 215;
      if (s.walking) s.x = Math.min(PATH.x1, s.x + SPEED * dt);
      draw(spot);
      setProgress(Math.round(near * 100));
      // a warning glow as the light comes close, and a moment's grace in it
      const gap = Math.abs(spot - s.x);
      if (wrapEl.current) wrapEl.current.dataset.close = gap < 110 ? 'true' : 'false';
      s.exposed = s.walking && gap < 30 ? s.exposed + dt : 0;
      if (s.exposed > 0.18) {
        setPhase('seen');
        s.walking = false;
        sfx().then((x) => x.roar());
        return;
      }
      if (s.x >= PATH.x1) {
        setPhase('there');
        unlock('gorgoroth');
        onArrive?.();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const begin = () => {
    audioContext(); // in the click, so the Eye can be heard
    cancelAnimationFrame(raf.current);
    state.current = { x: PATH.x0, walking: false, t: 0, last: 0, phase: 1.2, exposed: 0 };
    setPhase('walking');
    setProgress(0);
    run();
  };
  const walk = (on) => {
    if (phase !== 'walking') return;
    state.current.walking = on;
  };
  const key = (on) => (e) => {
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
      e.preventDefault();
      walk(on);
    }
  };

  useEffect(() => {
    // a still picture until the walk starts
    draw(265);
    if (prefersReducedMotion()) return;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const say = {
    ready: 'The Eye is looking for them. Hold to walk, let go to hide.',
    walking: `Keep going. ${progress}% of the way to the mountain.`,
    seen: 'The Eye sees you. Back to the start.',
    there: 'Mount Doom. The fire is just inside.',
  }[phase];

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:gap-14">
      <div ref={wrapEl} className="gorgoroth" data-phase={phase}>
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
            <g ref={pupil}>
              <ellipse rx="1.6" ry="6" fill="#140404" />
            </g>
          </g>
          <polygon ref={beam} fill="url(#gg-beam)" className="gg-beam" />
          {/* the road */}
          <path d={`M${PATH.x0} ${PATH.y + 4} C200 ${PATH.y + 8} 340 ${PATH.y - 2} ${PATH.x1} ${PATH.y + 2}`} stroke="#5a2f22" strokeWidth="3" strokeDasharray="4 6" fill="none" />
          {/* Frodo and Sam, cloaked */}
          <g ref={hobbits} className="gg-hobbits">
            <path d="M-8 0 L-5 -14 L-1 -14 L2 0 Z" fill="#4b5a3a" />
            <circle cx="-3" cy="-16" r="2.6" fill="#d9b48c" />
            <path d="M4 0 L7 -13 L11 -13 L14 0 Z" fill="#5a6a44" />
            <circle cx="9" cy="-15" r="2.6" fill="#d9b48c" />
            <rect x="11" y="-12" width="5" height="7" rx="1" fill="#6b5338" />
          </g>
        </svg>
      </div>
      <div>
        <h2 id="gorgoroth-title" className="title">
          Gorgoroth
        </h2>
        <p className="lead mt-4 max-w-[44ch]">The last stretch: open ground, all the way to Mount Doom, under the Eye. Hold to walk. Let go, and the elven cloaks hide them.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          {phase === 'walking' ? (
            <button
              type="button"
              className="btn btn-primary select-none"
              onPointerDown={() => walk(true)}
              onPointerUp={() => walk(false)}
              onPointerLeave={() => walk(false)}
              onPointerCancel={() => walk(false)}
              onKeyDown={key(true)}
              onKeyUp={key(false)}
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
        <p className="mt-5 min-h-[1.5em] text-sm text-muted" role="status">
          {say}
        </p>
      </div>
    </div>
  );
}
