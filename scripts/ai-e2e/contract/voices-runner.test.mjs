// Tier 1: a voices issue through the desktop's runner: read through the
// fake gh, the lines exported and made with the fake worker and ears in a
// temporary repository, pushed to its bare origin, and a pull request
// whose body says what summarise() read from generate.py's output.
import { describe, expect, it } from 'vitest';
import { sandbox } from './repo.mjs';
import { missing, voicesRepo } from './voices-kit.mjs';

// on CI the tools are installed for this job, so a missing one is a failure there, never a quiet skip
const why = process.env.CI ? null : missing();

describe.skipIf(why)(`a voices issue through the runner (subprocesses, up to 10 s)${why ? `: skipped, ${why}` : ''}`, () => {
  it('ends as a branch and a pull request that counts the lines made and names who has no voice', async () => {
    const box = sandbox();
    const { repo } = voicesRepo(box);
    box.fixture('api', { 'issues/1': { number: 1, title: 'contract voices', state: 'open', body: 'only: rick, han, luke\nrick: Get schwifty.', labels: [{ name: 'voices' }], author_association: 'OWNER', user: { login: 'owner' } } });
    box.fixture('label-list', []);
    box.fixture('pr-list', []);
    box.fixture('pr-create', 'https://github.com/owner/site/pull/88');
    const r = await box.runner('voices', ['--issue', '1']);
    expect(r.status, `${r.out}\n${r.err}`).toBe(0);
    const files = repo.originGit('show', '--name-only', '--format=', 'voices/contract-voices').split('\n').filter(Boolean);
    expect(files.filter((f) => f.endsWith('.mp3'))).toHaveLength(6);
    expect(files).toContain('public/audio/voiced/manifest.json');
    const [create] = box.gh().filter((c) => c[0] === 'pr' && c[1] === 'create');
    expect(create[create.indexOf('--title') + 1]).toBe('Voice lines: contract-voices (6 made)');
    const body = create[create.indexOf('--body') + 1];
    // the five of the fixture's lines with a voice, and the one the issue asked for ahead of its code
    expect(body).toMatch(/6 line\(s\) made, 1 doubtful/);
    expect(body).toMatch(/the manifest now has 6 lines/);
    expect(body).toMatch(/No voice yet for: luke/);
    expect(box.gh().filter((c) => c[0] === 'issue' && c[1] === 'comment').map((c) => c[4])).toContainEqual(expect.stringMatching(/^Made: https:\/\/github\.com\/owner\/site\/pull\/88/));
  });
});
