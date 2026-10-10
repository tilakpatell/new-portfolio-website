// Where a planet's air traffic flies, cell by cell: a patrol circles a place
// it guards (or a point of its cell), a lane runs straight across the cell
// and back, a shuttle runs between two places (or edge to edge). Every point
// is at least the row's altitude floor over the ground, measured at the point
// and between it and its neighbours, so a ship on the polyline never clips a
// ridge. A row with `lanes` lays that many parallel lanes at heights spread
// over its band (Coruscant's three). Seeded by the planet, the cell and the
// row, so every visit, and every pilot, sees the same routes.
//
// Cells are the shared world's (lib/net/cells.js's NET_CELL: life is
// streamed by the same cells the rooms are), and a route stays its cell's,
// so a ship is never handed from one cell to another.
//
// Pure: no three.js.
//
//   LIFE_CELL; cellKeyOf(x, z); cellBounds(key) → [x0, z0, x1, z1]
//   cellLife(spec, life, key, field) → { kinds: Set, biomes: Set, pois }
//   allowed(row, cell, spec, life) → may the row live in this cell
//   routesFor(spec, life, key, field, cell?) → [{ id, row, name, model, route,
//     points: [[x, y, z]…], loop, speed, alt, scramble, hostile, anchor: [x, z], length }]

import { seeded } from '../../seeded.js';
import { NET_CELL } from '../../net/cells.js';
import { kindAt } from './lifeTables.js';

export const LIFE_CELL = NET_CELL;
const EDGE = 96; // m a lane or a shuttle keeps in from its cell's edge
const STEP = 256; // m between a lane's points

export const cellKeyOf = (x, z) => `${Math.floor(x / LIFE_CELL)},${Math.floor(z / LIFE_CELL)}`;

export function cellBounds(key) {
  const [cx, cz] = key.split(',').map(Number);
  return [cx * LIFE_CELL, cz * LIFE_CELL, (cx + 1) * LIFE_CELL, (cz + 1) * LIFE_CELL];
}

