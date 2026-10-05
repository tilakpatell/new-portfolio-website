// Takes a change out of the site again: the one the ship's log entry <id>
// records (src/data/changes/<id>.json). On a branch from main:
//
//   node scripts/autopilot-revert.mjs 12 --why "The owner didn’t like the new sky."
//
// It finds the entry's merge commit on main's first-parent line from its
// pull request number, reverts it (`git revert -m 1`), puts the entry back
// in the log marked reverted (the revert took it out) with its screenshots,
// and commits. Push, open the pull request and merge it as for any change
// (.claude/skills/autopilot, "Undoing a change"). If the revert conflicts,
// it lists the later entries that touched the same files and leaves the
// conflict for you to resolve.
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIR = join(ROOT, 'src/data/changes');
const pad = (id) => String(id).padStart(4, '0');

const argv = process.argv.slice(2);
const id = Number(argv.find((a) => /^\d+$/.test(a)));
const whyAt = argv.indexOf('--why');
const why = whyAt >= 0 ? (argv[whyAt + 1] ?? '').trim() : '';
const fail = (m) => {
  console.error(m);
  process.exit(1);
};
if (!Number.isInteger(id) || id <= 0) fail('which change? node scripts/autopilot-revert.mjs <id> --why "…"');
if (!why) fail('--why "…" is needed: it goes in the log');

const git = (...a) => {
  const r = spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
};

const file = join(DIR, `${pad(id)}.json`);
const entry = JSON.parse(await readFile(file, 'utf8').catch(() => fail(`no entry ${id} (${file.replace(ROOT, '')})`)));
if (entry.reverted) fail(`change ${id} was already reverted on ${entry.reverted.date}: ${entry.reverted.why}`);
if (!entry.pr) fail(`change ${id} has no pull request number, so its merge can't be found; revert it by hand`);

if (git('status', '--porcelain').out) fail('the working tree has changes; commit or stash them first');

// the merge commit: "Merge pull request #N from …", or a squash's "(#N)"
const log = git('log', '--first-parent', '--format=%H%x09%P%x09%s', 'main').out || git('log', '--first-parent', '--format=%H%x09%P%x09%s').out;
const line = log.split('\n').find((l) => {
  const s = l.split('\t')[2] ?? '';
  return s.startsWith(`Merge pull request #${entry.pr} `) || s.endsWith(`(#${entry.pr})`);
});
if (!line) fail(`no merge of pull request #${entry.pr} on main; fetch main first (git fetch origin main && git branch -f main origin/main)`);
const [sha, parents] = line.split('\t');
const merge = parents.split(' ').length > 1;
console.log(`reverting ${sha.slice(0, 10)} (${merge ? 'a merge' : 'a squash'}) for #${entry.pr}: ${entry.title}`);

const revert = merge ? git('revert', '-m', '1', '--no-edit', sha) : git('revert', '--no-edit', sha);
if (!revert.ok) {
  const conflicted = git('diff', '--name-only', '--diff-filter=U').out.split('\n').filter(Boolean);
  console.error(`the revert conflicts in:\n  ${conflicted.join('\n  ')}`);
  // which later changes touched them
  const later = [];
  for (const l of log.split('\n')) {
    const [h, p, s] = l.split('\t');
    if (h === sha) break;
    const m = s.match(/Merge pull request #(\d+) |\(#(\d+)\)$/);
    if (!m) continue;
    const pr = Number(m[1] ?? m[2]);
    const touched = git('diff', '--name-only', p.split(' ').length > 1 ? `${h}^1` : `${h}^`, h).out.split('\n');
    const hits = conflicted.filter((f) => touched.includes(f));
    if (hits.length) later.push(`#${pr} (${h.slice(0, 10)}): ${hits.join(', ')}`);
  }
  if (later.length) console.error(`later pull requests changed the same files:\n  ${later.join('\n  ')}`);
  console.error('resolve the conflict (git status), then put the entry back marked reverted and commit; or git revert --abort');
  process.exit(2);
}

// the entry and its screenshots came out with the revert: put them back
await mkdir(DIR, { recursive: true });
entry.reverted = { date: new Date().toISOString().slice(0, 10), why };
await writeFile(file, `${JSON.stringify(entry, null, 2)}\n`);
for (const s of entry.shots ?? []) git('checkout', sha, '--', `public${s}`);
git('add', file, 'public/changes');
const commit = git('commit', '-q', '--amend', '--no-edit');
if (!commit.ok) fail(commit.err);
console.log(`reverted change ${id}; the entry stays in the log, marked reverted. Now push, open the pull request and merge it.`);
