import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { makeContext } from './health/context.mjs';
import bigFiles, { CEILING, WARN } from './health/big-files.mjs';
import lintDisables from './health/lint-disables.mjs';
import todoNotes from './health/todo-notes.mjs';
import { check, describe as words, ratchet } from './health/ratchet.mjs';

const TREE = fileURLToPath(new URL('./health/fixtures/tree/', import.meta.url));
const ctx = await makeContext(TREE);

describe('the measure, on a fixture tree', () => {
  it('big-files counts files over the ceiling and lists every file over the warning line, tests left out', async () => {
    const m = await bigFiles(ctx);
    expect(m.value).toBe(1);
    expect(m.detail.map((d) => d.file)).toEqual(['src/world/long.js', 'src/world/mid.js']);
    expect(m.detail[0].n).toBeGreaterThan(CEILING);
    expect(m.detail[1].n).toBeGreaterThan(WARN);
    expect(m.better).toBe('lower');
  });

  it('lint-disables counts every form, in src and scripts', async () => {
    const m = await lintDisables(ctx);
    expect(m.value).toBe(3);
    expect(m.detail).toEqual([{ file: 'src/world/small.js', n: 2 }, { file: 'scripts/tool.mjs', n: 1 }]);
  });

  it('todo-notes counts TODO, FIXME and HACK under src only', async () => {
    const m = await todoNotes(ctx);
    expect(m.value).toBe(2);
    expect(m.detail).toEqual([{ file: 'src/world/small.js', n: 2 }]);
  });
});

describe('the ratchet', () => {
  const metrics = [
    { id: 'big-files', value: 3, unit: 'files', detail: [{ file: 'a.js', n: 2000 }] },
    { id: 'entry-kb', value: 141, unit: 'kB', detail: [] },
    { id: 'new-one', value: 9, unit: 'things', detail: [] },
  ];

  it('check names only what is over a budget it has; a metric without a budget never fails', () => {
    expect(check(metrics, { 'big-files': 3, 'entry-kb': 145 })).toEqual([]);
    const over = check(metrics, { 'big-files': 2, 'entry-kb': 145 });
    expect(over).toHaveLength(1);
    expect(over[0]).toMatchObject({ id: 'big-files', value: 3, budget: 2, worst: [{ file: 'a.js', n: 2000 }] });
    expect(words(over)).toContain('big-files: 3 files over budget 2');
    expect(words(over)).toContain('a.js  2000');
  });

  it('ratchet only lowers, adds a budget for a new metric, rounds kB up to the next 5 and sorts the keys', () => {
    const next = ratchet(metrics, { 'big-files': 5, 'entry-kb': 140, zzz: 1 });
    expect(next).toEqual({ 'big-files': 3, 'entry-kb': 140, 'new-one': 9, zzz: 1 });
    expect(Object.keys(next)).toEqual(['big-files', 'entry-kb', 'new-one', 'zzz']);
    expect(ratchet([{ id: 'entry-kb', value: 141, unit: 'kB', detail: [] }], {})).toEqual({ 'entry-kb': 145 });
  });

  it('ratchet leaves a skipped metric alone', () => {
    expect(ratchet([{ id: 'total-js-kb', value: 0, skipped: true, detail: [] }], { 'total-js-kb': 5000 })).toEqual({ 'total-js-kb': 5000 });
  });
});
