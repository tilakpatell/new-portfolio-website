// A level pack's instances (lane L: docs/superpowers/specs/2026-10-10-bf2017-
// levels-lighting-sabers-design.md, "How a level draws"): each a 32-byte
// record as the game's map packs it, so a cell's bin is the map's own bytes
// rebased: position Float32 × 3, quaternion Int16 × 4 (xyzw, over 32767),
// scale Float32 × 3, little-endian. Pure: the pack builder (scripts/) and the
// scene (galaxy/surface/level/) read and write the same records.
//
//   readInstances(bin, first, count) → { count, position, quaternion, scale } (Float32Arrays)
//   writeInstances({ count, position, quaternion, scale }) → ArrayBuffer
//   isMirrored(scale, i), cellOf(x, z, cell), cellKey(cx, cz)

export const INSTANCE_BYTES = 32;
export const CELL = 128;
const Q = 32767;

export function readInstances(bin, first = 0, count = null) {
  const buf = bin instanceof ArrayBuffer ? bin : bin.buffer;
  const base = bin instanceof ArrayBuffer ? 0 : bin.byteOffset;
  const n = count ?? Math.floor((bin.byteLength - first * INSTANCE_BYTES) / INSTANCE_BYTES);
  const v = new DataView(buf, base + first * INSTANCE_BYTES, n * INSTANCE_BYTES);
  const position = new Float32Array(n * 3);
  const quaternion = new Float32Array(n * 4);
  const scale = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const o = i * INSTANCE_BYTES;
    for (let k = 0; k < 3; k++) position[i * 3 + k] = v.getFloat32(o + k * 4, true);
    for (let k = 0; k < 4; k++) quaternion[i * 4 + k] = v.getInt16(o + 12 + k * 2, true) / Q;
    for (let k = 0; k < 3; k++) scale[i * 3 + k] = v.getFloat32(o + 20 + k * 4, true);
  }
  return { count: n, position, quaternion, scale };
}

export function writeInstances({ count, position, quaternion, scale }) {
  const out = new ArrayBuffer(count * INSTANCE_BYTES);
  const v = new DataView(out);
  for (let i = 0; i < count; i++) {
    const o = i * INSTANCE_BYTES;
    for (let k = 0; k < 3; k++) v.setFloat32(o + k * 4, position[i * 3 + k], true);
    for (let k = 0; k < 4; k++) v.setInt16(o + 12 + k * 2, Math.max(-Q, Math.min(Q, Math.round(quaternion[i * 4 + k] * Q))), true);
    for (let k = 0; k < 3; k++) v.setFloat32(o + 20 + k * 4, scale[i * 3 + k], true);
  }
  return out;
}

// An odd number of negative axes turns the mesh inside out (its matrix's
// determinant is negative), so it draws with its faces' other side.
export const isMirrored = (scale, i) => scale[i * 3] * scale[i * 3 + 1] * scale[i * 3 + 2] < 0;

export const cellOf = (x, z, cell = CELL) => [Math.floor(x / cell), Math.floor(z / cell)];
export const cellKey = (cx, cz) => `${cx},${cz}`;
