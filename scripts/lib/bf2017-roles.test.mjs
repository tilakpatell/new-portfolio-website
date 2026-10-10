import { describe, expect, it } from 'vitest';
import { ROLES } from '../galaxy-textures.mjs';
import { isSequel } from './bf2017-manifest.mjs';
import { ROLE_SOURCES, roleFiles } from './bf2017-roles.mjs';

describe('the ground and trim roles, on the game’s own maps', () => {
  it('has a game source for every role the site’s surfaces are dressed by', () => {
    for (const role of Object.keys(ROLES)) expect(ROLE_SOURCES[role], role).toBeTruthy();
  });

  it('takes every map from the drop’s textures, none from a scan set, none from the sequel era', () => {
    for (const [role, s] of Object.entries(ROLE_SOURCES)) {
      const maps = [s.color, s.normal, s.orm].filter(Boolean);
      expect(maps.length, role).toBeGreaterThan(0);
      for (const m of maps) {
        expect(m, role).toMatch(/^web\/textures\/(objects|levels)\//);
        expect(m, role).not.toMatch(/cc0|polyhaven|ambientcg|quaternius/i);
        expect(isSequel(m), `${role}: ${m}`).toBe(false);
      }
      // (a grey grain from the occlusion where the game has no colour map)
      if (!s.color) expect(s.orm, role).toBeTruthy();
    }
  });

  it('says how big a tile is, in metres, and what its detail is centred on', () => {
    for (const [role, s] of Object.entries(ROLE_SOURCES)) {
      expect(s.metres, role).toBeGreaterThanOrEqual(1);
      expect(s.metres, role).toBeLessThanOrEqual(8);
      expect(s.mean, role).toBeGreaterThan(0.5);
      expect(s.mean, role).toBeLessThan(1);
    }
  });

  it('crops a trim sheet to a square of it, inside the map', () => {
    for (const [role, s] of Object.entries(ROLE_SOURCES)) {
      if (!s.crop) continue;
      const [x0, y0, x1, y1] = s.crop;
      expect(x0 >= 0 && y0 >= 0 && x1 <= 1 && y1 <= 1 && x1 > x0 && y1 > y0, role).toBe(true);
      expect(x1 - x0).toBeCloseTo(y1 - y0, 6);
    }
  });

  it('names a role’s three WebPs at a size, under the game’s own folder', () => {
    expect(roleFiles('snow')).toEqual({ color: '/textures/galaxy/bf2017/snow/color.webp', normal: '/textures/galaxy/bf2017/snow/normal.webp', arm: '/textures/galaxy/bf2017/snow/arm.webp' });
    expect(roleFiles('snow', 'sm').color).toBe('/textures/galaxy/bf2017/snow/color-sm.webp');
  });
});
