// A model from anywhere: a GitHub issue labelled `gen3d` (or the gen3d
// workflow's "Run workflow" form, which opens one) is made on the desktop's
// GPU, ends as a pull request with a judging sheet, and the issue says so.
// The title is the model's name; the body says what, one field a line (or
// several to a line, two spaces apart), all optional but one of prompt/what/image:
//
//   what: an X-wing starfighter          (what it is, for the credit and the judge; the prompt if none)
//   prompt: an X-wing starfighter, …     (FLUX draws the concept picture: only for designs it knows)
//   image: (attach a picture, or an URL) (the picture to follow; Pixal3D unless faithful: no)
//   front: / left: / back: / right: (a picture each, or attach them in that order: Hunyuan3D multi-view)
//   faces: 24000  tex: 2048  seed: 42  res: 1024  fov: 49  engine: trelliscpp|trellis2|hunyuan
//   faithful: no  bake: no  fresh: yes
//   ultra: yes                           (a fourth cut for the ultra level too: up to 300k faces, 8192 maps; budget.mjs ULTRA)
//
//   node scripts/gen3d/runner.mjs --issue N | --sweep | --watch [60] | --pending | --enqueue
//
// (scripts/desktop/jobs.mjs has what those do; .github/workflows/gen3d.yml runs them.)
// Jobs are made in their own checkout beside the repository (<repo>-gen3d,
// GEN3D_RUNNER_ROOT for another), on a branch gen3d/<name> from origin/main.

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cli } from '../desktop/jobs.mjs';
import { deps, fetchImage, fields, fresh, git, imageUrls, push, pullRequest, repoName, slug, tee, urlIn, workspace } from '../desktop/lib.mjs';
import { TIERS, ULTRA } from './budget.mjs';

export { slug } from '../desktop/lib.mjs';
export const LABEL = 'gen3d';
export const RUNNING = 'gen3d:running';
export const FAILED = 'gen3d:failed';
const SIDES = ['front', 'left', 'back', 'right'];
export const KEYS = ['what', 'prompt', 'image', ...SIDES, 'faces', 'tex', 'seed', 'res', 'fov', 'engine', 'faithful', 'bake', 'fresh', 'ultra', 'more'];
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 5298;
// (a prefix written as one, as lib.mjs's slug has it: not "model-627"'s own first word)
const prefix = /^\s*(gen3d|3d|model)(\s*:\s*|\s+-\s+)/i;

// An issue → a job for make.mjs, or null when it says nothing to make.
// A job that can't be made says why in `error`.
export function parseIssue({ number, title, body = '' }) {
  const name = slug(title);
  if (!name) return null;
  const f = fields(body ?? '', KEYS);
  // every picture in the body, in order; the sides named by fields (front: URL) or taken in that order
  const urls = imageUrls(body ?? '');
  const named = Object.fromEntries(SIDES.map((k) => [k, urlIn(f[k])]).filter(([, u]) => u));
  const sides = Object.keys(named).length ? named : Object.fromEntries(urls.slice(0, SIDES.length).map((u, i) => [SIDES[i], u]));
  const image = sides.front ?? urlIn(f.image);
  const views = Object.keys(sides).length > 1 ? sides : undefined; // several: Hunyuan3D multi-view
  const what = f.what ?? f.prompt ?? title.replace(prefix, '').trim();
  const prompt = f.prompt ?? (image ? undefined : what);
  const no = (v) => /^(no|false|off|0)$/i.test(v ?? '');
  const yes = (v) => /^(yes|true|on|1)$/i.test(v ?? '');
  const errors = [];
  const num = (k, lo, hi) => {
    if (f[k] === undefined) return undefined;
    const n = Number(String(f[k]).replace(/[,_\s]/g, '').replace(/k$/i, '000'));
    if (!Number.isFinite(n) || n < lo || n > hi) errors.push(`${k}: "${f[k]}" isn't a number from ${lo} to ${hi}`);
    return Number.isFinite(n) ? n : undefined;
  };
  const engine = f.engine?.toLowerCase();
  if (engine && !['trelliscpp', 'trellis2', 'hunyuan'].includes(engine)) errors.push(`engine: "${f.engine}" isn't trelliscpp, trellis2 or hunyuan`);
  if (f.image && !image) errors.push(`image: "${f.image}" has no link in it (attach the picture, or give its URL)`);
  const job = {
    number,
    name,
    what,
    image,
    views,
    prompt: image ? undefined : prompt,
    faces: num('faces', 300, 1000000),
    tex: num('tex', 256, 8192),
    seed: num('seed', 0, 2 ** 31),
    res: num('res', 256, 1536),
    fov: num('fov', 5, 120),
    engine,
    faithful: image ? !no(f.faithful) : false,
    noBake: no(f.bake),
    fresh: yes(f.fresh),
    ultra: yes(f.ultra),
  };
  if (errors.length) job.error = errors.join('; ');
  return job;
}

