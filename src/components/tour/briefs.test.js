import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRIEFS, rowsFor } from './briefs';
import { ASKED, BRIEFED } from './brief';
import { GUIDES } from '../guide/routes';
import { keyTokens } from '../guide/keys';

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

describe('the worlds’ basics', () => {
  it('has them for exactly the worlds and the asks brief.js names', () => {
    expect(Object.keys(BRIEFS).sort()).toEqual([...BRIEFED, ...ASKED].sort());
  });

  it('has them for every page with controls the guide sends you to', () => {
    for (const [key, g] of Object.entries(GUIDES)) if (g.nudge) expect(BRIEFS[key], key).toBeTruthy();
  });

  it('opens on what the place is, and ends at the guide’s button', () => {
    for (const [key, steps] of Object.entries(BRIEFS)) {
      expect(steps[0].at, key).toBeUndefined();
      expect(steps[0].keys ?? steps[0].touch, key).toBeUndefined();
      expect(steps.at(-1).at, key).toBe('guide');
      expect(steps.at(-1).text, key).toMatch(/\?/);
    }
  });

  it('keeps to a few stops, each with a title, something to say and a name of its own', () => {
    for (const [key, steps] of Object.entries(BRIEFS)) {
      expect(steps.length, key).toBeGreaterThanOrEqual(3);
      expect(steps.length, key).toBeLessThanOrEqual(6);
      expect(new Set(steps.map((s) => s.id)).size, key).toBe(steps.length);
      for (const s of steps) {
        expect(s.title, `${key}/${s.id}`).toBeTruthy();
        expect(s.text.length, `${key}/${s.id}`).toBeGreaterThan(20);
      }
    }
  });

  it('shows how to move, on a keyboard and on a phone', () => {
    for (const [key, steps] of Object.entries(BRIEFS)) {
      expect(steps.some((s) => s.keys), key).toBe(true);
      expect(steps.some((s) => s.touch), key).toBe(true);
    }
  });

  it('writes every control as the guide does: a few keys and what they do', () => {
    for (const [key, steps] of Object.entries(BRIEFS))
      for (const s of steps)
        for (const rows of [s.keys, s.touch].filter(Boolean)) {
          expect(rows.length, `${key}/${s.id}`).toBeLessThanOrEqual(5);
          for (const row of rows) {
            expect(row, `${key}/${s.id}`).toHaveLength(2);
            expect(keyTokens(row[0]).some((t) => t.key), `${key}/${s.id}: ${row[0]}`).toBe(true);
            expect(row[1].length, `${key}/${s.id}: ${row[0]}`).toBeGreaterThan(1);
          }
        }
  });

  it('points only at things marked in the page for it', () => {
    const names = marked();
    for (const steps of Object.values(BRIEFS)) for (const s of steps) if (s.at) expect(names.has(s.at), `data-tour="${s.at}"`).toBe(true);
  });

  it('shows a phone its own controls, and no keyboard’s', () => {
    const fly = BRIEFS['/galaxy'].find((s) => s.id === 'fly');
    expect(rowsFor(fly, false)).toBe(fly.keys);
    expect(rowsFor(fly, true)).toBe(fly.touch);
    const port = BRIEFS['/deathstar'].find((s) => s.id === 'port');
    expect(rowsFor(port, true)).toBeNull();
  });
});
