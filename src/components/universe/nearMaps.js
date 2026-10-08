// A planet's maps by how near it is, in three steps (planetMaps.js says
// which files). Up front every planet wears its small set (planets.js's
// loadTextures: each map's smallest file, and stand-ins for its relief,
// roughness and glow), which is right across the map: twelve radii out a
// planet is under 200 pixels tall. Within twelve radii it gets its standard
// set (step 1: 1024 on a desktop's ladder, and its own relief, roughness and
// glow); within six, its near set over that and its finer sphere (step 2,
// nearGeometry): parked 2.4 radii out, a planet fills 600 pixels with a
// quarter of its surface, 256 texels of a 1024 map, so the -hq copies, and on
// ultra the -xl colour map, or the 8192 -8k where one has been baked
// (planetMaps.js's K8). Each step is held a quarter further out than it's
// taken (15 and 7.5 radii), so its edge doesn't load and drop it over and
// over. At most two near sets at once, and four standard sets, the nearest
// (and always those of the two near ones): the map's planets are a thousand
// units and more apart, twenty and more of their radii, so twelve radii
// hold one planet at a time, two at a hand-off, and the sun; four is room
// to spare, and a bound on the memory a crowd could take. A set dropped has
// its textures disposed; one that arrives after the ship has gone on is
// never installed, only freed. On low and on a phone, step 1 only.
//
//   wanted(shipAt, planets, { near, far, hold, holdFar, resident, residentFar })
//       → [{ id, step }]: each planet within `far` radii (`holdFar` for one
//       holding its standard set) at step 1, within `near` (`hold` for one
//       holding its near set) at step 2, nearest first
//   evict(resident, wanted, max) → { keep, drop }
//   createNearMaps({ level, small, load, forget, resident, standard, near, far, upload })
//   (`resident`, `standard`: how many near and standard sets at most;
//   `upload(textures) → Promise`: a set sent to the graphics chip a slice at a
//   time before it's put on, rather than all in the frame it's swapped in)
//       → { update(shipAt, planets), resident(step = 2), dispose() }
//   (each planet: { id, at | group, r | radius, nearSet(level) → { std, near }, swapMaps(T2 | null), nearGeometry(on) })

import * as THREE from 'three';
import { forgetTexture, loadTexture } from '../../lib/three/textures';
import { detailLevel } from '../../lib/detail';

const BASE = '/textures/universe/';
const NEAR = 6;
const FAR = 12;
// (a planet already holding a step keeps it out to here, so the edge of
// its range doesn't load and drop it over and over)
const HOLD = 1.25;

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function wanted(shipAt, planets, { near = NEAR, far = FAR, hold = near, holdFar = far, resident = [], residentFar = [] } = {}) {
  const two = new Set(resident);
  const one = new Set(residentFar);
  const stepOf = (id, k) => (k <= (two.has(id) ? Math.max(near, hold) : near) ? 2 : k <= (one.has(id) ? Math.max(far, holdFar) : far) ? 1 : 0);
  return planets
    .map((p) => {
      const k = dist(shipAt, p.at) / p.r;
      return { id: p.id, k, step: stepOf(p.id, k) };
    })
    .filter((w) => w.step)
    .sort((a, b) => a.k - b.k)
    .map(({ id, step }) => ({ id, step }));
}

export function evict(resident, want, max) {
  const keep = want.slice(0, max);
  return { keep, drop: resident.filter((id) => !keep.includes(id)) };
}

const NONE = { update() {}, resident: () => [], dispose() {} };

