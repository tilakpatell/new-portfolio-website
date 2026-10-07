// Tier 7, taking a change out (scripts/autopilot-revert.mjs, "Revert change
// N"): in a temporary repository with three merged pull requests and their
// log entries, the second is reverted, its entry kept and marked; and when
// the third built on the same lines, it stops and names the third.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run, sandbox } from '../contract/repo.mjs';

// a repository whose main has three merged pull requests, #101 to #103, each with its log entry;
// `third` is the file the third one changes (b.txt, the second's, makes them clash)
function history(third) {
  const box = sandbox();
  const repo = box.repo(['scripts/autopilot-revert.mjs']);
  const write = (f, text) => {
    mkdirSync(join(repo.root, f, '..'), { recursive: true });
    writeFileSync(join(repo.root, f), text);
  };
  const change = (n, file, text, title) => {
    repo.git('checkout', '-q', '-b', `change-${n}`, 'main');
    write(file, text);
    write(`src/data/changes/000${n}.json`, `${JSON.stringify({ id: n, date: '2026-10-07', title, kind: 'fix', summary: 'a change for the revert test', routes: ['/'], pr: 100 + n, shots: [], reverted: null }, null, 2)}\n`);
    repo.git('add', '-A');
    repo.git('commit', '-q', '-m', title);
    repo.git('checkout', '-q', 'main');
    repo.git('merge', '-q', '--no-ff', `change-${n}`, '-m', `Merge pull request #${100 + n} from owner/change-${n}`);
  };
  change(1, 'a.txt', 'one\n', 'The first');
  change(2, 'b.txt', 'two\n', 'The second');
  change(3, third, third === 'b.txt' ? 'two, then three\n' : 'three\n', 'The third');
  return { box, repo, revert: () => run(process.execPath, [join(repo.root, 'scripts', 'autopilot-revert.mjs'), '2', '--why', 'the owner asked'], { cwd: repo.root, env: box.env }) };
}

describe('reverting a change (a temporary repository, up to 10 s)', () => {
  it('takes the second change out, and keeps its entry in the log, marked reverted', async () => {
    const { repo, revert } = history('c.txt');
    const r = await revert();
    expect(r.status, r.err).toBe(0);
    expect(existsSync(join(repo.root, 'b.txt'))).toBe(false);
    expect(readFileSync(join(repo.root, 'a.txt'), 'utf8')).toBe('one\n');
    expect(readFileSync(join(repo.root, 'c.txt'), 'utf8')).toBe('three\n');
    const entry = JSON.parse(readFileSync(join(repo.root, 'src', 'data', 'changes', '0002.json'), 'utf8'));
    expect(entry).toMatchObject({ id: 2, pr: 102, reverted: { why: 'the owner asked' } });
    expect(repo.git('log', '-1', '--format=%s')).toMatch(/^Revert "Merge pull request #102/);
    expect(repo.git('status', '--porcelain')).toBe('');
  });

  it('stops when a later change built on the same lines, and names it', async () => {
    const { repo, revert } = history('b.txt');
    const r = await revert();
    expect(r.status).toBe(2);
    expect(r.err).toMatch(/the revert conflicts in:\s+b\.txt/);
    expect(r.err).toMatch(/later pull requests changed the same files:\s+#103 \([0-9a-f]{10}\): b\.txt/);
    // nothing committed: the conflict is left for a person
    expect(repo.git('log', '-1', '--format=%s')).toBe('Merge pull request #103 from owner/change-3');
  });

  it('refuses a change reverted already', async () => {
    const { repo, revert } = history('c.txt');
    expect((await revert()).status).toBe(0);
    const again = await revert();
    expect(again.status).toBe(1);
    expect(again.err).toMatch(/change 2 was already reverted on \d{4}-\d{2}-\d{2}: the owner asked/);
    expect(repo.git('status', '--porcelain')).toBe('');
  });
});