// a seeded random from the planet, the cell and what it's for
export function rngOf(seed, key, what) {
  const s = `${seed}:${key}:${what}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return seeded(h);
}

// what the cell is: its biomes and their kinds on a 3 × 3 of samples, and its places
export function cellLife(spec, life, key, field) {
  const [x0, z0, x1, z1] = cellBounds(key);
  const kinds = new Set();
  const biomes = new Set();
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      const b = spec.biomes?.[field.biomeAt(x0 + ((i + 0.5) / 3) * LIFE_CELL, z0 + ((j + 0.5) / 3) * LIFE_CELL)];
      const id = b?.id ?? 'default';
      biomes.add(id);
      kinds.add(kindAt(life, id));
    }
  const pois = (spec.pois ?? []).filter((p) => p.at[0] >= x0 && p.at[0] < x1 && p.at[1] >= z0 && p.at[1] < z1);
  if (pois.length && life.kinds.poi) kinds.add(life.kinds.poi);
  return { kinds, biomes, pois };
}

const living = (cell) => [...cell.kinds].some((k) => k !== 'dead');

export function allowed(row, cell, spec, life) {
  if (!living(cell)) return false;
  if (row.near === 'poi' && !cell.pois.length) return false;
  if (row.kind && !cell.kinds.has(row.kind)) return false;
  if (row.biome && (spec.biomes ?? []).some((b) => row.biome.includes(b.id)) && !row.biome.some((b) => cell.biomes.has(b))) return false;
  // (a row of no kind of its own lives where the cell isn't only dead, and not on a dead biome's alone)
  if (!row.kind && row.biome && row.biome.every((b) => kindAt(life, b) === 'dead')) return false;
  return true;
}

// the floor under a polyline's point: the ground there and a quarter and half
// of the way to each neighbour, the highest
function floors(points, heightAt, loop = true) {
  const n = points.length;
  return points.map(([x, z], i) => {
    let h = heightAt(x, z);
    for (const j of [i - 1, i + 1]) {
      if (!loop && (j < 0 || j >= n)) continue;
      const [ox, oz] = points[(j + n) % n];
      for (const t of [0.25, 0.5]) h = Math.max(h, heightAt(x + (ox - x) * t, z + (oz - z) * t));
    }
    return h;
  });
}

const lengthOf = (pts) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }
  return s;
};

const band = (alt, t) => alt[0] + (alt[1] - alt[0]) * t;

function patrol(row, cell, bounds, rand, heightAt) {
  const [x0, z0] = bounds;
  const poi = row.near === 'poi' || row.scramble ? cell.pois[0] : null;
  const anchor = poi ? [poi.at[0], poi.at[1]] : [x0 + 500 + rand() * (LIFE_CELL - 1000), z0 + 500 + rand() * (LIFE_CELL - 1000)];
  const r = (poi ? poi.r + (poi.edge ?? 0) + 200 : 300) + rand() * 400;
  const n = 10;
  const spin = rand() * Math.PI * 2;
  const flat = Array.from({ length: n }, (_, i) => {
    const a = spin + (i / n) * Math.PI * 2;
    // (an ellipse, not a circle: a beat looks walked, not drawn with compasses)
    return [anchor[0] + Math.cos(a) * r, anchor[1] + Math.sin(a) * r * 0.75];
  });
  const alt = band(row.alt, rand());
  const f = floors(flat, heightAt);
  return [{ anchor, points: flat.map(([x, z], i) => [x, f[i] + alt, z]) }];
}

function lanes(row, bounds, rand, heightAt) {
  const [x0, z0, x1, z1] = bounds;
  const n = row.lanes ?? 1;
  const alongX = rand() < 0.5;
  const mid = [(x0 + x1) / 2, (z0 + z1) / 2];
  const span = Array.from({ length: Math.floor((LIFE_CELL - 2 * EDGE) / STEP) + 1 }, (_, i) => EDGE + i * STEP);
  const across = (rand() - 0.5) * 400;
  const flatOf = (off) => {
    const there = span.map((s) => (alongX ? [x0 + s, mid[1] + off] : [mid[0] + off, z0 + s]));
    // (back the other way 30 m over: two-way traffic in one lane)
    const back = [...there].reverse().map(([x, z]) => (alongX ? [x, z + 30] : [x + 30, z]));
    return [...there, ...back];
  };
  const flats = Array.from({ length: n }, (_, j) => flatOf(across + (j - (n - 1) / 2) * 160));
  // one floor for all a row's lanes, so they keep their heights apart
  let floor = -Infinity;
  for (const flat of flats) for (const h of floors(flat, heightAt)) floor = Math.max(floor, h);
  const pick = rand();
  return flats.map((flat, j) => {
    const alt = band(row.alt, n === 1 ? pick : j / (n - 1));
    return { anchor: mid, points: flat.map(([x, z], i) => [x, floor + alt + (i >= flat.length / 2 ? 12 : 0), z]) };
  });
}

function shuttle(row, cell, bounds, rand, heightAt) {
  const [x0, z0, x1, z1] = bounds;
  const inset = (v, lo) => lo + EDGE + v * (LIFE_CELL - 2 * EDGE);
  let a;
  let b;
  if (cell.pois.length >= 2) {
    a = cell.pois[0].at;
    b = cell.pois[1].at;
  } else if (rand() < 0.5) {
    a = [x0 + EDGE, inset(rand(), z0)];
    b = [x1 - EDGE, inset(rand(), z0)];
  } else {
    a = [inset(rand(), x0), z0 + EDGE];
    b = [inset(rand(), x0), z1 - EDGE];
  }
  const n = 8;
  const there = Array.from({ length: n }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / (n - 1), a[1] + ((b[1] - a[1]) * i) / (n - 1)]);
  // (back 40 m to one side, so the two ways don't meet head on)
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const side = [((a[1] - b[1]) / d) * 40, ((b[0] - a[0]) / d) * 40];
  const back = [...there].reverse().map(([x, z]) => [x + side[0], z + side[1]]);
  const flat = [...there, ...back];
  const alt = band(row.alt, rand());
  const f = floors(flat, heightAt);
  return [{ anchor: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], points: flat.map(([x, z], i) => [x, f[i] + alt, z]) }];
}

export function routesFor(spec, life, key, field, cell = cellLife(spec, life, key, field)) {
  const bounds = cellBounds(key);
  const out = [];
  life.air.forEach((row, i) => {
    if (!allowed(row, cell, spec, life)) return;
    const rand = rngOf(spec.seed, key, `r${i}`);
    const made = row.route === 'lane' ? lanes(row, bounds, rand, field.heightAt) : row.route === 'shuttle' ? shuttle(row, cell, bounds, rand, field.heightAt) : patrol(row, cell, bounds, rand, field.heightAt);
    made.forEach((m, j) =>
      out.push({
        id: made.length > 1 ? `${key}:r${i}:${j}` : `${key}:r${i}`,
        row: i,
        name: row.name,
        model: row.model,
        route: row.route,
        points: m.points,
        loop: true,
        speed: row.speed,
        alt: row.alt,
        scramble: row.scramble ?? null,
        hostile: row.hostile ?? null,
        anchor: m.anchor,
        length: lengthOf(m.points),
      }),
    );
  });
  return out;
}
