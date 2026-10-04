import { NavLink } from 'react-router-dom';
import { WORLDS } from './worlds';

// A way between the hidden worlds, on each of them.
export default function WorldSwitcher({ className = '' }) {
  return (
    <nav className={`world-switcher ${className}`} aria-label="Worlds">
      <span className="world-switcher-label">Worlds</span>
      {WORLDS.map((w) => (
        <NavLink key={w.to} to={w.to} className={({ isActive }) => `world-link${isActive ? ' is-active' : ''}`} title={w.from}>
          {w.label}
        </NavLink>
      ))}
    </nav>
  );
}
