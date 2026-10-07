// Tier 5, every judge's evaluation in one go (npm run test:ai:gpu's second
// half, and the nightly's): the vision judge (vision.mjs) and the hearing
// judge (scripts/voices/eval_judge.py, with the voices venv's Python). Each
// runs even when another failed, so one night says everything; the whole
// fails when any did.
//
//   node scripts/ai-e2e/evals/run.mjs      (VOICES_PYTHON for another Python; AI_RESULTS for another results folder)
//
// Each eval writes its own results/<date>-<name>.json; this writes
// results/<date>-evals.json, how each step went, for the nightly report.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

export const steps = ({ python = process.env.VOICES_PYTHON ?? join(homedir(), '.venvs', 'voices', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python') } = {}) => [
  { name: 'vision', cmd: process.execPath, args: [join(HERE, 'vision.mjs')] },
  { name: 'hearing', cmd: python, args: [join(ROOT, 'scripts', 'voices', 'eval_judge.py')] },
];

function one({ cmd, args }) {
  return new Promise((done) => {
    let out = '';
    const keep = (d) => {
      out = (out + d).slice(-20000);
      process.stdout.write(d);
    };
    const p = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    p.stdout.on('data', keep);
    p.stderr.on('data', keep);
    p.on('error', (e) => done({ ok: false, tail: `${cmd} didn’t start: ${e.message}` }));
    p.on('close', (code) => done({ ok: code === 0, tail: out.split(/\r?\n/).filter(Boolean).slice(-15).join('\n') }));
  });
}

export async function runAll(list = steps(), { dir = process.env.AI_RESULTS ?? join(HERE, '..', 'results'), date = new Date().toISOString().slice(0, 10) } = {}) {
  const done = [];
  for (const s of list) {
    const started = Date.now();
    console.log(`\n── ${s.name}`);
    const r = await one(s);
    done.push({ name: s.name, ok: r.ok, seconds: Math.round((Date.now() - started) / 1000), tail: r.tail });
  }
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${date}-evals.json`);
  const ok = done.every((s) => s.ok);
  writeFileSync(file, `${JSON.stringify({ tier: 'evals', ok, steps: done }, null, 1)}\n`);
  return { ok, steps: done, file };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = await runAll();
  console.log(`\n${r.steps.map((s) => `${s.ok ? 'ok  ' : 'FAIL'} ${s.name} (${s.seconds} s)`).join('\n')}\n${r.file}`);
  process.exit(r.ok ? 0 : 1);
}
