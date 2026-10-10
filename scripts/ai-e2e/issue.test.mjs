// The one ai-health issue the nightly keeps, through the fake gh: a red
// night opens it or adds the night's table to it; a green night closes it.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FAKES } from './contract/repo.mjs';
import { keep } from './issue.mjs';

let saved;
let dir;
beforeEach(() => {
  saved = { ...process.env };
  dir = mkdtempSync(join(tmpdir(), 'ai-e2e-issue-'));
  process.env.GH_BIN = join(FAKES, 'gh.mjs');
  process.env.GH_LOG = join(dir, 'gh.json');
  process.env.GH_FIXTURES = dir;
});
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
});
const open = (list) => writeFileSync(join(dir, 'issue-list.json'), JSON.stringify(list));
const calls = () => JSON.parse(readFileSync(join(dir, 'gh.json'), 'utf8'));

describe('the ai-health issue', () => {
  it('is opened on a red night with the table, labelled', () => {
    open([]);
    keep({ ok: false, markdown: '| tier | … |', date: '2026-10-07', run: 'https://x/run/1' });
    const create = calls().find((c) => c[0] === 'issue' && c[1] === 'create');
    expect(create).toEqual(expect.arrayContaining(['--label', 'ai-health', '--title', 'AI health: red on 2026-10-07']));
    expect(create[create.indexOf('--body') + 1]).toMatch(/\| tier \| … \|[\s\S]*https:\/\/x\/run\/1/);
  });

  it('gets the night’s table as a comment when it is open already', () => {
    open([{ number: 12 }]);
    keep({ ok: false, markdown: 'table', date: '2026-10-08' });
    expect(calls().filter((c) => c[1] === 'create')).toEqual([]);
    expect(calls().find((c) => c[1] === 'comment')).toEqual(expect.arrayContaining(['12', '--body']));
  });

  it('is closed by a green night, with the table to say why', () => {
    open([{ number: 12 }]);
    keep({ ok: true, markdown: 'table', date: '2026-10-09' });
    expect(calls().find((c) => c[1] === 'close')).toEqual(expect.arrayContaining(['12', '--comment']));
  });

  it('is left alone by a green night when there is none open', () => {
    open([]);
    keep({ ok: true, markdown: 'table', date: '2026-10-09' });
    expect(calls().filter((c) => ['create', 'comment', 'close'].includes(c[1]))).toEqual([]);
  });
});
