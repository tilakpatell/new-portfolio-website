import { useState } from 'react';
import { RiArrowGoBackLine, RiArrowLeftLine, RiArrowRightLine, RiRestartLine } from 'react-icons/ri';
import { restartSite } from '../../lib/restart';
import { CARDS } from '../interests/cards';
import { STATION_CARDS } from './stationCards';
import { CREWS, crewById } from './crews';
import { next, prev } from './layout';
import { byId } from './universes';
import Face from './Faces';
import ModelCredits from '../ModelCredits';

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
            {Object.keys(c.speakers)
              .slice(0, 2) // the crew, not their guests
              .map((who) => (
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

export default function UniversePanel({ universe, onSelect, onEnter, onWhole, leaving, ship, onShip, onStartOn }) {
  const [changing, setChanging] = useState(false);
  const [homeFirst, setHomeFirst] = useState(false);
  const crew = crewById(ship);

  if (!universe) {
    return (
      <aside className="universe-panel" aria-label="About the map">
        <p className="eyebrow">The universe</p>
        <h2 className="universe-title">My whole site, as a universe</h2>
        {!crew || changing ? (
          <>
            <p className="mt-3 text-sm leading-relaxed">
              The stations round the sun are my pages: home, experience, projects, résumé, contact and the terminal. The planets further out are the things I love. Pick a ship and fly to any of them;
              your crew will have something to say about each.
            </p>
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
              <p className="mt-3 text-xs leading-relaxed text-muted">Or just pick a place by name, and the camera takes you there.</p>
            )}
          </>
        ) : (
          <>
            <p className="mt-3 text-sm leading-relaxed">
              You’re flying {crew.ship.replace(/^(The|An) /, (m) => m.toLowerCase())} with {crew.label}. Fly close to a station or a planet to see what’s there, or pick one by name and the ship takes
              you.
            </p>
            <ul className="universe-keys mt-4">
              <li className="universe-keys-board">
                <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or the arrows to fly
              </li>
              <li className="universe-keys-board">
                <kbd>R</kbd> to climb, <kbd>C</kbd> to dive
              </li>
              <li>Out past the planets is deep space: boost there for the pulse drive</li>
              <li className="universe-keys-board">
                <kbd>Space</kbd> to boost, <kbd>F</kbd> to fire, <kbd>M</kbd> for the whole map
              </li>
              <li className="universe-keys-board">
                <kbd>E</kbd> to land or dock where you are
              </li>
              <li className="universe-keys-touch">Drag anywhere on the map to fly, hold the arrows to climb and dive, hold Boost to go fast, and tap Fire</li>
              <li className="universe-keys-touch">Tap a planet or a station to fly there</li>
            </ul>
            <button type="button" className="btn btn-ghost btn-sm mt-5" onClick={() => setChanging(true)}>
              Change ship
            </button>
          </>
        )}
        <button
          type="button"
          className="universe-back mt-5"
          onClick={() => {
            onStartOn?.('home');
            setHomeFirst(true);
          }}
          aria-live="polite"
        >
          {homeFirst ? 'Next time the site opens on the home page.' : 'Prefer the plain site? Start on the home page next time'}
        </button>
        <button type="button" className="universe-back mt-2" onClick={restartSite}>
          <RiRestartLine className="h-3.5 w-3.5" aria-hidden="true" /> Restart the site from the beginning
        </button>
        <p className="universe-credit">
          Planet maps and the Milky Way by{' '}
          <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener noreferrer">
            Solar System Scope
          </a>{' '}
          (CC BY 4.0), recoloured; metal and paper from{' '}
          <a href="https://ambientcg.com" target="_blank" rel="noopener noreferrer">
            ambientCG
          </a>{' '}
          (CC0).
        </p>
        <ModelCredits where="universe" className="universe-credit universe-models" />
      </aside>
    );
  }
  const Card = CARDS[universe.id] ?? STATION_CARDS[universe.id];
  const core = universe.kind === 'core';
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
        {crew ? (core ? 'Dock at' : 'Land on') : 'Go to'} {universe.place} <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
      </button>
      <ul className="universe-card mt-4" key={universe.id}>
        <Card />
      </ul>
    </aside>
  );
}
