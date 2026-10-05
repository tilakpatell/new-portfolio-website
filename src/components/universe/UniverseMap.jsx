import { useEffect, useRef, useState } from 'react';
import { useScene } from '../../lib/three/useScene';
import { UNIVERSES } from './universes';
import { ORDER, keyStep } from './layout';
import MiniMap from './MiniMap';

// The map: the 3D scene (scene.js and planets.js, through useScene) with the
// planets' names as buttons over it. React renders the names once; the
// scene moves them as it draws. The names are one focus group: the arrow
// keys step through the universes, Home and End jump to the ends. With a
// ship picked there's a ring that shows the drag-to-steer stick, a gauge of
// how high it flies, its shields (while there's trouble about), Boost, Fire
// and climb and dive buttons on touch screens and a line on how to fly
// until you do. While the
// 3D loads the box says so (3D first: never the flat map in the meantime);
// if 3D is off, fails or is lost, the flat MiniMap takes the box.
const load = () => import('./scene');

export default function UniverseMap({ selected, onSelect, onOpen, handle, frozen, ship, onEvent, onLand, onCrash }) {
  const labels = useRef({});
  const stick = useRef(null);
  const alt = useRef(null);
  const shield = useRef(null);
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
      alt,
      shield,
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
  const climb = (way) => (e) => {
    e.preventDefault();
    view.current?.climb?.(way);
  };
  const climbButton = (way, label) => (
    <button
      type="button"
      className="universe-climb"
      aria-label={label}
      onPointerDown={climb(way)}
      onPointerUp={climb(0)}
      onPointerCancel={climb(0)}
      onPointerLeave={climb(0)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d={way > 0 ? 'M5 15l7-7 7 7' : 'M5 9l7 7 7-7'} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );

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
              <div ref={alt} className="universe-alt" aria-hidden="true">
                <span className="universe-alt-mark" />
              </div>
              <div ref={shield} className="universe-shield" aria-hidden="true">
                <span className="universe-shield-label">Shields</span>
                <span className="universe-shield-bar">
                  <span />
                </span>
              </div>
              <div className="universe-climbs">
                {climbButton(1, 'Climb')}
                {climbButton(-1, 'Dive')}
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
                    <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> to fly, <kbd>R</kbd> <kbd>C</kbd> to climb and dive, <kbd>Space</kbd> to boost, <kbd>F</kbd> to fire, <kbd>M</kbd> for the map
                  </span>
                  <span className="universe-hint-touch">Drag anywhere to fly, the arrows to climb and dive, hold Boost to go fast</span>
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
