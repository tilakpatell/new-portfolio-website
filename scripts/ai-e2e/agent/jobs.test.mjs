// Tier 7, the desktop jobs' contract: what ask.mjs writes, the runners read
// back as the same job (a property over generated requests); status.mjs
// over gh's answers in every state; the doctor finding a tool where the
// Claude app's box put it, and saying how to fix one that's missing.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { seeded } from '../fakes/png.mjs';
import { ask } from '../../desktop/ask.mjs';
import { parseIssue as gen3dIssue, slug } from '../../gen3d/runner.mjs';
import { parseIssue as voicesIssue } from '../../voices/runner.mjs';
import { REPO, run, sandbox } from '../contract/repo.mjs';

const WORDS = ['an', 'X-wing', 'starfighter', 'old', 'redwood', 'stump', 'grey', 'TIE', 'with', 'wings', 'Hondo’s', 'ship', 'a', 'cactus,', 'tall'];
const ENGINES = ['trelliscpp', 'trellis2', 'hunyuan'];

// a request as a person or a session would make it, drawn from the seed
function request(r) {
  const pick = (list) => list[Math.floor(r() * list.length)];
  const words = (n) => Array.from({ length: n }, () => pick(WORDS)).join(' ');
  const want = { name: `model ${Math.floor(r() * 1000)}`, what: words(2 + Math.floor(r() * 4)) };
  const kind = r();
  if (kind < 0.4) want.image = [`https://x.test/${Math.floor(r() * 1e6)}.png`];
  else if (kind < 0.6) want.image = ['front', 'left', 'back', 'right'].map((s) => `https://x.test/${s}-${Math.floor(r() * 1e6)}.png`);
  else want.prompt = words(3 + Math.floor(r() * 5));
  if (r() < 0.6) want.faces = 300 + Math.floor(r() * 120000);
  if (r() < 0.5) want.tex = pick([256, 512, 1024, 2048, 4096]);
  const options = {};
  if (r() < 0.5) options.seed = Math.floor(r() * 1e6);
  if (r() < 0.3) options.res = pick([512, 1024, 1536]);
  if (r() < 0.3) options.fov = 5 + Math.floor(r() * 100);
  if (r() < 0.3) options.engine = pick(ENGINES);
  if (r() < 0.3) options.faithful = 'no';
  if (r() < 0.3) options.bake = 'no';
  if (r() < 0.3) options.fresh = 'yes';
  return { want, options };
}

const argv = ({ want, options }) => [
  want.name,
  '--what', want.what,
  ...(want.image ?? []).flatMap((u) => ['--image', u]),
  ...(want.prompt ? ['--prompt', want.prompt] : []),
  ...(want.faces ? ['--faces', String(want.faces)] : []),
  ...(want.tex ? ['--tex', String(want.tex)] : []),
  ...(Object.keys(options).length ? ['--options', Object.entries(options).map(([k, v]) => `${k}: ${v}`).join('  ')] : []),
  '--dry-run',
];

describe('a job asked for, read back by the runner', () => {
  it('is the same job, for 100 generated gen3d requests', async () => {
    for (let seed = 1; seed <= 100; seed++) {
      const req = request(seeded(seed));
      const { title, body } = await ask('gen3d', argv(req));
      const job = gen3dIssue({ number: seed, title, body });
      const { want, options } = req;
      const say = `seed ${seed}: ${body}`;
      expect(job.error, say).toBeUndefined();
      expect(job.name, say).toBe(slug(want.name));
      expect(job.what, say).toBe(want.what);
      if (want.image?.length === 4) expect(job.views, say).toEqual({ front: want.image[0], left: want.image[1], back: want.image[2], right: want.image[3] });
      if (want.image) expect(job.image, say).toBe(want.image[0]);
      else expect(job.prompt, say).toBe(want.prompt);
      expect([job.faces, job.tex], say).toEqual([want.faces, want.tex]);
      expect([job.seed, job.res, job.fov, job.engine], say).toEqual([options.seed, options.res, options.fov, options.engine]);
      expect(job.faithful, say).toBe(Boolean(want.image) && options.faithful !== 'no');
      expect([job.noBake, job.fresh], say).toEqual([options.bake === 'no', options.fresh === 'yes']);
    }
  });

  it('is the same speakers and lines, for 50 generated voices requests', async () => {
    const WHO = ['rick', 'morty', 'han', 'luke', 'walt', 'jesse'];
    for (let seed = 1; seed <= 50; seed++) {
      const r = seeded(seed * 31);
      const only = WHO.filter(() => r() < 0.4);
      const lines = WHO.filter(() => r() < 0.3).map((who) => ({ who, text: `${WORDS[Math.floor(r() * WORDS.length)]}, said ${seed}.` }));
      const args = ['batch', ...(only.length ? ['--only', only.join(',')] : []), ...lines.flatMap((l) => ['--line', `${l.who}: ${l.text}`]), '--dry-run'];
      const { title, body } = await ask('voices', args);
      const job = voicesIssue({ number: seed, title, body });
      expect(job.only, body).toEqual(only.length ? only : null);
      expect(job.lines, body).toEqual(lines);
    }
  });
});

