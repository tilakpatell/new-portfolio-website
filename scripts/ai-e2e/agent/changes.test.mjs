// Tier 7, the ship's log as the autopilot writes it (scripts/autopilot-log.mjs)
// and the /changes page reads it: every entry well-formed, its screenshots
// there, and the next number one past the last.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO, run } from '../contract/repo.mjs';

const DIR = join(REPO, 'src', 'data', 'changes');
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.json'));
const ENTRIES = FILES.map((f) => [f, JSON.parse(readFileSync(join(DIR, f), 'utf8'))]);
const KINDS = ['feature', 'graphics', 'performance', 'fix', 'content', 'infra'];

describe('the ship’s log', () => {
  it('has entries, each named by its number', () => {
    expect(ENTRIES.length).toBeGreaterThan(0);
    for (const [f, e] of ENTRIES) expect(f).toBe(`${String(e.id).padStart(4, '0')}.json`);
  });

  it.each(ENTRIES)('%s is well-formed: a date, a kind, words, routes, its pull request, screenshots that exist', (f, e) => {
    expect(Number.isInteger(e.id) && e.id > 0, 'id').toBe(true);
    expect(e.date, 'date').toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(KINDS, 'kind').toContain(e.kind);
    expect(e.title.length, 'title').toBeGreaterThan(5);
    expect(e.summary.length, 'summary').toBeGreaterThan(20);
    expect(Array.isArray(e.routes) && e.routes.every((r) => r.startsWith('/')), 'routes').toBe(true);
    expect(Number.isInteger(e.pr) && e.pr > 0, 'pr').toBe(true);
    for (const s of e.shots ?? []) expect(existsSync(join(REPO, 'public', s)), `${s} is missing`).toBe(true);
    // never reverted, or reverted with a date and a reason
    if (e.reverted !== null && e.reverted !== undefined) {
      expect(e.reverted.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.reverted.why.length).toBeGreaterThan(0);
    }
  });

  it('gives the next entry the number one past the highest (a subprocess)', async () => {
    const r = await run(process.execPath, [join(REPO, 'scripts', 'autopilot-log.mjs'), '--next']);
    const top = Math.max(...ENTRIES.map(([, e]) => e.id));
    expect(r.out.trim()).toBe(String(top + 1).padStart(4, '0'));
  });
});
