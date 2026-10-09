// A clip from words, from anywhere: a GitHub issue labelled `motion` (or the
// motion workflow's "Run workflow" form, which opens one) is made on the
// desktop's GPU with HY-Motion 1.0, baked onto Luke, and ends as a pull
// request with the clip and a sheet of it beside one of the library's; the
// issue says so. The title is the clip's name; the body, one field a line
// (or several to a line, two spaces apart), all optional but the prompt:
//
//   prompt: a two-handed overhead sword strike, stepping forward   (English, under 60 words: what the body does)
//   seconds: 3            (the clip's length, 1 to 10; under 5 keeps the model under 26 GB)
//   seed: 42  cfg: 5      (another take; how closely to follow the words)
//   model: lite           (HY-Motion-1.0-Lite, 0.46B, in place of the 1B)
//   with: sword.heavy.a     (the library clip on the sheet beside it: public/games/meshy/ual-NAME.glb)
//
//   node scripts/motion/runner.mjs --issue N | --sweep | --watch [60] | --pending | --enqueue
//
// (scripts/desktop/jobs.mjs has what those do; .github/workflows/motion.yml runs them.)
// Jobs are made in their own checkout beside the repository (<repo>-motion,
// MOTION_RUNNER_ROOT for another), on a branch motion/<name> from origin/main.

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cli } from '../desktop/jobs.mjs';
import { deps, fields, fresh, git, push, pullRequest, repoName, slug, tee, workspace } from '../desktop/lib.mjs';
import { wslPath } from '../gen3d/generate.mjs';

export const LABEL = 'motion';
export const KEYS = ['prompt', 'seconds', 'seed', 'cfg', 'model', 'with', 'more'];
// HY-Motion in WSL, as gen3d's TRELLIS.2 is: its conda env and its checkout (scripts/motion/README.md)
export const WSL = { distro: process.env.MOTION_WSL_DISTRO ?? process.env.GEN3D_WSL_DISTRO ?? 'Ubuntu-24.04', conda: '~/miniforge3', env: process.env.MOTION_CONDA_ENV ?? 'hymotion', repo: process.env.MOTION_REPO ?? '~/HY-Motion-1.0' };
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 5299;
const HERE = fileURLToPath(new URL('.', import.meta.url));
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

// An issue → a job, or null when its title names nothing. A job that can't
// be made says why in `error`.
export function parseIssue({ number, title, body = '' }) {
  const name = slug(title);
  if (!name) return null;
  const f = fields(body ?? '', KEYS);
  const errors = [];
  const num = (k, lo, hi, fallback) => {
    if (f[k] === undefined) return fallback;
    const n = Number(String(f[k]).replace(/\s*s(econds?)?$/i, ''));
    if (!Number.isFinite(n) || n < lo || n > hi) errors.push(`${k}: "${f[k]}" isn't a number from ${lo} to ${hi}`);
    return Number.isFinite(n) ? n : fallback;
  };
  const prompt = f.prompt?.trim();
  if (!prompt) errors.push('prompt: say what the body does, in English (a two-handed overhead sword strike, stepping forward)');
  else if (prompt.split(/\s+/).length > 60) errors.push(`prompt: ${prompt.split(/\s+/).length} words; HY-Motion follows under 60 best`);
  const model = (f.model ?? 'standard').toLowerCase();
  if (!['standard', 'lite'].includes(model)) errors.push(`model: "${f.model}" isn't standard or lite`);
  const other = f.with ?? 'sword.heavy.a';
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(other)) errors.push(`with: "${f.with}" isn't a library clip's name (sword.heavy.a, sword.a, …)`);
  const job = { number, name, prompt, seconds: num('seconds', 1, 10, 3), seed: num('seed', 0, 2 ** 31, 42), cfg: num('cfg', 1, 15, 5), lite: model === 'lite', with: other };
  if (errors.length) job.error = errors.join('; ');
  return job;
}

// The workflow form's inputs (or ask.mjs's) → the issue that asks for them.
export function request({ name, prompt, seconds, seed, options, more } = {}) {
  const title = slug(name);
  if (!title) throw new Error('name: say what to call the clip (a-z, 0-9, dashes: it becomes public/games/meshy/ual-gen.NAME.glb)');
  const lines = [prompt && `prompt: ${prompt}`, seconds && `seconds: ${seconds}`, seed && `seed: ${seed}`];
  for (const o of String(options ?? more ?? '').split(/\s{2,}|[;\n]/).map((s) => s.trim()).filter(Boolean)) lines.push(o);
  const body = lines.filter(Boolean).join('\n');
  const check = parseIssue({ number: 0, title, body });
  if (check?.error) throw new Error(check.error);
  return { title, body };
}

