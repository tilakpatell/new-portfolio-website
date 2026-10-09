// A leaf of the flight's quadtree as data: vertices, normals, triangles, the
// heights the ship collides with and the clutter on it, in typed arrays a
// worker can hand over without a copy. The page only wraps them.
//
// Heights are sampled on a padded grid, (n + 2)² points a `step` apart with
// the leaf's own n² inside, so a normal at the edge reads its neighbour's
// ground by central differences and two leaves agree on the light where they
// meet (the spec's decision 5). A skirt hangs SKIRT metres under the edge
// ring, so where a coarser leaf meets a finer one the gap between their
// edges shows skirt, not sky.
//
// Clutter (rows [x, y, z, yaw, scale, kind], world metres; scale times the
// kind's `size` in the planet's table) is placed on the
// two finest depths only. A kind belongs to one depth (its `depth`, the
// finest when left out): its placements are made for the square of that
// depth and a finer leaf keeps those that fall inside it, so a spire stays
// where it stood when its leaf splits under the ship.
//
// Pure: runs in Node and in the flight's terrain worker.
//
//   makeLeaf(spec, leaf, { n, field, tier }) → { key, n, step, positions,
//     normals, indices, heights, clutter }

import { seeded } from '../../seeded.js';
import { MAX_DEPTH, leafOf } from './quadtree.js';
import { heightOn } from './sample.js';

export const SKIRT = 12;
export const CLUTTER_DEPTHS = [5, 6];
// every kind a planet's clutter may name; a row carries the kind's index here
// (the page builds each kind's shape: expanse/flight/ground.js)
export const CLUTTER_KINDS = ['rock', 'spire', 'debris', 'trunk', 'hive', 'crystal', 'block'];
export const DENSITY = { low: 0.4, mid: 0.7, high: 1, ultra: 1 };
const STEEP = 0.7; // metres a metre: nothing stands on a slope steeper

export function makeLeaf(spec, leaf, { n = 33, field, tier = 'mid' }) {
  const step = leaf.size / (n - 1);
  const pad = n + 2;
  const h = new Float32Array(pad * pad);
  for (let iz = 0; iz < pad; iz++) for (let ix = 0; ix < pad; ix++) h[iz * pad + ix] = field.heightAt(leaf.x0 + (ix - 1) * step, leaf.z0 + (iz - 1) * step);

  // the grid, and a skirt vertex under each of the 4n − 4 edge vertices
  const ringLength = 4 * n - 4;
  const verts = n * n + ringLength;
  const positions = new Float32Array(verts * 3);
  const normals = new Float32Array(verts * 3);
  const heights = new Float32Array(n * n);
  let v = 0;
  const put = (x, y, z, nx, ny, nz) => {
    positions[v * 3] = x;
    positions[v * 3 + 1] = y;
    positions[v * 3 + 2] = z;
    normals[v * 3] = nx;
    normals[v * 3 + 1] = ny;
    normals[v * 3 + 2] = nz;
    v++;
  };
  for (let iz = 0; iz < n; iz++)
    for (let ix = 0; ix < n; ix++) {
      const i = (iz + 1) * pad + (ix + 1);
      const y = h[i];
      heights[iz * n + ix] = y;
      // central differences on the padded grid: the slope in metres a metre
      const dx = (h[i + 1] - h[i - 1]) / (2 * step), dz = (h[i + pad] - h[i - pad]) / (2 * step);
      const len = Math.hypot(dx, 1, dz);
      put(ix * step, y, iz * step, -dx / len, 1 / len, -dz / len);
    }
  // the skirt: the edge ring again, SKIRT lower; its normals copy the edge's,
  // so the band that shows in a crack is lit as the ground above it
  const ring = [];
  for (let ix = 0; ix < n; ix++) ring.push([ix, 0]);
  for (let iz = 1; iz < n; iz++) ring.push([n - 1, iz]);
  for (let ix = n - 2; ix >= 0; ix--) ring.push([ix, n - 1]);
  for (let iz = n - 2; iz >= 1; iz--) ring.push([0, iz]);
  const skirtAt = new Int32Array(n * n);
  for (const [ix, iz] of ring) {
    const top = iz * n + ix;
    skirtAt[top] = v;
    put(ix * step, heights[top] - SKIRT, iz * step, normals[top * 3], normals[top * 3 + 1], normals[top * 3 + 2]);
  }

  const indices = new Uint32Array((n - 1) * (n - 1) * 6 + ringLength * 6);
  let t = 0;
  for (let iz = 0; iz < n - 1; iz++)
    for (let ix = 0; ix < n - 1; ix++) {
      const a = iz * n + ix, b = a + 1, c = a + n, d = c + 1;
      // split (ix + 1, iz)–(ix, iz + 1), as cell.js and the galaxy's ground
      // do, and as sample.js reads it
      indices[t++] = a; indices[t++] = c; indices[t++] = b;
      indices[t++] = b; indices[t++] = c; indices[t++] = d;
    }
  for (let k = 0; k < ring.length; k++) {
    const [ix, iz] = ring[k], [jx, jz] = ring[(k + 1) % ring.length];
    const a = iz * n + ix, b = jz * n + jx, sa = skirtAt[a], sb = skirtAt[b];
    // wound to face out of the leaf: a crack is seen from the neighbour's
    // side, and the ground's material draws front faces only
    indices[t++] = a; indices[t++] = b; indices[t++] = sa;
    indices[t++] = b; indices[t++] = sb; indices[t++] = sa;
  }
  return { key: leaf.key, n, step, positions, normals, indices, heights, clutter: clutterFor(spec, leaf, heights, n, field, tier) };
}

