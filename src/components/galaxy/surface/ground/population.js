// The world fills in round you: the turf's soldiers are made cell by cell
// as you come near and let go of behind you (runtime/chunkGrid.js's
// bookkeeping), each cell's roster the same on every visit (seeded by the
// site and the cell), the dead staying dead and a soldier that walked kept
// by the cell it's in now. Pure, tested; groundScene.js makes the figures.
// The design: docs/superpowers/specs/2026-10-08-ground-factions-design.md,
// section 4.
//
// rosterFor(cellKey, turfs, effects, tier, seed, standable) → Spec[]
//   Spec = { id, kind, side, role: 'post' | 'patrol' | 'fill' | 'raid', at,
//   yaw, home, beat?, turf, squad }
// createPopulation({ site, turfs, effects, tier, seed, rand, standable }) →
//   { update({ x, z, heading }) → { make: Soldier[], drop: id[] }, soldiers,
//   died(id), isDead(id), move(id, x, z), cellOf(x, z) → key, reinforce(key, specs),
//   waiting() → the specs in loaded cells not made (the cap's) }

import { createChunkGrid } from '../../../../runtime/chunkGrid';
import { kindFor, newSoldier } from './troops';
import { strengthOf, turfAt } from './turf';

export const CELL = 48;
export const RADIUS = 3;
export const HYSTERESIS = 1;
export const DENSITY = { high: 3, mid: 2, low: 1 };
export const POP = { ultra: 32, high: 28, mid: 18, low: 10 };
// (a waiting soldier this much nearer than the furthest made takes its place)
export const SWAP = 12;
const PRUNE = 30; // updates between looks for cells to let go of
const RESORT = 15; // updates (half a second at 30 a second) between sorts of who waits, with nothing changed
const DRY = 12; // metres a reinforcement is moved to find dry ground, at most
const KEEP = ['hp', 'grudge', 'suppressed', 'staggerUntil', 'engagedUntil']; // what a soldier let go of keeps till it's made again
const COVERT = 25; // nobody this near where a covert landing put you
const SHIP = 14; // nor on the ship's pad
const low = (tier) => tier === 'low';
const densityOf = (tier) => DENSITY[tier] ?? DENSITY.high;

const keyOf = (cx, cz) => `${cx},${cz}`;
const cellKey = (x, z) => keyOf(Math.floor(x / CELL), Math.floor(z / CELL));
const parse = (key) => key.split(',').map(Number);

// a small seeded generator from a string
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (v) => +v.toFixed(2);
const clear = (effects, p, site) => (!effects.covertAt || Math.hypot(p[0] - effects.covertAt[0], p[1] - effects.covertAt[1]) >= COVERT) && (!site || Math.hypot(p[0] - site[0], p[1] - site[1]) >= SHIP);

