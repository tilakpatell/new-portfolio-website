// The ground's height where it is drawn: a leaf's grid read on the same two
// triangles a quad is split into (leafMesh.js: the diagonal from (ix + 1, iz)
// to (ix, iz + 1)), so what the ship hits is what it sees, not a smoother
// bilinear surface a metre off it on a ridge.
//
// Pure.
//
//   heightOn(leaf, heights, n, x, z) → metres (world x, z), NaN off the leaf

export function heightOn(leaf, heights, n, x, z) {
  const step = leaf.size / (n - 1);
  const u = (x - leaf.x0) / step, v = (z - leaf.z0) / step;
  if (!(u >= 0 && v >= 0 && u <= n - 1 && v <= n - 1)) return NaN;
  const ix = Math.min(n - 2, Math.floor(u)), iz = Math.min(n - 2, Math.floor(v));
  const fu = u - ix, fv = v - iz;
  const a = heights[iz * n + ix], b = heights[iz * n + ix + 1], c = heights[(iz + 1) * n + ix], d = heights[(iz + 1) * n + ix + 1];
  if (fu + fv <= 1) return a + (b - a) * fu + (c - a) * fv;
  return d + (c - d) * (1 - fu) + (b - d) * (1 - fv);
}