// FNV-1a over the text, for a seed per square and kind
const hashOf = (text) => {
  let x = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) x = Math.imul(x ^ text.charCodeAt(i), 0x01000193);
  return x | 0;
};

function clutterFor(spec, leaf, heights, n, field, tier) {
  if (!CLUTTER_DEPTHS.includes(leaf.d) || !spec.clutter?.length) return new Float32Array(0);
  const rows = [];
  const pois = spec.pois ?? [];
  for (const c of spec.clutter) {
    const depth = c.depth ?? MAX_DEPTH;
    if (leaf.d < depth) continue;
    const f = 2 ** (leaf.d - depth);
    const owner = leafOf(depth, Math.floor(leaf.ix / f), Math.floor(leaf.iz / f));
    const kind = CLUTTER_KINDS.indexOf(c.kind);
    // (a kind this build doesn't know isn't placed)
    if (kind < 0) continue;
    const count = Math.round(((c.perKm2 * owner.size * owner.size) / 1e6) * (DENSITY[tier] ?? DENSITY.mid));
    const rnd = seeded(hashOf(`${spec.id}|${owner.key}|${c.kind}`));
    for (let k = 0; k < count; k++) {
      // four draws a placement whatever is kept, so one dropped doesn't move the rest
      const x = owner.x0 + rnd() * owner.size, z = owner.z0 + rnd() * owner.size;
      const yaw = rnd() * Math.PI * 2, r = rnd();
      if (x < leaf.x0 || x >= leaf.x0 + leaf.size || z < leaf.z0 || z >= leaf.z0 + leaf.size) continue;
      if (pois.some((p) => Math.hypot(x - p.at[0], z - p.at[1]) < p.r + (p.edge ?? Math.max(8, p.r * 0.6)))) continue;
      const sx = (field.heightAt(x + 1, z) - field.heightAt(x - 1, z)) / 2, sz = (field.heightAt(x, z + 1) - field.heightAt(x, z - 1)) / 2;
      if (Math.hypot(sx, sz) > STEEP) continue;
      rows.push(x, heightOn(leaf, heights, n, x, z), z, yaw, (0.7 + 0.6 * r * r) * (c.size ?? 1), kind);
    }
  }
  return new Float32Array(rows);
}