// The command that writes the job's BVH: generate.py in WSL, or the
// contract tests' fake (MOTION_ENGINE=fake) with node; the job checkout's
// own (`root`), as the bake is.
export function command(job, out, { engine = process.env.MOTION_ENGINE, root = join(HERE, '..', '..') } = {}) {
  if (engine === 'fake') return [process.execPath, join(root, 'scripts', 'ai-e2e', 'fakes', 'motion.mjs'), job.prompt, out, '--seconds', String(job.seconds), '--seed', String(job.seed)];
  const script = wslPath(join(root, 'scripts', 'motion', 'generate.py'));
  const run = `source ${WSL.conda}/bin/activate ${WSL.env} && cd ${WSL.repo} && python ${q(script)} ${q(job.prompt)} ${q(wslPath(out))} --seconds ${job.seconds} --seed ${job.seed} --cfg ${job.cfg} --repo ${WSL.repo}${job.lite ? ' --lite' : ''}`;
  return ['wsl.exe', '-d', WSL.distro, '-e', 'bash', '-lc', run];
}

// Whether HY-Motion is set up in WSL (its env, its weights, its skeleton
// pulled from LFS), for the doctor. → what's there, or null
export function ready() {
  const model = `${WSL.repo}/ckpts/tencent/HY-Motion-1.0`;
  const look = `test -d ${WSL.conda}/envs/${WSL.env} && test -s ${model}/latest.ckpt && test $(stat -c %s ${WSL.repo}/scripts/gradio/static/assets/dump_wooden/j_template.bin) -gt 256 && echo ${model}`;
  try {
    return execFileSync('wsl.exe', ['-d', WSL.distro, '-e', 'bash', '-lc', look], { encoding: 'utf8', timeout: 20000, windowsHide: true }).trim() || null;
  } catch {
    return null; // no WSL, no env, no weights
  }
}

// Where a job's BVH, the model's NPZ and the sheet are kept: MOTION_CACHE, else the checkout's own cache.
export const cacheOf = (root, name) => join(process.env.MOTION_CACHE ? resolve(root, process.env.MOTION_CACHE) : join(root, 'scripts', 'motion', 'cache'), name);

// The credit a made clip carries in public/games/credits.json.
export const credit = (job) => ({
  source: 'https://github.com/Tencent-Hunyuan/HY-Motion-1.0',
  name: `${job.prompt}: a clip made for this site with HY-Motion 1.0 on the site owner's machine, baked onto Meshy's skeleton (scripts/motion)`,
  authors: ['Tilak Patel, with Tencent HY-Motion 1.0'],
  license: "Generated for this site; HY-Motion 1.0 is under the Tencent HY-Motion 1.0 Community License, which doesn't apply in the EU, the UK or South Korea",
});

// A dev server on the job's checkout, for the sheet.
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
    throw new Error(`the dev server for the sheet did not come up on :${PORT} (is another one there?)`);
  })();
  return { ready, stop: () => p.kill() };
}

// In an Actions run, what to look at afterwards goes where the workflow uploads it from.
function keep(cache, name) {
  if (!process.env.RUNNER_TEMP) return;
  const to = join(process.env.RUNNER_TEMP, 'motion-artifacts');
  mkdirSync(to, { recursive: true });
  for (const f of [`${name}.bvh`, `${name}_000.npz`, `${name}_meta.json`, 'sheet.png']) if (existsSync(join(cache, f))) copyFileSync(join(cache, f), join(to, f));
}

