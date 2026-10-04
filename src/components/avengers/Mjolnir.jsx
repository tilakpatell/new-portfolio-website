import { useEffect, useRef, useState } from 'react';
import { useAchievements } from '../Achievements';
import { audioContext } from '../../lib/audio';

const sfx = () => import('../../lib/sfx');
const HOLD = 1800; // ms of holding before the hammer decides

// Mjolnir, head down in its crater. Press and hold to lift it. It decides
// whether you are worthy: you are, once you have found ten of the site's
// easter eggs (or all of the hidden ones).
export default function Mjolnir() {
  const { unlocked, unlock } = useAchievements();
  const worthy = unlocked.length >= 10 || unlocked.includes('collector');
  const [state, setState] = useState('rest'); // rest, straining, lifted, refused
  const [tries, setTries] = useState(0);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const begin = () => {
    if (state === 'lifted' || state === 'straining') return;
    audioContext(); // in the press, so the thunder can be heard
    setState('straining');
    timer.current = setTimeout(() => {
      if (worthy) {
        setState('lifted');
        sfx().then((s) => s.thunder());
        unlock('worthy');
      } else {
        setState('refused');
        setTries((n) => n + 1);
      }
    }, HOLD);
  };
  const end = () => {
    if (state !== 'straining') return;
    clearTimeout(timer.current);
    setState('rest');
  };
  const onKeyDown = (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      begin();
    }
  };
  const onKeyUp = (e) => {
    if (e.key === ' ' || e.key === 'Enter') end();
  };

  const say = {
    rest: worthy ? 'Something about you feels worthy. Press and hold.' : 'Press and hold to lift it.',
    straining: 'Lifting…',
    lifted: 'You are worthy. The hammer comes to you, and the sky answers.',
    refused: tries >= 3 ? `Not worthy. Yet. Find ${Math.max(0, 10 - unlocked.length)} more easter eggs and try again.` : 'It does not move. Not worthy. Yet.',
  }[state];

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
      <div className="mjolnir-stage" data-state={state}>
        <svg viewBox="0 0 320 260" className="block h-auto w-full" role="img" aria-label={state === 'lifted' ? 'Mjolnir rising out of its crater in a flash of lightning' : 'Mjolnir, head down in a stony crater'}>
          <defs>
            <linearGradient id="mj-head" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#4b535b" />
              <stop offset="0.45" stopColor="#c9d1d8" />
              <stop offset="1" stopColor="#5b636b" />
            </linearGradient>
            <linearGradient id="mj-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0d1424" />
              <stop offset="1" stopColor="#2a3346" />
            </linearGradient>
          </defs>
          <rect width="320" height="260" fill="url(#mj-sky)" />
          <path className="mj-bolt" d="M178 0 L160 52 L176 56 L150 118 L170 120 L146 170" fill="none" stroke="#e9f3ff" strokeWidth="3" strokeLinejoin="round" />
          {/* the crater */}
          <ellipse cx="160" cy="226" rx="150" ry="30" fill="#1b1f26" />
          <path d="M10 226 Q60 196 100 206 Q160 186 220 206 Q262 196 310 226 Q260 244 160 246 Q60 244 10 226 Z" fill="#3a3f47" />
          <ellipse cx="160" cy="218" rx="70" ry="14" fill="#14171c" />
          {[30, 74, 246, 284].map((x, i) => (
            <path key={x} d={`M${x} 226 l12 -14 l14 4 l6 12 Z`} fill={i % 2 ? '#4a5059' : '#555c66'} />
          ))}
          <g className="mj-hammer">
            {/* the leather-wrapped handle, the strap, then the head in the ground */}
            <path d="M154 70 h12 v120 h-12 Z" fill="#5a3a22" />
            {Array.from({ length: 12 }, (_, i) => (
              <path key={i} d={`M154 ${76 + i * 10} l12 -5`} stroke="#3b2414" strokeWidth="2" />
            ))}
            <path d="M156 70 C140 50 146 30 160 30 C174 30 180 50 164 70" fill="none" stroke="#3b2414" strokeWidth="4" />
            <rect x="152" y="64" width="16" height="8" rx="2" fill="#8d959c" />
            <path d="M112 186 h96 l6 8 v40 l-6 8 h-96 l-6 -8 v-40 Z" fill="url(#mj-head)" stroke="#2c3238" strokeWidth="1.5" />
            <path d="M126 196 c10 10 24 10 34 0 c10 10 24 10 34 0 M126 222 c10 -10 24 -10 34 0 c10 -10 24 -10 34 0" fill="none" stroke="#3a4148" strokeWidth="1.6" />
          </g>
        </svg>
      </div>
      <div>
        <h2 id="mjolnir-title" className="title">
          Mjolnir
        </h2>
        <p className="lead mt-4 max-w-[46ch]">Only the worthy can lift it. Steve Rogers moved it an inch at a party, years before he picked it up for real.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            className="btn btn-primary hold-btn"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture?.(e.pointerId);
              begin();
            }}
            onPointerUp={end}
            onPointerLeave={end}
            onPointerCancel={end}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            onContextMenu={(e) => e.preventDefault()}
            disabled={state === 'lifted'}
          >
            {state === 'straining' ? 'Hold on…' : 'Press and hold to lift'}
          </button>
          {state === 'lifted' && (
            <button type="button" className="btn btn-ghost" onClick={() => setState('rest')}>
              Put it back
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
