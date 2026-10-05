import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import CREDITS from '../../../../data/modelCredits.json';
import { GROUPS, SURFACE_MODELS, surfaceUrl } from './index';

const file = (kind) => new URL(`../../../../../public${surfaceUrl(kind)}`, import.meta.url);

describe('the surface models', () => {
  it('names each kind once, across the groups', () => {
    const all = Object.values(GROUPS).flatMap((m) => Object.keys(m));
    expect(new Set(all).size).toBe(all.length);
    for (const kind of all) expect(kind, kind).toMatch(/^[a-z0-9]+$/);
  });

  it('has each one brought in, small enough, with what the import needs', () => {
    for (const [kind, m] of Object.entries(SURFACE_MODELS)) {
      expect(m.uid, kind).toMatch(/^[0-9a-f]{32}$/);
      expect(m.as, kind).toBeTruthy();
      expect(m.metres, kind).toBeGreaterThan(0);
      expect(['x', 'y', 'z', 'max', undefined], kind).toContain(m.along);
      expect(existsSync(file(kind)), `${kind}.glb`).toBe(true);
      expect(statSync(file(kind)).size, `${kind}.glb`).toBeLessThan(2.5 * 1024 * 1024);
      expect(CREDITS[`surface-${kind}`]?.file, `${kind}'s credit`).toBe(surfaceUrl(kind));
    }
  });
});
