// The planet's occurrences and events, round the ship: the cells' wrecks,
// caves, camps and beacons (lib/land/flight/occurrences.js) placed as you
// come to them and let go of behind you, their rules run near the ship, and
// the director's events (lib/land/flight/director.js) started and ended,
// said on the HUD (./eventNews.js), and told to the room (./online.js) when
// they are yours, so every pilot round you sees the one. The drawing is the
// caller's `draw` (./occurrenceScene.js's, or a fake in the tests): this file
// decides, that one draws. Leaving the planet clears all of it.
//
// No three.js here.
//
//   createOccurrences({ spec, field, draw, director, say, setEvent, radius }) → {
//     step(ship, at, dt), link(online) → online, markers() → [{ id, kind, name, at }],
//     placed() → occurrences, active() → ev | null, force(kind) → ev | null,
//     stats(), dispose() }
//   draw: { occurrences(list), fire({ from, to }), begin(ev), end(ev),
//     step(ship, at, dt, ev | null), clear() }

import { cap, occurrencesFor, placeOccurrences, applyRule } from '../../../lib/land/flight/occurrences';
import { createFlightDirector } from '../../../lib/land/flight/director';
import { cellKeyOf } from '../../../lib/land/flight/routes';
import { setEvent as setEventNews } from './eventNews';
import { say as sayNews } from './lifeNews';

const RING = 1200; // m: the biomes round you are sampled this far out, for what an event needs
const NEAR = 1.5; // an occurrence's rule is asked within this many of its reach

export function createOccurrences({ spec, field, draw, director = createFlightDirector({ spec }), say = sayNews, setEvent = setEventNews, radius = 1 }) {
  const rows = occurrencesFor(spec);
  const cells = new Map(); // key → occurrences
  const states = new Map(); // id → its rule's visit state
  let list = [];
  let key = null;
  let biomes = [];
  let room = null;
  let offRoom = () => {};
  let playing = null;
  let gone = false;

  const biomeAt = (x, z) => spec.biomes?.[field.biomeAt(x, z)]?.id;
  const ringOf = (x, z) => {
    const ids = new Set([biomeAt(x, z)]);
    for (let k = 0; k < 8; k++) ids.add(biomeAt(x + Math.cos((k * Math.PI) / 4) * RING, z + Math.sin((k * Math.PI) / 4) * RING));
    ids.delete(undefined);
    return [...ids];
  };

  // the 3 × 3 round the ship's cell, placed; the rest let go of
  const restream = (x, z) => {
    const [cx, cz] = key.split(',').map(Number);
    const want = new Set();
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) want.add(`${cx + dx},${cz + dz}`);
    for (const k of cells.keys()) if (!want.has(k)) cells.delete(k);
    for (const k of want) if (!cells.has(k)) cells.set(k, placeOccurrences(spec, rows, k, field));
    list = [...cells.values()].flat();
    biomes = ringOf(x, z);
    draw.occurrences(list);
  };

  // what the director holds against what's drawn: end the old, start the new
  const sync = () => {
    const now = director.active();
    const was = playing;
    // (set first: telling the room may be answered at once, and that answer syncs again)
    playing = now;
    setEvent(now);
    if (was && was.id !== now?.id) draw.end(was);
    if (now && now.id !== was?.id) {
      draw.begin(now);
      say(now.line);
      if (now.mine) room?.event(director.wire(now));
    }
  };

  const heard = (e) => {
    if (gone) return;
    if (e.type === 'event') {
      if (director.receive(e.event)) sync();
      // (a later one than ours: ours again, so they drop theirs for it)
      else if (playing && e.event.id > playing.id) room?.event(director.wire(playing));
    }
    // (a pilot new to you: what's on, so they needn't wait for the next roll)
    else if (e.type === 'joined' && playing) room?.event(director.wire(playing));
  };

  return {
    step(ship, at, dt) {
      if (gone) return;
      const k = cellKeyOf(ship.x, ship.z);
      if (k !== key) {
        key = k;
        restream(ship.x, ship.z);
      }
      for (const occ of list) {
        if (Math.hypot(ship.x - occ.at[0], ship.z - occ.at[2]) > occ.r * NEAR) continue;
        if (!states.has(occ.id)) states.set(occ.id, {});
        const fx = applyRule(occ, ship, states.get(occ.id), dt);
        if (fx.toast) say(fx.toast);
        for (const h of fx.hostile ?? []) draw.fire(h);
      }
      director.update(dt, { at: [ship.x, ship.z], cell: key, biomes });
      sync();
      draw.step(ship, at, dt, playing);
    },
    // the room, as shared.js makes it (its makeOnline): heard from now on
    link(online) {
      offRoom();
      room = online;
      offRoom = online?.on?.(heard) ?? (() => {});
      return online;
    },
    // for the planet map (./mapRules.js's markersOf): what's placed round you, and what's on
    markers() {
      const out = list.map((o) => ({ id: o.id, kind: o.kind, name: cap(o.name), at: [o.at[0], o.at[2]] }));
      if (playing) out.push({ id: playing.id, kind: playing.kind, name: playing.line, at: playing.at });
      return out;
    },
    placed: () => list,
    active: () => playing,
    // (the checks: something now, as if rolled here)
    force(kind) {
      const ev = director.force(kind);
      if (ev) sync();
      return ev;
    },
    stats: () => ({ cells: cells.size, occurrences: list.length, event: playing?.kind ?? null, linked: Boolean(room) }),
    // leaving the planet: every event over, the weather as it was, no timer left
    dispose() {
      gone = true;
      offRoom();
      room = null;
      director.clear();
      if (playing) draw.end(playing);
      playing = null;
      setEvent(null);
      draw.clear();
      cells.clear();
      states.clear();
      list = [];
    },
  };
}
