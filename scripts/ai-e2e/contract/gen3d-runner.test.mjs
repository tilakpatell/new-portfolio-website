// Tier 1: a gen3d issue from end to end, as the desktop's runner takes it:
// read through the fake gh, the picture fetched from a local server, made
// with the fake engines in a temporary repository, pushed to its bare
// origin, and answered with a pull request and a comment; or failed with a
// label, a comment that says why, and nothing pushed.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { issue, sandbox, serveFixtures } from './repo.mjs';

let server;
beforeAll(async () => {
  server = await serveFixtures();
});
afterAll(() => server.close());

// no Chromium for the sheet: the fake sheet stands in, and no dev server starts
const NO_BROWSER = { CHROME: '/nowhere/chrome' };

function job(file, { title = 'x-wing', judge = 'judge-good.json' } = {}) {
  const box = sandbox({ judge });
  const repo = box.repo();
  box.fixture('api', { 'issues/1': issue(1, title, file, server.base) });
  box.fixture('label-list', []);
  box.fixture('pr-list', []);
  box.fixture('pr-create', 'https://github.com/owner/site/pull/77');
  return { box, repo };
}
const call = (box, ...prefix) => box.gh().filter((c) => prefix.every((p, i) => c[i] === p));
const branches = (repo) => repo.originGit('branch', '--list', '--format=%(refname:short)').split('\n').filter(Boolean);

describe('a gen3d issue through the runner (subprocesses, up to 10 s each)', () => {
  it('ends as a branch on origin, a pull request that shows the sheet, verdict and cuts, and a closed issue', async () => {
    const { box, repo } = job('issue-full.md');
    const r = await box.runner('gen3d', ['--issue', '1'], NO_BROWSER);
    expect(r.status, `${r.out}\n${r.err}`).toBe(0);
    expect(branches(repo)).toContain('gen3d/x-wing');
    const files = repo.originGit('show', '--name-only', '--format=', 'gen3d/x-wing').split('\n');
    expect(files.sort()).toEqual(['docs/gen3d/x-wing.png', 'public/games/credits.json', 'public/models/gen3d/x-wing.glb', 'public/models/gen3d/x-wing.hq.glb', 'public/models/gen3d/x-wing.lo.glb']);
    const [create] = call(box, 'pr', 'create');
    const body = create[create.indexOf('--body') + 1];
    expect(create[create.indexOf('--head') + 1]).toBe('gen3d/x-wing');
    expect(body).toContain('https://raw.githubusercontent.com/owner/site/gen3d/x-wing/docs/gen3d/x-wing.png');
    expect(body).toMatch(/verdict: 9\/10/);
    expect(body).toMatch(/hq: [\d,]+ triangles, \d+ KB/);
    expect(body).toMatch(/lo: [\d,]+ triangles, \d+ KB/);
    expect(call(box, 'issue', 'comment').map((c) => c[4])).toContainEqual(expect.stringMatching(/^Made: https:\/\/github\.com\/owner\/site\/pull\/77/));
    expect(call(box, 'issue', 'close')).toHaveLength(1);
    const labels = call(box, 'issue', 'edit').map((c) => c.slice(3).join(' '));
    expect(labels).toEqual(['--add-label gen3d:running', '--remove-label gen3d:running']);
  });

  it('passes every field of the issue to the pipeline', async () => {
    const { box } = job('issue-full.md');
    await box.runner('gen3d', ['--issue', '1'], NO_BROWSER);
    const [engine] = box.fakes('engine');
    // seed, res, fov and the engine asked for reach the engine; faithful: no keeps Pixal3D off
    expect(engine.argv.join(' ')).toMatch(/--seed 1 .*--res 1024 .*--fov 49 .*--asked trelliscpp/);
    expect(engine.argv).not.toContain('--faithful');
    // faces and tex reach the bake
    const [bake] = box.fakes('blender');
    expect(bake.argv.join(' ')).toMatch(/--faces 8000 --tex 1024/);
    // fresh: yes ignores the cache
    expect(box.fakes('engine')).toHaveLength(1);
  });

  it('fails an issue it can’t read with a label and a comment quoting the field, and pushes nothing', async () => {
    const { box, repo } = job('issue-bad-faces.md');
    const r = await box.runner('gen3d', ['--issue', '1'], NO_BROWSER);
    expect(r.status).toBe(1);
    expect(call(box, 'issue', 'edit').map((c) => c.slice(3).join(' '))).toEqual(['--add-label gen3d:failed']);
    expect(call(box, 'issue', 'comment')[0][4]).toMatch(/Can't read this job: faces: "lots" isn't a number from 300 to 1000000/);
    expect(branches(repo)).toEqual(['main']);
    expect(box.fakes('engine')).toEqual([]);
  });

  it('fails a run whose engine dies with the log’s tail in the comment, and pushes nothing', async () => {
    const { box, repo } = job('issue-full.md');
    const r = await box.runner('gen3d', ['--issue', '1'], { ...NO_BROWSER, GEN3D_FAKE_FAIL_AT: 'generate' });
    expect(r.status).toBe(1);
    const failed = call(box, 'issue', 'comment').map((c) => c[4]).find((b) => b.startsWith('Failed'));
    expect(failed).toMatch(/fake engine: failing at generate/);
    expect(call(box, 'issue', 'edit').map((c) => c.slice(3).join(' '))).toEqual(['--add-label gen3d:running', '--add-label gen3d:failed', '--remove-label gen3d:running']);
    expect(branches(repo)).toEqual(['main']);
    expect(call(box, 'pr', 'create')).toEqual([]);
  });

  it('gives the engine all four sides of a multi-view issue at once', async () => {
    const { box } = job('issue-multiview.md');
    const r = await box.runner('gen3d', ['--issue', '1'], NO_BROWSER);
    expect(r.status, `${r.out}\n${r.err}`).toBe(0);
    const engines = box.fakes('engine');
    expect(engines).toHaveLength(1);
    for (const side of ['--left', '--back', '--right']) expect(engines[0].argv).toContain(side);
  });
});
