// The planet map's raster: a square of ground as MAP_N × MAP_N cells, each
// the biome that weighs most at its centre and the height there, for the
// map to paint (components/expanse/flight/map.js). Drawn from the field, not
// stored: the same square is the same raster every time.
//
// A raster is a 2 km square (a depth-3 quadtree square, MAP_DEPTH), 64 m a
// cell. It is its own job in the terrain worker, not a rider on a leaf's
// answer, because the depth-3 square under the ship is split into finer
// leaves and never asked for itself (quadtree.js's leaves only), and the map
// is wanted most just there.
//
// Pure: runs in Node and in the flight's terrain worker.
//
//   MAP_N, MAP_DEPTH; rasterKey(ix, iz) → 'map:ix:iz'
//   rasterFor(field, leaf, n = MAP_N) → { biome: Uint8Array, height: Float32Array }

export const MAP_N = 32;
export const MAP_DEPTH = 3;
export const rasterKey = (ix, iz) => `map:${ix}:${iz}`;

export function rasterFor(field, leaf, n = MAP_N) {
  const biome = new Uint8Array(n * n);
  const height = new Float32Array(n * n);
  const step = leaf.size / n;
  for (let iz = 0; iz < n; iz++)
    for (let ix = 0; ix < n; ix++) {
      const x = leaf.x0 + (ix + 0.5) * step, z = leaf.z0 + (iz + 0.5) * step;
      biome[iz * n + ix] = field.biomeAt(x, z);
      height[iz * n + ix] = field.heightAt(x, z);
    }
  return { biome, height };
}
