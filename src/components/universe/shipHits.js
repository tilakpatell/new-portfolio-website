// Your ship flying into another ship: one sweep of your way this frame
// against every small ship the scene has, whichever system flies it (the
// hunters, the wingmen, the traffic, a skirmish, the characters, the pilots
// online, the battle at the front). Plain objects only (no three.js), so
// it's tested in Node; the law it applies is lib/combat/contact.js's, and
// the scene plays out what the hit it answers does.
//
// createShipHits({ sources, cool = CONTACT.cool, radius = SHIP.radius }) →
//   { sweep(before, after, dt, now) → hit | null, sources }
// before, after: your ship's states last frame and this (ship.js's).
// sources: functions answering this frame's bodies from one system each
//   (a missing source, or one answering null, is skipped).
// body: { key, id, kind, at: { x, y, z }, prev?, vel?, size, r?, side:
//   'foe' | 'friend' | 'civil' | 'law' | 'pilot', hit(punch, before, after)
//   → { down, at, size, kind, civil? } | null }
//   `prev` is where it was last frame (`at` when left out); `vel` is read
//   when given, else taken from `prev` and dt; `r` is its body, bodyRadius
//   of its size when left out. `hit` is the system's own way of taking a
//   ram's hits, the path a shot takes; the scene calls it, never the sweep
//   (`before` and `after` for the systems that test a segment).
// hit: { body, k, at, place, normal, into, outcome } — `at` where you met on
//   your way, `place` where the other was then, `normal` the unit way from
//   it toward you, `into` the closing speed (from the velocities, never the
//   way over dt), `outcome` the law's contact(into, size); a friend is
//   always a glance.
//
// Only bodies within reach of where you are now are tested (the longest
// body, your own, and the frame's way, so a long frame still finds what it
// passed), each tested with the law's touchAt (sweptSpheres's test, read
// at the moment the two first touched), the earliest along the way wins, one hit a frame at most, and a
// ship just met is not met again for `cool` seconds.

import { CONTACT, bodyRadius, closingSpeed, contact, touchAt } from '../../lib/combat/contact';
import { shipVelocity } from './hunterRules';
import { SHIP } from './ship';

const KEEP = 64; // ships remembered before the old ones are let go
const GLANCE = { kind: 'glance', damage: 0, punch: 0, keep: CONTACT.glance };

export function createShipHits({ sources = [], cool = CONTACT.cool, radius = SHIP.radius } = {}) {
  const met = new Map(); // key → when it was last met
  const all = [];
  const vYou = [0, 0, 0];

  function sweep(before, after, dt, now) {
    all.length = 0;
    let most = 0;
    for (const source of sources) {
      const got = source?.();
      if (!got) continue;
      for (const b of got) {
        all.push(b);
        const r = b.r ?? bodyRadius(b.size);
        if (r > most) most = r;
      }
    }
    if (!all.length) return null;
    const wx = after.x - before.x;
    const wy = after.y - before.y;
    const wz = after.z - before.z;
    const reach = most + radius + Math.sqrt(wx * wx + wy * wy + wz * wz);
    const reach2 = reach * reach;
    let best = null;
    let bestK = Infinity;
    for (const b of all) {
      const dx = b.at.x - after.x;
      const dy = b.at.y - after.y;
      const dz = b.at.z - after.z;
      if (dx * dx + dy * dy + dz * dz > reach2) continue;
      if (now - (met.get(b.key) ?? -Infinity) < cool) continue;
      const k = touchAt(before, after, b.prev ?? b.at, b.at, (b.r ?? bodyRadius(b.size)) + radius);
      if (k !== null && k < bestK) {
        bestK = k;
        best = b;
      }
    }
    if (!best) return null;

    const k = bestK;
    const from = best.prev ?? best.at;
    const at = { x: before.x + wx * k, y: before.y + wy * k, z: before.z + wz * k };
    const place = { x: from.x + (best.at.x - from.x) * k, y: from.y + (best.at.y - from.y) * k, z: from.z + (best.at.z - from.z) * k };
    let nx = at.x - place.x;
    let ny = at.y - place.y;
    let nz = at.z - place.z;
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (l > 1e-9) {
      nx /= l;
      ny /= l;
      nz /= l;
    } else {
      nx = 0;
      ny = 1;
      nz = 0;
    }
    const normal = { x: nx, y: ny, z: nz };
    shipVelocity(after, vYou);
    const vThem = best.vel ?? (best.prev && dt > 0
      ? { x: (best.at.x - best.prev.x) / dt, y: (best.at.y - best.prev.y) / dt, z: (best.at.z - best.prev.z) / dt }
      : { x: 0, y: 0, z: 0 });
    const into = closingSpeed({ x: vYou[0], y: vYou[1], z: vYou[2] }, vThem, normal);
    const outcome = best.side === 'friend' ? { ...GLANCE } : contact(into, best.size);

    if (met.size >= KEEP) for (const [old, when] of met) if (now - when >= cool) met.delete(old);
    met.set(best.key, now);
    return { body: best, k, at, place, normal, into, outcome };
  }

  return { sweep, sources };
}
