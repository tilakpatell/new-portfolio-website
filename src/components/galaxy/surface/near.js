// What's near you, for the things only worth doing near you.
//
// The scattered trees and rocks are drawn instanced, hundreds to a draw; if
// every one of them cast a shadow, the sun's shadow pass would draw them all
// again, though its map only covers the ground round you. So each scattered
// part casts through a stand-in holding only the instances within a few tens
// of metres (placer.js), and this finds those.
//
//   nearInstances(xs, zs, x, z, r, max = Infinity) → Int32Array: the indices
//     of the points (xs[i], zs[i]) within r of (x, z) across the ground; past
//     `max` of them, the nearest `max`. Pure.
//   zoneVisibility(inZone) → { outdoors, zones }: which of the two is drawn.
//     Inside a zone (a cantina, a base) the outdoors is out of sight, and
//     outside, every zone's room is; drawing both would pay for one you
//     can't see. Pure.

export function nearInstances(xs, zs, x, z, r, max = Infinity) {
  const r2 = r * r;
  const hits = [];
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - x;
    const dz = zs[i] - z;
    const d = dx * dx + dz * dz;
    if (d <= r2) hits.push(i, d);
  }
  let n = hits.length / 2;
  if (n > max) {
    // (the nearest, by distance: rare, so a sort of the few that got in is fine)
    const order = Array.from({ length: n }, (_, k) => k).sort((a, b) => hits[a * 2 + 1] - hits[b * 2 + 1]);
    const out = new Int32Array(max);
    for (let k = 0; k < max; k++) out[k] = hits[order[k] * 2];
    return out;
  }
  const out = new Int32Array(n);
  for (let k = 0; k < n; k++) out[k] = hits[k * 2];
  return out;
}

export function zoneVisibility(inZone) {
  return { outdoors: !inZone, zones: Boolean(inZone) };
}
