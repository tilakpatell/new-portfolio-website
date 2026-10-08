// One 64 m cell of a planet's land, as data: the one function the world's
// worker runs. From the spec and the cell's integer coordinates alone (the
// rivers of the 3 × 3 regions round it, rivers.js), so neighbours agree on
// their shared edge without talking, and a cell is the same on every device.
//
//   heights  Float32Array(65 × 65), 1 m apart, both edges included, row-major
//            (heights[iz × 65 + ix] at x = cx × 64 + ix, z = cz × 64 + iz):
//            the field (layers.js), its river beds and banks and its lake
//            bowls carved in (nothing under the sea is carved)
//   water    Float32Array(65 × 65): the water's surface over each vertex, NaN
//            where there is none (a lake's level within 1.1 × its radius, a
//            river's within 1.2 × its width, the sea's where the ground is
//            below it)
//   mask     Uint8Array(128 × 128 × 4), texels 0.5 m, row-major from (0, 0):
//            R paving (0 here: a world's roads write it), G grass, B water
//            depth / MAX_DEPTH, A the river's flow (0…255 for 0…2π; 0 still)
//   props    [{ kind, x, y, z, yaw, scale }] in world metres, up to
//            spec.kit.perCell, by a seeded Poisson disc where the mask allows
//
// Pure: no three.js, no DOM; runs in a worker and in Node.
//
//   CELL = 64, N = 65, MASK = 128, MAX_DEPTH = 3
//   makeCell(spec, cx, cz) → { cx, cz, heights, water, mask, props }
//   cellMesh(heights, { step = 1 | 2 }) → { positions, normals, indices } in
//     the cell's frame (0…64), each quad split (ix + 1, iz)–(ix, iz + 1) (as
//     Rapier splits its heightfield, and as the galaxy's ground), a
//     2 m skirt down every edge (it hides the crack where a step-1 cell
//     meets a step-2 one)
//   heightAt(cell, lx, lz), waterAt(cell, lx, lz): read off the same
//     triangles, in the cell's frame (waterAt NaN when a corner is dry)

import { seeded } from '../seeded.js';
import { fieldAt } from './layers.js';
import { clipRivers, lakeAt, nearestRiverPoint, riversNear } from './rivers.js';

export const CELL = 64;
export const N = CELL + 1;
export const MASK = 128;
export const MAX_DEPTH = 3;
const TEXEL = CELL / MASK;
const SKIRT = 2;
const SHORE = 1.5; // no grass this near water
const BEACH = 1.5; // nor this far above the sea
const STEEP = 0.55; // nor on slopes steeper (rise over run)

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// the land's height at (x, z), carved by the rivers and lakes near it
function carved(spec, rivers, x, z) {
  let h = fieldAt(spec, x, z);
  if (h <= spec.sea) return h;
  const n = nearestRiverPoint(rivers, x, z);
  if (n) {
    const { d, level, width: w, depth } = n;
    h += (level + 0.3 - h) * smoothstep(2 * w, w, d) * 0.5;
    h = Math.min(h, level - depth * smoothstep(w, 0, d));
  }
  const k = lakeAt(rivers, x, z);
  if (k) {
    const d = Math.hypot(x - k.x, z - k.z);
    const q = d / k.r;
    const bowl = k.level - k.depth * Math.max(0.15, 1 - q * q);
    // inside the radius, down to the bowl; eased back to the land by 1.1 r
    const rim = k.level - k.depth * 0.15;
    h = Math.min(h, d <= k.r ? bowl : rim + (h - rim) * smoothstep(k.r, k.r * 1.1, d));
  }
  return h;
}

// the water's surface at (x, z) over ground at h, NaN where none; and the
// river's way there (null on still water)
function surface(spec, rivers, x, z, h, out) {
  out.level = NaN;
  out.flow = null;
  out.near = Infinity; // how far outside the water's edge (0 inside)
  const k = lakeAt(rivers, x, z);
  if (k) {
    out.level = k.level;
    out.near = 0;
  } else {
    for (const r of rivers) {
      const l = r.lake;
      if (l) out.near = Math.min(out.near, Math.max(0, Math.hypot(x - l.x, z - l.z) - l.r * 1.1));
    }
  }
  const n = nearestRiverPoint(rivers, x, z);
  if (n) {
    const edge = n.width * 1.2;
    if (n.d <= edge) {
      if (Number.isNaN(out.level)) {
        out.level = n.level;
        out.flow = n.tangent;
      }
      out.near = 0;
    } else out.near = Math.min(out.near, n.d - edge);
  }
  if (h < spec.sea) {
    out.level = Number.isNaN(out.level) ? spec.sea : Math.max(out.level, spec.sea);
    out.near = 0;
  }
  return out;
}

