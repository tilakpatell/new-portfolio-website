// The planet map's rules, apart from any canvas: where a point of the ground
// lands on the map, which 2 km squares a view needs, what colour a biome is,
// how far and which way a POI lies, and what is marked. ./map.js paints by
// them; ./MiniMap and ./PlanetMap show what it paints.
//
// The map is in world metres (x east, z south, so north is −z and up), never
// the floating origin's: a shift moves the renderer's scene, not the ground,
// so nothing on the map moves with it.
//
//   project([x, z], { centre, scale, headingUp, heading }) → [px, py] from the centre
//   unproject([px, py], view) → [x, z]
//   visibleLeaves(centre, radiusPx, scale) → raster keys, nearest first
//   biomeColour(spec, index, height) → '#rrggbb'
//   bearingOf(ship, [x, z]) → { rel (off the nose, + right), compass (from north, clockwise), dist }
//   poiRows(spec, ship) → [{ id, name, at, dist, far, point, rel }], nearest first
//   markersOf({ spec, waypoint, pilots, built, occurrences }) → [{ kind, id, at, label, icon? }]
//   cellAddress(x, z) → 'cx,cz', the shared world's cell

import { MAP_DEPTH, rasterKey } from '../../../lib/land/flight/mapRaster';
import { sizeAt } from '../../../lib/land/flight/quadtree';
import { MINIMAP, far } from '../../../runtime/hud';

// (lib/net/cells.js says NET_CELL once, from the shared world's lane; until
// it is on main the map's own square, which the spec makes the same 2 km)
const net = Object.values(import.meta.glob('../../../lib/net/cells.js', { eager: true }))[0];
export const MAP_CELL = net?.NET_CELL ?? sizeAt(MAP_DEPTH);
export const cellAddress = (x, z) => `${Math.floor(x / MAP_CELL)},${Math.floor(z / MAP_CELL)}`;

// rasters kept: one is 5 kB, so a long flight's trail stays on the full map
export const MAP_KEEP = 256;
// the disc's size in CSS px, and the ground it shows either way of the ship
export const MINI = { desktop: MINIMAP.size, phone: MINIMAP.phone, reach: 1920 };
export const miniScale = (size) => MINI.reach / (size / 2);
// the full map's metres a CSS px: out, the plan's 16, in (two steps of the wheel or a pinch)
export const FULL_SCALES = [32, 16, 8];
export const FULL_START = 1;

const SQUARE = sizeAt(MAP_DEPTH);

// (a turn by `a`: the heading-up map turns the ground so the nose is up)
const turn = ([a, b], t) => [a * Math.cos(t) - b * Math.sin(t), a * Math.sin(t) + b * Math.cos(t)];

export function project([x, z], { centre, scale, headingUp = false, heading = 0 }) {
  const v = [(x - centre[0]) / scale, (z - centre[1]) / scale];
  return headingUp ? turn(v, heading) : v;
}

export function unproject(p, { centre, scale, headingUp = false, heading = 0 }) {
  const [a, b] = headingUp ? turn(p, -heading) : p;
  return [centre[0] + a * scale, centre[1] + b * scale];
}

