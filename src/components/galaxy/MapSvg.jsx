import { memo } from 'react';
import { Territory, WarLines } from './WarLayers';
import { LETTER_SPACING, REGION_FONT, regionAngle, regionNamesShown, unknownNameX } from './regionNames';
import { CORE, GRID, LANES, REGIONS, UNKNOWN, edgeAt } from './systems';

// The galaxy map's SVG (HoloMap.jsx), in the stage that zooms and pans: the
// grid, the war's territory, the regions' rings and names and the Unknown
// Regions, the hyperspace lanes, the war's lines and the course. It only
// changes with the layers, the war, the course and the zoom (the regions'
// names are set in screen pixels), so it's a memo: a pan, which moves the
// stage and nothing in here, doesn't draw it again. The rings and the
// Unknown Regions' wedge are drawn once, here, for good.
const SIZE = 21; // the map is GRID squares across, in its own units
const TAU = Math.PI * 2;

// a region's edge, as an SVG path
const ring = (r) =>
  Array.from({ length: 73 }, (_, i) => {
    const a = (i / 72) * TAU;
    const d = edgeAt(r, a);
    return `${i ? 'L' : 'M'}${(CORE[0] + Math.cos(a) * d).toFixed(3)} ${(CORE[1] + Math.sin(a) * d).toFixed(3)}`;
  }).join(' ') + 'Z';
const RINGS = REGIONS.map((r) => [r.id, ring(r.r)]);

// the Unknown Regions' wedge, out west
const UNKNOWN_D = (() => {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI - UNKNOWN.half + (i / 12) * UNKNOWN.half * 2;
    const d = edgeAt(UNKNOWN.from, a);
    pts.push([CORE[0] + Math.cos(a) * d, CORE[1] + Math.sin(a) * d]);
  }
  for (let i = 12; i >= 0; i--) {
    const a = Math.PI - UNKNOWN.half + (i / 12) * UNKNOWN.half * 2;
    pts.push([CORE[0] + Math.cos(a) * 14, CORE[1] + Math.sin(a) * 14]);
  }
  return pts.map(([x, z], i) => `${i ? 'L' : 'M'}${x.toFixed(3)} ${z.toFixed(3)}`).join(' ') + 'Z';
})();

const LANE_POINTS = LANES.map((l) => [l.id, l.name, l.pts.map((p) => p.join(',')).join(' ')]);

const MapSvg = memo(function MapSvg({ layers, war, ops, route, unitPx }) {
  const regionFont = REGION_FONT / unitPx; // (11.5 px on screen at any zoom)
  const regionShown = regionNamesShown(REGIONS, unitPx); // (the ones with the room: the inner ones as you zoom)
  const course = route ? route.pts.map((p) => p.join(',')).join(' ') : null;
  return (
    <svg className="holomap-svg" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
      {/* the grid (off till asked for) */}
      {layers.grid &&
        Array.from({ length: GRID.cols + 1 }, (_, i) => (
          <line key={`c${i}`} x1={i} y1={0} x2={i} y2={SIZE} className="holomap-grid" />
        ))}
      {layers.grid &&
        Array.from({ length: GRID.rows + 1 }, (_, i) => (
          <line key={`r${i}`} x1={0} y1={i} x2={SIZE} y2={i} className="holomap-grid" />
        ))}
      {/* the war's territory */}
      {layers.territory && <Territory table={war} />}
      {/* the regions: their rings and names, and the Unknown Regions */}
      {layers.regions && (
        <>
          <path d={UNKNOWN_D} className="holomap-unknown" />
          {RINGS.map(([id, d]) => (
            <path key={id} d={d} className="holomap-region" data-id={id} />
          ))}
          {REGIONS.map((r, i) => {
            if (!regionShown.has(r.id)) return null;
            const a = regionAngle(i);
            const d = edgeAt(r.r, a) - regionFont * 0.9;
            const x = CORE[0] + Math.cos(a) * d;
            const y = CORE[1] + Math.sin(a) * d;
            const deg = (a * 180) / Math.PI + 90; // (along the ring)
            return (
              <text key={r.id} x={x} y={y} transform={`rotate(${deg.toFixed(1)} ${x.toFixed(3)} ${y.toFixed(3)})`} className="holomap-region-name" style={{ fontSize: regionFont, letterSpacing: regionFont * LETTER_SPACING }}>
                {r.name}
              </text>
            );
          })}
          <text x={unknownNameX(unitPx)} y={CORE[1] + 0.1} className="holomap-region-name holomap-unknown-name" style={{ fontSize: regionFont }}>
            Unknown Regions
          </text>
        </>
      )}
      {/* the routes */}
      {layers.lanes &&
        LANE_POINTS.map(([id, name, points]) => (
          <polyline key={id} points={points} className="holomap-lane">
            <title>{name}</title>
          </polyline>
        ))}
      {/* the war's lanes, borders and offensives */}
      {layers.fronts && <WarLines table={war} ops={ops} />}
      {/* the course */}
      {course && (
        <>
          <polyline points={course} fill="none" className="holomap-course-glow" />
          <polyline points={course} fill="none" className="holomap-course" />
        </>
      )}
    </svg>
  );
});

// the grid's letters and numbers (HTML, so they keep their size): nothing in them changes
export const Axes = memo(function Axes() {
  const pct = (v) => `${(v / SIZE) * 100}%`;
  return (
    <>
      <div className="holomap-axis holomap-axis-x" aria-hidden="true">
        {Array.from({ length: GRID.cols }, (_, i) => (
          <span key={i} style={{ left: pct(i + 0.5) }}>
            {String.fromCharCode(65 + i)}
          </span>
        ))}
      </div>
      <div className="holomap-axis holomap-axis-y" aria-hidden="true">
        {Array.from({ length: GRID.rows }, (_, i) => (
          <span key={i} style={{ top: pct(i + 0.5) }}>
            {i + 1}
          </span>
        ))}
      </div>
    </>
  );
});

export default MapSvg;
