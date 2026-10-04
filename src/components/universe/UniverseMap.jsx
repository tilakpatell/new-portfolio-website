import { useEffect, useRef, useState } from 'react';
import { useScene } from '../../lib/three/useScene';
import { UNIVERSES } from './universes';
import { ORDER, keyStep } from './layout';
import MiniMap from './MiniMap';

// The map: the 3D scene (scene.js and planets.js, through useScene) with the
// planets' names as buttons over it. React renders the names once; the
// scene moves them as it draws. The names are one focus group: the arrow
// keys step through the universes, Home and End jump to the ends. With a
// ship picked there's a ring that shows the drag-to-steer stick, a Boost
// button on touch screens and a line on how to fly until you do. While the
// 3D loads the box says so (3D first: never the flat map in the meantime);
// if 3D is off, fails or is lost, the flat MiniMap takes the box.
const load = () => import('./scene');

export default function UniverseMap({ selected, onSelect, onOpen, handle, frozen, ship, onEvent, onLand, onCrash }) {
  const labels = useRef({});
  const stick = useRef(null);
  const [flown, setFlown] = useState(false);
  const events = useRef(onEvent);
  events.current = onEvent;
  const { wrap, on, meant, view } = useScene(load, {
    id: 'universe',
    near: '0px',
    props: {
      selected,
      ship,
      labels,
      stick,
      frozen,
      onPick: onSelect,
      onOpen,
      onLand,
      onCrash,
      onEvent: (e) => {
        if (e.type === 'launch') setFlown(true);
        events.current?.(e);
      },
    },
  });

  useEffect(() => setFlown(false), [ship]);

  // what the page needs from the map: whether it's drawing, the dive in,
  // and Escape and the whole map while flying
  useEffect(() => {
    if (!handle) return;
    handle.current = {
      live: on,
      dive: (id) => view.current?.dive?.(id) ?? 0,
      escape: () => view.current?.escape?.() ?? false,
      whole: () => view.current?.whole?.() ?? false,
    };
  }, [handle, on, view]);

  const focusable = selected ?? ORDER[0];
  const onKeyDown = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const to = keyStep(e.key, selected);
    if (to === undefined) return;
    e.preventDefault();
    onSelect(to);
    labels.current[to]?.focus();
  };

  const hold = (down) => (e) => {
    e.preventDefault();
    view.current?.boost?.(down);
  };

  return (
    <div ref={wrap} className="universe-map" data-ship={ship || undefined}>
      {meant ? (
        <>
          {!on && (
            <p className="universe-loading" role="status">
              Charting the universe…
            </p>
          )}
          <ul className="universe-labels" aria-label="Universes" onKeyDown={onKeyDown}>
            {UNIVERSES.map((u) => (
              <li key={u.id}>
                <button
                  ref={(el) => {
                    labels.current[u.id] = el;
                  }}
                  type="button"
                  className="universe-label"
                  data-station={u.kind === 'core' || undefined}
                  style={{ '--swatch': u.swatch }}
                  aria-pressed={selected === u.id}
                  tabIndex={u.id === focusable ? 0 : -1}
                  onClick={() => onSelect(u.id)}
                  onPointerEnter={() => view.current?.hover?.(u.id)}
                  onPointerLeave={() => view.current?.hover?.(null)}
                  onFocus={() => view.current?.hover?.(u.id)}
                  onBlur={() => view.current?.hover?.(null)}
                >
                  {u.label}
                </button>
              </li>
            ))}
          </ul>
          {ship && on && (
            <>
              <div ref={stick} className="universe-stick" aria-hidden="true">
                <span />
              </div>
              <button type="button" className="universe-fire" onPointerDown={(e) => (e.preventDefault(), view.current?.fire?.())} onContextMenu={(e) => e.preventDefault()}>
                Fire
              </button>
              <button
                type="button"
                className="universe-boost"
                onPointerDown={hold(true)}
                onPointerUp={hold(false)}
                onPointerCancel={hold(false)}
                onPointerLeave={hold(false)}
                onContextMenu={(e) => e.preventDefault()}
              >
                Boost
              </button>
              {!flown && (
                <p className="universe-hint">
                  <span className="universe-hint-keys">
                    <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or the arrows to fly, <kbd>Space</kbd> to boost, <kbd>F</kbd> to fire, <kbd>M</kbd> for the map
                  </span>
                  <span className="universe-hint-touch">Drag anywhere to fly, hold Boost to go fast, tap Fire</span>
                </p>
              )}
            </>
          )}
        </>
      ) : (
        <div className="universe-flat">
          <MiniMap selected={selected} onSelect={onSelect} />
        </div>
      )}
    </div>
  );
}
