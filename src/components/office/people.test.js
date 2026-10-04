import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STAFF } from './layout';
import { CAST, GESTURES, isSpec } from './people';

// a person's .glb, and its JSON chunk
const file = (id) => readFileSync(new URL(`../../../public/models/office/cast/${id}.glb`, import.meta.url));
const glb = (id) => {
  const b = file(id);
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
};
// the bones the poses turn (people.js)
const BONES = ['Spine02', 'Spine01', 'Spine', 'neck', 'Head', ...['UpLeg', 'Leg', 'Foot', 'Arm', 'ForeArm', 'Hand'].flatMap((n) => [`Left${n}`, `Right${n}`])];

describe('the cast', () => {
  it('has everyone on the floor plan', () => {
    for (const s of STAFF) expect(CAST[s.id], s.id).toBeTruthy();
  });

  it('has a model of each of them: one skinned, textured mesh', () => {
    for (const id of Object.keys(CAST)) {
      const g = glb(id);
      expect(g.meshes, id).toHaveLength(1);
      expect(g.meshes[0].primitives, id).toHaveLength(1);
      expect(g.skins, id).toHaveLength(1);
      expect(g.images, id).toHaveLength(1);
    }
  });

  it('is rigged with the bones the poses turn, the feet at the end of the legs', () => {
    for (const id of Object.keys(CAST)) {
      const g = glb(id);
      const names = g.skins[0].joints.map((j) => g.nodes[j].name);
      for (const b of BONES) expect(names, `${id}: ${b}`).toContain(b);
      const node = (n) => g.nodes.find((o) => o.name === n);
      for (const side of ['Left', 'Right']) expect(node(`${side}Leg`).children.map((c) => g.nodes[c].name), id).toContain(`${side}Foot`);
    }
  });

  it('is sized as people are', () => {
    for (const [id, c] of Object.entries(CAST)) {
      expect(c.height, id).toBeGreaterThan(1.45);
      expect(c.height, id).toBeLessThan(2.0);
    }
  });

  it('names every gesture the callers use', () => {
    expect(GESTURES).toEqual(['nod', 'shake', 'shrug', 'fold', 'cheer', 'wave']);
  });

  it('takes someone from elsewhere as a spec of their own figure, not only an office id', () => {
    const walt = { id: 'walt', model: '/models/albuquerque/walt.glb', height: 1.79 };
    expect(isSpec(walt)).toBe(true);
    const { model, ...noModel } = walt;
    expect(model).toBeTruthy();
    expect(isSpec(noModel)).toBe(false);
    expect(isSpec({ ...walt, height: '1.79' })).toBe(false);
    expect(isSpec({ ...walt, model: '/models/albuquerque/walt.png' })).toBe(false);
    for (const id of Object.keys(CAST)) expect(isSpec(id), id).toBe(false);
    expect(isSpec(null)).toBe(false);
  });

  it('ships no animations (the browser poses them), and stays small enough to send', () => {
    for (const id of Object.keys(CAST)) {
      expect(glb(id).animations ?? [], id).toHaveLength(0);
      expect(file(id).length, id).toBeLessThan(190 * 1024);
    }
  });

  it('is welded and on its own atlas (scripts/meshy.mjs), which a mipmap can be made of', () => {
    for (const id of Object.keys(CAST)) {
      const g = glb(id);
      // (as Meshy cuts a figure, 11,000 vertices)
      expect(g.accessors[g.meshes[0].primitives[0].attributes.POSITION].count, id).toBeLessThan(8000);
      expect(g.samplers[g.textures[0].sampler], id).toMatchObject({ minFilter: 9987, wrapS: 33071, wrapT: 33071 });
    }
  });
});
