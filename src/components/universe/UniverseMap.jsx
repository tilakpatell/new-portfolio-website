import { useEffect, useRef } from 'react';
import { useScene } from '../../lib/three/useScene';
import { UNIVERSES } from './universes';
import { ORDER, keyStep } from './layout';
import MiniMap from './MiniMap';

// The map: the 3D scene (scene.js and planets.js, through useScene) with the
// planets' names as buttons over it. React renders the names once; the
// scene moves them as it draws. The names are one focus group: the arrow
// keys step through the universes, Home and End jump to the ends. While the
// 3D loads the box says so (3D first: never the flat map in the meantime);
// if 3D is off, fails or is lost, the flat MiniMap takes the box.
const load = () => import('./scene');

export default function UniverseMap({ selected, onSelect, handle, frozen }) {
  const labels = useRef({});
  const { wrap, on, meant, view } = useScene(load, {
    id: 'universe',
    near: '0px',
    props: { selected, labels, frozen, onPick: onSelect },
  });

  // what the page needs from the map: whether it's drawing, and the dive in
  useEffect(() => {
    if (!handle) return;
    handle.current = { live: on, dive: (id) => view.current?.dive?.(id) ?? 0 };
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

  return (
    <div ref={wrap} className="universe-map">
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
        </>
      ) : (
        <div className="universe-flat">
          <MiniMap selected={selected} onSelect={onSelect} />
        </div>
      )}
    </div>
  );
}
