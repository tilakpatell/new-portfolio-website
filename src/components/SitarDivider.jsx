import { useState } from 'react';
import { useOnceVisible } from './ui';

// A section break drawn as a sitar string. It shivers once when it scrolls into
// view; click it and it plays a note.
export default function SitarDivider({ className = '' }) {
  const ref = useOnceVisible('seen');
  const [plucks, setPlucks] = useState(0);
  const pluckIt = async () => {
    const { pluck } = await import('./interests/sitar');
    pluck(Math.floor(Math.random() * 8));
    setPlucks((n) => n + 1);
  };
  return (
    <div ref={ref} className={`sitar-divider ${className}`}>
      <span className="sd-peg" aria-hidden="true" />
      <button type="button" className="sd-string" onClick={pluckIt} aria-label="Pluck a sitar string" key={plucks} data-plucked={plucks > 0 || undefined}>
        <svg viewBox="0 0 1000 24" preserveAspectRatio="none" aria-hidden="true">
          <path className="sd-wave" d="M0 12 Q 62.5 0 125 12 T 250 12 T 375 12 T 500 12 T 625 12 T 750 12 T 875 12 T 1000 12" />
        </svg>
      </button>
      <span className="sd-peg" aria-hidden="true" />
    </div>
  );
}
