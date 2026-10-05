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

import { BUILD_SLOTS, isModuleOpen, moduleById, modulesFor } from './parts';

export const HULL_KEY = 'tp-universe-hull';

export const STOCK_BUILD = Object.freeze({ ...Object.fromEntries(BUILD_SLOTS.map((slot) => [slot, modulesFor(slot)[0].id])), seed: 1 });

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
// these achievements, picked by weight.
export function rollBuild(seed, unlocked = []) {
  const s = cleanSeed(seed);
  const r = random(s);
  const out = { seed: s };
  for (const slot of BUILD_SLOTS) {
    const open = modulesFor(slot).filter((m) => isModuleOpen(m, unlocked));
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

// What a build does to the ship as it comes: multipliers (1 for nothing)
// on its boost, acceleration, cruise, agility and self-levelling, its
// power plant (MW), what its modules draw from it and what they weigh.
export function statsOfBuild(build) {
  const s = { boost: 1, accel: 1, cruise: 1, agility: 1, level: 1, plant: 0, power: 0, mass: 0 };
  for (const m of modulesOf(build)) {
    for (const k of ['boost', 'accel', 'cruise', 'agility', 'level']) s[k] += m.does[k] ?? 0;
    s.plant += m.does.plant ?? 0;
    s.power += m.power;
    s.mass += m.mass;
  }
  return s;
}

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
