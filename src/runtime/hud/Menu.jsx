import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { openGuide } from '../../lib/palette';
import PlayersChip from './PlayersChip';

// A world's one Menu, top right: the world's own settings first (as
// children: <MenuItem>s), then Things to do, Controls (the site's guide, so
// the keys are written once, in guide/pages.js), the other players and the
// way out to the universe map. `todo`: { onOpen, done, total, label } (a
// world's canon name for its list, Passport or Cartridges, as its label;
// "Things to do" otherwise). Closes on a click anywhere else, on Esc, or
// on picking something.
export default function Menu({ label = 'Menu', todo = null, controls = true, trav = null, noun = 'players', lore = null, mapTo = null, className = '', children = null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const off = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener('pointerdown', off);
    window.addEventListener('keydown', off);
    return () => {
      window.removeEventListener('pointerdown', off);
      window.removeEventListener('keydown', off);
    };
  }, [open]);
  const close = () => setOpen(false);

  return (
    <div className={`hud-menu ${className}`.trim()} ref={ref}>
      <button type="button" className="hud-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
        {label}
      </button>
      {open && (
        // (a click on an item closes the menu after the item has done its thing)
        <div className="hud-menu-list" role="menu" onClick={(e) => e.target.closest('[data-keep]') || close()}>
          {children}
          {todo && (
            <button type="button" role="menuitem" onClick={todo.onOpen}>
              {todo.label ?? 'Things to do'}
              {todo.total ? ` · ${todo.done ?? 0}/${todo.total}` : ''}
            </button>
          )}
          {controls && (
            <button type="button" role="menuitem" onClick={openGuide} aria-keyshortcuts="?">
              Controls
            </button>
          )}
          {trav && <PlayersChip trav={trav} noun={noun} lore={lore} item />}
          {mapTo && (
            <Link role="menuitem" to={mapTo}>
              Universe map
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// One of a world's own entries in the Menu. `keep`: the menu stays open
// after it (a setting that cycles, read off the item itself).
export function MenuItem({ onClick, keep = false, children, ...rest }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} data-keep={keep || undefined} {...rest}>
      {children}
    </button>
  );
}
