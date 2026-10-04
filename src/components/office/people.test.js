import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STAFF } from './layout';
import { CAST, GESTURES, isSpec } from './people';

// the JSON chunk of a .glb
const glb = (path) => {
  const b = readFileSync(new URL(`../../../public/models/office/${path}`, import.meta.url));
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
};
const packs = { men: glb('cast-men.glb'), women: glb('cast-women.glb') };

describe('the cast', () => {
  it('has everyone on the floor plan', () => {
    for (const s of STAFF) expect(CAST[s.id], s.id).toBeTruthy();
  });

  it('dresses each person from parts their pack has: a head, a body, legs and feet', () => {
    for (const [id, c] of Object.entries(CAST)) {
      const pack = packs[c.pack];
      expect(pack, id).toBeTruthy();
      const meshes = pack.meshes.map((m) => m.name);
      for (const part of c.parts) expect(meshes, `${id}: ${part}`).toContain(part);
      expect(c.parts.map((p) => p.split('_')[0]).sort(), id).toEqual(['body', 'feet', 'head', 'legs']);
    }
  });

  it('colours only slots the packs have', () => {
    for (const [id, c] of Object.entries(CAST)) {
      const slots = packs[c.pack].extras.slots;
      for (const k of Object.keys(c.colors)) expect(slots, `${id}: ${k}`).toContain(k);
    }
  });

  it('is sized as people are', () => {
    for (const [id, c] of Object.entries(CAST)) {
      expect(c.height, id).toBeGreaterThan(1.45);
      expect(c.height, id).toBeLessThan(2.0);
      if (c.belly) expect(c.belly, id).toBeLessThan(1.6);
    }
  });

  it('ships the parts Albuquerque wears', () => {
    const meshes = packs.men.meshes.map((m) => m.name);
    expect(meshes).toContain('head_beard');
    expect(meshes).toContain('body_hoodie');
  });

  it('names every gesture the callers use', () => {
    expect(GESTURES).toEqual(['nod', 'shake', 'shrug', 'fold', 'cheer', 'wave']);
  });

  it('takes a wardrobe as a spec, not only an office id', () => {
    const full = { pack: 'men', parts: ['head_bald', 'body_tee', 'legs_jeans', 'feet_shoes'], height: 1.8, colors: { skin: 0xe0b598 } };
    expect(isSpec(full)).toBe(true);
    for (const id of Object.keys(CAST)) expect(isSpec(CAST[id]), id).toBe(true);
    const { pack, ...noPack } = full;
    const { parts, ...noParts } = full;
    expect(pack && parts).toBeTruthy();
    expect(isSpec(noPack)).toBe(false);
    expect(isSpec(noParts)).toBe(false);
    expect(isSpec({ ...full, pack: 'aliens' })).toBe(false);
    expect(isSpec({ ...full, parts: [] })).toBe(false);
    expect(isSpec('michael')).toBe(false);
    expect(isSpec(null)).toBe(false);
  });

  it('ships one skeleton a pack, and no animations it does not use', () => {
    for (const p of Object.values(packs)) {
      expect(p.skins).toHaveLength(1);
      expect(p.animations ?? []).toHaveLength(0);
    }
  });
});