export function createNearMaps({ level = detailLevel(), small = false, load = loadTexture, forget = forgetTexture, resident: max = 2, standard: maxStd = 4, near = NEAR, far = FAR, upload = null } = {}) {
  // (DEV: off, to measure what they cost: scripts/universe-check.mjs --near off)
  if (import.meta.env?.DEV && globalThis.localStorage?.getItem('tp-near') === 'off') return NONE;
  // step 2, the near set and the finer sphere, not on low or a phone
  const fine = level !== 'low' && !small;
  // by step, id → { planet, state: 'loading' | 'on', T2, urls, asked }
  const sets = { 1: new Map(), 2: new Map() };
  const all = () => [...sets[1].values(), ...sets[2].values()];
  let gone = false;
  const v = new THREE.Vector3();
  const lists = new Map(); // planet → its sets (worked out once)
  const worn = new Map(); // id → the maps it has on now

  // (a file a newer set has asked for too stays: the loader's cache hands
  // both sets the one texture)
  const held = (url, s) => all().some((o) => o !== s && o.asked.has(url));
  const free = (s) => {
    for (const [name, t] of Object.entries(s.T2 ?? {})) {
      if (held(s.urls[name], s)) continue;
      t.dispose?.();
      forget(s.urls[name]);
    }
    s.T2 = null;
  };
  // a planet's maps as its steps have them: the standard set's, the near
  // set's over it (none: its own back)
  const wear = (p) => {
    const on = (s) => (s?.state === 'on' ? s.T2 : {});
    const T2 = { ...on(sets[1].get(p.id)), ...on(sets[2].get(p.id)) };
    const now = Object.keys(T2).length ? T2 : null;
    const was = worn.get(p.id) ?? null;
    const same = was === now || (was && now && Object.keys(was).length === Object.keys(now).length && Object.keys(now).every((k) => was[k] === now[k]));
    if (same) return;
    worn.set(p.id, now);
    p.swapMaps?.(now);
  };
  const drop = (step, id) => {
    const s = sets[step].get(id);
    sets[step].delete(id);
    if (s?.state !== 'on') return; // (one still loading is freed when it lands)
    wear(s.planet);
    if (step === 2) s.planet.nearGeometry?.(false);
    free(s);
  };
  // the first of a map's files that loads, or nothing
  const fetchOne = async (s, { file, fallback, colour }) => {
    for (const f of [file, fallback].filter(Boolean)) {
      s.asked.add(BASE + f);
      try {
        return { url: BASE + f, t: await load(BASE + f, { color: colour }) };
      } catch {
        // (the next file down, or the planet keeps what it wears)
      }
    }
    return null;
  };
  const start = (step, p, list) => {
    const s = { planet: p, state: 'loading', T2: {}, urls: {}, asked: new Set() };
    sets[step].set(p.id, s);
    Promise.all(list.map(async (m) => [m.name, await fetchOne(s, m)])).then(async (got) => {
      for (const [name, r] of got) {
        if (!r) continue;
        s.T2[name] = r.t;
        s.urls[name] = r.url;
      }
      if (upload && !gone && sets[step].get(p.id) === s && Object.keys(s.T2).length) {
        try {
          await upload(Object.values(s.T2));
        } catch {
          // (they go up as they're drawn instead)
        }
      }
      // (gone on, dropped for a nearer one, or the scene's gone: never installed)
      if (gone || sets[step].get(p.id) !== s) return free(s);
      s.state = 'on';
      wear(p);
      if (step === 2) p.nearGeometry?.(true, level);
    });
  };

  return {
    update(shipAt, planets) {
      if (gone) return;
      const ps = new Map();
      for (const p of planets) {
        if (!lists.has(p)) lists.set(p, p.nearSet?.(level) ?? {});
        const { std = [], near: list = [] } = lists.get(p);
        if (!std.length && !list.length && !p.nearGeometry) continue;
        // (where it is in the world: a built planet's group, wherever the map's turned it)
        const c = p.at ?? p.group.getWorldPosition(v).toArray();
        ps.set(p.id, { id: p.id, at: c, r: p.r ?? p.radius, p, std, list });
      }
      const ship = Array.isArray(shipAt) ? shipAt : [shipAt.x, shipAt.y, shipAt.z];
      const want = wanted(ship, [...ps.values()], { near, far, hold: near * HOLD, holdFar: far * HOLD, resident: [...sets[2].keys()], residentFar: [...sets[1].keys()] });
      // step 2: the nearest two with a near set or a finer sphere
      const want2 = fine ? want.filter((w) => w.step === 2 && (ps.get(w.id).list.length || ps.get(w.id).p.nearGeometry)).map((w) => w.id) : [];
      const two = evict([...sets[2].keys()], want2, max);
      // step 1: the nearest four with a standard set, and the two near ones always
      const want1 = want.filter((w) => ps.get(w.id).std.length).map((w) => w.id);
      const keep1 = [...new Set([...evict([], want1, maxStd).keep, ...two.keep.filter((id) => ps.get(id).std.length)])];
      for (const id of two.drop) drop(2, id);
      for (const id of [...sets[1].keys()]) if (!keep1.includes(id)) drop(1, id);
      for (const id of keep1) if (!sets[1].has(id)) start(1, ps.get(id).p, ps.get(id).std);
      for (const id of two.keep) if (!sets[2].has(id)) start(2, ps.get(id).p, ps.get(id).list);
    },
    resident: (step = 2) => [...sets[step].entries()].filter(([, s]) => s.state === 'on').map(([id]) => id),
    dispose() {
      gone = true;
      for (const step of [2, 1]) for (const id of [...sets[step].keys()]) drop(step, id);
    },
  };
}
