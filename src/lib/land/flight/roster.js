// Who is in a cell: its ships, each on one of the cell's routes and spaced
// along it, and its people and animals, in groups round a home. The same
// every visit (seeded by the planet, the cell and the row, as
// galaxy/surface/ground/population.js's rosters are), capped per cell, the
// cap shared round the rows so a crowded row can't crowd out the rest. A
// home is found on a living biome the row may live on, never on a slope
// over 0.7 nor inside a place's flat; its members stand within the row's
// `spread` of it. A flyer (a flock's) is lifted into its altitude band.
// A row made only at night waits for the flight to have one.
//
// Pure: no three.js.
//
//   LIFE_CAP; slopeAt(heightAt, x, z)
//   rosterFor(spec, life, key, tier, field) → { routes, air: [{ id, kind, model, row,
//     route, t0 }], ground: [{ id, kind, model, role, row, at: [x, y, z], yaw, home: [x, z],
//     group, lift }] }

import { DENSITY, isDead, kindAt } from './lifeTables.js';
import { LIFE_CELL, allowed, cellBounds, cellLife, rngOf, routesFor } from './routes.js';

export const LIFE_CAP = { air: 12, ground: 48 };
const SLOPE = 0.7;
const SPREAD = 30; // m a group's members stand from home, unless the row says
const TRIES = 12;
const KM2 = (LIFE_CELL / 1000) ** 2;

export function slopeAt(heightAt, x, z, d = 2) {
  return Math.hypot((heightAt(x + d, z) - heightAt(x - d, z)) / (2 * d), (heightAt(x, z + d) - heightAt(x, z - d)) / (2 * d));
}

// a seeded count with the expected value n: its whole part, and one more as often as its fraction
const countOf = (n, rand) => Math.floor(n) + (rand() < n - Math.floor(n) ? 1 : 0);

// interleave lists, one from each in turn, until `cap` items (an item's weight is its size)
function share(lists, cap, size = () => 1) {
  const out = [];
  let used = 0;
  const at = lists.map(() => 0);
  for (let more = true; more; ) {
    more = false;
    for (let i = 0; i < lists.length; i++) {
      const item = lists[i][at[i]];
      if (!item) continue;
      at[i]++;
      if (used + size(item) > cap) continue;
      out.push(item);
      used += size(item);
      more = true;
    }
  }
  return out;
}

export function rosterFor(spec, life, key, tier, field) {
  const empty = { routes: [], air: [], ground: [] };
  if (isDead(life)) return empty;
  const cell = cellLife(spec, life, key, field);
  if (![...cell.kinds].some((k) => k !== 'dead')) return empty;
  const density = DENSITY[tier] ?? 1;
  const routes = routesFor(spec, life, key, field, cell);

  // ── the air ──
  const byRow = new Map();
  for (const r of routes) byRow.set(r.row, [...(byRow.get(r.row) ?? []), r]);
  const airLists = [];
  for (const [i, rs] of byRow) {
    const row = life.air[i];
    const rand = rngOf(spec.seed, key, `a${i}`);
    let n = countOf(row.perKm2 * KM2 * density, rand);
    // (a guard has at least its scramblers)
    if (row.scramble) n = Math.max(n, row.scramble.n);
    const phase = rand();
    airLists.push(
      Array.from({ length: n }, (_, k) => ({
        id: `${key}:a${i}:${k}`,
        kind: row.name,
        model: row.model,
        row: i,
        route: rs[k % rs.length].id,
        t0: (phase + Math.floor(k / rs.length) / Math.ceil(n / rs.length)) % 1,
      })),
    );
  }
  const air = share(airLists, LIFE_CAP.air);

  // ── the ground ──
  const [x0, z0] = cellBounds(key);
  const inCell = (x, z) => x >= x0 && x < x0 + LIFE_CELL && z >= z0 && z < z0 + LIFE_CELL;
  const inFlat = (x, z) => (spec.pois ?? []).some((p) => Math.hypot(x - p.at[0], z - p.at[1]) <= p.r);
  const specHas = (ids) => (spec.biomes ?? []).some((b) => ids.includes(b.id));
  const biomeId = (x, z) => spec.biomes?.[field.biomeAt(x, z)]?.id ?? 'default';
  const fits = (row, x, z) => {
    if (!inCell(x, z) || inFlat(x, z)) return false;
    const id = biomeId(x, z);
    const kind = kindAt(life, id);
    if (kind === 'dead') return false;
    if (row.biome && specHas(row.biome) && !row.biome.includes(id)) return false;
    if (row.kind && kind !== row.kind && !(row.kind === life.kinds.poi && cell.pois.length)) return false;
    return slopeAt(field.heightAt, x, z) <= SLOPE;
  };
  const groundLists = [];
  life.ground.forEach((row, i) => {
    if (row.night || !allowed(row, cell, spec, life)) return;
    const rand = rngOf(spec.seed, key, `g${i}`);
    const groups = countOf(row.perKm2 * KM2 * density, rand);
    const spread = row.spread ?? SPREAD;
    const list = [];
    for (let gi = 0; gi < groups; gi++) {
      let home = null;
      for (let t = 0; t < TRIES && !home; t++) {
        let x;
        let z;
        if (row.near === 'poi') {
          const p = cell.pois[Math.floor(rand() * cell.pois.length)];
          const a = rand() * Math.PI * 2;
          const r = p.r + (p.edge ?? 0) * 0.5 + 60 + rand() * 700;
          [x, z] = [p.at[0] + Math.cos(a) * r, p.at[1] + Math.sin(a) * r];
        } else [x, z] = [x0 + rand() * LIFE_CELL, z0 + rand() * LIFE_CELL];
        if (fits(row, x, z)) home = [x, z];
      }
      if (!home) continue;
      const size = row.group[0] + Math.floor(rand() * (row.group[1] - row.group[0] + 1));
      const members = [];
      for (let m = 0; m < size; m++) {
        let at = null;
        for (let t = 0; t < 4 && !at; t++) {
          const a = rand() * Math.PI * 2;
          const r = m === 0 ? 0 : Math.sqrt(rand()) * spread;
          const x = home[0] + Math.cos(a) * r;
          const z = home[1] + Math.sin(a) * r;
          if (m === 0 || fits(row, x, z)) at = [x, z];
        }
        if (!at) continue;
        const lift = row.alt ? row.alt[0] + rand() * (row.alt[1] - row.alt[0]) : 0;
        members.push({
          id: `${key}:g${i}:${gi}:${m}`,
          kind: row.name,
          model: row.model,
          role: row.role,
          row: i,
          at: [at[0], field.heightAt(at[0], at[1]) + lift, at[1]],
          yaw: rand() * Math.PI * 2,
          home,
          group: `${key}:g${i}:${gi}`,
          lift,
        });
      }
      if (members.length) list.push(members);
    }
    groundLists.push(list);
  });
  const ground = share(groundLists, LIFE_CAP.ground, (g) => g.length).flat();
  return { routes, air, ground };
}
