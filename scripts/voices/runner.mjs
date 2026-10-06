// Voice lines from anywhere: open a GitHub issue labelled `voices` and this,
// running on the desktop with the GPU, makes every line the site says that
// has no recording yet (and any asked for in the issue), opens a pull request
// with the recordings and tells the issue. The body, all optional:
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
//   node scripts/voices/runner.mjs --watch [60]     # poll every 60 s
//   node scripts/voices/runner.mjs --once
//
// Jobs run in their own checkout beside the repository (<repo>-voices) on a
// branch voices/<name> from origin/main; the GPU is shared with the gen3d
// runner (a TTS model is small beside TRELLIS.2).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gh, git, sh, slug, workspace } from '../gen3d/runner.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const LABEL = 'voices';
export const RUNNING = 'voices:running';
export const FAILED = 'voices:failed';
// the Python with the TTS engines (scripts/voices/README.md's venv)
export const PYTHON = process.env.VOICES_PYTHON ?? join(homedir(), '.venvs', 'voices', 'Scripts', 'python.exe');
// the references (not committed) and the takes cache, outside any checkout: %LOCALAPPDATA%\voices
const LOCAL = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local');
export const STORE = { refs: process.env.VOICES_REFS ?? join(LOCAL, 'voices', 'refs'), cache: process.env.VOICES_CACHE ?? join(LOCAL, 'voices', 'cache') };

// An issue → a job: which speakers (all by default) and any lines asked for.
export function parseIssue({ number, title, body = '' }) {
  const name = slug(title.replace(/^\s*(voices?|audio|lines)\s*[:-]\s*/i, '')) || `voices-${number}`;
  let only = null;
  const lines = [];
  for (const raw of body.split(/\r?\n/)) {
    const m = raw.match(/^\s*[-*]?\s*\*{0,2}([a-z][a-z0-9-]*)\*{0,2}\s*:\s*(.+?)\s*$/i);
    if (!m) continue;
    const [, key, value] = m;
    if (key.toLowerCase() === 'only') only = value.split(/[,\s]+/).map((s) => s.toLowerCase()).filter(Boolean);
    else if (key.toLowerCase() === 'what' || key.toLowerCase() === 'note') continue;
    else lines.push({ who: key.toLowerCase(), text: value });
  }
  return { number, name, only, lines };
}

export function openJobs() {
  const issues = JSON.parse(gh('issue', 'list', '--label', LABEL, '--state', 'open', '--limit', '20', '--json', 'number,title,body,labels'));
  return issues.filter((i) => !i.labels.some((l) => l.name === RUNNING || l.name === FAILED)).map(parseIssue);
}

// What generate.py reported: lines made, the doubtful ones, and speakers it had no voice for.
export function summarise(log, asked = []) {
  const made = log.match(/Done: (\d+) lines?(?:, (\d+) doubtful)?/);
  const noVoice = [...log.matchAll(/^([a-z0-9-]+): no reference yet/gim)].map((m) => m[1].toLowerCase());
  const missing = [...new Set([...noVoice, ...asked.map((l) => l.who).filter((who) => noVoice.includes(who))])];
  return { made: made ? Number(made[1]) : 0, doubtful: made?.[2] ? Number(made[2]) : 0, noVoice: missing };
}