describe('the status, over gh’s answers (subprocesses, up to 10 s)', () => {
  it('reads every state a job can be in, and a runner that is down', async () => {
    const box = sandbox();
    const issue = (number, labels, more = {}) => ({ number, title: `job ${number}`, html_url: `https://x/${number}`, updated_at: '2026-10-07T00:00:00Z', labels: labels.map((name) => ({ name })), author_association: 'OWNER', user: { login: 'owner' }, ...more });
    box.fixture('api', {
      'issues?labels=gen3d&state=open&per_page=50': [issue(1, ['gen3d']), issue(2, ['gen3d', 'gen3d:running']), issue(3, ['gen3d', 'gen3d:failed']), issue(4, ['gen3d'], { author_association: 'NONE', user: { login: 'stranger' } })],
      'issues?labels=voices&state=open&per_page=50': [issue(5, ['voices', 'voices:waiting'])],
      'issues?labels=motion&state=open&per_page=50': [issue(6, ['motion'])],
      'actions/runners': { runners: [{ name: 'tilak-gpu', status: 'offline', busy: false, labels: [{ name: 'gpu' }] }] },
    });
    box.fixture('run-list', [{ status: 'completed', conclusion: 'success', url: 'https://x/runs/1', createdAt: '2026-10-07T04:00:00Z', displayTitle: 'ai health' }]);
    const r = await run(process.execPath, [join(REPO, 'scripts', 'desktop', 'status.mjs'), '--json'], { env: box.env });
    expect(r.status, r.err).toBe(0);
    const s = JSON.parse(r.out);
    expect(s.runners).toEqual([{ name: 'tilak-gpu', status: 'offline', busy: false }]);
    expect(s.pipelines.gen3d.jobs.map((j) => j.state)).toEqual(['queued', 'running', 'failed', 'ignored (not from the owner or a collaborator)']);
    expect(s.pipelines.voices.jobs.map((j) => j.state)).toEqual(['waiting for the GPU']);
    expect(s.pipelines.motion.jobs.map((j) => j.state)).toEqual(['queued']);
    expect(s.aiHealth).toMatchObject({ conclusion: 'success' });
    // and nothing went to GitHub itself
    expect(box.gh().length).toBeGreaterThan(0);
  });
});

describe('the doctor, over a made-up AppData (subprocesses, up to 10 s)', () => {
  it('finds a tool where the Claude app’s box put it, and says how to fix one that’s missing', async () => {
    const box = sandbox();
    const local = mkdtempSync(join(tmpdir(), 'ai-e2e-local-'));
    // trellis.cpp only in the app's boxed copy of AppData
    const boxed = join(local, 'Packages', 'Claude_pzs8sxrjxfjjc', 'LocalCache', 'Local', 'trellis-studio', 'runtime');
    mkdirSync(boxed, { recursive: true });
    writeFileSync(join(boxed, 'trellis-cli.exe'), '');
    box.fixture('api', { user: 'owner' });
    const r = await run(process.execPath, [join(REPO, 'scripts', 'desktop', 'doctor.mjs'), '--json'], { env: { ...box.env, LOCALAPPDATA: local, VOICES_PYTHON: join(local, 'no-python.exe'), VOICES_REFS: join(local, 'no-refs') } });
    const list = JSON.parse(r.out);
    const by = (name) => list.find((c) => c.name === name);
    expect(by('trellis.cpp (TRELLIS.2)')).toMatchObject({ ok: true });
    expect(by('trellis.cpp (TRELLIS.2)').detail).toMatch(/Packages[\\/]Claude_[^\\/]+[\\/]LocalCache[\\/]Local[\\/]trellis-studio/);
    expect(by('the voices venv')).toMatchObject({ ok: false, need: true, fix: 'scripts/voices/README.md, Setup' });
    expect(by('reference voices')).toMatchObject({ ok: false, fix: expect.stringMatching(/VOICES_REFS/) });
    // a missing tool a job needs makes it say so in its exit code
    expect(r.status).toBe(1);
    // gh asked through the fake, not GitHub
    expect(box.gh()).toContainEqual(expect.arrayContaining(['api', 'user']));
  });
});
