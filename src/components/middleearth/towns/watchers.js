// Sneaking past watchers: anyone who walks a round and stops at each corner
// to look about (Farmer Maggot's dogs were the first; Bree's Nazgûl walk the
// lanes the same way). They see in a cone, but not through houses or walls;
// they hear you run close by, smell you closer still, and anyone wearing the
// Ring shows to them from far off, through anything. Seen, they stop a
// moment, then give chase, and give up when you're out of reach.
//
// opts: sight (m), cone (half-angle, radians), smell, hear, ringSight (m),
// alert (s before the chase), chase and patrol (m/s), giveUp (s), leash (m),
// catch (m), look (s spent looking about at a corner).

import { sightClear } from './walker';

const turnTo = (face, want, k) => {
  let d = want - face;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return face + d * Math.min(1, k);
};

export function newWatchers(rounds) {
  return {
    rounds,
    list: rounds.map((r, i) => ({ id: i, x: r[0][0], z: r[0][1], face: Math.atan2(-((r[1] ?? r[0])[1] - r[0][1]), (r[1] ?? r[0])[0] - r[0][0]), leg: 1 % r.length, mode: 'patrol', t: 0, wait: 0.5 + i * 0.4, look: 0, unseen: 0 })),
  };
}

// can this watcher see (hear, smell) the walker `h`? world: { colliders,
// walls, ring } (ring: it's being worn)
export function watcherSees(w, h, opts, { colliders = [], walls = [], ring = false } = {}) {
  const dx = h.x - w.x;
  const dz = h.z - w.z;
  const d = Math.hypot(dx, dz);
  if (ring && d < (opts.ringSight ?? 30)) return true;
  if (d < opts.smell) return true;
  const clear = () => sightClear(w.x, w.z, h.x, h.z, colliders, walls);
  if (h.running && d < opts.hear) return clear();
  if (d > opts.sight) return false;
  let off = Math.atan2(-dz, dx) - (w.face + w.look);
  off = Math.atan2(Math.sin(off), Math.cos(off));
  return Math.abs(off) < opts.cone && clear();
}

// Walk toward (tx, tz) at `speed`, kept out of things by `push`; true once there.
function walkTo(w, tx, tz, speed, dt, push, near = 0.2) {
  const dx = tx - w.x;
  const dz = tz - w.z;
  const d = Math.hypot(dx, dz);
  if (d < near) return true;
  const s = Math.min(d, speed * dt);
  let x = w.x + (dx / d) * s;
  let z = w.z + (dz / d) * s;
  if (push) [x, z] = push(x, z);
  w.x = x;
  w.z = z;
  w.face = turnTo(w.face, Math.atan2(-dz, dx), dt * 8);
  return false;
}

// One step of the watch. h: the walker. world: { colliders, walls, ring,
// push(x, z) for keeping a chaser out of houses, active (false: they walk
// their rounds but notice nothing) }. Returns events: { type: 'seen' |
// 'lost' | 'caught', id }.
export function stepWatchers(ws, h, dt, opts, world = {}) {
  const ev = [];
  const active = world.active !== false;
  for (const w of ws.list) {
    const round = ws.rounds[w.id];
    w.t += dt;
    if (w.mode === 'patrol') {
      if (w.wait > 0) {
        w.wait -= dt;
        w.look = Math.sin((opts.look - w.wait) * 2.6) * 0.9; // looking about
      } else {
        w.look *= Math.max(0, 1 - dt * 6);
        const [tx, tz] = round[w.leg];
        if (walkTo(w, tx, tz, opts.patrol, dt, null)) {
          w.leg = (w.leg + 1) % round.length;
          w.wait = opts.look;
        }
      }
      if (active && watcherSees(w, h, opts, world)) {
        w.mode = 'alert';
        w.t = 0;
        w.look = 0;
        ev.push({ type: 'seen', id: w.id });
      }
    } else if (w.mode === 'alert') {
      w.face = turnTo(w.face, Math.atan2(-(h.z - w.z), h.x - w.x), dt * 10);
      if (!active) w.mode = 'back';
      else if (w.t > opts.alert) {
        w.mode = 'chase';
        w.t = 0;
        w.unseen = 0;
      }
    } else if (w.mode === 'chase') {
      const d = Math.hypot(h.x - w.x, h.z - w.z);
      if (active && d < opts.catch) {
        w.mode = 'caught';
        ev.push({ type: 'caught', id: w.id });
        continue;
      }
      w.unseen = active && watcherSees(w, h, opts, world) ? 0 : w.unseen + dt;
      if (!active || w.unseen > 1.6 || w.t > opts.giveUp || d > opts.leash) {
        w.mode = 'back';
        w.t = 0;
        ev.push({ type: 'lost', id: w.id });
        continue;
      }
      walkTo(w, h.x, h.z, opts.chase, dt, world.push, 0);
      w.face = turnTo(w.face, Math.atan2(-(h.z - w.z), h.x - w.x), dt * 12);
    } else if (w.mode === 'back') {
      // back to the round, and carry on
      const [tx, tz] = round[w.leg];
      if (walkTo(w, tx, tz, opts.patrol * 1.4, dt, world.push, 0.3)) {
        w.mode = 'patrol';
        w.wait = opts.look;
      }
      if (active && w.t > 1.5 && watcherSees(w, h, opts, world)) {
        w.mode = 'alert';
        w.t = 0;
        ev.push({ type: 'seen', id: w.id });
      }
    }
  }
  return ev;
}
