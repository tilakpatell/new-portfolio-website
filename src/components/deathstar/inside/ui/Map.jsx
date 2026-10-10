import { useMemo } from 'react';
import { buildLayout } from '../rules/layout';
import { STATIONS } from '../rules/stations';
import { blueprint } from './blueprint';
import { sectionName } from './state';
import './map.css';

// The station’s blueprint over the HUD: the rooms you have seen on your
// deck (ui/blueprint.js picks them), thin grey rules on black glass, the
// room you are in lit red and an arrow where you stand, north up. The
// small one sits under the security readout, follows you and opens the
// whole sheet (M or Tab does too); the whole one fits every room drawn.
//
//   <MiniMap station seen here at route onOpen />       data-tour="ds-map"
//   <MapPanel station seen here at route onClose />     the whole sheet, a dialog
//     seen: [roomId]; here: the room you are in; at: { x, z, yaw } where you stand, if the world says;
//     route: [[x, z]] the way to the story's target, drawn dashed to a diamond at its end

const SPAN = 44; // metres across the small map
const layouts = new Map(); // station → its layout, built once: the map redraws as often as the HUD

function layoutOf(station) {
  const id = station in STATIONS ? station : 'ds1';
  if (!layouts.has(id)) layouts.set(id, buildLayout(STATIONS[id]));
  return layouts.get(id);
}

// a framed view of the sheet: round where you stand (or the middle of your
// room) for the small map, or round everything drawn
function viewOf(plan, { at, span }) {
  if (span) {
    const room = plan.rooms.find((r) => r.here);
    const c = at ?? (room ? { x: (room.x0 + room.x1) / 2, z: (room.z0 + room.z1) / 2 } : { x: 0, z: 0 });
    return { x: c.x - span / 2, z: c.z - span / 2, w: span, h: span };
  }
  const b = plan.bounds;
  return b ? { x: b.x0, z: b.z0, w: b.x1 - b.x0, h: b.z1 - b.z0 } : { x: -20, z: -20, w: 40, h: 40 };
}

function Sheet({ station, seen, here, at, route = null, span = null, labels = false }) {
  const plan = useMemo(() => blueprint(layoutOf(station), { seen, here }), [station, seen, here]);
  const view = viewOf(plan, { at, span });
  // sizes in metres, so they keep to the sheet’s scale
  const unit = Math.max(view.w, view.h) / 40;
  const font = unit * 0.9;
  return (
    <svg className="ds-sheet" viewBox={`${view.x} ${view.z} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {plan.rooms.map((r) =>
        r.round ? (
          <circle
            key={r.id}
            className="ds-room"
            data-here={r.here || undefined}
            data-kind={r.kind}
            cx={(r.x0 + r.x1) / 2}
            cy={(r.z0 + r.z1) / 2}
            r={(r.x1 - r.x0) / 2}
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          <rect key={r.id} className="ds-room" data-here={r.here || undefined} data-kind={r.kind} x={r.x0} y={r.z0} width={r.x1 - r.x0} height={r.z1 - r.z0} vectorEffect="non-scaling-stroke" />
        ),
      )}
      {plan.doors.map((d) => (
        <line key={d.id} className="ds-door" data-kind={d.kind} x1={d.x0} y1={d.z0} x2={d.x1} y2={d.z1} vectorEffect="non-scaling-stroke" />
      ))}
      {labels &&
        plan.rooms
          // (a name goes only where it fits across its room)
          .filter((r) => r.x1 - r.x0 > r.name.length * font * 0.62 && r.z1 - r.z0 > font * 1.6)
          .map((r) => (
            <text key={r.id} className="ds-room-name" x={(r.x0 + r.x1) / 2} y={(r.z0 + r.z1) / 2} fontSize={font} textAnchor="middle" dominantBaseline="middle">
              {r.name}
            </text>
          ))}
      {route?.length > 1 && (
        <>
          <polyline className="ds-route" points={route.map(([x, z]) => `${x},${z}`).join(' ')} vectorEffect="non-scaling-stroke" />
          <rect className="ds-route-end" x={-0.7} y={-0.7} width={1.4} height={1.4} transform={`translate(${route.at(-1)[0]} ${route.at(-1)[1]}) rotate(45) scale(${unit})`} />
        </>
      )}
      {at && (
        <polygon
          className="ds-you"
          points="0,-1.5 1.05,1.1 0,0.45 -1.05,1.1"
          // yaw 0 faces north (up the sheet) and turns clockwise towards east, as SVG’s rotate does
          transform={`translate(${at.x} ${at.z}) rotate(${((at.yaw ?? 0) * 180) / Math.PI}) scale(${unit})`}
        />
      )}
    </svg>
  );
}

export function MiniMap({ station, seen, here, at, route, onOpen }) {
  const name = layoutOf(station).rooms.get(here)?.name;
  return (
    <button
      type="button"
      className="ds-mini"
      data-tour="ds-map"
      onClick={onOpen}
      aria-label={name ? `Station map: you are in ${name}. Open the map` : 'Station map: the rooms you’ve seen are drawn in as you go. Open the map'}
    >
      <Sheet station={station} seen={seen} here={here} at={at} route={route} span={SPAN} />
      {!seen?.length && !here && <span className="ds-mini-empty">No rooms seen yet</span>}
      <span className="ds-mini-key" aria-hidden="true">
        M
      </span>
    </button>
  );
}

export default function MapPanel({ station, seen, here, at, route, onClose }) {
  const layout = layoutOf(station);
  const room = layout.rooms.get(here);
  return (
    <div className="ds-map" role="dialog" aria-modal="true" aria-label="Station map">
      <div className="ds-map-frame">
        <header className="ds-map-head">
          <div>
            <p className="ds-kicker">
              {layout.station.name}
              <span className="aurebesh ds-aurebesh" aria-hidden="true">
                Sector plan
              </span>
            </p>
            <h2 className="ds-map-title">{room ? sectionName(layout.station.id, room.section) : 'Station map'}</h2>
            {room && <p className="ds-map-here">You are in {room.name}.</p>}
          </div>
          <button type="button" className="ds-btn ds-btn-ghost" onClick={onClose} autoFocus>
            Close
          </button>
        </header>
        <div className="ds-map-sheet">
          <Sheet station={station} seen={seen} here={here} at={at} route={route} labels />
        </div>
        <p className="ds-map-foot">The rooms you’ve seen on this deck. The rest are drawn in as you find them.{route?.length > 1 ? ' The dashed line is the way to your objective.' : ''}</p>
      </div>
    </div>
  );
}
