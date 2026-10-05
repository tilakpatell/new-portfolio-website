import { useRef } from 'react';
import { useOnceVisible } from './ui';
import { audioContext } from '../lib/audio';
import { prefersReducedMotion } from '../lib/hooks';
import '../styles/lazy/sitardivider.css';

// A section break drawn as a sitar string. It shivers once when it scrolls into
// view; click it and it plays a note.
export default function SitarDivider({ className = '' }) {
  const ref = useOnceVisible('seen');
  const string = useRef(null);
  const pluckIt = async () => {
    if (!audioContext()) return; // start audio inside the click, before awaiting
    // the string shivers and settles back to a straight line
    if (!prefersReducedMotion()) {
      string.current?.querySelector('.sd-wave')?.animate(
        [1, -0.85, 0.6, -0.4, 0.22, -0.1, 0.002].map((k, i) => ({ transform: `scaleY(${k})`, offset: [0, 0.1, 0.22, 0.36, 0.52, 0.7, 1][i] })),
        { duration: 1600, easing: 'cubic-bezier(0.2, 0.6, 0.3, 1)' },
      );
    }
    const { pluck } = await import('./music/engine');
    const yaman = [1, 9 / 8, 5 / 4, 45 / 32, 3 / 2, 5 / 3, 15 / 8, 2];
    pluck(yaman[Math.floor(Math.random() * yaman.length)]);
  };
  return (
    <div ref={ref} className={`sitar-divider ${className}`}>
      <span className="sd-peg" aria-hidden="true" />
      <button ref={string} type="button" className="sd-string" onClick={pluckIt} aria-label="Pluck a sitar string">
        <svg viewBox="0 0 1000 24" preserveAspectRatio="none" aria-hidden="true">
          <path className="sd-wave" d="M0 12 Q 62.5 0 125 12 T 250 12 T 375 12 T 500 12 T 625 12 T 750 12 T 875 12 T 1000 12" />
        </svg>
      </button>
      <span className="sd-peg" aria-hidden="true" />
    </div>
  );
}
