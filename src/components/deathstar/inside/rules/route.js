// The way to what the story wants of you next: where its step’s target is
// (a named spot, a room, someone by their tag, a tagged thing to use or a
// jump to take), and the way there through the station’s doors and lifts
// (nav.js’s A*, as the crew walk), so the HUD can mark the next door, the
// lift to take, or the target itself once it is in the room with you. The
// way is worked out as anyone may walk it, locks and all aside: a locked
// door on the way is the story’s to open. Pure.
//
//   targetOf(g) → { x, y, z, room, what } | null   where the current story step points; what:
//     'spot' | 'room' | 'npc' | 'thing' | 'jump'; null in free roam, between steps, or for a step
//     with no target (one that comes to you)
//   routeTo(g, target) → { next: { x, y, z, room, kind: 'door' | 'lift' | 'goal' }, goal, metres } | null
//     next: where to head now; metres: the whole way’s length; null when no way is left

import { furnish } from './furnish';
import { route } from './nav';

const AIM = 1.2; // metres over the floor a marker stands: a man’s chest
const NEAR = 1.2; // metres: a waypoint closer than this is passed already

function stepOf(g) {
  if (!g.plot || g.plot.done) return null;
  return g.plot.story.steps.find((s) => s.id === g.plot.progress.step) ?? null;
}

const lift = (g, room, x, z) => ({ x, z, room, y: (g.layout.floorAt(room, x, z) ?? g.layout.rooms.get(room)?.y ?? 0) + AIM });

// a tagged thing, furnished in some room: the room it stands in and where
function thingOf(g, tag) {
  g.furnished ??= new Map();
  for (const room of g.layout.rooms.values()) {
    if (!g.furnished.has(room.id)) g.furnished.set(room.id, furnish(room, g.layout.station));
    const t = g.furnished.get(room.id).props.find((p) => p.tag === tag);
    if (t) return { room: room.id, x: t.x, z: t.z };
  }
  return null;
}

export function targetOf(g) {
  const t = stepOf(g)?.target;
  if (!t) return null;
  const { layout } = g;
  if (t.spot) {
    const s = layout.station.spots?.[t.spot];
    return s ? { ...lift(g, s.room, s.x, s.z), what: 'spot' } : null;
  }
  if (t.room) {
    const r = layout.rooms.get(t.room);
    return r ? { ...lift(g, r.id, r.x, r.z), what: 'room' } : null;
  }
  const tag = t.npc ?? t.tag;
  const who = g.crew?.people.find((p) => p.tag === tag && p.hp > 0) ?? g.crew?.people.find((p) => p.tag === tag);
  if (who) return { x: who.x, y: (who.y ?? 0) + AIM, z: who.z, room: who.room, what: 'npc' };
  const thing = thingOf(g, tag);
  if (thing) return { ...lift(g, thing.room, thing.x, thing.z), what: 'thing' };
  const jump = layout.jumps?.find((j) => j.id === tag);
  if (jump) return { ...lift(g, jump.from, jump.x, jump.z), what: 'jump' };
  const spot = layout.station.spots?.[tag];
  return spot ? { ...lift(g, spot.room, spot.x, spot.z), what: 'spot' } : null;
}

export function routeTo(g, target) {
  if (!target) return null;
  const you = g.you;
  const way = route(g.nav, { x: you.x, z: you.z, room: you.room }, { x: target.x, z: target.z, room: target.room }, { solidsOf: g.solidsOf });
  if (!way) return null;
  let metres = 0;
  for (let i = 1; i < way.length; i++) metres += Math.hypot(way[i].x - way[i - 1].x, way[i].z - way[i - 1].z);
  // the first door or lift car not yet passed, else the target itself
  let next = null;
  for (let i = 1; i < way.length - 1; i++) {
    const p = way[i];
    if (!p.door && !p.lift) continue;
    if (Math.hypot(p.x - you.x, p.z - you.z) < NEAR && p.room === you.room) continue;
    if (p.door) {
      const d = g.layout.doors.get(p.door);
      next = { x: p.x, z: p.z, room: p.room, y: (d?.y ?? you.y) + AIM, kind: 'door' };
    } else next = { ...lift(g, p.room, p.x, p.z), kind: 'lift' };
    break;
  }
  return { next: next ?? { x: target.x, y: target.y, z: target.z, room: target.room, kind: 'goal' }, goal: target, metres };
}
