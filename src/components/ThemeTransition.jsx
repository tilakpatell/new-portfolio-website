import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { THEMES } from '../theme/themes';
import { prefersReducedMotion } from '../lib/hooks';

// The moment a theme is picked: a short scene in its own style, a line it's
// known for and an original sound, while the new colours land underneath.
// Click, tap or any key skips it. Reduced motion keeps the words, not the motion.

const sfx = () => import('../lib/sfx');

const SCENES = {
  jedi: { kind: 'saber', color: '#4aa3ff', quote: 'May the Force be with you.', by: 'Star Wars', sound: (s) => s.saber(undefined, undefined, 0, 'jedi') },
  sith: { kind: 'saber', color: '#ff2a36', quote: 'I find your lack of faith disturbing.', by: 'Darth Vader', sound: (s) => s.saber(undefined, undefined, 0, 'sith') },
  stark: { kind: 'hud', color: '#7fdcff', quote: 'I am Iron Man.', by: 'Tony Stark', sound: (s) => s.repulsor() },
  arcade: { kind: 'pixels', color: '#d6246e', quote: 'Let’s-a go!', by: 'Player one', sound: (s) => s.coin() },
  heisenberg: { kind: 'tiles', color: '#5ec8f0', quote: 'I am the one who knocks.', by: 'Walter White', sound: (s) => s.knock() },
  dunder: { kind: 'memo', color: '#1f4e8c', quote: 'Limitless paper in a paperless world.', by: 'Dunder Mifflin', sound: (s) => s.ding() },
  raga: { kind: 'ripple', color: '#e8871e', quote: 'Sa. Where every raga begins and ends.', by: 'Raga', sound: null },
  optimus: { kind: 'transform', color: '#c8102e', quote: 'Autobots, roll out!', by: 'Optimus Prime', sound: (s) => s.transform() },
  megatron: { kind: 'transform', color: '#8b5cf6', quote: 'Peace through tyranny.', by: 'Megatron', sound: (s) => s.transform() },
  bumblebee: { kind: 'transform', color: '#f7c600', quote: 'Bumblebee, ready to roll.', by: 'Bumblebee', sound: (s) => s.transform() },
  shockwave: { kind: 'transform', color: '#a855f7', quote: 'Logic dictates only one outcome.', by: 'Shockwave', sound: (s) => s.transform() },
  soundwave: { kind: 'transform', color: '#4fd8ff', quote: 'Soundwave superior. Autobots inferior.', by: 'Soundwave', sound: (s) => s.transform() },
};

const LENGTH = { saber: 1700, hud: 1700, pixels: 1500, tiles: 1700, memo: 1800, ripple: 1800, transform: 1800, wipe: 1300 };

function Scene({ kind, color }) {
  if (kind === 'saber')
    return (
      <div className="tt-saber" aria-hidden="true">
        <span className="tt-hilt" />
        <span className="tt-blade" style={{ '--c': color }} />
      </div>
    );
  if (kind === 'hud')
    return (
      <div className="tt-hud" aria-hidden="true" style={{ '--c': color }}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="tt-ring" style={{ '--i': i }} />
        ))}
        <span className="tt-sweep" />
        <span className="tt-core" />
      </div>
    );
  if (kind === 'pixels')
    return (
      <div className="tt-pixels" aria-hidden="true">
        {Array.from({ length: 96 }, (_, i) => (
          <span key={i} style={{ '--d': `${((i % 12) + Math.floor(i / 12)) * 22}ms`, background: i % 7 === 0 ? '#22e07a' : i % 5 === 0 ? '#ffd23f' : color }} />
        ))}
      </div>
    );
  if (kind === 'ripple')
    return (
      <div className="tt-ripple" aria-hidden="true" style={{ '--c': color }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ '--i': i }} />
        ))}
      </div>
    );
  if (kind === 'transform')
    return (
      <div className="tt-plates" aria-hidden="true" style={{ '--c': color }}>
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} style={{ '--i': i }} />
        ))}
      </div>
    );
  if (kind === 'tiles') return <div className="tt-haze" aria-hidden="true" />;
  if (kind === 'wipe') return <div className="tt-wipe" aria-hidden="true" style={{ '--c': color }} />;
  return null;
}

// What sits just above the words, in the flow, so it never covers them.
function Badge({ kind, color }) {
  if (kind === 'tiles')
    return (
      <div className="tt-tiles" aria-hidden="true">
        {[
          ['35', 'Br', 'Bromine'],
          ['56', 'Ba', 'Barium'],
        ].map(([n, sym, name], i) => (
          <span key={sym} className="tt-tile" style={{ '--i': i }}>
            <small>{n}</small>
            <b>{sym}</b>
            <small>{name}</small>
          </span>
        ))}
      </div>
    );
  if (kind === 'memo')
    return (
      <div className="tt-memo" aria-hidden="true">
        <p className="tt-memo-head">Dunder Mifflin Paper Company · Scranton</p>
        <p className="tt-memo-line" />
        <p className="tt-memo-line short" />
        <span className="tt-stamp">Approved</span>
      </div>
    );
  if (kind === 'ripple')
    return (
      <b className="tt-sa" lang="hi" aria-hidden="true" style={{ color }}>
        सा
      </b>
    );
  if (kind === 'transform')
    return (
      <svg viewBox="0 0 48 48" className="tt-face" aria-hidden="true" style={{ '--c': color }}>
        <path d="M24 5 L36 11 V24 L32 36 H16 L12 24 V11 Z" />
        <path d="M16 19 h6 M26 19 h6" className="tt-eyes" />
        <path d="M19 29 h10 M21 32 h6" />
      </svg>
    );
  return null;
}

export default function ThemeTransition({ id, onDone }) {
  const scene = SCENES[id] ?? { kind: 'wipe', color: THEMES[id]?.swatch ?? '#888888', quote: THEMES[id]?.company ?? '', by: 'Site colors' };
  const reduced = prefersReducedMotion();
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (scene.sound) sfx().then((s) => scene.sound(s));
    else if (id === 'raga')
      import('./music/engine').then((m) => {
        m.pluck(1, { vel: 0.8 });
        m.pluck(3 / 2, { when: 0.14, vel: 0.75 });
        m.pluck(2, { when: 0.28, vel: 0.85 });
        m.chikari({ when: 0.46, vel: 0.55 });
      });
    const t = setTimeout(() => done.current(), reduced ? 1100 : LENGTH[scene.kind]);
    const skip = () => done.current();
    window.addEventListener('keydown', skip);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', skip);
    };
    // play once per transition
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="tt" data-kind={scene.kind} data-id={id} data-reduced={reduced || undefined} onPointerDown={() => done.current()} style={{ '--tt-len': `${reduced ? 1100 : LENGTH[scene.kind]}ms` }}>
      {!reduced && <Scene kind={scene.kind} color={scene.color} />}
      <figure className="tt-words" role="status">
        {!reduced && <Badge kind={scene.kind} color={scene.color} />}
        <blockquote>{scene.quote}</blockquote>
        {scene.by && <figcaption>{scene.by}</figcaption>}
      </figure>
    </div>,
    document.body,
  );
}
