// Voice lines from anywhere: a GitHub issue labelled `voices` (or the voices
// workflow's "Run workflow" form, which opens one) is made on the desktop's
// GPU: every line the site says that has no recording yet (and any asked
// for in the issue), as a pull request with the recordings, and the issue
// says so. The body, all optional:
//
//   only: rick, morty          (just these speakers; else everyone with a voice)
//   rick: Wubba lubba dub dub.  (a line to make ahead of the code that will say it: one a line, who: text)
//   morty: Aw geez, Rick.
//
// A cloud session that adds lines to the site opens one of these once its
// code is on main (or lists the lines in the body to have them ready first).
// Who has a voice: scripts/voices/README.md; a speaker without one is
// reported back, not made.
//
//   node scripts/voices/runner.mjs --issue N | --sweep | --watch [60] | --pending | --enqueue
//
// (scripts/desktop/jobs.mjs has what those do; .github/workflows/voices.yml runs them.)
// Jobs are made in their own checkout beside the repository (<repo>-voices,
// VOICES_RUNNER_ROOT for another) on a branch voices/<name> from origin/main.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cli } from '../desktop/jobs.mjs';
import { deps, fresh, git, localDir, normaliseForm, pullRequest, push, sh, slug, tee, workspace } from '../desktop/lib.mjs';

export const LABEL = 'voices';
export const RUNNING = 'voices:running';
export const FAILED = 'voices:failed';
// the Python with the TTS engines (scripts/voices/README.md's venv)
export const PYTHON = process.env.VOICES_PYTHON ?? join(homedir(), '.venvs', 'voices', 'Scripts', 'python.exe');
// the references (not committed) and the takes cache, outside any checkout:
// %LOCALAPPDATA%\voices, or the Claude app's boxed copy of it (localDir)
const VOICES = localDir('voices');
export const STORE = { refs: process.env.VOICES_REFS ?? join(VOICES, 'refs'), cache: process.env.VOICES_CACHE ?? join(VOICES, 'cache') };

// An issue → a job: which speakers (all by default) and any lines asked for.
export function parseIssue({ number, title, body = '' }) {
  const name = slug(String(title).replace(/^\s*(voices?|audio|lines)\s*[:-]\s*/i, '')) || `voices-${number}`;
  let only = null;
  const lines = [];
  for (const raw of normaliseForm(body ?? '').split(/\r?\n/)) {
    const m = raw.match(/^\s*[-*]?\s*\*{0,2}([a-z][a-z0-9-]*)\*{0,2}\s*:\s*(.+?)\s*$/i);
    if (!m) continue;
    const [, key, value] = m;
    if (key.toLowerCase() === 'only') only = value.split(/[,\s]+/).map((s) => s.toLowerCase()).filter(Boolean);
    else if (['what', 'note', 'notes', 'lines', 'name', 'why'].includes(key.toLowerCase())) continue;
    else lines.push({ who: key.toLowerCase(), text: value });
  }
  return { number, name, only, lines };
}

