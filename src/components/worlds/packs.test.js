import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PACKS, packFor } from './packs';
import { WORLD_MB, WORLDS } from './worlds';

describe('the packs', () => {
  it('are one per world, under its address', () => {
    // (a world, not the map's own size, which WORLD_MB keeps for the tour)
    for (const to of Object.keys(WORLD_MB).filter((t) => WORLDS.some((w) => w.to === t))) expect(PACKS[to]?.id, to).toBe(to);
  });

  it('are found from any address inside a world, the closest one winning', () => {
    expect(packFor('/dot-matrix/minecraft').id).toBe('/dot-matrix/minecraft');
    expect(packFor('/dot-matrix/tetris').id).toBe('/dot-matrix');
    expect(packFor('/c-137/citadel').id).toBe('/c-137');
    expect(packFor('/about')).toBeNull();
  });

  it('name the pages and the source they come from, files that exist', () => {
    for (const pack of Object.values(PACKS)) {
      expect(pack.pages.length, pack.id).toBeGreaterThan(0);
      expect(pack.src.length, pack.id).toBeGreaterThan(0);
      for (const p of [...pack.pages, ...pack.src]) {
        expect(p.startsWith('/'), p).toBe(false);
        expect(existsSync(p), `${pack.id}: ${p}`).toBe(true);
      }
    }
  });
});
