import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isSpec } from '../office/people';
import { CUSTOMERS } from './metherria/rules';
import { ABQ, HAZMAT, moodGesture } from './wardrobe';

// the JSON chunk of a .glb
const glb = (path) => {
  const b = readFileSync(new URL(`../../../public/models/office/${path}`, import.meta.url));
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
};
const packs = { men: glb('cast-men.glb'), women: glb('cast-women.glb') };

describe("Albuquerque's people", () => {
  it('dresses every Metherria customer', () => {
    for (const id of Object.keys(CUSTOMERS)) expect(ABQ[id], id).toBeTruthy();
  });

  it('dresses Hank, Hector, the nurse and Walt too', () => {
    for (const id of ['hank', 'hector', 'nurse', 'walt']) expect(ABQ[id], id).toBeTruthy();
  });

  it('dresses everyone from parts their pack ships', () => {
    for (const [id, spec] of Object.entries(ABQ)) {
      expect(isSpec(spec), id).toBe(true);
      expect(spec.id, id).toBe(id);
      const pack = packs[spec.pack];
      const meshes = pack.meshes.map((m) => m.name);
      for (const part of spec.parts) expect(meshes, `${id}: ${part}`).toContain(part);
      expect(spec.parts.map((p) => p.split('_')[0]).sort(), id).toEqual(['body', 'feet', 'head', 'legs']);
      for (const k of Object.keys(spec.colors)) expect(pack.extras.slots, `${id}: ${k}`).toContain(k);
      expect(spec.height, id).toBeGreaterThan(1.45);
      expect(spec.height, id).toBeLessThan(2.0);
    }
  });

  it('puts Walt and Jesse at the bench in hazmat, gloved', () => {
    for (const id of ['walt', 'jesseLab']) {
      expect(ABQ[id].colors.top, id).toBe(HAZMAT);
      expect(ABQ[id].colors.legs, id).toBe(HAZMAT);
      expect(ABQ[id].gloves, id).toBe(0x1a1a1a);
    }
    expect(ABQ.jesse.parts).toContain('body_hoodie');
    expect(ABQ.declan.parts).toContain('head_beard');
  });

  it("gives each figure the skeleton the cast module poses, under 600 KB", () => {
    const bones = ['Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'Head', ...['Shoulder', 'Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot'].flatMap((n) => [`Left${n}`, `Right${n}`])];
    const figures = Object.values(ABQ).filter((spec) => spec.model);
    expect(figures.map((f) => f.id).sort()).toEqual(Object.keys(ABQ).sort()); // everyone has one
    for (const { id, model } of figures) {
      const file = new URL(`../../../public${model}`, import.meta.url);
      expect(statSync(file).size, id).toBeLessThan(600 * 1024);
      const b = readFileSync(file);
      const g = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
      expect(g.skins, id).toHaveLength(1);
      const names = g.skins[0].joints.map((j) => g.nodes[j].name);
      for (const n of bones) expect(names, `${id}: ${n}`).toContain(n);
      expect(g.images?.length, id).toBeGreaterThan(0);
    }
  });

  it('reacts to each mood', () => {
    expect(['great', 'good', 'okay', 'bad', 'restless', 'wait'].map(moodGesture)).toEqual(['cheer', 'nod', 'shrug', 'shake', 'fold', null]);
    expect(moodGesture('anything else')).toBe(null);
  });
});
