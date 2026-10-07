// Minecraft, the mesher: one 16-high section of a chunk into the quads the
// scene draws, in three passes (opaque blocks; cutouts, whose texels are
// either there or not: leaves, glass, plants; and water, see-through).
// It runs in the worker, so what comes out is typed arrays, no three.js.
//
// A face is drawn only where it can be seen: toward air, a cutout, a liquid
// or the open edge of a chunk that isn't loaded yet (drawn, so the edge of
// the world isn't a hole; the face goes when the neighbour arrives and the
// section is meshed again). Each corner carries the game's "smooth
// lighting" ambient occlusion: of the three blocks round the corner on the
// face's side, two edges both solid make it darkest (0), otherwise it's
// 3 − how many are solid. The quad is split along the diagonal that keeps
// the shading from creasing, as the game does.
//
// A vertex is six 16-bit numbers (12 bytes):
//   x, y, z     in sixteenths of a block within the section (0–256), so a
//               lowered water surface or a plant's inset sits exactly
//   layer       the texture's layer in the block texture array
//   face | ao << 3 | tint << 5 | light << 8
//               face 0–5 top, bottom, north (−z), south (+z), east (+x),
//               west (−x), 6 a plant's cross; ao 0–3; tint, rules/blocks'
//               TINTS; light, the cell's sky << 4 | block
//   u | v << 5  the texel corner, in sixteenths (v down the image)
// Four vertices a quad, wound outward; the scene's one shared index buffer
// draws each as (0 1 2) (0 2 3).

import { BLOCKS, TINTS } from './blocks.js';
import { index } from './chunk.js';

export const FACE = { top: 0, bottom: 1, north: 2, south: 3, east: 4, west: 5, cross: 6 };
export const STRIDE = 6;
const NAMES = ['top', 'bottom', 'north', 'south', 'east', 'west'];

// the cube's faces: their outward step, their corners (unit cube, wound
// outward) and each corner's texel (u right, v down the image)
const CUBE = [
  { d: [0, 1, 0], c: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], uv: [[0, 0], [0, 1], [1, 1], [1, 0]] },
  { d: [0, -1, 0], c: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]], uv: [[0, 1], [0, 0], [1, 0], [1, 1]] },
  { d: [0, 0, -1], c: [[1, 1, 0], [1, 0, 0], [0, 0, 0], [0, 1, 0]], uv: [[0, 0], [0, 1], [1, 1], [1, 0]] },
  { d: [0, 0, 1], c: [[0, 1, 1], [0, 0, 1], [1, 0, 1], [1, 1, 1]], uv: [[0, 0], [0, 1], [1, 1], [1, 0]] },
  { d: [1, 0, 0], c: [[1, 1, 1], [1, 0, 1], [1, 0, 0], [1, 1, 0]], uv: [[0, 0], [0, 1], [1, 1], [1, 0]] },
  { d: [-1, 0, 0], c: [[0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]], uv: [[0, 0], [0, 1], [1, 1], [1, 0]] },
];
// the plant's two planes, the game's cross model: 2.9 to 13.1 sixteenths across
const CROSS = [
  [[3, 16, 3], [3, 0, 3], [13, 0, 13], [13, 16, 13]],
  [[3, 16, 13], [3, 0, 13], [13, 0, 3], [13, 16, 3]],
];
const CROSS_UV = [[0, 0], [0, 16], [16, 16], [16, 0]];

// per id, what the mesher asks of a block
const N = BLOCKS.length;
const OPAQUE = new Uint8Array(256);
const KIND = new Uint8Array(256); // 0 none, 1 cube, 2 cutout, 3 cross, 4 liquid
const PASS = new Uint8Array(256); // 0 opaque, 1 cutout, 2 water
const CULL_SELF = new Uint8Array(256);
const TINT = new Uint8Array(256);
const TOP_ONLY = new Uint8Array(256);
for (let i = 0; i < N; i++) {
  const b = BLOCKS[i];
  OPAQUE[i] = b.opaque ? 1 : 0;
  KIND[i] = b.shape === 'none' ? 0 : b.shape === 'cross' ? 3 : b.shape === 'liquid' ? 4 : b.shape === 'cube' ? 1 : 2;
  PASS[i] = b.shape === 'liquid' ? (b.name === 'water' ? 2 : 0) : b.shape === 'cube' && b.opaque ? 0 : 1;
  CULL_SELF[i] = b.cullSelf ? 1 : 0;
  TINT[i] = Math.max(0, TINTS.indexOf(b.tint));
  TOP_ONLY[i] = b.tintTopOnly ? 1 : 0;
}

// A growing list of vertices for one pass.
function buffer() {
  let data = new Uint16Array(STRIDE * 1024);
  let count = 0;
  return {
    push(x, y, z, layer, word, uv) {
      if ((count + 1) * STRIDE > data.length) {
        const more = new Uint16Array(data.length * 2);
        more.set(data);
        data = more;
      }
      const o = count * STRIDE;
      data[o] = x;
      data[o + 1] = y;
      data[o + 2] = z;
      data[o + 3] = layer;
      data[o + 4] = word;
      data[o + 5] = uv;
      count++;
    },
    done: () => (count ? { data: data.slice(0, count * STRIDE), count } : null),
  };
}

