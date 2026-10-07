import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOURS, textOf } from './steps';

// every data-tour="…" name marked in the components
const marked = () => {
  const names = new Set();
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.jsx$/.test(e.name)) for (const m of readFileSync(p, 'utf8').matchAll(/data-tour="([^"]+)"/g)) m[1].split(' ').forEach((n) => names.add(n));
    }
  };
  walk(join(import.meta.dirname, '..'));
  return names;
};

describe('the tours’ stops', () => {
  const ctx = { key: '⌘K' };

  it('has one for each view of the site, and only the audiences’ besides', () => {
    expect(Object.keys(TOURS)).toEqual(expect.arrayContaining(['classic', 'universe']));
    for (const name of Object.keys(TOURS)) expect(['classic', 'universe', 'recruiter', 'player', 'mixed'], name).toContain(name);
  });

  it('opens and closes each tour on a card that points at nothing', () => {
    for (const [name, steps] of Object.entries(TOURS)) {
      expect(steps[0].at, name).toBeUndefined();
      expect(steps.at(-1).at, name).toBeUndefined();
    }
  });

  it('gives every stop a title and something to say, and a name of its own', () => {
    for (const [name, steps] of Object.entries(TOURS)) {
      expect(new Set(steps.map((s) => s.id)).size, name).toBe(steps.length);
      for (const s of steps) {
        expect(s.title, `${name}/${s.id}`).toBeTruthy();
        expect(textOf(s, ctx).length, `${name}/${s.id}`).toBeGreaterThan(20);
      }
    }
  });

  it('points only at things marked in the page for it', () => {
    const names = marked();
    for (const steps of Object.values(TOURS)) for (const s of steps) if (s.at) expect(names.has(s.at), `data-tour="${s.at}"`).toBe(true);
  });

  it('says the shortcut this device uses', () => {
    const search = TOURS.classic.find((s) => s.at === 'search');
    expect(textOf(search, { key: 'Ctrl K' })).toContain('Ctrl K');
  });

  it('ends by saying where to take it again', () => {
    for (const steps of Object.values(TOURS)) expect(textOf(steps.at(-1), ctx)).toMatch(/guide/);
  });
});
