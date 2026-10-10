// What the desktop pipelines are doing, from anywhere gh is signed in: is
// the desktop's runner up, what's queued, running, waiting or failed, and
// the last few runs. On the desktop itself, the GPU's free memory too.
//
//   node scripts/desktop/status.mjs           readable
//   node scripts/desktop/status.mjs --json    for a script or a session

import { fileURLToPath } from 'node:url';
import { gh, ghCommand, gpuFree, labelled, repoName, sh, trusted } from './lib.mjs';

const PIPELINES = ['gen3d', 'voices', 'motion'];

// An open job's state, from its labels.
export function stateOf(issue, label) {
  const l = issue.labels;
  if (!trusted(issue)) return 'ignored (not from the owner or a collaborator)';
  if (l.includes(`${label}:failed`)) return 'failed';
  if (l.includes(`${label}:running`)) return 'running';
  if (l.includes(`${label}:waiting`)) return 'waiting for the GPU';
  return 'queued';
}

export function runners(repo) {
  try {
    const r = JSON.parse(sh(...ghCommand(['api', `repos/${repo}/actions/runners`]), { stdio: ['ignore', 'pipe', 'pipe'] }));
    return r.runners.filter((x) => x.labels.some((l) => l.name === 'gpu')).map((x) => ({ name: x.name, status: x.status, busy: x.busy }));
  } catch {
    return null; // listing runners needs a repository admin's token
  }
}

export function status() {
  const repo = repoName();
  const out = { repo, runners: runners(repo), gpu: gpuFree(), pipelines: {} };
  for (const p of PIPELINES) {
    const jobs = labelled(p, repo).map((i) => ({ number: i.number, title: i.title, state: stateOf(i, p), url: i.html_url, updated: i.updated_at }));
    let runs = [];
    try {
      runs = JSON.parse(sh(...ghCommand(['run', 'list', '--repo', repo, '--workflow', `${p}.yml`, '--limit', '5', '--json', 'displayTitle,status,conclusion,url,createdAt']), { stdio: ['ignore', 'pipe', 'pipe'] }));
    } catch {
      /* the workflow isn't on main yet */
    }
    out.pipelines[p] = { jobs, runs };
  }
  // the AI and the models' nightly (scripts/ai-e2e): its last night
  try {
    out.aiHealth = JSON.parse(gh('run', 'list', '--repo', repo, '--workflow', 'ai-health.yml', '--limit', '1', '--json', 'status,conclusion,url,createdAt'))[0] ?? null;
  } catch {
    out.aiHealth = null; /* not on main yet */
  }
  return out;
}

const ago = (t) => {
  const m = Math.round((Date.now() - new Date(t)) / 60000);
  return m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

export function render(s) {
  const lines = [];
  if (s.runners === null) lines.push("Desktop runner: can't tell (listing runners needs the repo owner's token)");
  else if (!s.runners.length) lines.push('Desktop runner: none registered (scripts/desktop/README.md, Setting up the desktop)');
  else for (const r of s.runners) lines.push(`Desktop runner ${r.name}: ${r.status === 'online' ? (r.busy ? 'online, working' : 'online, idle') : 'offline (the desktop is asleep or off; jobs wait for it)'}`);
  if (s.gpu) lines.push(`GPU here: ${(s.gpu.free / 1024).toFixed(1)} of ${(s.gpu.total / 1024).toFixed(1)} GB free`);
  lines.push(s.aiHealth ? `AI health, last night: ${s.aiHealth.conclusion || s.aiHealth.status} (${ago(s.aiHealth.createdAt)}) ${s.aiHealth.url}` : 'AI health: no night yet (.github/workflows/ai-health.yml)');
  for (const [p, { jobs, runs }] of Object.entries(s.pipelines)) {
    lines.push('', `${p}: ${jobs.length ? `${jobs.length} open` : 'nothing open'}`);
    for (const j of jobs) lines.push(`  #${j.number} ${j.title}: ${j.state}`);
    if (runs.length) lines.push('  recent runs:');
    for (const r of runs) lines.push(`    ${r.conclusion || r.status} ${r.displayTitle} (${ago(r.createdAt)}) ${r.url}`);
  }
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const s = status();
  console.log(process.argv.includes('--json') ? JSON.stringify(s, null, 2) : render(s));
}
