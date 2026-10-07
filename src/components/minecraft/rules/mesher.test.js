import { describe, expect, it } from 'vitest';
import { TEXTURES, byName } from './blocks';
import { makeChunk, set } from './chunk';
import { FACE, meshSection, unpack } from './mesher';

const id = (n) => byName.get(n).id;
const textures = new Map(TEXTURES.map((t, i) => [t, i]));
const none = { nx: null, px: null, nz: null, pz: null };
const mesh = (c, sy = 0, nb = none) => meshSection(c, sy, nb, { textures });
const verts = (m) => (m ? Array.from({ length: m.count }, (_, i) => unpack(m.data, i)) : []);
const faces = (m) => (m ? m.count / 4 : 0);

describe('the mesher', () => {
  it('a lone stone block has 6 faces (24 vertices)', () => {
    const c = makeChunk(0, 0);
    set(c, 5, 5, 5, id('stone'));
    const m = mesh(c);
    expect(m.opaque.count).toBe(24);
    expect(m.cutout).toBeNull();
    expect(m.water).toBeNull();
    expect(m.opaque.data).toBeInstanceOf(Uint16Array);
    expect(m.opaque.data.length).toBe(24 * 6);
  });

  it('an empty section has no meshes', () => {
    const c = makeChunk(0, 0);
    set(c, 5, 40, 5, id('stone'));
    expect(mesh(c, 0)).toEqual({ opaque: null, cutout: null, water: null });
  });

  it('two stones side by side have 10 faces', () => {
    const c = makeChunk(0, 0);
    set(c, 5, 5, 5, id('stone'));
    set(c, 6, 5, 5, id('stone'));
    expect(faces(mesh(c).opaque)).toBe(10);
  });

  it('glass beside stone keeps the stone’s face and its own', () => {
    const c = makeChunk(0, 0);
    set(c, 5, 5, 5, id('stone'));
    set(c, 6, 5, 5, id('glass'));
    const m = mesh(c);
    expect(faces(m.opaque)).toBe(6);
    expect(faces(m.cutout)).toBe(5);
  });

  it('glass beside glass hides the faces between; leaves beside leaves show both', () => {
    const c = makeChunk(0, 0);
    set(c, 5, 5, 5, id('glass'));
    set(c, 6, 5, 5, id('glass'));
    set(c, 5, 9, 5, id('oak_leaves'));
    set(c, 6, 9, 5, id('oak_leaves'));
    expect(faces(mesh(c).cutout)).toBe(10 + 12);
  });

  it('water with air above has one top face at 14/16', () => {
    const c = makeChunk(0, 0);
    for (let x = 4; x <= 6; x++) for (let z = 4; z <= 6; z++) for (let y = 4; y <= 5; y++) set(c, x, y, z, id('stone'));
    set(c, 5, 5, 5, id('water'));
    const m = mesh(c);
    expect(faces(m.water)).toBe(1);
    const v = verts(m.water);
    expect(v.every((p) => p.face === FACE.top && p.y === 5 * 16 + 14)).toBe(true);
    expect(v.every((p) => p.tint === 3)).toBe(true);
    // the stone under it and round it keeps its faces toward the water
    expect(verts(m.opaque).some((p) => p.face === FACE.top && p.y === 5 * 16)).toBe(true);
  });

  it('water under water is a full block with no top', () => {
    const c = makeChunk(0, 0);
    set(c, 5, 5, 5, id('water'));
    set(c, 5, 6, 5, id('water'));
    const v = verts(mesh(c).water);
    expect(v.filter((p) => p.face === FACE.top)).toHaveLength(4); // only the upper one's
    expect(v.filter((p) => p.face === FACE.north).map((p) => p.y).sort((a, b) => a - b)).toEqual([80, 80, 96, 96, 96, 96, 110, 110]);
  });

  it('tall grass is two crossed quads', () => {
    const c = makeChunk(0, 0);
    set(c, 5, 5, 5, id('short_grass'));
    const m = mesh(c);
    expect(m.cutout.count).toBe(8);
    expect(m.opaque).toBeNull();
    const v = verts(m.cutout);
    expect(v.every((p) => p.face === FACE.cross)).toBe(true);
    // inset as the game's cross model is, 2.9 to 13.1 sixteenths
    expect(Math.min(...v.map((p) => p.x)) - 80).toBe(3);
    expect(Math.max(...v.map((p) => p.x)) - 80).toBe(13);
    expect(v.every((p) => p.tint === 1)).toBe(true);
  });

  it('a vertex in a concave corner has ao 0 and in the open 3', () => {
    const c = makeChunk(0, 0);
    set(c, 5, 5, 5, id('stone'));
    set(c, 4, 6, 5, id('stone'));
    set(c, 5, 6, 4, id('stone'));
    const top = verts(mesh(c).opaque).filter((p) => p.face === FACE.top && p.y === 96 && p.x >= 80 && p.x <= 96 && p.z >= 80 && p.z <= 96);
    expect(top).toHaveLength(4);
    const at = (x, z) => top.find((p) => p.x === x * 16 && p.z === z * 16).ao;
    expect(at(5, 5)).toBe(0);
    expect(at(6, 6)).toBe(3);
    expect(at(6, 5)).toBe(2);
  });

  it('a face on the section’s edge with a null neighbour is drawn', () => {
    const c = makeChunk(0, 0);
    set(c, 0, 5, 5, id('stone'));
    expect(verts(mesh(c).opaque).filter((p) => p.face === FACE.west)).toHaveLength(4);
  });

  it('a neighbour chunk’s solid block hides the face', () => {
    const c = makeChunk(0, 0);
    const w = makeChunk(-1, 0);
    set(c, 0, 5, 5, id('stone'));
    set(w, 15, 5, 5, id('stone'));
    expect(verts(mesh(c, 0, { ...none, nx: w }).opaque).filter((p) => p.face === FACE.west)).toHaveLength(0);
  });

  it('a block on a section’s floor reads the section below', () => {
    const c = makeChunk(0, 0);
    set(c, 3, 16, 3, id('stone'));
    set(c, 3, 15, 3, id('stone'));
    expect(verts(mesh(c, 1).opaque).filter((p) => p.face === FACE.bottom)).toHaveLength(0);
    expect(verts(mesh(c, 1).opaque).filter((p) => p.face === FACE.top)).toHaveLength(4);
  });

  it('each face index matches its direction, and winds outward', () => {
    const c = makeChunk(0, 0);
    set(c, 5, 5, 5, id('stone'));
    const v = verts(mesh(c).opaque);
    const normal = { [FACE.top]: [0, 1, 0], [FACE.bottom]: [0, -1, 0], [FACE.north]: [0, 0, -1], [FACE.south]: [0, 0, 1], [FACE.east]: [1, 0, 0], [FACE.west]: [-1, 0, 0] };
    for (let q = 0; q < v.length; q += 4) {
      const [a, b, d] = [v[q], v[q + 1], v[q + 2]];
      expect(v.slice(q, q + 4).every((p) => p.face === a.face)).toBe(true);
      const e1 = [b.x - a.x, b.y - a.y, b.z - a.z];
      const e2 = [d.x - a.x, d.y - a.y, d.z - a.z];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]].map((s) => Math.sign(s) + 0);
      expect(n).toEqual(normal[a.face]);
      // the face sits on its own side of the block
      const want = normal[a.face];
      const centre = [0, 1, 2].map((k) => v.slice(q, q + 4).reduce((s, p) => s + [p.x, p.y, p.z][k], 0) / 4 / 16 - 5.5);
      expect(centre.map((c2) => Math.sign(Math.round(c2 * 2)) + 0)).toEqual(want);
    }
  });

  it('a grass block’s top has tint 1 and its side tint 0', () => {
    const c = makeChunk(0, 0);
    set(c, 5, 5, 5, id('grass_block'));
    const v = verts(mesh(c).opaque);
    expect(v.filter((p) => p.face === FACE.top).every((p) => p.tint === 1)).toBe(true);
    expect(v.filter((p) => p.face === FACE.north).every((p) => p.tint === 0)).toBe(true);
    expect(v.find((p) => p.face === FACE.top).layer).toBe(textures.get('grass_block_top'));
    expect(v.find((p) => p.face === FACE.bottom).layer).toBe(textures.get('dirt'));
  });

  it('a side’s texture stands upright: its top row at the block’s top', () => {
    const c = makeChunk(0, 0);
    set(c, 5, 5, 5, id('stone'));
    for (const p of verts(mesh(c).opaque).filter((q) => q.face >= FACE.north && q.face <= FACE.west)) expect(p.v).toBe(p.y === 96 ? 0 : 16);
  });

  it('an unlit chunk meshes in full sky light; a lit one carries its light', () => {
    const c = makeChunk(0, 0);
    set(c, 5, 5, 5, id('stone'));
    expect(verts(mesh(c).opaque).every((p) => p.light === 0xf0)).toBe(true);
    c.lit = true;
    c.light.fill(0x3a);
    expect(verts(mesh(c).opaque).every((p) => p.light === 0x3a)).toBe(true);
  });
});