// The workflow form's inputs (or ask.mjs's) → the issue that asks for them.
// `lines` is "who: text" entries, one a line or set apart by " | ".
export function request({ name, only, lines } = {}) {
  const title = `voices: ${String(name ?? '').trim() || 'unmade lines'}`;
  const said = String(lines ?? '')
    .split(/\r?\n|\s+\|\s+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const bad = said.filter((l) => !/^[a-z][a-z0-9-]*\s*:\s*\S/i.test(l));
  if (bad.length) throw new Error(`a line is "who: text": ${bad.map((l) => `"${l}"`).join(', ')}`);
  const body = [only && `only: ${only}`, ...said].filter(Boolean).join('\n') || 'Every line the site says that has no recording yet.';
  return { title, body };
}

// What generate.py reported: lines made, the doubtful ones, and speakers it had no voice for.
export function summarise(log, asked = []) {
  const made = log.match(/Done: (\d+) lines?(?:, (\d+) doubtful)?/);
  const noVoice = [...log.matchAll(/^([a-z0-9-]+): no reference yet/gim)].map((m) => m[1].toLowerCase());
  const missing = [...new Set([...noVoice, ...asked.map((l) => l.who).filter((who) => noVoice.includes(who))])];
  return { made: made ? Number(made[1]) : 0, doubtful: made?.[2] ? Number(made[2]) : 0, noVoice: missing };
}

export async function make(job, root, { log = console.log } = {}) {
  const branch = `voices/${job.name}`;
  log(`#${job.number} ${job.name}: ${job.only ? job.only.join(', ') : 'everyone'}${job.lines.length ? `, ${job.lines.length} line(s) asked for` : ''}`);
  if (!existsSync(PYTHON)) throw new Error(`no ${PYTHON}: the voices venv (scripts/voices/README.md)`);
  if (!existsSync(join(STORE.refs, 'rick.wav'))) throw new Error(`no references at ${STORE.refs} (copy scripts/voices/refs there, or set VOICES_REFS)`);
  fresh(root, branch);
  deps(root, log);
  const extra = join(root, 'scripts', 'voices', 'cache', `issue-${job.number}.json`);
  mkdirSync(dirname(extra), { recursive: true });
  writeFileSync(extra, JSON.stringify(job.lines));
  const exported = sh(process.execPath, [join(root, 'scripts', 'voices', 'export-lines.mjs'), '--extra', extra], { cwd: root });
  log(exported.split('\n').at(-1));
  const { out: made } = await tee(PYTHON, [join(root, 'scripts', 'voices', 'generate.py'), ...(job.only ? ['--only', job.only.join(',')] : [])], {
    cwd: root,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', VOICES_REFS: STORE.refs, VOICES_CACHE: STORE.cache },
    timeoutMs: (Number(process.env.VOICES_JOB_MINUTES) || 240) * 60000,
  });
  const s = summarise(made, job.lines);
  const manifest = JSON.parse(readFileSync(join(root, 'public', 'audio', 'voiced', 'manifest.json'), 'utf8'));
  const total = Object.keys(manifest.lines ?? {}).length;
  git(root, 'add', 'public/audio/voiced');
  const changed = git(root, 'status', '--porcelain', 'public/audio/voiced').split('\n').filter(Boolean).length;
  if (!changed) return { nothing: `Nothing to make: every line ${job.only ? `of ${job.only.join(', ')} ` : ''}already has a recording (${total} in the manifest).${s.noVoice.length ? `\n\nNo voice yet for: ${s.noVoice.join(', ')}.` : ''}` };
  git(root, '-c', 'core.safecrlf=false', 'commit', '-q', '-m', `Voice lines from issue #${job.number}: ${s.made} made\n\n${changed} files; manifest at ${total} lines.\n\nCo-Authored-By: voices runner <noreply@tilakpatell.com>`);
  await push(root, branch);
  const report = `${s.made} line(s) made${s.doubtful ? `, ${s.doubtful} doubtful (cache/takes/report.md on the desktop)` : ''}; the manifest now has ${total} lines.${s.noVoice.length ? `\n\nNo voice yet for: ${s.noVoice.join(', ')} (a reference is needed first: scripts/voices/README.md).` : ''}`;
  const pr = pullRequest(root, { branch, title: `Voice lines: ${job.name} (${s.made} made)`, body: `From issue #${job.number}.\n\n${report}\n\nMade on the desktop by the voices runner (scripts/voices/runner.mjs): each speaker's cloned voice, best of several takes, judged.` });
  return { pr, report };
}

export const pipeline = {
  name: 'voices',
  label: LABEL,
  vram: Number(process.env.VOICES_VRAM_MIB) || 10000,
  parse: parseIssue,
  make,
  request,
  keys: [],
  help: 'The body is optional: `only: rick, morty` and lines to make ahead as `who: text`. See scripts/voices/README.md.',
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await cli(pipeline, process.argv.slice(2), { root: () => workspace('voices', process.env.VOICES_RUNNER_ROOT) });
}