// One job, made: the BVH generated, baked onto Luke, the sheet shot, all
// committed on motion/<name>, pushed, and its pull request. → { pr, report }
export async function make(job, root, { log = console.log } = {}) {
  const branch = `motion/${job.name}`;
  log(`#${job.number} ${job.name}: "${job.prompt}", ${job.seconds} s, seed ${job.seed}${job.lite ? ', lite' : ''}`);
  fresh(root, branch);
  deps(root, log);
  const cache = cacheOf(root, job.name);
  mkdirSync(cache, { recursive: true });
  const bvh = join(cache, `${job.name}.bvh`);
  const minutes = Number(process.env.MOTION_JOB_MINUTES) || 45;
  let baked;
  try {
    const [cmd, ...args] = command(job, bvh, { root });
    await tee(cmd, args, { cwd: root, timeoutMs: minutes * 60000 });
    if (!existsSync(bvh)) throw new Error(`the model finished but wrote no ${bvh}`);
    const out = join(root, 'public', 'games', 'meshy');
    ({ out: baked } = await tee(process.execPath, [join(root, 'scripts', 'motion', 'bake.mjs'), bvh, job.name, '--out', out, '--prompt', job.prompt], { cwd: root, timeoutMs: 5 * 60000 }));
    // the sheet is for the judgement, not the clip: one that won't render leaves the pull request without it
    const chrome = process.env.CHROME ?? EDGE;
    if (existsSync(chrome)) {
      const server = serve(root);
      try {
        await server.ready;
        await tee(process.execPath, [join(root, 'scripts', 'motion', 'sheet.mjs'), job.name, join(cache, 'sheet.png'), '--with', job.with], { cwd: root, env: { ...process.env, CHROME: chrome, BASE: `http://127.0.0.1:${PORT}` }, timeoutMs: 10 * 60000 });
      } catch (e) {
        log(`no sheet: ${e.message}`);
      } finally {
        server.stop();
      }
    } else log(`no browser at ${chrome}: no sheet`);
  } finally {
    keep(cache, job.name);
  }
  const clip = `public/games/meshy/ual-gen.${job.name}.glb`;
  if (!existsSync(join(root, clip))) throw new Error(`bake.mjs finished but wrote no ${clip}`);
  // the credit, and the BVH beside the sheet (to bake again if the retarget changes)
  const credits = join(root, 'public', 'games', 'credits.json');
  const all = JSON.parse(readFileSync(credits, 'utf8'));
  all[`motion/ual-gen.${job.name}`] = credit(job);
  writeFileSync(credits, `${JSON.stringify(all, null, 2)}\n`);
  mkdirSync(join(root, 'docs', 'motion'), { recursive: true });
  copyFileSync(bvh, join(root, 'docs', 'motion', `${job.name}.bvh`));
  const files = [clip, 'public/games/credits.json', `docs/motion/${job.name}.bvh`];
  const sheet = join(cache, 'sheet.png');
  if (existsSync(sheet)) {
    copyFileSync(sheet, join(root, 'docs', 'motion', `${job.name}.png`));
    files.push(`docs/motion/${job.name}.png`);
  }
  const stats = baked.trim().split('\n').at(-1).replace(/^.*?ual-gen\./, 'ual-gen.');
  git(root, 'add', ...files);
  git(root, '-c', 'core.safecrlf=false', 'commit', '-q', '-m', `A clip from words, "${job.prompt}", made from issue #${job.number}\n\n${stats}\n\nCo-Authored-By: motion runner <noreply@tilakpatell.com>`);
  await push(root, branch);
  const repo = repoName();
  const picture = existsSync(sheet) ? `\n\n![${job.name} above ${job.with}, four moments each](https://raw.githubusercontent.com/${repo}/${branch}/docs/motion/${job.name}.png)` : '';
  const body = `From issue #${job.number}: "${job.prompt}" (${job.seconds} s, seed ${job.seed}, cfg ${job.cfg}${job.lite ? ', lite' : ''}).\n\n\`\`\`\n${stats}\n\`\`\`${picture}\n\nThe clip is \`${clip}\` (its clip \`gen.${job.name}\`), baked onto Luke; the sheet puts it above \`${job.with}\`. Look at it moving: \`/scripts/preview/motion.html?clip=${job.name}&with=${job.with}\` on the dev server. Whether it reads well enough to ship, and what to judge it by: \`docs/research/2026-10-08-motion-spike.md\`. Wiring it into a stroke is a separate change.`;
  const pr = pullRequest(root, { branch, title: `"${job.prompt}", a clip made by the motion runner`, body });
  return { pr, report: `\`\`\`\n${stats}\n\`\`\`` };
}

// What a failure most likely needs, for the issue comment.
export function hint(e) {
  const m = `${e.message}\n${e.err ?? ''}`;
  if (/no config\.yml|no latest\.ckpt|git lfs pull|conda|activate|No such file/i.test(m)) return 'HY-Motion is missing or half set up on the desktop: scripts/motion/README.md says how to set it up. ';
  if (/out of memory|CUDA error|cudaMalloc/i.test(m)) return 'The GPU ran out of memory (something else was using it? a shorter clip, or `model: lite`, needs less). ';
  if (/timed out|ran past/.test(m)) return 'A step hung and was stopped. ';
  return '';
}

export const pipeline = {
  name: 'motion',
  label: LABEL,
  // HY-Motion 1.0 asks 26 GB at least (its README), its Qwen3-8B text encoder most of it; Lite 24
  vram: Number(process.env.MOTION_VRAM_MIB) || 26000,
  keys: KEYS,
  parse: parseIssue,
  make,
  request,
  hint,
  help: "The title is the clip's name; the body says `prompt:` (what the body does) and, if you like, `seconds:`, `seed:`, `model: lite`. See scripts/motion/README.md.",
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await cli(pipeline, process.argv.slice(2), { root: () => workspace('motion', process.env.MOTION_RUNNER_ROOT) });
}
