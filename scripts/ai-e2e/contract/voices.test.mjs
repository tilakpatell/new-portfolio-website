// Tier 1: voices from the lines a world says to the mp3s and the manifest
// the site plays them from. export-lines.mjs over a fixture src/ tree (two
// worlds' voicelines.js), then generate.py with the fake worker and the
// fake ears, then the files as the site would look them up: by lineId(),
// computed here in JavaScript, so the two sides are held to agree.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lineId, voiceOf } from '../../../src/lib/voiced.js';
import { REPO, run, sandbox } from './repo.mjs';
import { missing, python, voicesRepo } from './voices-kit.mjs';

// on CI the tools are installed for this job, so a missing one is a failure there, never a quiet skip
const why = process.env.CI ? null : missing();
const WORLDS = ['alpha', 'beta'].flatMap((w) => readFileSync(join(REPO, 'scripts', 'ai-e2e', 'contract', 'fixtures', 'voices-src', 'src', 'worlds', w, 'voicelines.js'), 'utf8').match(/\{ who: '[a-z]+', text: '[^']+' \}/g));
const FIXTURE = WORLDS.map((l) => ({ who: l.match(/who: '([a-z]+)'/)[1], text: l.match(/text: '([^']+)'/)[1] }));

describe.skipIf(why)(`voices from lines to manifest (subprocesses, up to 10 s)${why ? `: skipped, ${why}` : ''}`, () => {
  it('exports every line of every voicelines.js, makes the ones with a voice, and the site finds each by its id', async () => {
    const box = sandbox();
    const { repo, cache } = voicesRepo(box);
    const exported = await run(process.execPath, [join(repo.root, 'scripts', 'voices', 'export-lines.mjs')], { cwd: repo.root, env: box.env });
    expect(exported.status, exported.err).toBe(0);
    const lines = JSON.parse(readFileSync(join(repo.root, 'scripts', 'voices', 'lines.json'), 'utf8'));
    expect(lines).toHaveLength(6);
    expect(lines.map((l) => l.who).sort()).toEqual(['han', 'han', 'han', 'luke', 'rick', 'rick']);
    for (const { who, text } of FIXTURE) expect(lines).toContainEqual({ id: lineId(voiceOf(who), text), who, text });

    const made = await run(box.env.VOICES_PYTHON, [join(repo.root, 'scripts', 'voices', 'generate.py'), '--takes', '2'], { cwd: repo.root, env: box.env });
    expect(made.status, made.err).toBe(0);
    expect(made.out).toMatch(/^luke: no reference yet/m);
    expect(made.out).toMatch(/Done: 5 lines, 1 doubtful/);

    const voiced = join(repo.root, 'public', 'audio', 'voiced');
    const manifest = JSON.parse(readFileSync(join(voiced, 'manifest.json'), 'utf8'));
    const want = FIXTURE.filter((l) => l.who !== 'luke').map((l) => [lineId(l.who, l.text), `${l.who}/${lineId(l.who, l.text)}.mp3`]);
    expect(Object.entries(manifest.lines).sort()).toEqual(want.sort());
    for (const [, file] of want) {
      const head = readFileSync(join(voiced, file)).subarray(0, 3);
      // an ID3 tag or an MPEG frame's sync bits: an mp3, not a renamed WAV
      expect(head.toString('latin1') === 'ID3' || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0), file).toBe(true);
    }
    expect(existsSync(join(voiced, 'luke'))).toBe(false);
    expect(readdirSync(join(voiced, 'han'))).toHaveLength(3);

    // the mumbled line passed no round: it ships its least-wrong take and is listed for a person to hear
    const report = readFileSync(join(cache, 'takes', 'report.md'), 'utf8');
    expect(report).toMatch(/\| han \| Han mumbles something about the Kessel Run\. \|/);
    expect(report.match(/^\| (rick|han) \|/gm)).toHaveLength(1);
  });

  it('runs the Python side’s own tests of the fakes', async () => {
    const r = await run(python(), ['-m', 'unittest', 'discover', '-s', join(REPO, 'scripts', 'voices'), '-p', 'test_judge_fake.py'], { cwd: REPO });
    expect(r.status, r.err).toBe(0);
    expect(r.err).toMatch(/Ran \d+ tests[\s\S]*OK/);
  });
});
