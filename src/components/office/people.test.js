import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STAFF } from './layout';
import { CAST } from './people';

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

  it('ships one skeleton a pack, and no animations it does not use', () => {
    for (const p of Object.values(packs)) {
      expect(p.skins).toHaveLength(1);
      expect(p.animations ?? []).toHaveLength(0);
    }
  });
});
