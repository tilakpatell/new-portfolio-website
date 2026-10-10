// The game's baked far shadow: one texture over the whole level, sampled
// beyond the live shadow map's reach. Its world bounds are measured once
// against the heightmap (its file does not carry them); outside them, and
// with no mask at all, the ground is in full sun.

// bounds: { minX, minZ, maxX, maxZ } in metres; [u, v] in 0…1, or null.
export function maskUv(x, z, bounds) {
  const u = (x - bounds.minX) / (bounds.maxX - bounds.minX);
  const v = (z - bounds.minZ) / (bounds.maxZ - bounds.minZ);
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  return [u, v];
}

// How much sun reaches (x, z): sample(u, v) gives the mask's 0…1.
export function shadowAt(x, z, bounds, sample) {
  if (!bounds || !sample) return 1;
  const uv = maskUv(x, z, bounds);
  return uv ? sample(uv[0], uv[1]) : 1;
}