export function heightAt(cell, lx, lz) {
  return triangle(cell.heights, lx, lz);
}

export function waterAt(cell, lx, lz) {
  return triangle(cell.water, lx, lz);
}

function triangle(a, lx, lz) {
  const x = Math.min(CELL, Math.max(0, lx));
  const z = Math.min(CELL, Math.max(0, lz));
  const i = Math.min(CELL - 1, Math.floor(x));
  const j = Math.min(CELL - 1, Math.floor(z));
  const fx = x - i;
  const fz = z - j;
  const h00 = a[j * N + i];
  const h10 = a[j * N + i + 1];
  const h01 = a[(j + 1) * N + i];
  // (a corner that weighs nothing is left out, so a NaN there doesn't spread)
  if (fx + fz <= 1) return h00 + (fx ? (h10 - h00) * fx : 0) + (fz ? (h01 - h00) * fz : 0);
  const h11 = a[(j + 1) * N + i + 1];
  return h11 + (fx < 1 ? (h01 - h11) * (1 - fx) : 0) + (fz < 1 ? (h10 - h11) * (1 - fz) : 0);
}

const mix = (a, b, c) => {
  let h = Math.imul(a | 0, 0x2c1b3c6d) ^ Math.imul(b | 0, 0x297a2d39) ^ Math.imul(c | 0, 0x7feb352d);
  h = Math.imul(h ^ (h >>> 16), 0x846ca68b);
  return (h ^ (h >>> 15)) | 0;
};

