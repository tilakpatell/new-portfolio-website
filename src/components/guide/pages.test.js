import { describe, expect, it } from 'vitest';
import { PAGES, SHORTCUTS, SITE, guideFor } from './pages';
import { keyTokens } from './keys';
import { WORLDS } from '../worlds/worlds';

describe('which guide a page gets', () => {
  it('finds a page by its own path', () => {
    expect(guideFor('/home').key).toBe('/home');
    expect(guideFor('/c-137/citadel').key).toBe('/c-137/citadel');
    expect(guideFor('/deathstar').title).toBe('The Death Star');
  });

  it('gives the universe’s to the front door and every place on the map', () => {
    for (const p of ['/', '/universe', '/universe/marvel']) expect(guideFor(p).key, p).toBe('/universe');
  });

  it('gives a section’s deeper pages their own kind of guide', () => {
    expect(guideFor('/experience/aws').key).toBe('/experience');
    expect(guideFor('/projects/gameboy').key).toBe('/project');
    expect(guideFor('/galaxy/hoth').key).toBe('/galaxy');
    expect(guideFor('/galaxy/hoth/surface').key).toBe('/galaxy/surface');
    expect(guideFor('/galaxy/hoth/mission').key).toBe('/galaxy/mission');
    expect(guideFor('/middle-earth').key).toBe('/middle-earth');
    expect(guideFor('/middle-earth/moria').key).toBe('/middle-earth/place');
  });

  it('has none for a page it doesn’t know', () => {
    expect(guideFor('/nowhere')).toBe(null);
    expect(guideFor('/galaxy/hoth/surface/deeper')).toBe(null);
  });

  it('has a guide for every world', () => {
    for (const w of WORLDS) expect(guideFor(w.to), w.to).not.toBe(null);
  });
});

describe('what the guide says', () => {
  const entries = Object.entries(PAGES);

  it('gives every page a title and something to say', () => {
    for (const [path, page] of entries) {
      expect(page.title, path).toBeTruthy();
      expect(Boolean(page.tips?.length || page.keys || page.touch), path).toBe(true);
    }
  });

  it('writes every control as keys and what they do', () => {
    for (const [path, page] of entries)
      for (const groups of [page.keys, page.touch].filter(Boolean))
        for (const g of groups) {
          expect(g.rows.length, path).toBeGreaterThan(0);
          for (const [keys, does] of g.rows) {
            expect(keyTokens(keys).some((t) => t.key), `${path}: ${keys}`).toBe(true);
            expect(does, `${path}: ${keys}`).toBeTruthy();
          }
        }
  });

  it('never names the same keys twice in one group', () => {
    for (const [path, page] of entries)
      for (const g of [...(page.keys ?? []), ...(page.touch ?? [])]) {
        const keys = g.rows.map(([k]) => k);
        expect(new Set(keys).size, `${path} ${g.label ?? ''}`).toBe(keys.length);
      }
  });

  it('tells the universe’s real flying keys (the arrows pitch; R is the weapons)', () => {
    const flying = PAGES['/universe'].keys.find((g) => g.label === 'Flying').rows;
    const does = (k) => flying.find(([keys]) => keys === k)?.[1] ?? '';
    expect(does('↑ ↓')).toMatch(/nose/i);
    expect(does('R / 1 2 3')).toMatch(/weapon/i);
    expect(JSON.stringify(PAGES['/universe'])).not.toMatch(/R to climb|C to dive/);
  });

  it('has the site’s own shortcuts and tips', () => {
    expect(SHORTCUTS.map(([k]) => k)).toContain('?');
    expect(SITE.length).toBeGreaterThan(3);
  });
});
