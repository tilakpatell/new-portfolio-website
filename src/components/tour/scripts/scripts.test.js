import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { legsFor, flatten } from '../../../lib/tour';
import { textOf } from '../steps';
import { MODES, loadScript } from './index';
import { RECRUITER } from './recruiter';

// every data-tour="…" name marked in the components and pages
const marked = () => {
  const names = new Set();
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.jsx$/.test(e.name)) for (const m of readFileSync(p, 'utf8').matchAll(/data-tour="([^"]+)"/g)) m[1].split(' ').forEach((n) => names.add(n));
    }
  };
  walk(join(import.meta.dirname, '..', '..', '..'));
  return names;
};

const SCRIPTS = { recruiter: RECRUITER };

describe('the tours across pages', () => {
  const ctx = { key: '⌘K', touch: false };

  it('are the ones the picker offers', async () => {
    expect(MODES.map((m) => m.id)).toEqual(Object.keys(SCRIPTS));
    for (const m of MODES) {
      expect(m.title, m.id).toBeTruthy();
      expect(m.text, m.id).toBeTruthy();
      expect((await loadScript(m.id)).id, m.id).toBe(m.id);
    }
    expect(await loadScript('nope')).toBe(null);
  });

  it('give every leg a page and a title, and every stop a title, words and a name of its own', () => {
    for (const [name, script] of Object.entries(SCRIPTS)) {
      expect(script.title, name).toBeTruthy();
      expect(script.achievement, name).toMatch(/^tour-/);
      const legs = legsFor(script, { touch: false });
      expect(legs.length, name).toBeGreaterThan(1);
      for (const leg of legs) {
        expect(leg.path, `${name}/${leg.id}`).toMatch(/^\//);
        expect(leg.title, `${name}/${leg.id}`).toBeTruthy();
      }
      const stops = flatten(legs);
      expect(new Set(stops.map((s) => s.id)).size, name).toBe(stops.length);
      for (const s of stops) {
        expect(s.title, `${name}/${s.id}`).toBeTruthy();
        expect(textOf(s, ctx).length, `${name}/${s.id}`).toBeGreaterThan(20);
      }
    }
  });

  it('open and close on a card that points at nothing', () => {
    for (const [name, script] of Object.entries(SCRIPTS)) {
      const stops = flatten(legsFor(script, { touch: false }));
      expect(stops[0].at, name).toBeUndefined();
      expect(stops.at(-1).at, name).toBeUndefined();
      expect(textOf(stops.at(-1), ctx), name).toMatch(/guide/);
    }
  });

  it('point only at things marked in a page for them', () => {
    const names = marked();
    for (const script of Object.values(SCRIPTS)) for (const leg of script.legs) for (const s of leg.stops) if (s.at) expect(names.has(s.at), `data-tour="${s.at}"`).toBe(true);
  });

  it('run in under the time they promise, at a stop every ten seconds or so', () => {
    for (const [name, script] of Object.entries(SCRIPTS)) {
      const stops = flatten(legsFor(script, { touch: false })).length;
      expect(stops * 10, name).toBeLessThanOrEqual(script.minutes * 60 + 30);
    }
  });
});
