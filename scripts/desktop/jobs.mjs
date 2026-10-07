// A desktop pipeline's jobs, whatever it makes: an issue is checked, waits
// for the GPU, is made (the pipeline's own `make`), and ends as a pull
// request and a comment, or as a failure that says why and how to retry.
// The pipelines (scripts/gen3d/runner.mjs, scripts/voices/runner.mjs) each
// describe themselves as an object and call `cli(pipeline)`:
//
//   { name, label, vram (MiB), minutes (the job's time limit),
//     keys (the issue fields), parse(issue) → job, make(job, root, ctx) → { pr, report } | { nothing },
//     request(inputs) → { title, body } }
//
// Their command lines are then all the same:
//
//   node scripts/<p>/runner.mjs --issue N      one job (the Actions workflow, on an issue or a dispatch)
//   node scripts/<p>/runner.mjs --sweep        every open job (the hourly workflow; --once is the same)
//   node scripts/<p>/runner.mjs --watch [60]   sweep every 60 s (by hand; the workflows are the usual way)
//   node scripts/<p>/runner.mjs --pending      how many jobs are waiting (prints the number)
//   node scripts/<p>/runner.mjs --enqueue      an issue from the workflow's inputs (INPUT_* in the environment)

import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOME, gh, issue as getIssue, keepAwake, labelled, quietly, ready, repoName, runUrl, summary, tail, waitForGpu } from './lib.mjs';

export const labels = (p) => ({ label: p.label, running: `${p.label}:running`, failed: `${p.label}:failed`, waiting: `${p.label}:waiting` });

// One runner per pipeline at a time on this machine: a lock file with its
// pid. A "running" label with no live lock behind it is a job that was cut
// off (the machine slept or restarted) and is taken again.
const LOCKS = join(HOME, 'locks');
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};
export function lock(name) {
  mkdirSync(LOCKS, { recursive: true });
  const file = join(LOCKS, `${name}.lock`);
  const held = existsSync(file) ? Number(readFileSync(file, 'utf8')) : 0;
  if (held && held !== process.pid && alive(held)) return null;
  writeFileSync(file, String(process.pid));
  const release = () => quietly(() => existsSync(file) && Number(readFileSync(file, 'utf8')) === process.pid && rmSync(file), 'unlock');
  process.once('exit', release);
  return { release };
}

const comment = (n, body) => quietly(() => gh('issue', 'comment', String(n), '--body', body), `comment on #${n}`);
const edit = (n, ...args) => quietly(() => gh('issue', 'edit', String(n), ...args), `label #${n}`);
const run = () => (runUrl() ? ` ([the run](${runUrl()}))` : '');

// A job cut off mid-way (its "running" label outlived the runner): taken again.
export function unstick(p, issues, log = console.log) {
  const l = labels(p);
  for (const i of issues.filter((i) => i.labels.includes(l.running))) {
    log(`#${i.number}: its last run was cut off; taking it again`);
    edit(i.number, '--remove-label', l.running);
    i.labels = i.labels.filter((x) => x !== l.running);
    comment(i.number, `The last attempt was cut off (the desktop slept or restarted); trying again${run()}.`);
  }
}

