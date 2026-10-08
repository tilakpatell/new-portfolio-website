import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { openGuide } from '../../lib/palette';
import PlayersChip from './PlayersChip';

// A world's one Menu, top right: the world's own settings first (as
// children: <MenuItem>s), then Things to do, Controls (the site's guide, so
// the keys are written once, in guide/pages.js), the other players and the
// way out to the universe map. `todo`: { onOpen, done, total, label } (a
// world's canon name for its list, Passport or Cartridges, as its label;
// "Things to do" otherwise). Closes on a click anywhere else, on Esc (that
// Esc is the menu's: the world doesn't also back out of something), or on
// picking something; the focus goes back to its button. A disclosure, not
// an ARIA menu: its entries are plain buttons and links, Tab between them.
export default function Menu({ label = 'Menu', todo = null, controls = true, trav = null, noun = 'players', lore = null, mapTo = null, className = '', children = null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const button = useRef(null);
  const id = useId();
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setOpen(false);
      button.current?.focus();
    };
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc, true);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc, true);
    };
  }, [open]);
  const close = () => {
    // (back to the button if the focus was in the list, so a keyboard isn't dropped on the page)
    const inside = ref.current?.contains(document.activeElement);
    setOpen(false);
    if (inside) button.current?.focus();
  };

  return (
    <div className={`hud-menu ${className}`.trim()} ref={ref}>
      <button ref={button} type="button" className="hud-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={id}>
        {label}
      </button>
      {open && (
        // (a click on an item closes the menu after the item has done its thing)
        <div className="hud-menu-list" id={id} onClick={(e) => e.target.closest('[data-keep]') || close()}>
          {children}
          {todo && (
            <button type="button" onClick={todo.onOpen}>
              {todo.label ?? 'Things to do'}
              {todo.total ? ` · ${todo.done ?? 0}/${todo.total}` : ''}
            </button>
          )}
          {controls && (
            <button type="button" onClick={openGuide} aria-keyshortcuts="?">
              Controls
            </button>
          )}
          {trav && <PlayersChip trav={trav} noun={noun} lore={lore} item />}
          {mapTo && (
            <Link to={mapTo}>
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
    <button type="button" onClick={onClick} data-keep={keep || undefined} {...rest}>
      {children}
    </button>
  );
}
