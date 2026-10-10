import { describe, expect, it } from 'vitest';
import { ERAS } from './systems';
import { WAR_SYSTEMS, opening } from './gcw';
import { DOCTRINE, SIDES, WARS, WAR_IDS, sideOfCode, warOfSide } from './sides';

// a colour's hue, in degrees round the wheel
const hueOf = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (!d) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
const apart = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

describe('the sides', () => {
  it('have short codes, none the same, that a tally key can carry', () => {
    const codes = Object.values(SIDES).map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(c).toMatch(/^[a-z]{2,3}$/);
    for (const [id, s] of Object.entries(SIDES)) {
      expect(s.id).toBe(id);
      expect(sideOfCode(s.code)).toBe(id);
      expect(['light', 'dark', 'hutt']).toContain(s.stance);
      expect(s.name).toMatch(/\S/);
      expect(s.colour).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it('are told apart on the map: in each war its three powers are 30° of hue apart at least', () => {
    // (the Hutts were green, as the Empire is: violet now, which no war's other two use)
    for (const w of Object.values(WARS)) {
      const hues = [w.liberator, w.raider, 'hutt'].map((id) => hueOf(SIDES[id].colour));
      for (let i = 0; i < hues.length; i++) for (let j = i + 1; j < hues.length; j++) expect(apart(hues[i], hues[j]), `${w.id}: ${i} ${j}`).toBeGreaterThanOrEqual(30);
    }
    const hutt = hueOf(SIDES.hutt.colour);
    expect(hutt).toBeGreaterThan(255);
    expect(hutt).toBeLessThan(295);
    for (const s of Object.values(SIDES)) if (s.id !== 'hutt') expect(apart(hueOf(s.colour), hutt), s.id).toBeGreaterThanOrEqual(45);
  });
  it('each have a doctrine: what they look for in a target, as weights', () => {
    for (const id of Object.keys(SIDES)) {
      const d = DOCTRINE[id];
      expect(d, id).toBeTruthy();
      for (const k of ['worth', 'weak', 'cut', 'area', 'jitter']) {
        expect(typeof d[k], `${id}.${k}`).toBe('number');
        expect(d[k]).toBeGreaterThanOrEqual(0);
      }
      expect(d.every ?? 1).toBeGreaterThan(0.5);
      expect(d.every ?? 1).toBeLessThanOrEqual(1.5);
    }
    // (the Hutts go for whatever's weakest; the Empire for what's worth most)
    expect(DOCTRINE.hutt.weak).toBeGreaterThan(DOCTRINE.hutt.worth);
    expect(DOCTRINE.empire.worth).toBeGreaterThan(DOCTRINE.empire.weak);
  });
});

describe('the wars', () => {
  it('one for each of the galaxy’s eras, liberator light and raider dark', () => {
    expect(WAR_IDS).toEqual(['clone', 'gcw', 'remnant']);
    expect(new Set(Object.values(WARS).map((w) => w.era))).toEqual(new Set(ERAS.map((e) => e.id)));
    for (const w of Object.values(WARS)) {
      expect(SIDES[w.liberator].stance, w.id).toBe('light');
      expect(SIDES[w.raider].stance, w.id).toBe('dark');
      expect(warOfSide(w.liberator)).toBe(w.id);
      expect(warOfSide(w.raider)).toBe(w.id);
    }
    expect(warOfSide('hutt')).toBeNull();
  });
  it('open on maps of war systems only, each held once, the Hutts on Tatooine in every war', () => {
    for (const w of Object.values(WARS)) {
      const named = Object.values(w.opening).flat();
      expect(new Set(named).size, w.id).toBe(named.length);
      for (const id of named) expect(WAR_SYSTEMS, `${w.id}: ${id}`).toContain(id);
      for (const side of Object.keys(w.opening)) expect([w.liberator, w.raider, 'hutt']).toContain(side);
      expect(w.opening.hutt).toContain('tatooine');
    }
  });
  it('give each of a war’s powers a capital it opens holding', () => {
    for (const w of Object.values(WARS)) {
      const o = opening(w.id);
      for (const side of [w.liberator, w.raider, 'hutt']) {
        const cap = w.capitals[side];
        expect(WAR_SYSTEMS, `${w.id}: ${side}`).toContain(cap);
        expect(o.owner[cap], `${w.id}: ${side}’s capital ${cap}`).toBe(side);
      }
    }
    expect(WARS.gcw.capitals).toEqual({ rebel: 'yavin', empire: 'coruscant', hutt: 'tatooine' });
  });
});
