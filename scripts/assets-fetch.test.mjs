import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FOLDERS, PACKS, checkSums, joinParts, partsOf, readSums } from './assets-fetch.mjs';

describe('the Star Wars release', () => {
  it('names a file’s parts as split names them: aa, ab, …', () => {
    expect(partsOf('b1-battle-droid.glb', 3)).toEqual(['b1-battle-droid.glb.part-aa', 'b1-battle-droid.glb.part-ab', 'b1-battle-droid.glb.part-ac']);
    expect(partsOf('x.glb', 28)[26]).toBe('x.glb.part-ba');
  });

  it('joins every part there is of a file, in order, and none of another’s', () => {
    const dir = mkdtempSync(join(tmpdir(), 'parts-'));
    writeFileSync(join(dir, 'm.glb.part-ab'), 'BB');
    writeFileSync(join(dir, 'm.glb.part-aa'), 'AA');
    writeFileSync(join(dir, 'm.glb.part-ac'), 'C');
    writeFileSync(join(dir, 'other.glb.part-ad'), 'ZZ');
    const out = joinParts(dir, 'm.glb');
    expect(readFileSync(out, 'utf8')).toBe('AABBC');
  });

  it('says which files do not match their sums', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sums-'));
    writeFileSync(join(dir, 'a.glb'), 'good');
    writeFileSync(join(dir, 'b.glb'), 'tampered');
    const sha = (s) => createHash('sha256').update(s).digest('hex');
    const sums = readSums(`${sha('good')}  a.glb\n${sha('bad')} *b.glb\n`);
    expect(sums).toEqual({ 'a.glb': sha('good'), 'b.glb': sha('bad') });
    expect(checkSums(dir, sums, ['a.glb', 'b.glb'])).toEqual(['b.glb']);
  });

  it('carries each model’s credit, as the assets repo lists it', () => {
    const { models } = PACKS.starwars;
    expect(Object.keys(models).sort()).toEqual(['atat', 'atat1k', 'b1', 'tie', 'venator', 'venatorcw']);
    for (const m of Object.values(models)) {
      expect(m.file).toMatch(/\.glb$/);
      expect(m.author && m.authorUrl && m.license && m.source).toBeTruthy();
    }
    expect(models.b1).toMatchObject({ author: 'leoxx300', license: 'CC-BY-4.0', file: 'b1-battle-droid.glb' });
  });

  it('knows where each pack sits in the assets repo', () => {
    expect(FOLDERS.naturemega).toBe('stylized-nature-megakit');
    expect(FOLDERS.ual1).toBe('universal-animation-library');
  });
});
