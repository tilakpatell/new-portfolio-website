// Tier 6, one real model and one real line, start to end, on the desktop's
// GPU (npm run test:ai:gpu's first half, and the nightly's): the pipelines
// as they are, on the smallest thing that proves them.
//
//   gen3d   make.mjs ai-health-xwing from the contract tests' X-wing render,
//           8000 faces, seed 1, --fresh, into a throwaway cache and output
//           (GEN3D_CACHE, GEN3D_OUT: never public/), judged as it ships
//   voices  generate.py, Han, one line, two takes, into a throwaway list,
//           cache and output (VOICES_LINES, VOICES_CACHE, VOICES_OUT)
//
//   node scripts/ai-e2e/real/health.mjs   → results/<date>-real.json; exit 1 when a line is missed
//
// Everything it makes lands under results/real-work/ (git-ignored, the
// run's artifact), inside the repository so the judging sheet's dev server
// can serve the models. With the fakes switched on (GEN3D_ENGINE=fake, …)
// it runs the same plumbing in seconds: health.test.mjs.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cutsFor } from '../../gen3d/budget.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const NAME = 'ai-health-xwing';
const FACES = 8000;

// The lines a night is held to. The verdict is make.mjs's own bar for a
// model to pass the judge (vlm.judge's `pass`); the times are a little over
// twice what the RTX 5090 takes warm (trellis.cpp ~3 min, the bake and the
// cuts a minute; F5/Qwen3 a minute for two takes), so a slow night is a
// red one.
export const LIMITS = { verdict: 7, gen3dSeconds: 25 * 60, voicesSeconds: 10 * 60 };

export function short({ gen3d, voices }) {
  const out = [];
  if (!gen3d.ok && gen3d.error) out.push(`gen3d: ${gen3d.error}`);
  else {
    if (gen3d.verdict == null) out.push('gen3d: no verdict (no judge reachable, or no sheet)');
    else if (gen3d.verdict < LIMITS.verdict) out.push(`gen3d: the judge gave it ${gen3d.verdict}/10, under ${LIMITS.verdict}`);
    for (const [t, n] of Object.entries(gen3d.tris ?? {})) if (n > gen3d.budget[t] * 1.05) out.push(`gen3d: the ${t} cut has ${n} triangles, over its ${gen3d.budget[t]}`);
    if (gen3d.seconds > LIMITS.gen3dSeconds) out.push(`gen3d: took ${Math.round(gen3d.seconds / 60)} min, over ${LIMITS.gen3dSeconds / 60}`);
  }
  if (!voices.ok && voices.error) out.push(`voices: ${voices.error}`);
  else {
    if (voices.made !== 1) out.push(`voices: ${voices.made} lines made, not 1`);
    if (voices.doubtful) out.push(`voices: ${voices.doubtful} doubtful`);
    if (voices.seconds > LIMITS.voicesSeconds) out.push(`voices: took ${Math.round(voices.seconds / 60)} min, over ${LIMITS.voicesSeconds / 60}`);
  }
  return out;
}

// a step's process, its output shown live and kept
function run(cmd, args, { env, minutes }) {
  return new Promise((done) => {
    let out = '';
    const p = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, PYTHONIOENCODING: 'utf-8', ...env }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const keep = (d) => {
      out = (out + d).slice(-200000);
      process.stdout.write(d);
    };
    p.stdout.on('data', keep);
    p.stderr.on('data', keep);
    const timer = setTimeout(() => p.kill(), minutes * 60000);
    p.on('error', (e) => done({ status: -1, out: `${cmd} didn’t start: ${e.message}` }));
    p.on('close', (status) => {
      clearTimeout(timer);
      done({ status, out });
    });
  });
}
const tailOf = (out) => out.split(/\r?\n/).filter(Boolean).slice(-3).join(' / ').slice(-400);

