import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHANGES, KINDS, changeById, pad, revertPhrase, tally } from './changes';

const files = import.meta.glob('./changes/*.json', { eager: true, import: 'default' });
const PUBLIC = fileURLToPath(new URL('../../public', import.meta.url));

describe("the ship's log", () => {
  it('has an entry in every file, named by its number', () => {
    for (const [path, entry] of Object.entries(files)) expect(path).toBe(`./changes/${pad(entry.id)}.json`);
  });

  it('numbers every entry once, and lists them newest first', () => {
    const ids = CHANGES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i < ids.length; i++) expect(ids[i]).toBeLessThan(ids[i - 1]);
    for (const id of ids) expect(Number.isInteger(id) && id > 0).toBe(true);
  });

  it('says everything about each change', () => {
    for (const c of CHANGES) {
      const at = `#${c.id}`;
      expect(c.title, at).toMatch(/\S/);
      expect(c.summary, at).toMatch(/\S/);
      expect(Object.keys(KINDS), at).toContain(c.kind);
      expect(c.date, at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(c.date)), at).toBe(false);
      expect(Array.isArray(c.routes), at).toBe(true);
      for (const r of c.routes) expect(r, at).toMatch(/^\//);
      expect(c.pr === null || (Number.isInteger(c.pr) && c.pr > 0), at).toBe(true);
      expect(Array.isArray(c.shots), at).toBe(true);
      expect(c.shots.length, at).toBeLessThanOrEqual(2);
      for (const s of c.shots) {
        expect(s, at).toMatch(new RegExp(`^/changes/${pad(c.id)}-(before|[a-z])\\.webp$`));
        expect(existsSync(`${PUBLIC}${s}`), `${at} ${s}`).toBe(true);
      }
      expect(c.measured === null || typeof c.measured === 'object', at).toBe(true);
      if (c.reverted) {
        expect(c.reverted.date, at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(c.reverted.why, at).toMatch(/\S/);
      } else expect(c.reverted, at).toBeNull();
    }
  });

  it('finds an entry by number and knows the words to undo it', () => {
    const first = CHANGES[CHANGES.length - 1];
    expect(changeById(first.id)).toBe(first);
    expect(changeById(String(first.id))).toBe(first);
    expect(changeById(999999)).toBeNull();
    expect(revertPhrase({ id: 12 })).toBe('Revert change 12');
  });

  it('adds the numbers up', () => {
    const t = tally([
      { id: 3, kind: 'fix', date: '2026-10-07', reverted: { date: '2026-10-08', why: 'no' } },
      { id: 2, kind: 'graphics', date: '2026-10-06', reverted: null },
      { id: 1, kind: 'graphics', date: '2026-10-05', reverted: null },
    ]);
    expect(t).toEqual({ count: 3, since: '2026-10-05', kinds: { feature: 0, graphics: 2, performance: 0, fix: 1, content: 0, infra: 0 }, reverted: 1 });
    expect(tally([])).toEqual({ count: 0, since: null, kinds: { feature: 0, graphics: 0, performance: 0, fix: 0, content: 0, infra: 0 }, reverted: 0 });
    expect(tally().count).toBe(CHANGES.length);
  });
});
