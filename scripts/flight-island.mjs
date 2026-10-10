// The planet flight (/fly) as an island the site can lose in one command:
// the inventory and the rules are scripts/lib/flight-island.mjs's, this is
// the hand that runs them over the repository.
//
//   node scripts/flight-island.mjs --check         # ok and the counts, or each unmarked or stale line (exit 1)
//   node scripts/flight-island.mjs --remove --dry  # what --remove would do, line by line
//   node scripts/flight-island.mjs --remove        # do it (a clean tree only), then npm install and the stack census
//
// npm test holds the inventory to the tree (flight-island.test.mjs) and
// node scripts/health.mjs --check runs --check, so a row that names the
// flight and is not marked fails before it lands.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apply, check, clean, removal } from './lib/flight-island.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// the repository as the pure module reads it: what git tracks or would
// (untracked but not ignored), each still a file on disk
export function repoTree(root = ROOT) {
  const listed = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 });
  const files = [...new Set(listed.split('\n').filter(Boolean))].filter((f) => existsSync(join(root, f)) && statSync(join(root, f)).isFile()).sort();
  return {
    files,
    read: (f) => (existsSync(join(root, f)) ? readFileSync(join(root, f), 'utf8') : null),
    write: (f, text) => {
      mkdirSync(dirname(join(root, f)), { recursive: true });
      writeFileSync(join(root, f), text);
    },
    remove: (f) => rmSync(join(root, f), { force: true }),
  };
}

const LABELS = {
  unmarked: 'names the flight, not marked // planet flight',
  stale: 'marked, names nothing of the flight',
  outsideImports: 'imports the flight from outside it',
  crossWorld: 'the flight past a world’s shared/ face',
  broken: 'a begin with no end, or an end with no begin',
};

function runCheck() {
  const r = check(repoTree());
  if (clean(r)) {
    console.log(`ok   ${r.counts.files} files on the island, ${r.counts.rows} marked rows, ${r.counts.references} references`);
    return 0;
  }
  for (const [k, label] of Object.entries(LABELS)) for (const x of r[k]) console.log(`${x.file}:${x.line}: ${label}: ${x.text}`);
  for (const f of r.unlisted) console.log(`${f}: has marked rows, not in ISLAND.rows (scripts/lib/flight-island.mjs)`);
  for (const f of r.missing) console.log(`${f}: in ISLAND.rows, has no marked row`);
  return 1;
}

function printPlan(plan) {
  console.log(`delete ${plan.delete.length} files:`);
  for (const f of plan.delete) console.log(`  ${f}`);
  const rows = plan.dropLines.reduce((n, d) => n + d.lines.length, 0);
  console.log(`drop ${rows} lines from ${plan.dropLines.length} files:`);
  for (const { file, lines } of plan.dropLines) for (const l of lines) console.log(`  ${file}:${l.line}: ${l.text}`);
  console.log(`dependencies out of package.json: ${plan.deps.join(', ')} (then npm install rewrites package-lock.json, and node scripts/stack-census.mjs --write)`);
  console.log(`write ${plan.migrationFile} (drops the flight's tables) and ${plan.decisionFile}`);
  console.log('by hand:');
  for (const b of plan.byHand) console.log(`  ${b}`);
  console.log(`the owner: apply ${plan.migrationFile} to the project (nothing else: the asset buckets are not the flight's)`);
}

function runRemove(dry) {
  const tree = repoTree();
  const plan = removal(tree, { date: new Date().toISOString().slice(0, 10) });
  printPlan(plan);
  if (dry) return 0;
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (dirty) {
    console.log('refused: the tree has changes; commit or stash them first, so the removal is one diff');
    return 1;
  }
  const r = check(tree);
  if (!clean(r)) {
    console.log('refused: --check is not clean, so a row would be left behind; run --check');
    return 1;
  }
  apply(plan, tree);
  execFileSync('npm', ['install'], { cwd: ROOT, stdio: 'inherit' });
  execFileSync('node', ['scripts/stack-census.mjs', '--write'], { cwd: ROOT, stdio: 'inherit' });
  console.log('done: the flight is gone. Run the gates (npm run lint, npm test, npm run build, node scripts/health.mjs --check), then the by-hand list above.');
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = new Set(process.argv.slice(2));
  if (args.has('--check')) process.exit(runCheck());
  else if (args.has('--remove')) process.exit(runRemove(args.has('--dry')));
  else {
    console.log('node scripts/flight-island.mjs --check | --remove --dry | --remove');
    process.exit(2);
  }
}
