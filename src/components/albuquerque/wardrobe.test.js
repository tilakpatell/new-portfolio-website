import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isSpec } from '../office/people';
import { CUSTOMERS } from './metherria/rules';
import { ABQ, moodGesture } from './wardrobe';

// a figure's .glb, and its JSON chunk
const file = (model) => new URL(`../../../public${model}`, import.meta.url);
const glb = (model) => {
  const b = readFileSync(file(model));
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
};
// the bones office/people.js turns
const BONES = ['Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'Head', ...['Shoulder', 'Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot'].flatMap((n) => [`Left${n}`, `Right${n}`])];

describe("Albuquerque's people", () => {
  it('has every Metherria customer', () => {
    for (const id of Object.keys(CUSTOMERS)) expect(ABQ[id], id).toBeTruthy();
  });

  it('has Hank, Hector, the nurse, and Walt and Jesse at the bench too', () => {
    for (const id of ['hank', 'hector', 'nurse', 'walt', 'jesseLab']) expect(ABQ[id], id).toBeTruthy();
  });

  it('gives each a spec the cast module takes, sized as people are', () => {
    for (const [id, spec] of Object.entries(ABQ)) {
      expect(isSpec(spec), id).toBe(true);
      expect(spec.id, id).toBe(id);
      expect(spec.height, id).toBeGreaterThan(1.45);
      expect(spec.height, id).toBeLessThan(2.0);
    }
  });

  it('gives each a figure on the skeleton the cast module poses: one skinned, textured mesh', () => {
    for (const { id, model } of Object.values(ABQ)) {
      const g = glb(model);
      expect(g.meshes, id).toHaveLength(1);
      expect(g.meshes[0].primitives, id).toHaveLength(1);
      expect(g.skins, id).toHaveLength(1);
      expect(g.images, id).toHaveLength(1);
      const names = g.skins[0].joints.map((j) => g.nodes[j].name);
      for (const n of BONES) expect(names, `${id}: ${n}`).toContain(n);
    }
  });

  it('ships no animations (the browser poses them), and stays small enough to send', () => {
    for (const { id, model } of Object.values(ABQ)) {
      expect(glb(model).animations ?? [], id).toHaveLength(0);
      expect(statSync(file(model)).size, id).toBeLessThan(220 * 1024);
    }
  });

  it('is welded and on its own atlas (scripts/reatlas.mjs), which a mipmap can be made of', () => {
    for (const { id, model } of Object.values(ABQ)) {
      const g = glb(model);
      // (as Meshy cuts a figure, 12,000 to 15,000 vertices)
      expect(g.accessors[g.meshes[0].primitives[0].attributes.POSITION].count, id).toBeLessThan(9000);
      expect(g.samplers[g.textures[0].sampler], id).toMatchObject({ minFilter: 9987, wrapS: 33071, wrapT: 33071 });
    }
  });

  it('reacts to each mood', () => {
    expect(['great', 'good', 'okay', 'bad', 'restless', 'wait'].map(moodGesture)).toEqual(['cheer', 'nod', 'shrug', 'shake', 'fold', null]);
    expect(moodGesture('anything else')).toBe(null);
  });
});
