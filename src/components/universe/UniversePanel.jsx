import { useState } from 'react';
import { RiArrowGoBackLine, RiArrowLeftLine, RiArrowRightLine } from 'react-icons/ri';
import { CARDS } from '../interests/cards';
import { CREWS, crewById } from './crews';
import { next, prev } from './layout';
import { byId } from './universes';
import Face from './Faces';

// Beside the map (a bottom sheet on a phone). With nothing selected: the
// ships to fly (or how to fly the one you're in). With a universe selected:
// its card, the way into its world, previous / next in map order, and back
// out to the whole map.

function Ships({ ship, onShip }) {
  return (
    <div className="universe-ships" role="group" aria-label="Pick a ship">
      {CREWS.map((c) => (
        <button key={c.id} type="button" className="universe-ship" aria-pressed={ship === c.id} onClick={() => onShip(c.id)}>
          <span className="universe-ship-faces" aria-hidden="true">
            {Object.keys(c.speakers).map((who) => (
              <Face key={who} who={who} className="universe-ship-face" />
            ))}
          </span>
          <span className="universe-ship-text">
            <span className="universe-ship-name">{c.ship}</span>
            <span className="universe-ship-crew">with {c.label}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export default function UniversePanel({ universe, onSelect, onEnter, onWhole, leaving, ship, onShip }) {
  const [changing, setChanging] = useState(false);
  const crew = crewById(ship);

  if (!universe) {
    return (
      <aside className="universe-panel" aria-label="About the map">
        <p className="eyebrow">The universe</p>
        <h2 className="universe-title">Ten worlds, one map</h2>
        {!crew || changing ? (
          <>
            <p className="mt-3 text-sm leading-relaxed">Pick a ship and fly it between the worlds. Your crew will have something to say about each one.</p>
            <Ships
              ship={ship}
              onShip={(id) => {
                setChanging(false);
                onShip(id);
              }}
            />
            {crew ? (
              <button type="button" className="universe-back mt-3" onClick={() => onShip(null)}>
                No ship, just look around
              </button>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-muted">Or just pick a planet, and the camera takes you there.</p>
            )}
          </>
        ) : (
          <>
            <p className="mt-3 text-sm leading-relaxed">
              You’re flying {crew.ship.replace(/^(The|An) /, (m) => m.toLowerCase())} with {crew.label}. Fly close to a planet to see what’s there, or pick one by name and the ship takes you.
            </p>
            <ul className="universe-keys mt-4">
              <li className="universe-keys-board">
                <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or the arrows to fly
              </li>
              <li className="universe-keys-board">
                <kbd>Space</kbd> to boost, <kbd>M</kbd> for the whole map
              </li>
              <li className="universe-keys-board">
                <kbd>E</kbd> to land on the planet you’re at
              </li>
              <li className="universe-keys-touch">Drag anywhere on the map to fly, and hold Boost to go fast</li>
              <li className="universe-keys-touch">Tap a planet to fly there</li>
            </ul>
            <button type="button" className="btn btn-ghost btn-sm mt-5" onClick={() => setChanging(true)}>
              Change ship
            </button>
          </>
        )}
      </aside>
    );
  }
  const Card = CARDS[universe.id];
  const before = byId(prev(universe.id));
  const after = byId(next(universe.id));
  return (
    <aside className="universe-panel" aria-label={universe.label}>
      <button type="button" className="universe-back" onClick={onWhole}>
        <RiArrowGoBackLine className="h-3.5 w-3.5" aria-hidden="true" /> The whole map
      </button>
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
        {crew ? 'Land on' : 'Enter'} {universe.world ?? (universe.id === 'travel' ? (crew ? 'Earth' : 'the travel page') : 'the Game Boy')} <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
      </button>
      <ul className="universe-card mt-4" key={universe.id}>
        <Card />
      </ul>
    </aside>
  );
}
