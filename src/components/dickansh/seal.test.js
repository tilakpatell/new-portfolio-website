/* global process */
import { describe, expect, it } from 'vitest';
import SEALED from './sealed.json';
import { normalize, seal, unseal } from './seal';

describe('the secret world’s seal', () => {
  it('reads the password loosely: case, apostrophes and spaces', () => {
    expect(normalize('  Ravana’s  GOLDEN Lanka ')).toBe(normalize("ravana's golden lanka"));
    expect(normalize('ravanas golden lanka')).toBe(normalize("ravana's golden lanka"));
  });

  it('opens what it sealed with the same password, and nothing with another', async () => {
    const box = await seal({ exhibits: [{ id: 'x' }] }, 'open sesame');
    expect(await unseal(box, 'Open Sesame')).toEqual({ exhibits: [{ id: 'x' }] });
    expect(await unseal(box, 'close sesame')).toBeNull();
  });

  it('keeps the exhibits out of the code: ciphertext only', async () => {
    expect(JSON.stringify(SEALED)).not.toMatch(/exhibit|glasses|kohl/i);
    expect(await unseal(SEALED, 'wrong')).toBeNull();
  });

  // the password isn't in the repo either: give it as DICKANSH_PASSWORD to check the real exhibits
  it.skipIf(!process.env.DICKANSH_PASSWORD)('opens the real exhibits with the password', async () => {
    const museum = await unseal(SEALED, process.env.DICKANSH_PASSWORD);
    expect(museum.exhibits.length).toBeGreaterThan(5);
    for (const ex of museum.exhibits) {
      for (const key of ['id', 'wing', 'title', 'prop', 'blurb']) expect(ex[key], `${ex.id}: ${key}`).toBeTruthy();
      expect(ex.items.length, ex.id).toBeGreaterThan(0);
    }
    expect(museum.exhibits[0].prop).toBe('glasses');
    // the list itself: every line belongs to an exhibit, and every exhibit's lines are on it
    const lines = museum.doc.lines;
    expect(lines.length).toBeGreaterThan(100);
    for (const line of lines) expect(museum.exhibits[line.x], line.t).toBeTruthy();
    const said = new Set(lines.map((l) => l.t));
    for (const ex of museum.exhibits) for (const it of ex.items) expect(said.has(it), `${ex.id}: ${it}`).toBe(true);
    expect(lines.filter((l) => l.link).every((l) => /^https:\/\//.test(l.link))).toBe(true);
  });
});
