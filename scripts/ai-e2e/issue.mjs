// The one issue the nightly keeps, labelled ai-health: a red night opens it
// (or, open already, adds the night's table to it), a green night closes
// it. One issue and not one a night, so a run of red nights is one thread
// to read, and a green night ends it.
//
//   node scripts/ai-e2e/issue.mjs [date]   (after report.mjs; GH_TOKEN in the workflow)
//   keep({ ok, markdown, date, run })

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gh, quietly, runUrl } from '../desktop/lib.mjs';
import { report } from './report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const LABEL = 'ai-health';

export function keep({ ok, markdown, date, run = runUrl() }) {
  const body = `${markdown}${run ? `\n\n[The night's run](${run}): its artifact has the results, the renders and the judging sheets.` : ''}`;
  const open = JSON.parse(gh('issue', 'list', '--label', LABEL, '--state', 'open', '--json', 'number', '--limit', '1') || '[]');
  if (ok) {
    if (open.length) gh('issue', 'close', String(open[0].number), '--comment', `Green again on ${date}.\n\n${body}`);
    return open.length ? 'closed' : 'quiet';
  }
  if (open.length) {
    gh('issue', 'comment', String(open[0].number), '--body', body);
    return 'commented';
  }
  quietly(() => gh('label', 'create', LABEL, '--color', 'B60205', '--description', 'the nightly AI health run went red', '--force'), 'label create');
  gh('issue', 'create', '--title', `AI health: red on ${date}`, '--label', LABEL, '--body', `${body}\n\nscripts/ai-e2e/README.md says what each tier means and what to do. A green night closes this.`);
  return 'opened';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.env.AI_RESULTS ?? join(HERE, 'results');
  const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  const r = existsSync(join(dir, `${date}-report.md`)) ? { ...report(dir, date), markdown: readFileSync(join(dir, `${date}-report.md`), 'utf8').trim() } : report(dir, date);
  console.log(`ai-health issue: ${keep({ ok: r.ok, markdown: r.markdown, date })}`);
}
