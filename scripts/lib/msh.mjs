// A ZeroEngine mesh (.msh: Star Wars Battlefront II's model format, what
// the mod tools export and what the remaster's models are made as) read
// into plain data: its materials (name, colours, the texture each wears)
// and its models (name, parent, type, transform, whether it's hidden, and
// its geometry as segments: a material, positions, normals, UVs and
// triangles), with the bones that skin one listed by name. Pure; tested in
// msh.test.mjs with a file written by hand.
//
// The file is chunks, each a four-letter tag, a little-endian uint32 size and
// that many bytes, padded to four: HEDR { SHVO, MSH2 { SINF, CAMR, MATL { MATD
// { NAME, DATA, ATRB, TX0D… } … }, MODL { MTYP, MNDX, NAME, PRNT, FLGS, TRAN,
// GEOM { BBOX, SEGM { MATI, POSL, WGHT, NRML, UV0L, STRP | NDXT | NDXL } …,
// ENVL }, SWCI } … }, CL1L }. Strings are null-terminated, padded to four.
//
//   readMsh(Buffer | Uint8Array) → { materials: [{ name, diffuse: [r, g, b, a],
//     specular, texture: 'name.tga' | null, flags, renderType }], models: [{
//     name, parent: name | null, type: 'null' | 'skin' | 'cloth' | 'bone' |
//     'static' | 'shadow' | number, index, hidden, scale: [x, y, z], rotation:
//     [x, y, z, w], translation: [x, y, z], segments: [{ material, positions:
//     Float32Array, normals: Float32Array | null, uvs: Float32Array | null,
//     indices: Uint32Array }], bones: [names] }] }

const TYPES = { 0: 'null', 1: 'skin', 2: 'cloth', 3: 'bone', 4: 'static', 6: 'shadow' };
const tag = (b, at) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
const pad4 = (n) => (n + 3) & ~3;

// the chunks in a range, each { tag, start, end } of its data
function chunks(b, from, to) {
  const out = [];
  let at = from;
  while (at + 8 <= to) {
    const t = tag(b, at);
    const size = b[at + 4] | (b[at + 5] << 8) | (b[at + 6] << 16) | ((b[at + 7] << 24) >>> 0);
    const start = at + 8;
    const end = start + size;
    if (end > to) throw new Error(`msh: the ${t} chunk at ${at} runs past its parent`);
    out.push({ tag: t, start, end });
    at = start + pad4(size);
  }
  return out;
}
const one = (list, t) => list.find((c) => c.tag === t) ?? null;
const all = (list, t) => list.filter((c) => c.tag === t);

