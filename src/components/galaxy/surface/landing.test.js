import { describe, expect, it } from 'vitest';
import { covertFor, landingFor } from './landing.js';
import { SITES, siteOf } from './sites';
import { heightFor, standable } from './sites/validity';
import { REACH } from './terrain';

const site = siteOf('endor');
const h = heightFor(site);
const away = (at, from) => Math.hypot(at[0] - from[0], at[1] - from[1]);

describe('where you set down', () => {
  it('lands at the pad on your own side’s world, or unsworn', () => {
    expect(landingFor(site, { yours: true }, h).at).toEqual(site.land.at);
    expect(landingFor(site, { side: null, hostile: false }, h).covert).toBe(false);
    expect(landingFor(site, { side: 'rebel', owner: 'rebel', yours: true }, h).covert).toBe(false);
    expect(landingFor(site, null, h).at).toEqual(site.land.at);
  });
  it('lands out of sight on the other side’s world', () => {
    const l = landingFor(site, { side: 'rebel', owner: 'empire', hostile: true, yours: false }, h);
    expect(l.covert).toBe(true);
    expect(Math.hypot(l.at[0] - site.land.at[0], l.at[1] - site.land.at[1])).toBeGreaterThan(110);
    expect(l.line).toMatch(/out of sight/);
    expect(l.line).toMatch(/^Empire-held\./);
  });
  it('a Hutt world lands you at the pad (they sell you, they don’t shoot you)', () => {
    expect(landingFor(site, { side: 'rebel', owner: 'hutt', hostile: true }, h).covert).toBe(false);
  });
  it('a world held by a side of another war is nobody’s you swore against: the pad', () => {
    expect(landingFor(site, { side: 'rebel', owner: 'separatists', hostile: true }, h).covert).toBe(false);
  });
  it('finds a dry covert spot on a world with none written', () => {
    const at = covertFor({ ...site, covert: undefined }, h);
    expect(h(...at)).toBeGreaterThan((site.water?.level ?? -Infinity) + 0.3);
  });
  it('lands where the fallback says on a world with none written, side on to the pad', () => {
    const bare = { ...site, covert: undefined };
    const l = landingFor(bare, { side: 'rebel', owner: 'empire' }, h);
    expect(l.covert).toBe(true);
    expect(l.at).toEqual(covertFor(bare, h));
    // (the ship's right, where you climb out, is towards the pad)
    const d = [site.land.at[0] - l.at[0], site.land.at[1] - l.at[1]];
    const n = Math.hypot(...d);
    expect(Math.cos(l.yaw) * (d[0] / n) - Math.sin(l.yaw) * (d[1] / n)).toBeCloseTo(1, 5);
  });
  for (const id of ['mustafar', 'nevarro', 'naboo', 'kashyyyk', 'tatooine']) {
    it(`${id}: the fallback is on the ring, dry, level enough, inside the world, and the same each time`, () => {
      const s = { ...siteOf(id), covert: undefined };
      const g = heightFor(s);
      const at = covertFor(s, g);
      expect(at).not.toBeNull();
      expect(away(at, s.land.at)).toBeGreaterThanOrEqual(149);
      expect(away(at, s.land.at)).toBeLessThanOrEqual(221);
      expect(g(...at)).toBeGreaterThan((s.water?.level ?? -Infinity) + 0.3);
      expect(Math.abs(g(at[0] + 3, at[1]) - g(at[0] - 3, at[1])) / 6).toBeLessThanOrEqual(0.25);
      expect(Math.abs(g(at[0], at[1] + 3) - g(at[0], at[1] - 3)) / 6).toBeLessThanOrEqual(0.25);
      expect(Math.hypot(...at)).toBeLessThanOrEqual(REACH - 40);
      expect(covertFor(s, g)).toEqual(at);
    });
  }
});

describe('every written covert spot', () => {
  for (const id of Object.keys(SITES)) {
    const s = siteOf(id);
    if (!s.covert) continue;
    it(`${id}: stands 110 to 260 m from the pad, on ground you can stand on`, () => {
      const d = away(s.covert.at, s.land.at);
      expect(d).toBeGreaterThanOrEqual(110);
      expect(d).toBeLessThanOrEqual(260);
      if (!s.noGround) expect(standable(s, s.covert.at)).toBe(true);
      expect(Number.isFinite(s.covert.yaw)).toBe(true);
    });
  }
  it('the worlds the brief names have one; Mustafar and Nevarro are left to the fallback', () => {
    for (const id of ['endor', 'hoth', 'yavin', 'scarif', 'bespin', 'tatooine', 'naboo', 'geonosis', 'kamino', 'kashyyyk', 'coruscant', 'mandalore', 'lothal', 'sorgan', 'dagobah']) expect(siteOf(id).covert, id).toBeTruthy();
    expect(siteOf('mustafar').covert).toBeUndefined();
    expect(siteOf('nevarro').covert).toBeUndefined();
  });
});
