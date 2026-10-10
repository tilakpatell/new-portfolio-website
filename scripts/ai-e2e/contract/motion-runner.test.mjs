// Tier 1: a motion issue from end to end, as the desktop's runner takes it:
// read through the fake gh, the clip written by the fake model, baked onto
// Luke for real in a temporary repository, pushed to its bare origin, and
// answered with a pull request and a comment; or failed with a label, a
// comment that says why, and nothing pushed.
import { describe, expect, it } from 'vitest';
import { sandbox } from './repo.mjs';

const FILES = ['scripts/motion', 'scripts/preview/ualRetarget.js', 'scripts/gen3d', 'scripts/desktop', 'scripts/ai-e2e/fakes', 'public/models/galaxy/crew/luke.glb', 'public/games/credits.json'];
// no browser for the sheet: the PR goes up without one
const NO_BROWSER = { CHROME: '/nowhere/chrome' };

function job(body, { title = 'contract-strike' } = {}) {
  const box = sandbox({ judge: null, env: { MOTION_ENGINE: 'fake', MOTION_VRAM_MIB: '1' } });
  const repo = box.repo(FILES);
  box.env.MOTION_RUNNER_ROOT = repo.root;
  box.fixture('api', { 'issues/1': { number: 1, title, state: 'open', body, labels: [{ name: 'motion' }], author_association: 'OWNER', user: { login: 'owner' } } });
  box.fixture('label-list', []);
  box.fixture('pr-list', []);
  box.fixture('pr-create', 'https://github.com/owner/site/pull/88');
  return { box, repo };
}
const call = (box, ...prefix) => box.gh().filter((c) => prefix.every((p, i) => c[i] === p));
const branches = (repo) => repo.originGit('branch', '--list', '--format=%(refname:short)').split('\n').filter(Boolean);

describe('a motion issue through the runner (subprocesses, a few seconds each)', () => {
  it('ends as a branch with the clip, its BVH and its credit, a pull request that says what it is, and a closed issue', async () => {
    const { box, repo } = job('prompt: a two-handed overhead sword strike, stepping forward\nseconds: 2  seed: 7');
    const r = await box.runner('motion', ['--issue', '1'], NO_BROWSER);
    expect(r.status, `${r.out}\n${r.err}`).toBe(0);
    expect(branches(repo)).toContain('motion/contract-strike');
    const files = repo.originGit('show', '--name-only', '--format=', 'motion/contract-strike').split('\n').filter(Boolean);
    expect(files.sort()).toEqual(['docs/motion/contract-strike.bvh', 'public/games/credits.json', 'public/games/meshy/ual-gen.contract-strike.glb']);
    const credits = JSON.parse(repo.originGit('show', 'motion/contract-strike:public/games/credits.json'));
    expect(credits['motion/ual-gen.contract-strike'].license).toMatch(/EU, the UK or South Korea/);
    const [create] = call(box, 'pr', 'create');
    const body = create[create.indexOf('--body') + 1];
    expect(create[create.indexOf('--head') + 1]).toBe('motion/contract-strike');
    expect(body).toMatch(/"a two-handed overhead sword strike, stepping forward" \(2 s, seed 7, cfg 5\)/);
    expect(body).toMatch(/ual-gen\.contract-strike\.glb [\d.]+ KB, 2\.00 s, 61 frames/);
    expect(body).toContain('motion.html?clip=contract-strike&with=sword.heavy.a');
    // the fake model was asked what the issue asked
    const [model] = box.fakes('motion');
    expect(model.argv.join(' ')).toMatch(/^a two-handed overhead sword strike, stepping forward .*contract-strike\.bvh --seconds 2 --seed 7$/);
    expect(call(box, 'issue', 'comment').map((c) => c[4])).toContainEqual(expect.stringMatching(/^Made: https:\/\/github\.com\/owner\/site\/pull\/88/));
    expect(call(box, 'issue', 'close')).toHaveLength(1);
    expect(call(box, 'issue', 'edit').map((c) => c.slice(3).join(' '))).toEqual(['--add-label motion:running', '--remove-label motion:running']);
  });

  it('fails an issue with no prompt with a label and a comment that says so, and pushes nothing', async () => {
    const { box, repo } = job('seconds: 3');
    const r = await box.runner('motion', ['--issue', '1'], NO_BROWSER);
    expect(r.status).toBe(1);
    expect(call(box, 'issue', 'comment').map((c) => c[4])).toContainEqual(expect.stringMatching(/^Can't read this job: prompt: say what the body does/));
    expect(call(box, 'issue', 'edit').map((c) => c.slice(3).join(' '))).toEqual(['--add-label motion:failed']);
    expect(branches(repo)).toEqual(['main']);
  });

  it('fails a run whose model dies with the log’s tail in the comment, and pushes nothing', async () => {
    const { box, repo } = job('prompt: a strike');
    const r = await box.runner('motion', ['--issue', '1'], { ...NO_BROWSER, GEN3D_FAKE_FAIL_AT: 'generate' });
    expect(r.status).toBe(1);
    const failed = call(box, 'issue', 'comment').map((c) => c[4]).find((b) => b.startsWith('Failed'));
    expect(failed).toMatch(/fake motion: failing at generate/);
    expect(call(box, 'issue', 'edit').map((c) => c.slice(3).join(' '))).toEqual(['--add-label motion:running', '--add-label motion:failed', '--remove-label motion:running']);
    expect(branches(repo)).toEqual(['main']);
  });
});
