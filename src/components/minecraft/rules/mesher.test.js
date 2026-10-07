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

  it('flowing water stands lower the further it has come: level 7 is 2 high', () => {
    const c = makeChunk(0, 0);
    for (let x = 4; x <= 6; x++) for (let z = 4; z <= 6; z++) for (let y = 4; y <= 5; y++) set(c, x, y, z, id('stone'));
    set(c, 5, 5, 5, id('water'), 7);
    const v = verts(mesh(c).water).filter((p) => p.face === FACE.top);
    expect(v.every((p) => p.y === 5 * 16 + 2)).toBe(true);
  });

  it('water under water is a full block with no top', () => {
    const c = makeChunk(0, 0);
    set(c, 5, 5, 5, id('water'));
    set(c, 5, 6, 5, id('water'));
    const v = verts(mesh(c).water);
    expect(v.filter((p) => p.face === FACE.top)).toHaveLength(4); // only the upper one's
    // (the upper's corners droop to the air round it: 11/16)
    expect(v.filter((p) => p.face === FACE.north).map((p) => p.y).sort((a, b) => a - b)).toEqual([80, 80, 96, 96, 96, 96, 107, 107]);
  });

  // the game's corner heights (BlockFluidRenderer.getFluidHeight): each corner the
  // four cells round it, a source or a falling cell weighing 11, a flowing one 1, an
  // open cell 1 at nothing, a solid one not at all; any of them under its liquid, full
  const floor = (c) => {
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) set(c, x, 4, z, id('stone'));
  };
  it('a lone source’s corners droop to the air round it: 11/16', () => {
    const c = makeChunk(0, 0);
    floor(c);
    set(c, 5, 5, 5, id('water'));
    const top = verts(mesh(c).water).filter((p) => p.face === FACE.top);
    expect(top.map((p) => p.y)).toEqual([91, 91, 91, 91]);
  });

  it('a flow’s corners meet its source’s: one surface, no gaps', () => {
    const c = makeChunk(0, 0);
    floor(c);
    set(c, 5, 5, 5, id('water'));
    set(c, 6, 5, 5, id('water'), 1);
    set(c, 7, 5, 5, id('water'), 2);
    const top = verts(mesh(c).water).filter((p) => p.face === FACE.top);
    const at = (x, z) => [...new Set(top.filter((p) => p.x === x * 16 && p.z === z * 16).map((p) => p.y))];
    for (const x of [6, 7]) for (const z of [5, 6]) expect(at(x, z)).toHaveLength(1);
    expect(at(6, 5)[0]).toBeGreaterThan(at(7, 5)[0]);
  });

  // the top quad over the cell (x, z)
  const topAt = (m, x, z) => {
    const v = verts(m);
    for (let i = 0; i < v.length; i += 4) {
      const q = v.slice(i, i + 4);
      if (q[0].face === FACE.top && Math.min(...q.map((p) => p.x)) === x * 16 && Math.min(...q.map((p) => p.z)) === z * 16) return q;
    }
    return null;
  };

  it('a top that slopes wears the flowing texture, running downstream; a level one the still', () => {
    const c = makeChunk(0, 0);
    floor(c);
    // a channel east from a source
    for (let x = 4; x <= 9; x++) for (const z of [4, 6]) set(c, x, 5, z, id('stone'));
    set(c, 4, 5, 5, id('stone'));
    set(c, 5, 5, 5, id('water'));
    set(c, 6, 5, 5, id('water'), 1);
    set(c, 7, 5, 5, id('water'), 2);
    const flow = topAt(mesh(c).water, 6, 5);
    expect(flow.every((p) => p.layer === textures.get('water_flow'))).toBe(true);
    // v runs east, with the water
    for (const p of flow) expect(p.v).toBe(p.x === 6 * 16 ? 0 : 16);
    // a source in a basin lies level: the still texture
    const d = makeChunk(0, 0);
    for (let x = 4; x <= 6; x++) for (let z = 4; z <= 6; z++) for (let y = 4; y <= 5; y++) set(d, x, y, z, id('stone'));
    set(d, 5, 5, 5, id('water'));
    expect(topAt(mesh(d).water, 5, 5).every((p) => p.layer === textures.get('water_still'))).toBe(true);
  });

  it('flowing north, the texture turns to run north', () => {
    const c = makeChunk(0, 0);
    floor(c);
    for (let z = 6; z <= 10; z++) for (const x of [4, 6]) set(c, x, 5, z, id('stone'));
    set(c, 5, 5, 10, id('stone'));
    set(c, 5, 5, 9, id('water'));
    set(c, 5, 5, 8, id('water'), 1);
    set(c, 5, 5, 7, id('water'), 2);
    const flow = topAt(mesh(c).water, 5, 8);
    expect(flow.every((p) => p.layer === textures.get('water_flow'))).toBe(true);
    // v grows toward -z: 0 on the cell's south edge, 16 on its north
    for (const p of flow) expect(p.v).toBe(p.z === 9 * 16 ? 0 : 16);
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

  it('a vertex stands at its height in the column, so a column’s sections join into one mesh', () => {
    const c = makeChunk(0, 0);
    set(c, 3, 64, 3, id('stone'));
    const ys = verts(mesh(c, 4).opaque).map((p) => p.y);
    expect(Math.min(...ys)).toBe(64 * 16);
    expect(Math.max(...ys)).toBe(65 * 16);
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

  it('a log laid along x shows its rings east and west, its bark round the rest with the grain along x', () => {
    const c = makeChunk(0, 0);
    set(c, 5, 5, 5, id('oak_log'), 1);
    const v = verts(mesh(c).opaque);
    const layerOf = (f) => v.find((p) => p.face === f).layer;
    expect(layerOf(FACE.east)).toBe(textures.get('oak_log_top'));
    expect(layerOf(FACE.west)).toBe(textures.get('oak_log_top'));
    expect(layerOf(FACE.top)).toBe(textures.get('oak_log'));
    expect(layerOf(FACE.north)).toBe(textures.get('oak_log'));
    // the grain (down the texture) runs along x: along the top edge, v changes
    const top = v.filter((p) => p.face === FACE.north && p.y === 96);
    expect(top[0].v).not.toBe(top[1].v);
    // upright, it doesn't
    const d = makeChunk(0, 0);
    set(d, 5, 5, 5, id('oak_log'), 0);
    const up = verts(mesh(d).opaque).filter((p) => p.face === FACE.north && p.y === 96);
    expect(up[0].v).toBe(up[1].v);
  });

  it('a log laid along z shows its rings north and south', () => {
    const c = makeChunk(0, 0);
    set(c, 5, 5, 5, id('birch_log'), 2);
    const v = verts(mesh(c).opaque);
    expect(v.find((p) => p.face === FACE.south).layer).toBe(textures.get('birch_log_top'));
    expect(v.find((p) => p.face === FACE.east).layer).toBe(textures.get('birch_log'));
  });

  it('a furnace shows its front the way it was set facing', () => {
    const c = makeChunk(0, 0);
    set(c, 5, 5, 5, id('furnace'), 3); // east
    const v = verts(mesh(c).opaque);
    expect(v.find((p) => p.face === FACE.east).layer).toBe(textures.get('furnace_front'));
    expect(v.find((p) => p.face === FACE.north).layer).toBe(textures.get('furnace_side'));
    expect(v.find((p) => p.face === FACE.top).layer).toBe(textures.get('furnace_top'));
  });

  it('a standing torch is the game’s post, two sixteenths square and ten high, cut from the middle of its picture', () => {
    const c = makeChunk(0, 0);
    set(c, 5, 5, 5, id('torch'), FACE.top);
    const m = mesh(c);
    expect(m.opaque).toBeNull();
    const v = verts(m.cutout);
    expect(v.length / 4).toBe(5); // four sides and the top
    expect(Math.min(...v.map((p) => p.x)) - 80).toBe(7);
    expect(Math.max(...v.map((p) => p.x)) - 80).toBe(9);
    expect(Math.max(...v.map((p) => p.y)) - 80).toBe(10);
    expect(v.every((p) => p.layer === textures.get('torch'))).toBe(true);
    const top = v.filter((p) => p.face === FACE.top);
    expect(top.map((p) => p.u).sort()).toEqual([7, 7, 9, 9]);
    expect(top.map((p) => p.v).sort()).toEqual([6, 6, 8, 8]);
  });

  it('a torch on a wall leans out from it', () => {
    const c = makeChunk(0, 0);
    // hung on the east face of a block to its west: its foot at the west of the cell
    set(c, 5, 5, 5, id('torch'), FACE.east);
    const v = verts(mesh(c).cutout);
    const foot = v.filter((p) => p.y === 80 + 3).map((p) => p.x - 80);
    const head = v.filter((p) => p.y === 80 + 13).map((p) => p.x - 80);
    expect(Math.min(...foot)).toBeLessThan(Math.min(...head));
  });

  it('a slab is half a block high, its sides cut from the lower half of the picture, hiding nothing beside it', () => {
    const c = makeChunk(0, 0);
    set(c, 5, 5, 5, id('oak_slab'));
    set(c, 6, 5, 5, id('stone'));
    const m = mesh(c);
    const slab = verts(m.cutout);
    expect(Math.max(...slab.map((p) => p.y)) - 80).toBe(8);
    expect(slab.filter((p) => p.face === FACE.north && p.y === 88).every((p) => p.v === 8)).toBe(true);
    // the stone keeps its face toward the slab
    expect(verts(m.opaque).filter((p) => p.face === FACE.west)).toHaveLength(4);
  });

  it('a bed lies 9 high, the head’s blanket with its pillow', () => {
    const c = makeChunk(0, 0);
    set(c, 5, 5, 5, id('red_bed'), 0); // the foot
    set(c, 5, 5, 4, id('red_bed'), 8); // the head (bit 8), north of it
    const v = verts(mesh(c).cutout);
    expect(Math.max(...v.map((p) => p.y)) - 80).toBe(9);
    const tops = v.filter((p) => p.face === FACE.top);
    expect(new Set(tops.map((p) => p.layer))).toEqual(new Set([textures.get('red_bed_top'), textures.get('red_bed_head_top')]));
  });

  it('a ladder is one thin face on its wall, seen from both sides', () => {
    const c = makeChunk(0, 0);
    set(c, 5, 5, 5, id('ladder'), FACE.east); // hung on the east face of the block to its west
    const v = verts(mesh(c).cutout);
    expect(v).toHaveLength(4);
    expect(v.every((p) => p.x === 80 + 1)).toBe(true);
  });

  it('stairs face by state: the step rises toward the way they face', () => {
    const c = makeChunk(0, 0);
    set(c, 5, 5, 5, id('oak_stairs'), 0); // facing north: the tall half on the north
    const v = verts(mesh(c).cutout);
    const tall = v.filter((p) => p.y === 96);
    expect(tall.length).toBeGreaterThan(0);
    expect(tall.every((p) => p.z <= 88)).toBe(true);
    const d = makeChunk(0, 0);
    set(d, 5, 5, 5, id('oak_stairs'), 3); // east
    expect(verts(mesh(d).cutout).filter((p) => p.y === 96).every((p) => p.x >= 88)).toBe(true);
  });

  it('a door is a thin plate, its lower half and upper half their own pictures, and it swings', () => {
    const c = makeChunk(0, 0);
    set(c, 5, 5, 5, id('oak_door'), 0); // facing north, shut
    set(c, 5, 6, 5, id('oak_door'), 8); // its upper half
    const v = verts(mesh(c).cutout);
    const zs = new Set(v.map((p) => p.z - 80));
    expect([...zs].sort((a, b) => a - b)).toEqual([0, 3]);
    expect(new Set(v.filter((p) => p.face === FACE.north && p.y > 96).map((p) => p.layer))).toEqual(new Set([textures.get('oak_door_top')]));
    expect(new Set(v.filter((p) => p.face === FACE.north && p.y < 96).map((p) => p.layer))).toEqual(new Set([textures.get('oak_door_bottom')]));
    const d = makeChunk(0, 0);
    set(d, 5, 5, 5, id('oak_door'), 4); // open: swung to lie along its side
    const xs = new Set(verts(mesh(d).cutout).map((p) => p.x - 80));
    expect(xs.size).toBe(2);
    expect(Math.max(...xs) - Math.min(...xs)).toBe(3);
  });

  it('smooth light: a corner averages the four cells round it, a dark one taking the face’s own', () => {
    const c = makeChunk(0, 0);
    c.lit = true;
    set(c, 5, 5, 5, id('stone'));
    // the cells over the top face: (5,6,5) 12 sky; west of it 8; north of it 4; the corner (4,6,4) 0 (as a solid's is)
    c.light[(6 * 16 + 5) * 16 + 5] = 12 << 4;
    c.light[(6 * 16 + 5) * 16 + 4] = 8 << 4;
    c.light[(6 * 16 + 4) * 16 + 5] = 4 << 4;
    c.light[(6 * 16 + 4) * 16 + 4] = 0;
    // and a torch's light on the face cell alone
    c.light[(6 * 16 + 5) * 16 + 5] |= 8;
    const top = verts(mesh(c).opaque).filter((p) => p.face === FACE.top);
    const at = (x, z) => top.find((p) => p.x === x * 16 && p.z === z * 16).light;
    // (12 + 8 + 4 + 12) / 4 = 9 sky; block (8 + 8 + 8 + 8) / 4 = 8 (dark ones take the face's)
    expect(at(5, 5) >> 4).toBe(9);
    expect(at(5, 5) & 15).toBe(8);
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
