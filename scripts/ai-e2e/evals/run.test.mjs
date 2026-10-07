// The evals' runner: each evaluation run in turn, every one run even when
// one fails, and the night failed when any did.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runAll, steps } from './run.mjs';

const node = (code) => ({ cmd: process.execPath, args: ['-e', code] });

describe('running the evals', () => {
  it('runs every step, says how each went, and fails the whole when one did', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-e2e-evals-'));
    const r = await runAll([
      { name: 'vision', ...node('process.exit(0)') },
      { name: 'hearing', ...node('console.error("under the line"); process.exit(1)') },
      { name: 'third', ...node('process.exit(0)') },
    ], { dir });
    expect(r.ok).toBe(false);
    expect(r.steps.map((s) => [s.name, s.ok])).toEqual([['vision', true], ['hearing', false], ['third', true]]);
    expect(r.steps[1].tail).toMatch(/under the line/);
  });

  it('says why a step couldn’t start, rather than stopping the night', async () => {
    const r = await runAll([{ name: 'hearing', cmd: join(tmpdir(), 'no-such-python.exe'), args: [] }], { dir: mkdtempSync(join(tmpdir(), 'ai-e2e-evals-')) });
    expect(r.ok).toBe(false);
    expect(r.steps[0].tail).toMatch(/didn’t start/);
  });

  it('runs the vision eval with node and the hearing eval with the voices Python', () => {
    const [vision, hearing] = steps({ python: 'C:/py/python.exe', results: 'R' });
    expect(vision.args[0]).toMatch(/evals[\\/]vision\.mjs$/);
    expect(hearing.cmd).toBe('C:/py/python.exe');
    expect(hearing.args[0]).toMatch(/voices[\\/]eval_judge\.py$/);
  });

  it('writes the summary where the report reads it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-e2e-evals-'));
    writeFileSync(join(dir, 'x'), '');
    const r = await runAll([{ name: 'vision', ...node('0') }], { dir, date: '2026-10-07' });
    expect(JSON.parse(readFileSync(join(dir, '2026-10-07-evals.json'), 'utf8'))).toMatchObject({ tier: 'evals', ok: true, steps: [{ name: 'vision', ok: true }] });
    expect(r.file).toBe(join(dir, '2026-10-07-evals.json'));
  });
});