export function rosterFor(key, turfs, effects, tier, seed, standable, { pad = null } = {}) {
  const out = [];
  const rand = seeded(`${seed}:${key}`);
  const ok = (p) => standable(p) && clear(effects, p, pad);
  for (const t of turfs) {
    // a post's holders, side by side across its facing
    t.posts.forEach((post, i) => {
      if (cellKey(post[0], post[1]) !== key) return;
      const yaw = Math.atan2(post[0] - t.at[0], post[1] - t.at[1]);
      const n = low(tier) ? 1 : 2;
      for (let k = 0; k < n; k++) {
        const off = n === 1 ? 0 : k ? 1.2 : -1.2;
        const at = [r2(post[0] + Math.cos(yaw) * off), r2(post[1] - Math.sin(yaw) * off)];
        if (!ok(at)) continue;
        out.push({ id: `${t.id}:p${i}:${k}`, kind: kindFor(t.side, rand), side: t.side, role: 'post', at, yaw: r2(yaw), home: post, turf: t.id, squad: `${t.id}:p${i}` });
      }
    });
    // a beat's patrol, counted in the cell its first point is in
    t.beats.forEach((beat, i) => {
      if (!beat.length || cellKey(beat[0][0], beat[0][1]) !== key) return;
      const n = low(tier) ? 2 : 3;
      const next = beat[1] ?? beat[0];
      const yaw = Math.atan2(next[0] - beat[0][0], next[1] - beat[0][1]);
      for (let k = 0; k < n; k++) {
        const at = [r2(beat[0][0] - Math.sin(yaw) * k * 2.2), r2(beat[0][1] - Math.cos(yaw) * k * 2.2)];
        if (!ok(at)) continue;
        out.push({ id: `${t.id}:b${i}:${k}`, kind: kindFor(t.side, rand), side: t.side, role: 'patrol', at, yaw: r2(yaw), home: beat[0], beat, turf: t.id, squad: `${t.id}:b${i}` });
      }
    });
  }
  // the fill: by the turf at the cell's middle, density × its strength, in pairs
  const [cx, cz] = parse(key);
  const mid = [(cx + 0.5) * CELL, (cz + 0.5) * CELL];
  const t = turfAt(turfs, mid[0], mid[1]);
  if (t) {
    const n = Math.round(densityOf(tier) * strengthOf(t, effects));
    const face = t.front ? Math.atan2(t.front.at[0] - t.at[0], t.front.at[1] - t.at[1]) : null;
    for (let k = 0; k < n; k++) {
      for (let tries = 0; tries < 10; tries++) {
        const at = [r2((cx + rand()) * CELL), r2((cz + rand()) * CELL)];
        if (turfAt(turfs, at[0], at[1]) !== t || !ok(at)) continue;
        const yaw = face ?? rand() * Math.PI * 2;
        out.push({ id: `f:${key}:${k}`, kind: kindFor(t.side, rand), side: t.side, role: 'fill', at, yaw: r2(yaw), home: at, turf: t.id, squad: `f:${key}:${Math.floor(k / 2)}` });
        break;
      }
    }
  }
  return out;
}

