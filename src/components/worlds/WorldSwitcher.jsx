import { Link, NavLink, useLocation } from 'react-router-dom';
import { RiArrowRightLine } from 'react-icons/ri';
import { WORLDS } from './worlds';
import { byPath } from '../universe/universes';
import { nextWorld } from '../universe/layout';
import '../../styles/lazy/worlds.css';

// A way between the hidden worlds, on each of them: back to this world's
// place on the universe map, on to the next world, or straight to any.
// (On a planet of the Rick and Morty sector, /c-137/<moon>, C-137's link
// isn't lit: the planet's a world of its own. The Citadel's still C-137's.)
export default function WorldSwitcher({ className = '' }) {
  const here = byPath(useLocation().pathname);
  const after = nextWorld(here?.id ?? null);
  const onMoon = here?.kind === 'moon';
  return (
    <nav className={`world-switcher ${className}`} aria-label="Worlds">
      <Link to={here ? `/universe/${here.id}` : '/universe'} className="world-link world-link-map">
        Universe map
      </Link>
      <Link to={after.to} className="world-link">
        Next: {after.world} <RiArrowRightLine className="inline h-3.5 w-3.5" aria-hidden="true" />
      </Link>
      <Link to="/worlds" className="world-link">
        Installed
      </Link>
      <span className="world-switcher-label">Worlds</span>
      {WORLDS.map((w) => (
        <NavLink key={w.to} to={w.to} end={onMoon} className={({ isActive }) => `world-link${isActive ? ' is-active' : ''}`} title={w.from}>
          {w.label}
        </NavLink>
      ))}
    </nav>
  );
}