// One issue made, start to end. → 'made' | 'nothing' | 'failed' | 'deferred' | 'skipped'
export async function take(p, i, root, log = console.log) {
  const l = labels(p);
  const r = ready(i, l);
  if (!r.ok) {
    log(`#${i.number}: skipped, ${r.why}`);
    return 'skipped';
  }
  let job;
  try {
    job = p.parse(i);
    if (!job) throw new Error('the title names nothing to make');
    if (job.error) throw new Error(job.error);
  } catch (e) {
    edit(i.number, '--add-label', l.failed);
    comment(i.number, `Can't read this job: ${e.message}\n\n${p.help ?? ''}\n\nEdit the issue, then remove the \`${l.failed}\` label to try again.`);
    log(`#${i.number}: can't read it: ${e.message}`);
    return 'failed';
  }
  if (!(await waitForGpu(p.vram, { minutes: p.gpuWait ?? 45, log }))) {
    if (!i.labels.includes(l.waiting)) {
      edit(i.number, '--add-label', l.waiting);
      comment(i.number, `Waiting for the GPU (something else on the desktop is using it); the hourly sweep tries again${run()}.`);
    }
    log(`#${i.number}: deferred, the GPU is busy`);
    summary(`- #${i.number} ${i.title}: deferred, the GPU is busy`);
    return 'deferred';
  }
  edit(i.number, '--add-label', l.running, ...(i.labels.includes(l.waiting) ? ['--remove-label', l.waiting] : []));
  if (runUrl()) comment(i.number, `Started on the desktop: ${runUrl()}`);
  const awake = keepAwake();
  try {
    const made = await p.make(job, root, { log, number: i.number });
    if (made.nothing) {
      comment(i.number, made.nothing);
      quietly(() => gh('issue', 'close', String(i.number), '--reason', 'completed'), 'close');
      summary(`- #${i.number} ${i.title}: nothing to make`);
      return 'nothing';
    }
    comment(i.number, `Made: ${made.pr}${made.report ? `\n\n${made.report}` : ''}`);
    quietly(() => gh('issue', 'close', String(i.number), '--reason', 'completed'), 'close');
    summary(`- #${i.number} ${i.title}: ${made.pr}`);
    log(`#${i.number} → ${made.pr}`);
    return 'made';
  } catch (e) {
    const detail = tail(`${e.err ?? ''}\n${e.message}`, 40);
    edit(i.number, '--add-label', l.failed);
    comment(i.number, `Failed${run()}:\n\n\`\`\`\n${detail.slice(-6000)}\n\`\`\`\n\n${p.hint?.(e) ?? ''}Fix the issue (or the desktop), then remove the \`${l.failed}\` label to try again.`);
    summary(`- #${i.number} ${i.title}: **failed**: ${e.message.split('\n')[0]}`);
    log(`#${i.number} failed: ${e.message}`);
    return 'failed';
  } finally {
    awake.stop();
    edit(i.number, '--remove-label', l.running);
  }
}

export const pending = (p) => labelled(p.label).filter((i) => ready(i, labels(p)).ok);

// Every open job, one after another.
export async function sweep(p, root, log = console.log) {
  const all = labelled(p.label);
  unstick(p, all, log);
  const results = [];
  for (const i of all) results.push(await take(p, i, root, log));
  return results;
}

// A dispatch's inputs (INPUT_NAME, …) as an issue, so the request outlives
// the desktop being off: the job runs on it now if the desktop's up, else
// the next sweep finds it. → the issue's number
export function enqueue(p, inputs = fromEnv()) {
  const { title, body } = p.request(inputs);
  const url = gh('issue', 'create', '--title', title, '--body', `${body}\n\n_Queued from the Actions tab${process.env.GITHUB_ACTOR ? ` by @${process.env.GITHUB_ACTOR}` : ''}._`, '--label', p.label);
  const number = Number(url.match(/(\d+)\s*$/)?.[1]);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `number=${number}\n`);
  summary(`Queued ${url}`);
  return number;
}

export const fromEnv = (env = process.env) => Object.fromEntries(Object.entries(env).filter(([k, v]) => k.startsWith('INPUT_') && v).map(([k, v]) => [k.slice(6).toLowerCase(), v]));

export async function cli(p, argv = process.argv.slice(2), { root: rootFor } = {}) {
  const has = (f) => argv.includes(f);
  const val = (f) => argv[argv.indexOf(f) + 1];
  const log = (m) => console.log(`${new Date().toLocaleTimeString()} ${m}`);
  if (has('--pending')) {
    console.log(pending(p).length);
    return;
  }
  if (has('--enqueue')) {
    console.log(enqueue(p));
    return;
  }
  const held = lock(p.name);
  if (!held) {
    log(`another ${p.name} runner is going on this machine; its jobs will be taken in turn`);
    if (has('--issue')) process.exitCode = 0;
    return;
  }
  const root = rootFor();
  if (has('--issue')) {
    const n = Number(val('--issue'));
    if (!n) throw new Error('--issue N');
    const i = getIssue(n);
    if (i.labels.includes(labels(p).running)) unstick(p, [i], log); // this machine holds the lock: a "running" label is from a run that was cut off
    const r = await take(p, i, root, log);
    if (r === 'failed') process.exitCode = 1;
    return;
  }
  const every = has('--watch') ? Number(val('--watch')) || 60 : null;
  log(`${p.name}: jobs are open issues labelled "${p.label}" on ${repoName()}, made in ${root}${every ? `, every ${every}s` : ''}`);
  do {
    try {
      const r = await sweep(p, root, log);
      if (r.length) log(`${r.length} job(s): ${r.join(', ')}`);
      if (!every && r.includes('failed')) process.exitCode = 1;
    } catch (e) {
      log(`sweep failed: ${e.message}`);
      if (!every) process.exitCode = 1;
    }
    if (every) await new Promise((r) => setTimeout(r, every * 1000));
  } while (every);
}
