// Tier 2: the voice lines as shipped. Every file is in the manifest and
// every manifest entry is a file; each is a real mp3 of a sensible length;
// each is a line the site still says (its id is lineId() of a line
// export-lines.mjs finds today); and every speaker with lines has a folder
// of them. What breaks a rule today is on an allow-list beside this file,
// which only shrinks: what is on it is a finding for the owner.
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { REPO, run } from '../contract/repo.mjs';
import { mp3 } from './mp3.mjs';

const VOICED = join(REPO, 'public', 'audio', 'voiced');
const MANIFEST = JSON.parse(readFileSync(join(VOICED, 'manifest.json'), 'utf8')).lines;
const allow = (name) => JSON.parse(readFileSync(new URL(`./${name}`, import.meta.url), 'utf8'));
const ORPHANS = allow('allow-orphans.json');
const VOICELESS = allow('allow-voiceless.json');
const FILES = readdirSync(VOICED, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((d) => readdirSync(join(VOICED, d.name)).map((f) => `${d.name}/${f}`));
// the shortest a line can be said in, and longer than any line the site has
const SHORTEST = 0.3;
const LONGEST = 30;

describe('the voice lines as shipped', () => {
  it('are each in the manifest, and each manifest entry is a file', () => {
    const listed = new Set(Object.values(MANIFEST));
    expect(FILES.filter((f) => !listed.has(f) && !ORPHANS.unlisted.includes(f)), 'files the manifest doesn’t list').toEqual([]);
    expect(Object.values(MANIFEST).filter((f) => !existsSync(join(VOICED, f))), 'manifest entries with no file').toEqual([]);
    expect(Object.entries(MANIFEST).filter(([id, f]) => !f.endsWith(`/${id}.mp3`)), 'entries filed under another id').toEqual([]);
  });

  it(`are each a real mp3 between ${SHORTEST} and ${LONGEST} seconds long`, () => {
    const bad = FILES.filter((f) => f.endsWith('.mp3')).flatMap((f) => {
      const m = mp3(readFileSync(join(VOICED, f)));
      if (!m.frames) return [`${f}: not an mp3`];
      return m.seconds < SHORTEST || m.seconds > LONGEST ? [`${f}: ${m.seconds.toFixed(2)} s`] : [];
    });
    expect(bad).toEqual([]);
    expect(FILES.filter((f) => !f.endsWith('.mp3')), 'anything else in the folders').toEqual([]);
  });

  describe('against the lines the site says today (export-lines.mjs, up to 10 s)', () => {
    let lines;
    beforeAll(async () => {
      const out = join(mkdtempSync(join(tmpdir(), 'ai-e2e-lines-')), 'lines.json');
      const r = await run(process.execPath, [join(REPO, 'scripts', 'voices', 'export-lines.mjs'), '--out', out]);
      if (r.status) throw new Error(`export-lines.mjs failed:\n${r.err}`);
      lines = JSON.parse(readFileSync(out, 'utf8'));
    }, 60000);

    it('is each a line the site still says', () => {
      const said = new Set(lines.map((l) => l.id));
      const orphans = Object.entries(MANIFEST)
        .filter(([id]) => !said.has(id))
        .map(([, f]) => f);
      expect(orphans.filter((f) => !ORPHANS.unsaid.includes(f)), 'lines no longer said (their text changed, or they’re gone)').toEqual([]);
    });

    it('has a folder for every speaker with lines to say, but the few with no reference yet', () => {
      const speakers = [...new Set(lines.map((l) => l.who))].sort();
      expect(speakers.filter((who) => !existsSync(join(VOICED, who)) && !VOICELESS.speakers.includes(who))).toEqual([]);
    });

    it('keeps its allow-lists to what is still so', () => {
      const said = new Set(lines.map((l) => l.id));
      const idOf = Object.fromEntries(Object.entries(MANIFEST).map(([id, f]) => [f, id]));
      const stale = [
        ...ORPHANS.unlisted.filter((f) => !FILES.includes(f) || f in idOf),
        ...ORPHANS.unsaid.filter((f) => !(f in idOf) || said.has(idOf[f])),
        ...VOICELESS.speakers.filter((who) => existsSync(join(VOICED, who)) || !lines.some((l) => l.who === who)),
      ];
      expect(stale, 'fixed since: take these off the allow-lists').toEqual([]);
    });
  });
});
