import { EMBLEMS, EMBLEM_BOX } from './emblems';

// A side's crest (emblems.js), drawn in the colour it's given (currentColor):
// on the holotable's fleets, in the war's strength strip and in its key.
// Always beside words that say whose it is, so it's hidden from screen readers.
export default function Emblem({ side, className = 'holomap-emblem' }) {
  const shapes = EMBLEMS[side];
  if (!shapes) return null;
  return (
    <svg className={className} viewBox={EMBLEM_BOX} aria-hidden="true" focusable="false">
      {shapes.map((s) => (
        <path key={s.d} d={s.d} fill="currentColor" fillRule={s.evenodd ? 'evenodd' : undefined} />
      ))}
    </svg>
  );
}