// The make.mjs command line for a job (the picture, if any, already at `image`).
export function makeArgs(job, image, sides = {}) {
  const a = [job.name];
  if (image) {
    a.push('--image', image);
    for (const [k, f] of Object.entries(sides)) if (k !== 'front') a.push(`--${k}`, f);
  } else a.push('--prompt', job.prompt);
  a.push('--what', job.what);
  for (const k of ['faces', 'tex', 'seed', 'res', 'fov', 'engine']) if (job[k] !== undefined) a.push(`--${k}`, String(job[k]));
  if (image && job.faithful && Object.keys(sides).length <= 1) a.push('--faithful');
  // make.mjs follows a single picture with Pixal3D unless told not to
  if (image && !job.faithful) a.push('--no-faithful');
  if (job.noBake) a.push('--no-bake');
  if (job.fresh) a.push('--fresh');
  if (job.ultra) a.push('--ultra');
  return a;
}

// The workflow form's inputs (or ask.mjs's) → the issue that asks for them.
export function request({ name, what, image, prompt, faces, tex, options, more } = {}) {
  const title = slug(name);
  if (!title) throw new Error('name: say what to call the model (a-z, 0-9, dashes: it becomes public/models/gen3d/NAME.glb)');
  if (!what && !prompt && !image) throw new Error('give at least one of what, prompt or image');
  const pictures = String(image ?? '').split(/[\s,]+/).filter((u) => /^https?:\/\//.test(u));
  const lines = [what && `what: ${what}`, prompt && `prompt: ${prompt}`];
  if (pictures.length > 1) pictures.slice(0, SIDES.length).forEach((u, i) => lines.push(`${SIDES[i]}: ${u}`));
  else if (pictures.length) lines.push(`image: ${pictures[0]}`);
  if (faces) lines.push(`faces: ${faces}`);
  if (tex) lines.push(`tex: ${tex}`);
  for (const o of String(options ?? more ?? '').split(/\s{2,}|[;\n]/).map((s) => s.trim()).filter(Boolean)) lines.push(o);
  const body = lines.filter(Boolean).join('\n');
  const check = parseIssue({ number: 0, title, body });
  if (check?.error) throw new Error(check.error);
  return { title, body };
}

// Where make.mjs keeps a job's sheet, log and outcome: GEN3D_CACHE when it's
// set (make.mjs reads the same), else the checkout's own cache.
export const cacheOf = (root, name) => join(process.env.GEN3D_CACHE ? resolve(root, process.env.GEN3D_CACHE) : join(root, 'scripts', 'gen3d', 'cache'), name);

// A dev server on the job's checkout, for the judging sheet's renders.
function serve(root) {
  const p = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), root, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', windowsHide: true });
  const ready = (async () => {
    for (let i = 0; i < 90; i++) {
      try {
        if ((await fetch(`http://127.0.0.1:${PORT}/`)).ok) return;
      } catch {
        /* not yet */
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`the dev server for the judging sheet did not come up on :${PORT} (is another one there?)`);
  })();
  return { ready, stop: () => p.kill() };
}

// In an Actions run, what to look at afterwards (the pictures in, the
// sheet, the log, the outcome) goes where the workflow uploads it from.
function keep(cache) {
  if (!process.env.RUNNER_TEMP) return;
  const to = join(process.env.RUNNER_TEMP, 'gen3d-artifacts');
  mkdirSync(to, { recursive: true });
  for (const f of ['sheet.png', 'result.json', 'make.log', 'concept.png', 'from-issue.png', 'given.png']) if (existsSync(join(cache, f))) copyFileSync(join(cache, f), join(to, f));
}

const stat = (r) =>
  [
    `engine: ${r.engine}, seed ${r.seed}`,
    ...Object.entries(r.cuts ?? {}).map(([t, c]) => `${t}: ${c.triangles.toLocaleString('en-US')} triangles, ${(c.bytes / 1024).toFixed(0)} KB`),
    r.verdict ? `verdict: ${r.verdict.score}/10${r.verdict.problems?.length ? ` (${r.verdict.problems.join('; ')})` : ''}` : null,
  ]
    .filter(Boolean)
    .join('\n');

// One job, made: the picture(s) fetched, make.mjs run, the cuts and the
// sheet committed on gen3d/<name>, pushed, and its pull request. → { pr, report }
export async function make(job, root, { log = console.log } = {}) {
  const branch = `gen3d/${job.name}`;
  log(`#${job.number} ${job.name}: ${job.image ? `from ${job.views ? `${Object.keys(job.views).length} pictures` : 'a picture'}${job.faithful ? ' (Pixal3D)' : ''}` : `"${job.prompt}"`}`);
  fresh(root, branch);
  deps(root, log);
  const cache = cacheOf(root, job.name);
  mkdirSync(cache, { recursive: true });
  const image = job.image ? await fetchImage(job.image, join(cache, 'from-issue.png')) : null;
  const sides = {};
  for (const [k, u] of Object.entries(job.views ?? {})) sides[k] = k === 'front' ? image : await fetchImage(u, join(cache, `from-issue-${k}.png`));
  const chrome = process.env.CHROME ?? EDGE;
  const server = existsSync(chrome) ? serve(root) : null;
  try {
    if (server) await server.ready;
    await tee(process.execPath, [join(root, 'scripts', 'gen3d', 'make.mjs'), ...makeArgs(job, image, sides)], {
      cwd: root,
      env: { ...process.env, ...(server ? { CHROME: chrome, BASE: `http://127.0.0.1:${PORT}` } : {}) },
      timeoutMs: (Number(process.env.GEN3D_JOB_MINUTES) || 120) * 60000,
    });
  } finally {
    server?.stop();
    keep(cache);
  }
  const result = existsSync(join(cache, 'result.json')) ? JSON.parse(readFileSync(join(cache, 'result.json'), 'utf8')) : {};
  const stats = stat(result) || readFileSync(join(cache, 'make.log'), 'utf8').trim();
  const sheet = join(cache, 'sheet.png');
  // every cut of the model (budget.mjs's TIERS: .hq, plain, .lo, and .ultra where one was asked for), and the credit
  const files = [...[ULTRA, ...Object.values(TIERS)].map((t) => `public/models/gen3d/${job.name}${t.suffix}.glb`).filter((f) => existsSync(join(root, f))), 'public/games/credits.json'];
  if (!files.some((f) => f.endsWith('.glb'))) throw new Error(`make.mjs finished but wrote no public/models/gen3d/${job.name}*.glb`);
  if (existsSync(sheet)) {
    mkdirSync(join(root, 'docs', 'gen3d'), { recursive: true });
    copyFileSync(sheet, join(root, 'docs', 'gen3d', `${job.name}.png`));
    files.push(`docs/gen3d/${job.name}.png`);
  }
  git(root, 'add', ...files);
  git(root, '-c', 'core.safecrlf=false', 'commit', '-q', '-m', `${job.what}: a 3D model made from issue #${job.number}\n\n${stats}\n\nCo-Authored-By: gen3d runner <noreply@tilakpatell.com>`);
  await push(root, branch);
  const repo = repoName();
  const picture = existsSync(sheet) ? `\n\n![${job.name}, raw and web](https://raw.githubusercontent.com/${repo}/${branch}/docs/gen3d/${job.name}.png)` : '';
  const body = `From issue #${job.number}: ${job.what}.\n\n\`\`\`\n${stats}\n\`\`\`${picture}\n\nThe model is \`public/models/gen3d/${job.name}.glb\` (and \`.hq\`/\`.lo\` cuts), credited in \`credits.json\`; wiring it into a scene is a separate change.`;
  const pr = pullRequest(root, { branch, title: `${job.what}, made by the gen3d runner`, body });
  return { pr, report: `\`\`\`\n${stats}\n\`\`\`` };
}

// What a failure most likely needs, for the issue comment.
export function hint(e) {
  const m = `${e.message}\n${e.err ?? ''}`;
  if (/couldn't fetch the picture/.test(m)) return 'The picture couldn\'t be fetched: attach it to the issue instead of linking it, or link the image file itself. ';
  if (/isn't set up here|not set up here/.test(m)) return 'An engine is missing on the desktop: scripts/gen3d/README.md says how to set it up. ';
  if (/out of memory|CUDA error|cudaMalloc/i.test(m)) return 'The GPU ran out of memory (something else was using it?). ';
  if (/over the budget|over \d+ KB/.test(m)) return 'The model came out over its budget: ask for fewer faces or a smaller tex. ';
  if (/timed out|ran past/.test(m)) return 'A step hung and was stopped. ';
  return '';
}

export const pipeline = {
  name: 'gen3d',
  label: LABEL,
  vram: Number(process.env.GEN3D_VRAM_MIB) || 18000, // trellis.cpp at res 1024 peaks near 16 GB; Hunyuan + 2.1 paint near 20
  keys: KEYS,
  parse: parseIssue,
  make,
  request,
  hint,
  help: 'The title is the model\'s name; the body says `what:`, and `image:` (a picture to follow) or `prompt:`. See scripts/gen3d/README.md.',
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await cli(pipeline, process.argv.slice(2), { root: () => workspace('gen3d', process.env.GEN3D_RUNNER_ROOT) });
}
