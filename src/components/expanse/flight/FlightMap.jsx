import { useCallback, useRef, useState } from 'react';
import { MiniMap, far, minimapSize } from '../../../runtime/hud';
import { useMediaQuery } from '../../../lib/hooks';
import { bearingOf, markersOf } from './mapRules';
import './map.css';

// The flight's map in its HUD: the minimap (the kit's disc, drawn by
// ./map.js ten times a second), the waypoint's line on the top row (which
// way and how far, written through refs), and the full planet map
// (./PlanetMap) on M or a tap of the disc. The world gives the map, the ship
// and, where the shared world and the planet's life are on, its `pilots()`,
// `built()` and `occurrences()` lists; without them the map marks none.
//
//   <FlightMap spec source={() => world | null} touch />
export default function FlightMap({ spec, source, touch = false }) {
  const narrow = useMediaQuery('(max-width: 639px)');
  const [waypoint, setWaypoint] = useState(null);
  const way = useRef(null);
  way.current = waypoint;
  const arrow = useRef(null);
  const dist = useRef(null);

  const markers = useCallback(
    (w) => markersOf({ spec, waypoint: way.current, pilots: w.pilots?.() ?? [], built: w.built?.() ?? [], occurrences: w.occurrences?.() ?? [] }),
    [spec],
  );

  const draw = useCallback(
    (ctx, size) => {
      const w = source();
      if (!w?.map) return '';
      const ship = w.ship;
      if (way.current && arrow.current && dist.current) {
        const b = bearingOf(ship, way.current.at);
        arrow.current.style.transform = `rotate(${b.rel}rad)`;
        const text = far(b.dist);
        if (dist.current.textContent !== text) dist.current.textContent = text;
      }
      return w.map.drawMini(ctx, { ship, size, markers: markers(w) });
    },
    [source, markers],
  );

  const line = waypoint && (
    <p className="fly-waypoint" role="status">
      <span className="fly-waypoint-arrow" ref={arrow} aria-hidden="true">
        ↑
      </span>
      <span className="fly-waypoint-name">{waypoint.name}</span>
      <span className="fly-waypoint-dist" ref={dist} />
      <button type="button" className="fly-waypoint-clear" onClick={() => setWaypoint(null)} aria-label={`Clear the waypoint, ${waypoint.name}`}>
        ×
      </button>
    </p>
  );

  return (
    <>
      <MiniMap className="fly-minimap" size={minimapSize(narrow ? 0 : 1280, touch)} draw={draw} label={`Open the map of ${spec.name}`}>
        {narrow && line}
      </MiniMap>
      {!narrow && line}
    </>
  );
}
