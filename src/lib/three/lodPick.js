// Who of a crowd animates, who stands still and who isn't drawn, by
// distance from the camera and a count per tier: a body still going down
// gets its turn before anyone living (a fall that loses its turn has to be
// cut short), a body that has finished falling stands still but drawn,
// anyone past `far` or not shown is hidden. Moved here from the Death Star
// (deathstar/inside/scene/people.js) when the galaxy's ground needed it
// too. Pure, tested.
//
//   LIVE → { ultra, high, mid, low }   how many animate on each tier; FAR: 60 m
//   liveCount(tier) → n
//   lodPick(items: [{ id, x, y, z, shown?, settled?, falling? }], at, { count, far }, out?)
//     → Map<id, 'live' | 'still' | 'hidden'>

export const LIVE = Object.freeze({ ultra: 24, high: 24, mid: 14, low: 8 });
export const FAR = 60;

export function liveCount(tier) {
  return LIVE[tier] ?? LIVE.low;
}

export function lodPick(items, at, { count = LIVE.low, far = FAR } = {}, out = new Map()) {
  out.clear();
  const near = [];
  for (const p of items) {
    const d = Math.hypot(p.x - at.x, p.y - at.y, p.z - at.z);
    if (p.shown === false || !(d <= far)) out.set(p.id, 'hidden');
    else if (p.settled) out.set(p.id, 'still');
    else near.push([p.falling ? 0 : 1, d, p.id]);
  }
  // a body going down first, nearest first among each: a fall that loses its turn has to be cut short
  near.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  near.forEach(([, , id], i) => out.set(id, i < count ? 'live' : 'still'));
  return out;
}