export function readMsh(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u32 = (at) => view.getUint32(at, true);
  const u16 = (at) => view.getUint16(at, true);
  const f32 = (at) => view.getFloat32(at, true);
  const str = (c) => {
    let end = c.start;
    while (end < c.end && b[end] !== 0) end++;
    return String.fromCharCode(...b.subarray(c.start, end));
  };
  const floats = (at, n) => Array.from({ length: n }, (_, i) => f32(at + i * 4));
  const top = chunks(b, 0, b.length);
  const hedr = one(top, 'HEDR');
  if (!hedr) throw new Error('msh: no HEDR chunk: not a ZeroEngine mesh');
  const inHedr = chunks(b, hedr.start, hedr.end);
  const msh2 = one(inHedr, 'MSH2');
  if (!msh2) throw new Error('msh: no MSH2 chunk');
  const inMsh = chunks(b, msh2.start, msh2.end);

  // ── materials ──
  const materials = [];
  const matl = one(inMsh, 'MATL');
  if (matl) {
    for (const matd of all(chunks(b, matl.start + 4, matl.end), 'MATD')) {
      const inMat = chunks(b, matd.start, matd.end);
      const name = one(inMat, 'NAME');
      const data = one(inMat, 'DATA');
      const atrb = one(inMat, 'ATRB');
      const tx = one(inMat, 'TX0D');
      materials.push({
        name: name ? str(name) : `material${materials.length}`,
        diffuse: data ? floats(data.start, 4) : [1, 1, 1, 1],
        specular: data ? floats(data.start + 16, 4) : [0, 0, 0, 1],
        texture: tx ? str(tx) || null : null,
        flags: atrb ? b[atrb.start] : 0,
        renderType: atrb ? b[atrb.start + 1] : 0,
      });
    }
  }

  // ── models ──
  const models = [];
  for (const modl of all(inMsh, 'MODL')) {
    const inModel = chunks(b, modl.start, modl.end);
    const mtyp = one(inModel, 'MTYP');
    const type = mtyp ? u32(mtyp.start) : 0;
    const name = one(inModel, 'NAME');
    const prnt = one(inModel, 'PRNT');
    const flgs = one(inModel, 'FLGS');
    const tran = one(inModel, 'TRAN');
    const t = tran ? floats(tran.start, 10) : [1, 1, 1, 0, 0, 0, 1, 0, 0, 0];
    const model = {
      name: name ? str(name) : `model${models.length}`,
      parent: prnt ? str(prnt) || null : null,
      type: TYPES[type] ?? type,
      index: one(inModel, 'MNDX') ? u32(one(inModel, 'MNDX').start) : models.length + 1,
      hidden: flgs ? (u32(flgs.start) & 1) === 1 : false,
      scale: t.slice(0, 3),
      rotation: t.slice(3, 7),
      translation: t.slice(7, 10),
      segments: [],
      bones: [],
    };
    const geom = one(inModel, 'GEOM');
    if (geom) {
      const inGeom = chunks(b, geom.start, geom.end);
      for (const segm of all(inGeom, 'SEGM')) {
        const inSeg = chunks(b, segm.start, segm.end);
        const mati = one(inSeg, 'MATI');
        const posl = one(inSeg, 'POSL');
        if (!posl) continue;
        const n = u32(posl.start);
        const positions = new Float32Array(n * 3);
        for (let i = 0; i < n * 3; i++) positions[i] = f32(posl.start + 4 + i * 4);
        const read3 = (c, k) => {
          if (!c) return null;
          const m = u32(c.start);
          const out = new Float32Array(m * k);
          for (let i = 0; i < m * k; i++) out[i] = f32(c.start + 4 + i * 4);
          return out;
        };
        const normals = read3(one(inSeg, 'NRML'), 3);
        const uvs = read3(one(inSeg, 'UV0L'), 2);
        // the triangles: a list of them (NDXT), polygons to fan (NDXL), or
        // strips (STRP: each strip's first two indices flagged with the high bit)
        const idx = [];
        const ndxt = one(inSeg, 'NDXT');
        const ndxl = one(inSeg, 'NDXL');
        const strp = one(inSeg, 'STRP');
        if (ndxt) {
          const m = u32(ndxt.start);
          for (let i = 0; i < m * 3; i++) idx.push(u16(ndxt.start + 4 + i * 2));
        } else if (ndxl) {
          const m = u32(ndxl.start);
          let at = ndxl.start + 4;
          for (let p = 0; p < m; p++) {
            const k = u16(at);
            at += 2;
            const poly = [];
            for (let i = 0; i < k; i++) {
              poly.push(u16(at));
              at += 2;
            }
            for (let i = 1; i + 1 < poly.length; i++) idx.push(poly[0], poly[i], poly[i + 1]);
          }
        } else if (strp) {
          const m = u32(strp.start);
          const raw = Array.from({ length: m }, (_, i) => u16(strp.start + 4 + i * 2));
          // a new strip starts where two flagged indices come together
          let strip = [];
          const flush = () => {
            for (let i = 0; i + 2 < strip.length; i++) {
              const [a, c, d] = [strip[i], strip[i + 1], strip[i + 2]];
              if (a === c || c === d || a === d) continue; // (a degenerate join)
              if (i % 2 === 0) idx.push(a, c, d);
              else idx.push(c, a, d);
            }
            strip = [];
          };
          for (let i = 0; i < raw.length; i++) {
            const flagged = (raw[i] & 0x8000) !== 0;
            if (flagged && i + 1 < raw.length && (raw[i + 1] & 0x8000) !== 0 && strip.length) flush();
            strip.push(raw[i] & 0x7fff);
          }
          flush();
        }
        model.segments.push({ material: mati ? u32(mati.start) : 0, positions, normals, uvs, indices: Uint32Array.from(idx) });
      }
      const envl = one(inGeom, 'ENVL');
      if (envl) {
        const m = u32(envl.start);
        model.bones = Array.from({ length: m }, (_, i) => u32(envl.start + 4 + i * 4));
      }
    }
    models.push(model);
  }
  // (a skin's envelope names bones by their model index: by name here)
  for (const m of models) m.bones = m.bones.map((i) => models.find((o) => o.index === i)?.name ?? String(i));
  return { materials, models };
}
