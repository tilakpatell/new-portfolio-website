import { useState } from 'react';
import { RiPauseLine, RiPlayLine } from 'react-icons/ri';
import { useInView, useReducedMotion, useScript } from '../lib/hooks';
import './stages.css';

// Plays a scripted sequence while the stage is on screen. Starts paused for
// visitors who prefer reduced motion; the phase dots let anyone step through.
// eslint-disable-next-line react-refresh/only-export-components
export function useStagePlayer(phases) {
  const [ref, inView] = useInView({ rootMargin: '0px' });
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(!reduced);
  const [index, setIndex] = useScript(phases, inView && playing);
  return { ref, index, setIndex, phase: phases[index], playing, setPlaying, running: inView && playing };
}

export function StageWindow({ title, right, children, className = '' }) {
  return (
    <div className={`stage-window dark-scope ${className}`}>
      <div className="stage-bar">
        <span className="stage-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="truncate">{title}</span>
        {right && <span className="ml-auto flex-none">{right}</span>}
      </div>
      {children}
    </div>
  );
}

export function PhaseBar({ phases, player: { index, setIndex, playing, setPlaying } }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
      <button
        type="button"
        className="btn btn-ghost btn-sm w-9 px-0"
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? 'Pause animation' : 'Play animation'}
      >
        {playing ? <RiPauseLine className="h-4 w-4" /> : <RiPlayLine className="h-4 w-4" />}
      </button>
      <div className="flex items-center gap-1.5" role="group" aria-label="Steps">
        {phases.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Step ${i + 1}: ${p.label}`}
            aria-current={i === index ? 'step' : undefined}
            className="grid h-6 w-6 place-items-center rounded-full"
          >
            <span
              className="block h-2 rounded-full transition-all duration-300"
              style={{ width: i === index ? 18 : 8, background: i === index ? 'var(--accent)' : 'var(--border-strong)' }}
            />
          </button>
        ))}
      </div>
      <p className="mono min-w-0 flex-1 text-sm text-body" aria-live="polite">
        {phases[index].label}
      </p>
    </div>
  );
}