export async function runJob(job, root, log = console.log) {
  const branch = `voices/${job.name}`;
  log(`#${job.number} ${job.name}: ${job.only ? job.only.join(', ') : 'everyone'}${job.lines.length ? `, ${job.lines.length} line(s) asked for` : ''}`);
  gh('issue', 'edit', String(job.number), '--add-label', RUNNING);
  try {
    if (!existsSync(PYTHON)) throw new Error(`no ${PYTHON}: the voices venv (scripts/voices/README.md)`);
    git(root, 'fetch', '-q', 'origin', 'main');
    git(root, 'checkout', '-q', '-B', branch, 'origin/main');
    const extra = join(root, 'scripts', 'voices', 'cache', `issue-${job.number}.json`);
    mkdirSync(dirname(extra), { recursive: true });
    writeFileSync(extra, JSON.stringify(job.lines));
    const exported = sh(process.execPath, [join(root, 'scripts', 'voices', 'export-lines.mjs'), '--extra', extra], { cwd: root });
    log(exported.split('\n').at(-1));
    if (!existsSync(join(STORE.refs, 'rick.wav'))) throw new Error(`no references at ${STORE.refs} (copy scripts/voices/refs there, or set VOICES_REFS)`);
    const made = sh(PYTHON, [join(root, 'scripts', 'voices', 'generate.py'), ...(job.only ? ['--only', job.only.join(',')] : [])], { cwd: root, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, PYTHONIOENCODING: 'utf-8', VOICES_REFS: STORE.refs, VOICES_CACHE: STORE.cache } });
    const s = summarise(made, job.lines);
    const manifest = JSON.parse(readFileSync(join(root, 'public', 'audio', 'voiced', 'manifest.json'), 'utf8'));
    const total = Object.keys(manifest.lines ?? {}).length;
    git(root, 'add', 'public/audio/voiced');
    const changed = git(root, 'status', '--porcelain', 'public/audio/voiced').split('\n').filter(Boolean).length;
    if (!changed) {
      gh('issue', 'comment', String(job.number), '--body', `Nothing to make: every line ${job.only ? `of ${job.only.join(', ')}` : ''} already has a recording (${total} in the manifest).${s.noVoice.length ? `\n\nNo voice yet for: ${s.noVoice.join(', ')}.` : ''}`);
      gh('issue', 'close', String(job.number), '--reason', 'completed');
      log(`#${job.number}: nothing to make`);
      return null;
    }
    git(root, '-c', 'core.safecrlf=false', 'commit', '-q', '-m', `Voice lines from issue #${job.number}: ${s.made} made\n\n${changed} files; manifest at ${total} lines.\n\nCo-Authored-By: voices runner <noreply@tilakpatell.com>`);
    git(root, '-c', 'http.version=HTTP/1.1', 'push', '-q', '-f', '-u', 'origin', branch);
    const report = `${s.made} line(s) made${s.doubtful ? `, ${s.doubtful} doubtful (cache/takes/report.md on the desktop)` : ''}; the manifest now has ${total} lines.${s.noVoice.length ? `\n\nNo voice yet for: ${s.noVoice.join(', ')} (a reference is needed first: scripts/voices/README.md).` : ''}`;
    const pr = gh('pr', 'create', '--base', 'main', '--head', branch, '--title', `Voice lines: ${job.name} (${s.made} made)`, '--body', `From issue #${job.number}.\n\n${report}\n\nMade on the desktop by the voices runner (scripts/voices/runner.mjs): Qwen3-TTS in each speaker's cloned voice, best of four takes, judged.`);
    gh('issue', 'comment', String(job.number), '--body', `Made: ${pr}\n\n${report}`);
    gh('issue', 'close', String(job.number), '--reason', 'completed');
    log(`#${job.number} → ${pr}`);
    return pr;
  } catch (e) {
    gh('issue', 'edit', String(job.number), '--add-label', FAILED);
    gh('issue', 'comment', String(job.number), '--body', `Failed:\n\n\`\`\`\n${String(e.message ?? e).slice(0, 3000)}\n\`\`\`\n\nFix the issue and remove the \`${FAILED}\` label to try again.`);
    log(`#${job.number} failed: ${e.message}`);
    return null;
  } finally {
    gh('issue', 'edit', String(job.number), '--remove-label', RUNNING);
  }
}

export async function pass(root, log = console.log) {
  const jobs = openJobs();
  for (const job of jobs) await runJob(job, root, log);
  return jobs.length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--watch');
  const every = i >= 0 ? Number(args[i + 1] ?? 60) || 60 : null;
  const root = workspace(process.env.VOICES_RUNNER_ROOT ?? undefined, 'voices');
  console.log(`voices runner: jobs are open issues labelled "${LABEL}", made in ${root}${every ? `, every ${every}s` : ''}`);
  do {
    try {
      const n = await pass(root);
      if (n) console.log(`${new Date().toLocaleTimeString()}: ${n} job(s) done`);
    } catch (e) {
      console.error(`${new Date().toLocaleTimeString()}: ${e.message}`);
    }
    if (every) await new Promise((r) => setTimeout(r, every * 1000));
  } while (every);
}
