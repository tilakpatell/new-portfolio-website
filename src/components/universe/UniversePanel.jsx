import { useEffect, useRef, useState } from 'react';
import { RiArrowGoBackLine, RiArrowLeftLine, RiArrowRightLine, RiRestartLine, RiSideBarFill, RiSideBarLine } from 'react-icons/ri';
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
// out to the whole map. Put away (tucked), it's a small bar naming where you
// are, so the map has the room; the same element either way, so the scene
// sees it change size and moves the planets into the space it leaves.

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

// Put the panel away, from its top corner
function Tuck({ onTuck }) {
  return (
    <button type="button" className="universe-tuck" onClick={() => onTuck(true)} aria-expanded="true" aria-label="Hide the panel" title="Hide the panel">
      <RiSideBarFill className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

export default function UniversePanel({ universe, onSelect, onEnter, onWhole, leaving, ship, onShip, onStartOn, tucked = false, onTuck }) {
  const [changing, setChanging] = useState(false);
  const [homeFirst, setHomeFirst] = useState(false);
  const crew = crewById(ship);
  // a press on hide or show unmounts the button pressed: the focus goes on
  // to the one that takes its place
  const panel = useRef(null);
  const refocus = useRef(false);
  const toggle = (on) => {
    refocus.current = true;
    onTuck(on);
  };
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    panel.current?.querySelector('.universe-tuck, .universe-untuck')?.focus();
  }, [tucked]);

  if (tucked) {
    return (
      <aside ref={panel} className="universe-panel" aria-label={universe ? universe.label : 'About the map'} data-tucked="">
        <button type="button" className="universe-untuck" onClick={() => toggle(false)} aria-expanded="false">
          <span className="eyebrow truncate" style={universe ? { color: universe.accent } : undefined}>
            {universe ? universe.label : 'The universe'}
          </span>
          <span className="universe-untuck-say">
            <RiSideBarLine className="h-4 w-4" aria-hidden="true" /> Show the panel
          </span>
        </button>
      </aside>
    );
  }

  if (!universe) {
    return (
      <aside ref={panel} className="universe-panel" aria-label="About the map">
        {onTuck && <Tuck onTuck={toggle} />}
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
                <kbd>W</kbd> <kbd>S</kbd> for the throttle, <kbd>A</kbd> <kbd>D</kbd> or <kbd>←</kbd> <kbd>→</kbd> to turn
              </li>
              <li className="universe-keys-board">
                <kbd>↑</kbd> <kbd>↓</kbd> (or <kbd>R</kbd> <kbd>C</kbd>) to tip the nose up and down: the ship flies along it, so it climbs and dives faster the faster it goes. Or drag on the map like a stick
              </li>
              <li>Out past the planets is deep space: boost there for the pulse drive</li>
              <li className="universe-keys-board">
                <kbd>Space</kbd> to boost, hold <kbd>F</kbd> to fire, <kbd>M</kbd> for the whole map
              </li>
              <li className="universe-keys-board">
                <kbd>V</kbd> for the cockpit, or back behind the ship
              </li>
              <li>The guns lock on to whoever comes after you, the ones coming at you first: shoot at the pip ahead of them and the shots bend home. Arrows at the edge show the ones you can’t see</li>
              <li className="universe-keys-board">
                <kbd>T</kbd> for the next target (<kbd>Q</kbd> the one before), or click one; <kbd>E</kbd> to land or dock where you are
              </li>
              <li className="universe-keys-board">
                <kbd>O</kbd> for the flight settings: steering, climb and dive, drag sensitivity, aim assist, the camera, and up and down the other way round
              </li>
              <li>Out in deep space, click a wonder and the ship flies you there</li>
              <li className="universe-keys-touch">Drag anywhere on the map to fly, hold the arrows to climb and dive, hold Boost to go fast and Fire to shoot; View puts you in the cockpit, and the sliders button in the corner sets how it all feels</li>
              <li className="universe-keys-touch">Tap a planet, a station or a wonder to fly there, or a hunter to lock on</li>
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
    <aside ref={panel} className="universe-panel" aria-label={universe.label}>
      {onTuck && <Tuck onTuck={toggle} />}
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