// The section and a one-block border from the chunks round it, as one
// 18 × 18 × 18 grid of ids and light, so every look-up is an array read.
const P = 18;
const pad = (x, y, z) => ((y + 1) * P + (z + 1)) * P + (x + 1);
function gather(chunk, sectionY, nb) {
  const ids = new Uint8Array(P * P * P);
  const light = new Uint8Array(P * P * P);
  const y0 = sectionY * 16;
  const full = 0xf0;
  const pick = (x, z) => {
    if (x >= 0 && x < 16 && z >= 0 && z < 16) return [chunk, x, z];
    const cx = x < 0 ? 'n' : x > 15 ? 'p' : '';
    const cz = z < 0 ? 'n' : z > 15 ? 'p' : '';
    const c = cx && cz ? nb[`${cx}x${cz}z`] : cx ? nb[`${cx}x`] : nb[`${cz}z`];
    return [c ?? null, (x + 16) & 15, (z + 16) & 15];
  };
  for (let z = -1; z <= 16; z++)
    for (let x = -1; x <= 16; x++) {
      const [c, lx, lz] = pick(x, z);
      for (let y = -1; y <= 16; y++) {
        const wy = y0 + y;
        const p = pad(x, y, z);
        if (!c || wy < 0 || wy > 255) {
          light[p] = full;
          continue;
        }
        const i = index(lx, wy, lz);
        ids[p] = c.ids[i];
        light[p] = c.lit ? c.light[i] : full;
      }
    }
  return { ids, light };
}

export function meshSection(chunk, sectionY, nb, { textures }) {
  const { ids, light } = gather(chunk, sectionY, nb ?? {});
  const out = [buffer(), buffer(), buffer()];
  const layerOf = (name) => textures.get(name) ?? 0;
  const solidAt = (x, y, z) => OPAQUE[ids[pad(x, y, z)]];
  const y0 = sectionY * 16;
  let any = false;
  for (let y = 0; y < 16; y++) {
    const base = index(0, y0 + y, 0);
    for (let z = 0; z < 16; z++)
      for (let x = 0; x < 16; x++) {
        const id = chunk.ids[base + z * 16 + x];
        if (!id) continue;
        any = true;
        const kind = KIND[id];
        const b = BLOCKS[id];
        const buf = out[PASS[id]];
        if (kind === 3) {
          const word = FACE.cross | (3 << 3) | (TINT[id] << 5) | (light[pad(x, y, z)] << 8);
          const layer = layerOf(b.faces.north);
          for (const quad of CROSS)
            for (let k = 0; k < 4; k++) buf.push(x * 16 + quad[k][0], y * 16 + quad[k][1], z * 16 + quad[k][2], layer, word, CROSS_UV[k][0] | (CROSS_UV[k][1] << 5));
          continue;
        }
        // a liquid's surface sits at 14/16 unless more of it is above
        const lowered = kind === 4 && KIND[ids[pad(x, y + 1, z)]] !== 4 ? 2 : 0;
        for (let f = 0; f < 6; f++) {
          const face = CUBE[f];
          const [dx, dy, dz] = face.d;
          const nid = ids[pad(x + dx, y + dy, z + dz)];
          if (kind === 4) {
            if (nid === id || OPAQUE[nid]) continue;
          } else if (OPAQUE[nid] || (nid === id && CULL_SELF[id] && kind === 2)) continue;
          else if (nid === id && kind === 1) continue;
          const tint = TOP_ONLY[id] && f !== FACE.top ? 0 : TINT[id];
          const lit = light[pad(x + dx, y + dy, z + dz)];
          const layer = layerOf(b.faces[NAMES[f]]);
          const ao = [0, 0, 0, 0];
          const px = [];
          for (let k = 0; k < 4; k++) {
            const [cx, cy, cz] = face.c[k];
            // the two edge neighbours and the corner, one step out from the face
            const sx = dx ? 0 : cx * 2 - 1;
            const sy = dy ? 0 : cy * 2 - 1;
            const sz = dz ? 0 : cz * 2 - 1;
            const ox = x + dx;
            const oy = y + dy;
            const oz = z + dz;
            let s1;
            let s2;
            if (dx) [s1, s2] = [solidAt(ox, oy + sy, oz), solidAt(ox, oy, oz + sz)];
            else if (dy) [s1, s2] = [solidAt(ox + sx, oy, oz), solidAt(ox, oy, oz + sz)];
            else [s1, s2] = [solidAt(ox + sx, oy, oz), solidAt(ox, oy + sy, oz)];
            const corner = solidAt(ox + sx, oy + sy, oz + sz);
            ao[k] = kind === 4 ? 3 : s1 && s2 ? 0 : 3 - (s1 + s2 + corner);
            const top = cy === 1 ? 16 - lowered : 0;
            px.push([x * 16 + cx * 16, y * 16 + top, z * 16 + cz * 16, face.uv[k][0] * 16, face.uv[k][1] * 16]);
          }
          // the side of a lowered liquid shows its texture cut, not squashed
          if (lowered && f >= 2) for (const p of px) if (p[4] === 0) p[4] = lowered;
          // split along the diagonal that doesn't crease the shading
          const start = ao[0] + ao[2] < ao[1] + ao[3] ? 1 : 0;
          for (let k = 0; k < 4; k++) {
            const j = (k + start) & 3;
            const p = px[j];
            buf.push(p[0], p[1], p[2], layer, f | (ao[j] << 3) | (tint << 5) | (lit << 8), p[3] | (p[4] << 5));
          }
        }
      }
  }
  if (!any) return { opaque: null, cutout: null, water: null };
  return { opaque: out[0].done(), cutout: out[1].done(), water: out[2].done() };
}

// One vertex, read back (for the tests, and to say what the shader reads).
export function unpack(data, i) {
  const o = i * STRIDE;
  const word = data[o + 4];
  const uv = data[o + 5];
  return { x: data[o], y: data[o + 1], z: data[o + 2], layer: data[o + 3], face: word & 7, ao: (word >> 3) & 3, tint: (word >> 5) & 7, light: word >> 8, u: uv & 31, v: uv >> 5 };
}
