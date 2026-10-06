// Mends what a new atlas (scripts/reatlas.mjs) does to a few of an HD
// figure's triangles. At about 40,000 faces, a figure has small charts round
// the lips, the nostrils and the ears that the packing lays down to nothing:
// a point or a line on the atlas, with no texel of their own, so they take
// the colour of whatever chart they land in (a fleck of hazmat yellow at the
// corner of a mouth). Each is given the colour of the nearest triangle beside
// it on the figure that does have room: its corners go to that triangle's
// middle on the atlas. Only a vertex no good triangle uses is moved, so
// nothing that was right is pulled out of shape. Pure: plain arrays in, the
// UVs changed in place.
//
//   mendCollapsed(index, uv, position, size, { least }) → how many triangles
//       it mended. `size`: the atlas's texels across; a triangle with less
//       than `least` of a texel on it (and some area on the figure) is mended.

const area2 = (ax, ay, bx, by, cx, cy) => Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;

function area3(p, a, b, c) {
  const e = [0, 1, 2].map((k) => p[b * 3 + k] - p[a * 3 + k]);
  const f = [0, 1, 2].map((k) => p[c * 3 + k] - p[a * 3 + k]);
  return Math.hypot(e[1] * f[2] - e[2] * f[1], e[2] * f[0] - e[0] * f[2], e[0] * f[1] - e[1] * f[0]) / 2;
}

export function mendCollapsed(index, uv, position, size, { least = 0.01 } = {}) {
  const tris = index.length / 3;
  // the triangles with no room, and those that show nothing anyway
  const collapsed = new Uint8Array(tris);
  let any = false;
  for (let t = 0; t < tris; t++) {
    const [a, b, c] = [index[t * 3], index[t * 3 + 1], index[t * 3 + 2]];
    const texels = area2(uv[a * 2], uv[a * 2 + 1], uv[b * 2], uv[b * 2 + 1], uv[c * 2], uv[c * 2 + 1]) * size * size;
    if (texels < least && area3(position, a, b, c) > 1e-12) collapsed[t] = any = 1;
  }
  if (!any) return 0;
  // the triangles at each place on the figure (a chart's vertices are its
  // own, so its neighbours across a seam are found by where they are)
  const place = (v) => `${position[v * 3]},${position[v * 3 + 1]},${position[v * 3 + 2]}`;
  const at = new Map();
  for (let t = 0; t < tris; t++)
    for (let c = 0; c < 3; c++) {
      const k = place(index[t * 3 + c]);
      if (!at.has(k)) at.set(k, []);
      at.get(k).push(t);
    }
  // a vertex may move only if every triangle using it has no room
  const used = new Map(); // vertex -> whether a good triangle uses it
  for (let t = 0; t < tris; t++) for (let c = 0; c < 3; c++) used.set(index[t * 3 + c], (used.get(index[t * 3 + c]) ?? false) || !collapsed[t]);
  const places = (t) => [0, 1, 2].map((c) => place(index[t * 3 + c]));
  let mended = 0;
  for (let t = 0; t < tris; t++) {
    if (!collapsed[t]) continue;
    // outward from it, a ring of neighbours at a time, to the nearest good
    // one (of a ring, the one sharing most of its corners with the last)
    const seen = new Set([t]);
    let ring = [t];
    let donor = -1;
    for (let step = 0; step < 16 && donor < 0 && ring.length; step++) {
      const next = new Map(); // triangle -> corners shared with the ring
      for (const r of ring)
        for (const k of places(r))
          for (const n of at.get(k))
            if (!seen.has(n)) next.set(n, (next.get(n) ?? 0) + 1);
      let most = 0;
      for (const [n, shared] of next) if (!collapsed[n] && shared > most) [donor, most] = [n, shared];
      for (const n of next.keys()) seen.add(n);
      ring = [...next.keys()];
    }
    if (donor < 0) continue;
    const [a, b, c] = [index[donor * 3], index[donor * 3 + 1], index[donor * 3 + 2]];
    const mid = [(uv[a * 2] + uv[b * 2] + uv[c * 2]) / 3, (uv[a * 2 + 1] + uv[b * 2 + 1] + uv[c * 2 + 1]) / 3];
    let moved = false;
    for (let k = 0; k < 3; k++) {
      const v = index[t * 3 + k];
      if (used.get(v)) continue;
      uv[v * 2] = mid[0];
      uv[v * 2 + 1] = mid[1];
      moved = true;
    }
    if (moved) mended++;
  }
  return mended;
}
