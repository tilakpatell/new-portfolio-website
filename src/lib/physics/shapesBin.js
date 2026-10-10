// A level pack's shapes bin (physics/<mesh>.bin): one mesh's Havok shapes,
// in its own frame, written by the build (scripts/bf2017-physics.mjs) and
// read by the page (havok.js). 'BFPH', version 1, the count; then per shape
// u8 kind (hull, mesh, capsule, sphere), part, material, root, u32 points,
// u32 indices, and its numbers: a hull's points, a mesh's points and
// indices, a capsule's two ends and radius, a sphere's centre and radius.
// Every block a multiple of four bytes, so the reader's arrays are views
// into the one buffer. No three.js, no DOM.
//
//   packShapes(shapes) → ArrayBuffer
//   readShapes(buffer) → [{ kind, part, material, root, points?, indices?,
//     a?, b?, centre?, radius? }]

const KINDS = ['hull', 'mesh', 'capsule', 'sphere'];
const MAGIC = 0x48504642; // 'BFPH', little-endian
const VERSION = 1;

const byte = (v, what) => {
  if (!(Number.isInteger(v) && v >= 0 && v < 256)) throw new Error(`shapes bin: a shape's ${what} ${v} won't fit a byte`);
  return v;
};

export function packShapes(shapes) {
  let size = 12;
  for (const s of shapes) {
    size += 12;
    if (s.kind === 'hull') size += s.points.length * 4;
    else if (s.kind === 'mesh') size += s.points.length * 4 + s.indices.length * 4;
    else if (s.kind === 'capsule') size += 7 * 4;
    else if (s.kind === 'sphere') size += 4 * 4;
    else throw new Error(`shapes bin: no kind '${s.kind}'`);
  }
  const buf = new ArrayBuffer(size);
  const dv = new DataView(buf);
  dv.setUint32(0, MAGIC, true);
  dv.setUint32(4, VERSION, true);
  dv.setUint32(8, shapes.length, true);
  let o = 12;
  const floats = (list) => {
    for (const v of list) {
      dv.setFloat32(o, v, true);
      o += 4;
    }
  };
  for (const s of shapes) {
    dv.setUint8(o, KINDS.indexOf(s.kind));
    dv.setUint8(o + 1, byte(s.part ?? 0, 'part'));
    dv.setUint8(o + 2, byte(s.material ?? 0, 'material'));
    dv.setUint8(o + 3, byte(s.root ?? 0, 'root'));
    const n = s.kind === 'hull' || s.kind === 'mesh' ? s.points.length / 3 : 0;
    dv.setUint32(o + 4, n, true);
    dv.setUint32(o + 8, s.kind === 'mesh' ? s.indices.length : 0, true);
    o += 12;
    if (s.kind === 'hull') floats(s.points);
    else if (s.kind === 'mesh') {
      floats(s.points);
      for (const v of s.indices) {
        dv.setUint32(o, v, true);
        o += 4;
      }
    } else if (s.kind === 'capsule') floats([...s.a, ...s.b, s.radius]);
    else floats([...s.centre, s.radius]);
  }
  return buf;
}

// (views into the buffer where they line up, so a mesh's arrays are shared
// by everything that reads them)
export function readShapes(buffer) {
  const buf = buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const dv = new DataView(buf);
  if (buf.byteLength < 12 || dv.getUint32(0, true) !== MAGIC) throw new Error('shapes bin: not a shapes bin');
  const version = dv.getUint32(4, true);
  if (version !== VERSION) throw new Error(`shapes bin: shapes bin version ${version}, not ${VERSION}`);
  const count = dv.getUint32(8, true);
  const shapes = [];
  let o = 12;
  for (let i = 0; i < count; i++) {
    const kind = KINDS[dv.getUint8(o)];
    const s = { kind, part: dv.getUint8(o + 1), material: dv.getUint8(o + 2), root: dv.getUint8(o + 3) };
    const n = dv.getUint32(o + 4, true);
    const m = dv.getUint32(o + 8, true);
    o += 12;
    if (kind === 'hull' || kind === 'mesh') {
      s.points = new Float32Array(buf, o, n * 3);
      o += n * 12;
      if (kind === 'mesh') {
        s.indices = new Uint32Array(buf, o, m);
        o += m * 4;
      }
    } else if (kind === 'capsule') {
      const f = new Float32Array(buf, o, 7);
      s.a = [f[0], f[1], f[2]];
      s.b = [f[3], f[4], f[5]];
      s.radius = f[6];
      o += 28;
    } else if (kind === 'sphere') {
      const f = new Float32Array(buf, o, 4);
      s.centre = [f[0], f[1], f[2]];
      s.radius = f[3];
      o += 16;
    } else throw new Error(`shapes bin: shape ${i} has an unknown kind`);
    shapes.push(s);
  }
  return shapes;
}
