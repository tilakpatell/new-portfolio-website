// What a body falling aboard the Death Star lands on: the station itself.
// A ragdoll (lib/three/ragdollPhysics.js) asks, point by point, whether it
// is in anything; this answers from the layout the walker walks on: the
// floor under the point in whichever room it is over (so a body rolls off
// a gantry onto the deck below, or over the chasm’s edge and on down), and
// the walls near where it fell, a doorway’s gap open while its door is.
// Pure: layout and doors in, a function out.
//
//   colliderFor(layout, { room, at, off, open, reach }) → collide(p, r) → bool
//     room: the room it fell in (the one asked when a point is over no room); at: { x, z } where
//     it fell; off: layout.offTags’s Set (a bridge drawn back is no floor); open(doorId) → bool;
//     reach: metres round `at` whose walls are kept (4)
//     collide: moves p ({ x, y, z }, radius r) out of the walls and up onto the floor; true when
//     it is on the floor

const STEP_UP = 0.6; // metres under a floor a point is still lifted onto it: lower, it has fallen past

export function colliderFor(layout, { room, at, off = undefined, open = () => false, reach = 4 } = {}) {
  const near = layout.walls.filter((w) => {
    // the segment's nearest point to where it fell
    const dx = w.x1 - w.x0;
    const dz = w.z1 - w.z0;
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((at.x - w.x0) * dx + (at.z - w.z0) * dz) / l2));
    return Math.hypot(w.x0 + dx * t - at.x, w.z0 + dz * t - at.z) < reach;
  });
  return (p, r) => {
    for (const w of near) {
      if (w.door && open(w.door)) continue;
      if (p.y < w.y0 - r || p.y > w.y1 + r) continue;
      const dx = w.x1 - w.x0;
      const dz = w.z1 - w.z0;
      const l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((p.x - w.x0) * dx + (p.z - w.z0) * dz) / l2));
      const cx = w.x0 + dx * t;
      const cz = w.z0 + dz * t;
      let nx = p.x - cx;
      let nz = p.z - cz;
      const d = Math.hypot(nx, nz);
      if (d >= r) continue;
      if (d < 1e-6) {
        // on the line itself: out to the room's side (its right, walking the segment)
        const l = Math.sqrt(l2);
        nx = -dz / l;
        nz = dx / l;
      } else {
        nx /= d;
        nz /= d;
      }
      p.x = cx + nx * r;
      p.z = cz + nz * r;
    }
    const id = layout.roomAt(p.x, p.y + STEP_UP, p.z) ?? room;
    const floor = id ? layout.floorAt(id, p.x, p.z, off) : null;
    if (floor === null || p.y - r >= floor || p.y < floor - STEP_UP) return false;
    p.y = floor + r;
    return true;
  };
}