// the squares within the disc's bounding square, nearest the centre first
export function visibleLeaves(centre, radiusPx, scale) {
  const r = radiusPx * scale;
  const x0 = Math.floor((centre[0] - r) / SQUARE), x1 = Math.floor((centre[0] + r) / SQUARE);
  const z0 = Math.floor((centre[1] - r) / SQUARE), z1 = Math.floor((centre[1] + r) / SQUARE);
  const out = [];
  for (let iz = z0; iz <= z1; iz++)
    for (let ix = x0; ix <= x1; ix++) out.push([Math.hypot((ix + 0.5) * SQUARE - centre[0], (iz + 0.5) * SQUARE - centre[1]), rasterKey(ix, iz)]);
  return out.sort((a, b) => a[0] - b[0]).map((o) => o[1]);
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c) => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// a biome's own colour, from the planet's palette: the first biome is the
// low ground; a sunken one is water (the low colour toward the sky's); the
// others, by how high they sit, toward the high colour, then the rock, then
// the accent, so neighbours read apart
const tints = new WeakMap();
function tintsOf(spec) {
  let t = tints.get(spec);
  if (t) return t;
  const p = spec.palette;
  const low = rgb(p.low);
  const toward = [p.high, p.rock, p.accent].map(rgb);
  const land = spec.biomes.map((b, i) => [b.base ?? 0, i]).filter(([base, i]) => i > 0 && base >= 0).sort((a, b) => a[0] - b[0]);
  t = spec.biomes.map((b, i) => {
    if (i === 0) return low;
    if ((b.base ?? 0) < 0) return mix(mix(low, rgb(p.skyHigh ?? p.accent), 0.55), [24, 48, 96], 0.2);
    const k = land.findIndex(([, j]) => j === i);
    return mix(low, toward[k % 3], 0.6);
  });
  tints.set(spec, t);
  return t;
}

// the biome's colour at a height: darker under its base, lighter over it
export function biomeRgb(spec, index, height) {
  const c = tintsOf(spec)[index] ?? tintsOf(spec)[0];
  const k = Math.max(-0.6, Math.min(0.6, (height - (spec.biomes[index]?.base ?? 0)) / 160));
  return k < 0 ? mix(c, [0, 0, 0], -k * 0.5) : mix(c, [255, 255, 255], k * 0.4);
}
export const biomeColour = (spec, index, height) => toHex(biomeRgb(spec, index, height));

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export function bearingOf(ship, [x, z]) {
  const dx = x - ship.x, dz = z - ship.z;
  const yaw = ship.yaw ?? 0;
  // the nose is (−sin yaw, −cos yaw) (flightRules' forwardOf), its right (cos yaw, −sin yaw)
  const ahead = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
  const right = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  return { rel: Math.atan2(right, ahead), compass: wrap(Math.atan2(dx, -dz)), dist: Math.hypot(dx, dz) };
}

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const compassPoint = (a) => POINTS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];

export function poiRows(spec, ship) {
  return (spec.pois ?? [])
    .map((p) => {
      const b = bearingOf(ship, p.at);
      return { id: p.id, name: p.name, at: p.at, dist: b.dist, far: far(b.dist), point: compassPoint(b.compass), rel: b.rel };
    })
    .sort((a, b) => a.dist - b.dist);
}

const finite = (...v) => v.every(Number.isFinite);

// What the map marks, from plain lists: the planet's POIs, the waypoint, and
// whatever the shared world and the planet's life give (none when they're
// not there): a pilot is { id, name, pose: { x, z } } (the room's peers()),
// a built thing { id, type | entity_type, x, z } (the loader's all()), an
// occurrence { id, kind, name, at } (the life streamer's)
export function markersOf({ spec, waypoint = null, pilots = [], built = [], occurrences = [] }) {
  const out = (spec.pois ?? []).map((p) => ({ kind: 'poi', id: p.id, at: p.at, label: p.name }));
  for (const p of pilots) {
    const x = p.pose?.x ?? p.x, z = p.pose?.z ?? p.z;
    if (finite(x, z)) out.push({ kind: 'pilot', id: p.id, at: [x, z], label: p.name });
  }
  for (const e of built) if (finite(e.x, e.z)) out.push({ kind: 'built', id: e.id, at: [e.x, e.z], label: e.type ?? e.entity_type });
  for (const o of occurrences) if (o.at && finite(...o.at)) out.push({ kind: 'occurrence', id: o.id, at: o.at, label: o.name, icon: o.kind });
  if (waypoint) out.push({ kind: 'waypoint', id: waypoint.id, at: waypoint.at, label: waypoint.name });
  return out;
}
