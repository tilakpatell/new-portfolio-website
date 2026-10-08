import { describe, expect, it } from 'vitest';
import { MODELS, NATURE_COLOURS } from '../src/components/galaxy/surface/catalog/nature.js';
import { familyOf, greyOf } from './quaternius-nature.mjs';

describe('the nature kit import', () => {
  it('names each kind nk-something, from a file of the pack', () => {
    for (const [kind, m] of Object.entries(MODELS)) {
      expect(kind).toMatch(/^nk[a-z0-9]+$/);
      expect(m.cc0, kind).toBe('quaternius');
      expect(m.from, kind).toMatch(/^[A-Za-z0-9_]+$/);
      expect(m.metres, kind).toBeGreaterThan(0);
    }
  });

  it('sorts the materials into families', () => {
    expect(familyOf('Grass')).toBe('grass');
    expect(familyOf('Leaves')).toBe('plant');
    expect(familyOf('Flowers')).toBe('flowers');
    expect(familyOf('Leaves_Birch')).toBe('leaves');
    expect(familyOf('Bark_Pine')).toBe('bark');
    expect(familyOf('Rocks')).toBe('stone');
    expect(familyOf('Mushrooms')).toBe('stone');
  });

  it('turns the masks into light: dark at the root, full at the tip, the rest untouched', () => {
    expect(greyOf('grass', 0)).toBeCloseTo(0.42);
    expect(greyOf('grass', 1)).toBe(1);
    expect(greyOf('grass', 2)).toBe(1);
    expect(greyOf('bark', 0.08)).toBeGreaterThan(0.6);
    expect(greyOf('leaves', 0.3)).toBe(1);
    expect(greyOf('stone', 0)).toBe(1);
  });

  it('colours only leaves and grass', () => {
    for (const name of Object.keys(NATURE_COLOURS)) expect(['leaves', 'grass'], name).toContain(familyOf(name));
  });
});