export function makeCell(spec, cx, cz) {
  const x0 = cx * CELL;
  const z0 = cz * CELL;
  const rivers = clipRivers(riversNear(spec, cx, cz), x0, z0, x0 + CELL, z0 + CELL, SHORE + 1);
  const heights = new Float32Array(N * N);
  const water = new Float32Array(N * N);
  const s = { level: NaN, flow: null, near: Infinity };
  for (let iz = 0; iz < N; iz++)
    for (let ix = 0; ix < N; ix++) {
      const k = iz * N + ix;
      heights[k] = carved(spec, rivers, x0 + ix, z0 + iz);
      water[k] = surface(spec, rivers, x0 + ix, z0 + iz, heights[k], s).level;
    }
  const cell = { cx, cz, heights, water, mask: new Uint8Array(MASK * MASK * 4), props: [] };
  const mask = cell.mask;
  for (let j = 0; j < MASK; j++)
    for (let i = 0; i < MASK; i++) {
      const lx = (i + 0.5) * TEXEL;
      const lz = (j + 0.5) * TEXEL;
      const h = heightAt(cell, lx, lz);
      const dx = heightAt(cell, lx + TEXEL, lz) - heightAt(cell, lx - TEXEL, lz);
      const dz = heightAt(cell, lx, lz + TEXEL) - heightAt(cell, lx, lz - TEXEL);
      const slope = Math.hypot(dx, dz) / (2 * TEXEL);
      surface(spec, rivers, x0 + lx, z0 + lz, h, s);
      const t = (j * MASK + i) * 4;
      // grass: on gentle dry ground, off the shore, the beach and the sea floor
      let g = 1 - smoothstep(STEEP - 0.2, STEEP, slope);
      g *= smoothstep(0, SHORE, s.near) * (s.near >= SHORE ? 1 : 0);
      if (h < spec.sea + BEACH) g = 0;
      // (and none in a texel whose nearest vertex stands in water)
      if (!Number.isNaN(water[Math.round(lz) * N + Math.round(lx)])) g = 0;
      mask[t + 1] = Math.round(g * 255);
      // (the depth off the water's own triangles, so it is where the surface is drawn)
      const w = waterAt(cell, lx, lz);
      const depth = Number.isNaN(w) ? 0 : Math.min(1, Math.max(0, (w - h) / MAX_DEPTH));
      mask[t + 2] = Math.round(depth * 255);
      if (s.flow && depth > 0) {
        const a = Math.atan2(s.flow[1], s.flow[0]);
        mask[t + 3] = Math.round((((a + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI)) * 255) % 256;
      }
    }
  cell.props = scatter(spec, cell, x0, z0);
  return cell;
}

// the props: a seeded Poisson disc over the cell, each kind where it may stand
function scatter(spec, cell, x0, z0) {
  const { perCell, kinds } = spec.kit;
  const out = [];
  if (!perCell || !kinds.length) return out;
  const rand = seeded(mix(spec.seed, cell.cx, cell.cz));
  const spacing = Math.max(2, CELL / Math.sqrt(perCell * 2));
  let crates = 0;
  for (let tries = 0; out.length < perCell && tries < perCell * 4; tries++) {
    const lx = rand() * CELL;
    const lz = rand() * CELL;
    const kind = kinds[Math.floor(rand() * kinds.length)];
    const yaw = rand() * Math.PI * 2;
    const r = rand();
    if (out.some((p) => Math.hypot(p.x - x0 - lx, p.z - z0 - lz) < spacing)) continue;
    const t = (Math.min(MASK - 1, Math.floor(lz / TEXEL)) * MASK + Math.min(MASK - 1, Math.floor(lx / TEXEL))) * 4;
    const grass = cell.mask[t + 1] / 255;
    const wet = cell.mask[t + 2] > 0 || !Number.isNaN(waterAt(cell, lx, lz));
    const y = heightAt(cell, lx, lz);
    if (wet || y <= spec.sea) continue;
    let scale = 1;
    if (kind === 'tree') {
      if (grass <= 0.5) continue;
      scale = 0.8 + 0.5 * r;
    } else if (kind === 'rock') {
      // on slopes and banks: where the grass gives out
      if (grass > 0.6 && r > 0.3) continue;
      scale = 0.5 + r;
    } else if (kind === 'crate') {
      if (crates >= 3 || grass < 0.9) continue;
      crates++;
    }
    out.push({ kind, x: x0 + lx, y, z: z0 + lz, yaw, scale });
  }
  return out;
}

export function cellMesh(heights, { step = 1 } = {}) {
  const q = CELL / step;
  const side = q + 1;
  const top = side * side;
  const verts = top + 4 * side;
  const positions = new Float32Array(verts * 3);
  const normals = new Float32Array(verts * 3);
  const indices = new Uint32Array(q * q * 6 + 4 * q * 6);
  const h = (ix, iz) => heights[Math.min(CELL, Math.max(0, iz)) * N + Math.min(CELL, Math.max(0, ix))];
  const normal = (ix, iz, out, o) => {
    // central differences on the 1 m heights (one-sided at the edges)
    const l = ix > 0 ? ix - 1 : ix;
    const r = ix < CELL ? ix + 1 : ix;
    const d = iz > 0 ? iz - 1 : iz;
    const u = iz < CELL ? iz + 1 : iz;
    const gx = (h(r, iz) - h(l, iz)) / (r - l);
    const gz = (h(ix, u) - h(ix, d)) / (u - d);
    const len = Math.hypot(gx, 1, gz);
    out[o] = -gx / len;
    out[o + 1] = 1 / len;
    out[o + 2] = -gz / len;
  };
  for (let j = 0; j < side; j++)
    for (let i = 0; i < side; i++) {
      const v = (j * side + i) * 3;
      positions[v] = i * step;
      positions[v + 1] = h(i * step, j * step);
      positions[v + 2] = j * step;
      normal(i * step, j * step, normals, v);
    }
  let k = 0;
  for (let j = 0; j < q; j++)
    for (let i = 0; i < q; i++) {
      const a = j * side + i;
      const b = a + 1;
      const c = a + side;
      const d = c + 1;
      indices[k++] = a;
      indices[k++] = c;
      indices[k++] = b;
      indices[k++] = b;
      indices[k++] = c;
      indices[k++] = d;
    }
  // the skirts: each edge's vertices again, SKIRT metres lower, walled down
  // from the edge (wound to face out)
  const edges = [
    (t) => t, // z = 0, along +x
    (t) => t * side + q, // x = 64, along +z
    (t) => q * side + (q - t), // z = 64, along −x
    (t) => (q - t) * side, // x = 0, along −z
  ];
  let v = top;
  for (const at of edges) {
    const first = v;
    for (let t = 0; t < side; t++, v++) {
      const s = at(t);
      positions[v * 3] = positions[s * 3];
      positions[v * 3 + 1] = positions[s * 3 + 1] - SKIRT;
      positions[v * 3 + 2] = positions[s * 3 + 2];
      normals[v * 3] = normals[s * 3];
      normals[v * 3 + 1] = normals[s * 3 + 1];
      normals[v * 3 + 2] = normals[s * 3 + 2];
    }
    for (let t = 0; t < q; t++) {
      const a = at(t);
      const b = at(t + 1);
      const c = first + t;
      const d = first + t + 1;
      indices[k++] = a;
      indices[k++] = b;
      indices[k++] = d;
      indices[k++] = a;
      indices[k++] = d;
      indices[k++] = c;
    }
  }
  return { positions, normals, indices };
}
