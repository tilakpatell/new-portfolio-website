// A sector of the expanse, made from the universe's seed and where it is:
// the same sector every time, built alone, nothing stored. Up to two dozen
// star systems, each with its planets, who holds it, how busy and how
// dangerous it is; a few wonders between them; and a beacon in the middle
// of each side, facing the next sector. Sector (0, 0) is the authored map:
// it has no generated systems, and its beacons are the home system's four
// (waypoints.js's). Further out the names get
// stranger, the space less held and the hazards worse. Pure (no three.js).
// Sides: n is -z, s +z, e +x, w -x. Everything is in plain map coordinates.
//
// SECTOR (grid.js's)
// makeSector(universe: bigint, sx, sz) → { id: 'E:sx,sz', sx, sz, seed,
//   origin: [x, 0, z], systems, wonders, beacons: { n, e, s, w } }
//   a system: { id: 'E:sx,sz:i', i, name, designation, at, seed, culture,
//     star: { class, color, size }, planets, faction: { id, name },
//     traffic: 0..1, hazard: null | 'storm' | 'pirates' | 'minefield' }
//   a planet: { id: '<system id>:j', name, type, radius, color, at (where it
//     is round its orbit at t = 0), orbit, moons, rings, seed }
//   a wonder: { id: 'E:sx,sz:w<k>', kind, name, at, size, seed }
//   a beacon: { id: 'beacon:E:sx,sz:<side>', at (the point), side }
// neighbours(sx, sz) → [[sx, sz]…] the four edge neighbours, n e s w
// facing(a, b) → the side of a ([sx, sz]) that faces b, an edge neighbour

import { MAP_RADIUS, SECTORS, SECTOR_RADIUS } from "../../universe/layout";
import { REGIONS } from "../../universe/regions";
import { SECTOR, sectorId } from "./grid";
import { designation, nameOf } from "./names";
import {
  hash64,
  int,
  pick,
  planetSeed,
  range,
  rngOf,
  sectorSeed,
  systemSeed,
} from "./seed";
import {
  FACTION_KINDS,
  PLANET_TYPES,
  STAR_CLASSES,
  WONDERS,
  factionBand,
  hazardWeights,
} from "./tables";

export { SECTOR };

const DISC = SECTOR / 2 - 2000; // systems stay inside this round the middle
const EDGE = SECTOR / 2 - 2000; // a beacon's this far out from the middle
const GAP = 6000; // between systems, level
const WONDER_GAP = 3000; // between a wonder and any system
const BEACON_GAP = 3000; // between a beacon and any system
const TRIES = 60; // darts a system
const ORBIT_MAX = 2600;
const SIDES = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const level = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const weighted = (rng, list, w = (x) => x.weight) => {
  let r = rng() * list.reduce((s, x) => s + w(x), 0);
  for (const x of list) if ((r -= w(x)) <= 0) return x;
  return list[list.length - 1];
};

// the home system's four beacons, as waypoints.js makes them (s is the
// one the ship starts at, 'home'); not imported, waypoints.js is busy
const HOME_OUT = Math.hypot(REGIONS[0].hub[0], REGIONS[0].hub[2]);
const homeAt = (a) => [
  Math.sin(a) * HOME_OUT,
  REGIONS[0].hub[1],
  Math.cos(a) * HOME_OUT,
];
const HOME_ANGLES = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 };

export const neighbours = (sx, sz) =>
  Object.values(SIDES).map(([dx, dz]) => [sx + dx, sz + dz]);
export function facing(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  for (const [side, [x, z]] of Object.entries(SIDES))
    if (x === dx && z === dz) return side;
  throw new Error(`sectors ${a} and ${b} don't share an edge`);
}

// where nothing generated may go: round the authored map, for its neighbours
function keepOuts(sx, sz) {
  if (Math.max(Math.abs(sx), Math.abs(sz)) !== 1) return [];
  return [
    { at: [0, 0, 0], r: MAP_RADIUS + 4000 },
    { at: SECTORS.rickmorty.origin, r: SECTOR_RADIUS.rickmorty + 4000 },
  ];
}

function beaconsOf(sx, sz, seed) {
  const [cx, cz] = [sx * SECTOR, sz * SECTOR];
  const id = sectorId(sx, sz);
  const make = (side, at) => ({ id: `beacon:${id}:${side}`, at, side });
  if (!sx && !sz)
    return Object.fromEntries(
      Object.entries(HOME_ANGLES).map(([side, a]) => [
        side,
        make(side, homeAt(a)),
      ]),
    );
  const rng = rngOf(hash64(seed, "beacons"));
  const off = () => range(rng, -3000, 3000);
  const y = () => range(rng, -200, 200);
  return {
    n: make("n", [cx + off(), y(), cz - EDGE]),
    e: make("e", [cx + EDGE, y(), cz + off()]),
    s: make("s", [cx + off(), y(), cz + EDGE]),
    w: make("w", [cx - EDGE, y(), cz + off()]),
  };
}

