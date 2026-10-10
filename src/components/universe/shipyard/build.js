// A garage build: one module for each of the shipyard's slots (parts.js),
// and the seed it was rolled from. Rolling is No Man's Sky's way of picking
// a ship: the seed decides, slot by slot, which of the modules it keeps,
// the commoner ones more often, so a seed is always the same ship, and a
// code of a few letters (buildCode) is enough to pass one on.
//
// Each crew can fly its own build in place of its stock ship (`readHulls`:
// kept as { crew id: build or null } under HULL_KEY), and the other pilots
// see it (`writeBuild`: ids only on the wire, read back by readBuildWire,
// which believes nothing but the ids in parts.js).
//
// A crew's own ship (its stock hull) takes modules too, as tuning: a tune is
// { slot: module id } for the slots after the hull (`readTune`, kept per crew
// under TUNE_KEY). The ship keeps its own model; the module's numbers are
// what it adds (`statsOfTune`), drawing on the crew's own plant. A slot's
// stock module, and a None, are the ship as it came: no tune at all.

import { BUILD_SLOTS, isModuleOpen, moduleById, modulesFor } from './parts';

export const HULL_KEY = 'tp-universe-hull';
export const GARAGE_KEY = 'tp-universe-garage'; // (each crew's last garage build, flown or not)
export const TUNE_KEY = 'tp-universe-tune'; // (each crew's tuning of its own ship: { crew id: { slot: module id } })

export const STOCK_BUILD = Object.freeze({ ...Object.fromEntries(BUILD_SLOTS.map((slot) => [slot, modulesFor(slot)[0].id])), seed: 1 });

export const TUNE_SLOTS = BUILD_SLOTS.filter((slot) => slot !== 'hull'); // (the hull is the ship itself: Stock, or a garage build)
// Whether a module is the ship as it came for its slot (the stock build's, or a None): picking it tunes nothing.
export const isStockModule = (slot, id) => id === STOCK_BUILD[slot] || id === 'none';

const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const cleanSeed = (v) => (Number.isInteger(v) && v >= 0 && v <= 0xffffffff ? v : 1);

// A build from storage (or anything): each slot's module if it's one there
// is, the first of the slot otherwise.
export function readBuild(raw) {
  if (!isObject(raw)) return { ...STOCK_BUILD };
  const out = { seed: cleanSeed(raw.seed) };
  for (const slot of BUILD_SLOTS) out[slot] = typeof raw[slot] === 'string' && moduleById(slot, raw[slot]) ? raw[slot] : STOCK_BUILD[slot];
  return out;
}

// mulberry32: a small seeded generator, the same numbers everywhere
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A whole ship from a seed: for each slot, one of the modules open with
// these achievements, picked by weight. Given the module ids owned (a list
// or a Set, from the wallet), only those, the stock build's and the empty
// slots: what's free is in every slot, so nothing bought is still a ship.
export function rollBuild(seed, unlocked = [], owned = null) {
  const s = cleanSeed(seed);
  const r = random(s);
  const out = { seed: s };
  const has = owned ? (id) => (owned instanceof Set ? owned.has(id) : owned.includes(id)) : () => true;
  for (const slot of BUILD_SLOTS) {
    const open = modulesFor(slot).filter((m) => isModuleOpen(m, unlocked) && (has(m.id) || m.id === STOCK_BUILD[slot] || m.id === 'none'));
    const total = open.reduce((n, m) => n + m.weight, 0);
    let x = r() * total;
    out[slot] = open[open.length - 1].id;
    for (const m of open) {
      x -= m.weight;
      if (x < 0) {
        out[slot] = m.id;
        break;
      }
    }
  }
  return out;
}

const modulesOf = (build) => BUILD_SLOTS.map((slot) => moduleById(slot, build[slot]) ?? moduleById(slot, STOCK_BUILD[slot]));