export function createPopulation({ site, turfs, effects, tier = 'high', seed = 1, rand = Math.random, standable = () => true }) {
  const grid = createChunkGrid({ size: CELL, radius: RADIUS, inFlight: 1, hysteresis: HYSTERESIS });
  const cap = POP[tier] ?? POP.high;
  const pad = site?.land?.at ?? null;
  const specs = new Map(); // id → spec (where it was last, kept for the visit)
  const cells = new Map(); // key → { built, ids: Set }
  const dead = new Set();
  const soldiers = new Map(); // id → Soldier (made)
  let you = [0, 0];
  let ticks = 0;
  let sorts = 0;
  let queue = null; // who waits to be made, nearest first (sorted again on a change, or every RESORT updates)
  let queuedAt = 0;
  let yourCell = null;

  const cell = (key) => {
    let c = cells.get(key);
    if (!c) cells.set(key, (c = { built: false, ids: new Set() }));
    return c;
  };
  const place = (spec) => {
    specs.set(spec.id, spec);
    spec.cell = cellKey(spec.at[0], spec.at[1]);
    cell(spec.cell).ids.add(spec.id);
  };
  const build = (key) => {
    const c = cell(key);
    if (c.built) return;
    c.built = true;
    changed();
    for (const s of rosterFor(key, turfs, effects, tier, seed, standable, { pad })) if (!specs.has(s.id)) place({ ...s, from: key });
  };
  const move = (id, x, z) => {
    const spec = specs.get(id);
    if (!spec) return;
    spec.at = [x, z];
    const k = cellKey(x, z);
    if (k === spec.cell) return;
    cells.get(spec.cell)?.ids.delete(id);
    spec.cell = k;
    cell(k).ids.add(id);
  };
  // within the band round you that's kept (the radius and its hysteresis)
  const kept = (key) => {
    const [x, z] = parse(key);
    const [cx, cz] = [Math.floor(you[0] / CELL), Math.floor(you[1] / CELL)];
    return Math.max(Math.abs(x - cx), Math.abs(z - cz)) <= RADIUS + HYSTERESIS;
  };
  const far = (spec) => Math.hypot(spec.at[0] - you[0], spec.at[1] - you[1]);
  // a dry spot within DRY of p (rings out, eight bearings each), or null
  const dry = (p) => {
    if (standable(p)) return p;
    for (let r = 3; r <= DRY; r += 3)
      for (let i = 0; i < 8; i++) {
        const q = [r2(p[0] + Math.cos((i / 8) * Math.PI * 2) * r), r2(p[1] + Math.sin((i / 8) * Math.PI * 2) * r)];
        if (standable(q)) return q;
      }
    return null;
  };
  // let go of: what it had kept on its spec, for when it's made again
  const letGo = (id) => {
    const s = soldiers.get(id);
    const spec = specs.get(id);
    if (s && spec && s.alive) spec.kept = Object.fromEntries(KEEP.filter((k) => s[k] != null).map((k) => [k, s[k]]));
    soldiers.delete(id);
  };
  const make = (spec) => {
    const s = newSoldier(spec, rand);
    if (spec.kept) Object.assign(s, spec.kept);
    soldiers.set(spec.id, s);
    return s;
  };
  // the cells out of the band that hold nothing that's changed (they'd be built the same again): let go of
  const prune = () => {
    for (const [key, c] of cells) {
      if (kept(key) || grid.loaded.has(key)) continue;
      let pristine = true;
      for (const id of c.ids) {
        const spec = specs.get(id);
        if (dead.has(id) || soldiers.has(id) || !spec || spec.kept || spec.from !== key) {
          pristine = false;
          break;
        }
      }
      if (!pristine) continue;
      for (const id of c.ids) specs.delete(id);
      cells.delete(key);
    }
  };
  const waiting = () => {
    const out = [];
    for (const key of grid.loaded) for (const id of cells.get(key)?.ids ?? []) if (!soldiers.has(id) && !dead.has(id)) out.push(specs.get(id));
    sorts++;
    return out.sort((a, b) => far(a) - far(b));
  };
  const changed = () => (queue = null);

  return {
    soldiers,
    cellOf: cellKey,
    move,
    waiting,
    died(id) {
      dead.add(id);
      soldiers.delete(id);
    },
    isDead: (id) => dead.has(id),
    // (for the tests: how much it's keeping)
    sizes: () => ({ cells: cells.size, specs: specs.size, dead: dead.size, sorts }),
    reinforce(key, list) {
      for (const s of list) {
        if (specs.has(s.id) || dead.has(s.id)) continue;
        // (never sent in in the water: moved to dry ground near, or not at all)
        const at = dry(s.at);
        if (at) place({ ...s, at: [...at] });
      }
      changed();
      cell(key);
    },
    update({ x, z, heading = null }) {
      you = [x, z];
      // (where each soldier is now, so the cell it walked into keeps it)
      for (const s of soldiers.values()) move(s.id, s.b.x, s.b.z);
      const { ask } = grid.update({ x, z, heading });
      for (const key of ask) {
        grid.began(key);
        build(key);
        grid.done(key, grid.gen);
      }
      const drop = [];
      for (const id of soldiers.keys()) {
        if (kept(specs.get(id).cell)) continue;
        letGo(id);
        drop.push(id);
      }
      const made = [];
      const here = cellKey(x, z);
      if (here !== yourCell || drop.length || ticks - queuedAt >= RESORT) changed();
      yourCell = here;
      if (!queue) {
        queue = waiting();
        queuedAt = ticks;
      }
      for (const spec of queue) {
        if (soldiers.has(spec.id) || dead.has(spec.id)) continue;
        if (soldiers.size >= cap) {
          // the furthest made gives way to one well nearer, if it isn't the one walking in
          let worst = null;
          for (const s of soldiers.values()) if (!worst || far(specs.get(s.id)) > far(specs.get(worst.id))) worst = s;
          if (!worst || far(specs.get(worst.id)) - far(spec) <= SWAP) break;
          letGo(worst.id);
          drop.push(worst.id);
        }
        made.push(make(spec));
      }
      if (++ticks % PRUNE === 0) prune();
      return { make: made, drop };
    },
  };
}
