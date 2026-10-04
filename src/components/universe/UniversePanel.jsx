import { RiArrowLeftLine, RiArrowRightLine } from 'react-icons/ri';
import { CARDS } from '../interests/cards';
import { next, prev } from './layout';
import { byId } from './universes';

// Beside the map (a bottom sheet on a phone): the selected universe's card,
// the way into its world, and previous / next in map order.
export default function UniversePanel({ universe, onSelect, onEnter, leaving }) {
  if (!universe) {
    return (
      <aside className="universe-panel" aria-label="About the map">
        <p className="eyebrow">The universe</p>
        <h2 className="universe-title">Nine worlds, one map</h2>
        <p className="mt-3 text-sm leading-relaxed">Pick a planet to fly there and see what it holds. Drag to turn the map. The arrow keys step through them and Escape brings you back out.</p>
        <button type="button" className="btn btn-primary mt-5" onClick={() => onSelect(next(null))}>
          Start with Star Wars <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
        </button>
      </aside>
    );
  }
  const Card = CARDS[universe.id];
  const before = byId(prev(universe.id));
  const after = byId(next(universe.id));
  return (
    <aside className="universe-panel" aria-label={universe.label} aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="globe-btn" onClick={() => onSelect(before.id)} aria-label={`Previous: ${before.label}`} title={before.label}>
          <RiArrowLeftLine className="h-4 w-4" aria-hidden="true" />
        </button>
        <p className="eyebrow truncate" style={{ color: universe.accent }}>
          {universe.label}
        </p>
        <button type="button" className="globe-btn" onClick={() => onSelect(after.id)} aria-label={`Next: ${after.label}`} title={after.label}>
          <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <button type="button" className="btn btn-primary universe-enter mt-4" onClick={onEnter} disabled={leaving}>
        Enter {universe.world ?? (universe.id === 'travel' ? 'the travel page' : 'the Game Boy')} <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
      </button>
      <ul className="universe-card mt-4" key={universe.id}>
        <Card />
      </ul>
    </aside>
  );
}
