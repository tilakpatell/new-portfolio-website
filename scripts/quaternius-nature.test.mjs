import { describe, expect, it } from 'vitest';
import { MODELS, NATURE_COLOURS } from '../src/components/galaxy/surface/catalog/nature.js';
import { CREDIT, familyOf, galaxyCredit, greyOf, packRoots } from './quaternius-nature.mjs';

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

  it('credits each kind as public/games/credits.json has the landings’ models, its file found by its name', () => {
    const c = galaxyCredit('nkbirch1', MODELS.nkbirch1);
    expect(c).toEqual({ source: 'https://quaternius.com', id: 'Birch_1', name: 'Stylized Nature MegaKit: Birch_1', authors: ['Quaternius'], license: 'CC0 1.0', use: expect.any(String) });
    // (never a public/…/ folder in it: the credits' audit would take that for the whole folder)
    expect(JSON.stringify(c)).not.toMatch(/public\//);
    expect(c.use).toContain('nkbirch1');
    expect(CREDIT('nkbirch1')).toBe('quaternius-galaxy/nkbirch1');
    // (not the landings' prefix: scripts/quaternius.mjs drops the quaternius/ credits it doesn't make)
    expect(CREDIT('x').startsWith('quaternius/')).toBe(false);
  });

  it('looks for the packs where scripts/quaternius.mjs does first ($QUATERNIUS, then the asset repo beside this one)', () => {
    const roots = packRoots({ QUATERNIUS: '/a:/b' }, '/repo', '/tmp');
    expect(roots.slice(0, 2)).toEqual(['/a/stylized-nature-megakit/glTF', '/b/stylized-nature-megakit/glTF']);
    expect(packRoots({}, '/x/repo', '/tmp')).toEqual(['/x/tilakverse-assets/quaternius/stylized-nature-megakit/glTF', '/tmp/tilakverse-assets/quaternius/stylized-nature-megakit/glTF', '/x/repo/lab/assets/naturemega/glTF']);
  });
});

