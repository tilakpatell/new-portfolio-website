import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PROPS } from './props';

const file = (url) => new URL(`../../../../public${url}`, import.meta.url);
// the JSON chunk of a .glb
const json = (url) => {
  const b = readFileSync(file(url));
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
};

describe("Walt's props", () => {
  it('ships every prop the scene loads', () => {
    for (const [name, p] of Object.entries(PROPS)) {
      expect(existsSync(file(p.url)), name).toBe(true);
      expect(statSync(file(p.url)).size, name).toBeLessThan(300 * 1024);
    }
  });

  it('keeps every prop under 2,000 triangles', () => {
    for (const [name, p] of Object.entries(PROPS)) {
      const g = json(p.url);
      const tris = g.meshes.flatMap((m) => m.primitives).reduce((n, prim) => n + g.accessors[prim.indices ?? prim.attributes.POSITION].count / 3, 0);
      expect(tris, name).toBeLessThan(2000);
    }
  });

  it('puts the spout on the drums', () => {
    for (const name of ['drumBase', 'drumBlue']) {
      const { spout, band, size } = PROPS[name];
      expect(spout, name).toHaveLength(3);
      // out past the body, toward +x, in the drum's top half
      expect(spout[0], name).toBeGreaterThan(band[1]);
      expect(spout[1], name).toBeGreaterThan(size * 0.5);
      expect(spout[1], name).toBeLessThan(size);
      expect(Math.abs(spout[2]), name).toBeLessThan(0.02);
      // the label band on the body, about halfway up
      expect(band[0], name).toBeGreaterThan(size * 0.25);
      expect(band[0], name).toBeLessThan(size * 0.75);
    }
  });
});