// What modules do to a ship together: multipliers (1 for nothing) on its
// boost, acceleration, cruise, agility and self-levelling, the plant they
// bring (MW), what they draw from it and what they weigh.
function sumOf(mods) {
  const s = { boost: 1, accel: 1, cruise: 1, agility: 1, level: 1, plant: 0, power: 0, mass: 0 };
  for (const m of mods) {
    for (const k of ['boost', 'accel', 'cruise', 'agility', 'level']) s[k] += m.does[k] ?? 0;
    s.plant += m.does.plant ?? 0;
    s.power += m.power;
    s.mass += m.mass;
  }
  return s;
}

// What a build does to the ship as it comes: its own plant (MW) with its
// modules' numbers.
export const statsOfBuild = (build) => sumOf(modulesOf(build));

// A tune from storage (or anything): { slot: module id } for the slots after
// the hull, each a module there is that isn't the ship as it came. Nothing
// else survives, so what's kept is always one thing in one shape.
export function readTune(raw) {
  const out = {};
  if (!isObject(raw)) return out;
  for (const slot of TUNE_SLOTS) {
    const id = raw[slot];
    if (typeof id === 'string' && moduleById(slot, id) && !isStockModule(slot, id)) out[slot] = id;
  }
  return out;
}

// What a tune does to a crew's own ship: the same numbers a build's modules
// give, with no plant of its own (the ship's is what they draw on).
export const statsOfTune = (tune) => sumOf(TUNE_SLOTS.filter((slot) => tune?.[slot]).map((slot) => moduleById(slot, tune[slot])).filter(Boolean));

// The same tune twice over, for knowing when nothing has changed.
export const tuneKey = (tune) => TUNE_SLOTS.map((slot) => tune?.[slot] ?? '').join();

// The wire: the modules' ids in slot order (not the seed: the ship's the
// same without it).
export const writeBuild = (build) => BUILD_SLOTS.map((slot) => build[slot]);
export function readBuildWire(data) {
  if (!Array.isArray(data) || data.length !== BUILD_SLOTS.length) return null;
  const out = {};
  for (let i = 0; i < BUILD_SLOTS.length; i++) {
    const id = data[i];
    if (typeof id !== 'string' || id.length > 24 || !moduleById(BUILD_SLOTS[i], id)) return null;
    out[BUILD_SLOTS[i]] = id;
  }
  return out;
}

// A code to pass a build on: GB-, each slot's module as its place in the
// slot's list (base 36), then the seed: 'GB-021301.k3'.
export function buildCode(build) {
  const picks = BUILD_SLOTS.map((slot) => Math.max(0, modulesFor(slot).findIndex((m) => m.id === build[slot])).toString(36)).join('');
  return `GB-${picks}.${cleanSeed(build.seed).toString(36)}`;
}
export function parseBuildCode(code) {
  if (typeof code !== 'string') return null;
  const m = /^gb-([0-9a-z]{6})\.([0-9a-z]{1,7})$/.exec(code.trim().toLowerCase());
  if (!m) return null;
  const out = { seed: cleanSeed(parseInt(m[2], 36)) };
  for (let i = 0; i < BUILD_SLOTS.length; i++) {
    const list = modulesFor(BUILD_SLOTS[i]);
    const mod = list[parseInt(m[1][i], 36)];
    if (!mod) return null;
    out[BUILD_SLOTS[i]] = mod.id;
  }
  return out;
}

// What each crew flies, as kept: a build, or null for its stock ship.
export function readHulls(raw, crews) {
  const out = {};
  if (!isObject(raw)) return out;
  for (const crew of crews) if (crew in raw) out[crew] = isObject(raw[crew]) ? readBuild(raw[crew]) : null;
  return out;
}

// What each crew's ship is tuned with, as kept: { crew id: tune } for the
// crews with any.
export function readTunes(raw, crews) {
  const out = {};
  if (!isObject(raw)) return out;
  for (const crew of crews) {
    const tune = readTune(raw[crew]);
    if (Object.keys(tune).length) out[crew] = tune;
  }
  return out;
}
