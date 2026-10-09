// The way to what the story wants of you next: where its step’s target is
// (a named spot, a room, someone by their tag, a tagged thing to use or a
// jump to take), and the way there through the station’s doors and lifts
// (nav.js’s A*, as the crew walk), so the HUD can mark the next door, the
// lift to take, or the target itself once it is in the room with you. The
// way goes by doors you can open (a locked one the Empire's only when you
// pass for one), and failing that by a jump that lands where the target is
// (the chute into the compactor); only when neither reaches it does it go
// through a locked door, which is then the story's to open. Pure.
//
//   targetOf(g) → { x, y, z, room, what, at? } | null   where the current story step points; what:
//     'spot' | 'room' | 'npc' | 'thing' | 'jump'; null in free roam, between steps, or for a step
//     with no target (one that comes to you); at: a thing's own height (a camera on the ceiling)
//   routeTo(g, target) → { next: { x, y, z, room, kind: 'door' | 'lift' | 'jump' | 'goal' }, goal, metres } | null
//     next: where to head now; metres: the whole way’s length; null when no way is left

import { furnish } from './furnish';
import { offTags } from './layout';
import { route } from './nav';

const AIM = 1.2; // metres over the floor a marker stands: a man’s chest
const NEAR = 1.2; // metres: a waypoint closer than this is passed already

function stepOf(g) {
  if (!g.plot || g.plot.done) return null;
  return g.plot.story.steps.find((s) => s.id === g.plot.progress.step) ?? null;
}

const lift = (g, room, x, z) => ({ x, z, room, y: (g.layout.floorAt(room, x, z) ?? g.layout.rooms.get(room)?.y ?? 0) + AIM });

// a tagged thing, furnished in some room: the room it stands in and where. A tag names one thing, or
// the things numbered under it (AA-23's cameras, `aa23-camera-1` and `-2`), the nearest not yet broken
function thingOf(g, tag) {
  g.furnished ??= new Map();
  let best = null;
  for (const room of g.layout.rooms.values()) {
    if (!g.furnished.has(room.id)) g.furnished.set(room.id, furnish(room, g.layout.station));
    for (const t of g.furnished.get(room.id).props) {
      if (!(t.tag === tag || t.tag?.startsWith(`${tag}-`)) || g.broken?.has(t.tag)) continue;
      const d = Math.hypot(t.x - g.you.x, t.z - g.you.z) + (room.id === g.you.room ? 0 : 1000);
      if (!best || d < best.d) best = { room: room.id, x: t.x, z: t.z, y: t.y, d };
    }
  }
  return best && { room: best.room, x: best.x, z: best.z, y: best.y };
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
  if (thing) return { ...lift(g, thing.room, thing.x, thing.z), what: 'thing', at: thing.y };
  const jump = layout.jumps?.find((j) => j.id === tag);
  if (jump) return { ...lift(g, jump.from, jump.x, jump.z), what: 'jump' };
  const spot = layout.station.spots?.[tag];
  return spot ? { ...lift(g, spot.room, spot.x, spot.z), what: 'spot' } : null;
}

// whether you may go through a door: any not locked (a seal lifts), the Empire's own when you pass for one
function yours(g, id, door) {
  const s = g.doors?.[id];
  if (!s?.locked) return true;
  const you = g.you;
  return door.kind !== 'hatch' && door.lock === 'side:imperial' && (you.side === 'imperial' || Boolean(you.armour && you.helmet));
}
const lockOpen = (g, lock) => !lock || (lock.startsWith('flag:') && g.flags?.has(lock.slice(5)));
const length = (way) => way.reduce((m, p, i) => (i ? m + Math.hypot(p.x - way[i - 1].x, p.z - way[i - 1].z) : 0), 0);

function wayTo(g, target) {
  const you = g.you;
  const from = { x: you.x, z: you.z, room: you.room };
  const to = { x: target.x, z: target.z, room: target.room };
  // (never over a floor drawn back: the chasm's bridge while it is in)
  const off = offTags(g.layout, g.flags ?? new Set());
  const own = route(g.nav, from, to, { solidsOf: g.solidsOf, off, canPass: (id, door) => yours(g, id, door) });
  if (own) return { way: own };
  // by a jump that lands in the target's room, the nearest way round
  let best = null;
  for (const j of g.layout.jumps ?? []) {
    const land = g.layout.station.spots?.[j.to];
    if (!lockOpen(g, j.lock) || (land?.room ?? j.to) !== target.room) continue;
    const way = route(g.nav, from, { x: j.x, z: j.z, room: j.from }, { solidsOf: g.solidsOf, off, canPass: (id, door) => yours(g, id, door) });
    if (way && (!best || length(way) < length(best.way))) best = { way, jump: j };
  }
  if (best) return best;
  const any = route(g.nav, from, to, { solidsOf: g.solidsOf, off });
  return any ? { way: any } : null;
}

export function routeTo(g, target) {
  if (!target) return null;
  const you = g.you;
  const found = wayTo(g, target);
  if (!found) return null;
  const { way, jump } = found;
  const metres = length(way);
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
  const end = jump ? { ...lift(g, jump.from, jump.x, jump.z), kind: 'jump' } : { x: target.x, y: target.y, z: target.z, room: target.room, kind: 'goal' };
  return { next: next ?? end, goal: target, metres, points: way.map((p) => ({ x: p.x, z: p.z, room: p.room })), ...(jump ? { jump: jump.id } : {}) };
}