// a point in the sector's disc, clear of everything in `clear` ([{ at, r }])
function dart(rng, cx, cz, clear) {
  for (let t = 0; t < TRIES; t++) {
    const a = rng() * Math.PI * 2,
      r = DISC * Math.sqrt(rng());
    const at = [cx + Math.sin(a) * r, 0, cz + Math.cos(a) * r];
    if (clear.every((c) => level(at, c.at) >= c.r)) return at;
  }
  return null;
}

function cultureOf(rng, d) {
  if (d <= 2) return "core";
  if (d <= 6) return rng() < 0.15 * (d - 2) - 0.1 ? "drift" : "rim";
  return rng() < 0.15 ? "rim" : "drift";
}

function planetsOf(sysId, sysSeed, at, star, culture) {
  const rng = rngOf(hash64(sysSeed, "planets"));
  const want = int(rng, 1, 7);
  const planets = [];
  let orbit = star.size * 3,
    lastR = 0;
  for (let j = 0; j < want; j++) {
    const seed = planetSeed(sysSeed, j);
    const pr = rngOf(seed);
    const kind = weighted(pr, PLANET_TYPES);
    const radius = Math.round(range(pr, ...kind.radius));
    if (j) orbit += 2 * Math.max(radius, lastR) + range(pr, 40, 400);
    if (orbit > ORBIT_MAX) break;
    const a = pr() * Math.PI * 2;
    planets.push({
      id: `${sysId}:${j}`,
      name: nameOf(pr, culture),
      type: kind.type,
      radius,
      color: pick(pr, kind.colors),
      at: [
        at[0] + Math.cos(a) * orbit,
        at[1] + range(pr, -40, 40),
        at[2] + Math.sin(a) * orbit,
      ],
      orbit,
      moons: int(pr, ...kind.moons),
      rings: pr() < kind.rings,
      seed,
    });
    lastR = radius;
  }
  return planets;
}

export function makeSector(universe, sx, sz) {
  const id = sectorId(sx, sz);
  const seed = sectorSeed(universe, sx, sz);
  const origin = [sx * SECTOR, 0, sz * SECTOR];
  const beacons = beaconsOf(sx, sz, seed);
  const sector = {
    id,
    sx,
    sz,
    seed,
    origin,
    systems: [],
    wonders: [],
    beacons,
  };
  if (!sx && !sz) return sector;

  const rng = rngOf(seed);
  const d = Math.max(Math.abs(sx), Math.abs(sz));
  const [cx, , cz] = origin;
  const outs = keepOuts(sx, sz);
  const near = Object.values(beacons).map((b) => ({ at: b.at, r: BEACON_GAP }));

  // the factions of its own a sector this far out has, named here
  const local = Array.from({ length: int(rng, 1, 2) }, (_, k) => {
    const name = `${nameOf(rng, cultureOf(rng, d))} ${pick(rng, FACTION_KINDS)}`;
    return { id: `${id}:f${k}`, name };
  });
  const band = factionBand(d);

  const count = int(rng, 8, 24);
  const clear = [...outs, ...near];
  for (let i = 0; i < count; i++) {
    const at = dart(rng, cx, cz, clear);
    if (!at) continue;
    at[1] = range(rng, -500, 500);
    clear.push({ at, r: GAP });
    const i2 = sector.systems.length;
    const sSeed = systemSeed(seed, i2);
    const sr = rngOf(sSeed);
    const culture = cultureOf(sr, d);
    const cls = weighted(sr, STAR_CLASSES);
    const star = {
      class: cls.class,
      color: cls.color,
      size: Math.round(range(sr, ...cls.size)),
    };
    const f = weighted(sr, band);
    const faction =
      f.id === "generated" ? pick(sr, local) : { id: f.id, name: f.name };
    const sysId = `${id}:${i2}`;
    sector.systems.push({
      id: sysId,
      i: i2,
      name: nameOf(sr, culture),
      designation: designation(sr),
      at,
      seed: sSeed,
      culture,
      star,
      planets: planetsOf(sysId, sSeed, at, star, culture),
      faction,
      traffic: clamp(0.9 - 0.08 * d + range(sr, -0.15, 0.15), 0.05, 1),
      hazard: weighted(sr, hazardWeights(d), ([, w]) => w)[0],
    });
  }

  // the wonders, clear of every system and beacon
  const wclear = [
    ...outs,
    ...near,
    ...sector.systems.map((s) => ({ at: s.at, r: WONDER_GAP })),
  ];
  const wonders = int(rng, 0, 3);
  for (let k = 0; k < wonders; k++) {
    const at = dart(rng, cx, cz, wclear);
    if (!at) continue;
    const wSeed = hash64(seed, "wonder", k);
    const wr = rngOf(wSeed);
    at[1] = range(wr, -800, 800);
    const kind = weighted(wr, WONDERS);
    wclear.push({ at, r: WONDER_GAP });
    sector.wonders.push({
      id: `${id}:w${sector.wonders.length}`,
      kind: kind.kind,
      name: nameOf(wr, cultureOf(wr, d)),
      at,
      size: Math.round(range(wr, ...kind.size)),
      seed: wSeed,
    });
  }
  return sector;
}