async function gen3d(work) {
  const cache = join(work, 'gen3d-cache');
  const out = join(work, 'gen3d-out');
  rmSync(cache, { recursive: true, force: true });
  mkdirSync(join(out, 'public', 'games'), { recursive: true });
  writeFileSync(join(out, 'public', 'games', 'credits.json'), '{}\n');
  // the judging sheet's renders need a dev server on the repository (a fake sheet doesn't)
  const sheetServer = process.env.CHROME && process.env.GEN3D_SHEET !== 'fake' ? await (await import('../render/server.mjs')).serve(ROOT) : null;
  const started = Date.now();
  try {
    const r = await run(process.execPath, [join(ROOT, 'scripts', 'gen3d', 'make.mjs'), NAME, '--image', join(ROOT, 'scripts', 'ai-e2e', 'contract', 'fixtures', 'x-wing-ref.png'), '--what', 'an X-wing starfighter', '--faces', String(FACES), '--seed', '1', '--fresh'], {
      env: { GEN3D_CACHE: cache, GEN3D_OUT: out, ...(sheetServer ? { BASE: sheetServer.base } : {}) },
      minutes: LIMITS.gen3dSeconds / 60 + 5,
    });
    const seconds = Math.round((Date.now() - started) / 1000);
    const file = join(cache, NAME, 'result.json');
    if (r.status !== 0 || !existsSync(file)) return { ok: false, status: r.status, seconds, error: `make.mjs exited ${r.status}: ${tailOf(r.out)}` };
    const result = JSON.parse(readFileSync(file, 'utf8'));
    const budget = Object.fromEntries(Object.entries(cutsFor(FACES)).map(([t, c]) => [t, c.faces]));
    return {
      ok: true,
      status: 0,
      engine: result.engine,
      verdict: result.verdict?.score ?? null,
      problems: result.verdict?.problems ?? [],
      tris: Object.fromEntries(Object.entries(result.cuts).map(([t, c]) => [t, c.triangles])),
      bytes: Object.fromEntries(Object.entries(result.cuts).map(([t, c]) => [t, c.bytes])),
      budget,
      seconds,
    };
  } finally {
    sheetServer?.stop();
  }
}

async function voices(work) {
  const lines = join(work, 'lines.json');
  const cache = join(work, 'voices-cache');
  const out = join(work, 'voiced');
  for (const d of [cache, out]) rmSync(d, { recursive: true, force: true });
  const started = Date.now();
  const exported = await run(process.execPath, [join(ROOT, 'scripts', 'voices', 'export-lines.mjs'), '--out', lines], { minutes: 5 });
  if (exported.status !== 0) return { ok: false, status: exported.status, error: `export-lines.mjs exited ${exported.status}: ${tailOf(exported.out)}` };
  const { STORE } = await import('../../voices/runner.mjs');
  const python = process.env.VOICES_PYTHON ?? join(homedir(), '.venvs', 'voices', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const r = await run(python, [join(ROOT, 'scripts', 'voices', 'generate.py'), '--only', 'han', '--limit', '1', '--takes', '2'], {
    env: { VOICES_LINES: lines, VOICES_CACHE: cache, VOICES_OUT: out, VOICES_REFS: process.env.VOICES_REFS ?? STORE.refs },
    minutes: LIMITS.voicesSeconds / 60 + 5,
  });
  const seconds = Math.round((Date.now() - started) / 1000);
  const done = r.out.match(/Done: (\d+) lines?, (\d+) doubtful/);
  if (r.status !== 0 || !done) return { ok: false, status: r.status, seconds, error: `generate.py exited ${r.status}: ${tailOf(r.out)}` };
  // the take that was kept: the best-scored of the line's takes
  const scores = existsSync(join(cache, 'takes', 'scores.jsonl'))
    ? readFileSync(join(cache, 'takes', 'scores.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];
  const best = scores.filter((s) => s.score != null).sort((a, b) => b.score - a.score)[0] ?? scores[0];
  return { ok: true, status: 0, made: Number(done[1]), doubtful: Number(done[2]), wer: best?.wer ?? null, similarity: best?.sim ?? null, seconds };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const results = process.env.AI_RESULTS ?? join(HERE, '..', 'results');
  const date = process.env.AI_DATE ?? new Date().toISOString().slice(0, 10);
  const work = join(ROOT, 'scripts', 'ai-e2e', 'results', 'real-work');
  mkdirSync(work, { recursive: true });
  mkdirSync(results, { recursive: true });
  // the GPU as the desktop's jobs wait for it (a game, a long TTS run): the
  // gen3d job's need, for as long as a sweep waits, before the night says so
  const { waitForGpu } = await import('../../desktop/lib.mjs');
  const free = process.env.GEN3D_ENGINE === 'fake' || (await waitForGpu(Number(process.env.GEN3D_VRAM_MIB) || 18000, { minutes: 20 }));
  console.log('── gen3d');
  const g = free ? await gen3d(work) : { ok: false, status: -1, error: 'the GPU stayed busy for 20 min: nothing made' };
  console.log('── voices');
  const v = await voices(work);
  const miss = short({ gen3d: g, voices: v });
  const night = { tier: 'real', ok: miss.length === 0, short: miss, gen3d: { ...g, ok: g.ok && !miss.some((m) => m.startsWith('gen3d')) }, voices: { ...v, ok: v.ok && !miss.some((m) => m.startsWith('voices')) } };
  const file = join(results, `${date}-real.json`);
  writeFileSync(file, `${JSON.stringify(night, null, 1)}\n`);
  console.log(miss.length ? `under the line: ${miss.join('; ')}` : 'one real model and one real line, made and passed');
  console.log(file);
  process.exit(miss.length ? 1 : 0);
}
