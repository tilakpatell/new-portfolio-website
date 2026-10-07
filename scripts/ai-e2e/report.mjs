// The nightly report: one Markdown table from every tier's results, for
// the ai-health issue, the run's summary and a person at a terminal.
//
//   node scripts/ai-e2e/report.mjs [date]   → stdout, and results/<date>-report.md; exit 1 when a tier is red
//   report(dir, date) → { ok, markdown, rows }
//
// It reads, from the results folder (AI_RESULTS): doctor.json (the
// desktop doctor's --json), render.json (the render tier's, copied from
// render/out/results.json), and <date>-evals, -vision, -hearing, -real and
// -drift.json. A tier with no file did not run, which is red.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const pct = (x) => `${Math.round(x * 100)}%`;
const mins = (s) => (s == null ? '' : `${Math.round(s / 60)} min`);

export function report(dir, date) {
  const read = (name) => (existsSync(join(dir, name)) ? JSON.parse(readFileSync(join(dir, name), 'utf8')) : null);
  const rows = [];
  const row = (tier, ok, says, time = '') => rows.push({ tier, ok, says, time });

  const doctor = read('doctor.json');
  if (!doctor) row('doctor', false, 'did not run');
  else {
    const missing = doctor.filter((c) => c.need && !c.ok);
    row('doctor', !missing.length, missing.length ? `missing: ${missing.map((c) => c.name).join(', ')}` : `${doctor.filter((c) => c.ok).length} of ${doctor.length} ready`);
  }

  const render = read('render.json');
  if (!render) row('3 render', false, 'did not run');
  else {
    const bad = render.models.filter((m) => m.errors.length || m.coverage < render.coverage);
    row('3 render', !bad.length, bad.length ? `${render.models.length} renders, ${bad.length} not drawn: ${bad.slice(0, 5).map((m) => m.file).join(', ')}` : `${render.models.length} renders, every one drawn`);
  }

  const vision = read(`${date}-vision.json`);
  if (!vision) row('5 vision', false, read(`${date}-evals.json`)?.steps?.find((s) => s.name === 'vision')?.tail?.split('\n').at(-1) ?? 'did not run');
  else row('5 vision', vision.ok, vision.results.map((r) => `${r.backend}: ${pct(r.judge.accuracy)} in band (MAE ${r.judge.mae.toFixed(2)}), picks ${r.pick.right}/${r.pick.n}`).join('; '), mins(read(`${date}-evals.json`)?.steps?.find((s) => s.name === 'vision')?.seconds));

  const hearing = read(`${date}-hearing.json`);
  if (!hearing) row('5 hearing', false, read(`${date}-evals.json`)?.steps?.find((s) => s.name === 'hearing')?.tail?.split('\n').at(-1) ?? 'did not run');
  else row('5 hearing', hearing.ok, `WER ${(hearing.wer * 100).toFixed(1)}%, right speaker first ${pct(hearing.speaker_first)}, ${hearing.ordered ? 'bad under good' : 'a bad take over a good one'}`, mins(read(`${date}-evals.json`)?.steps?.find((s) => s.name === 'hearing')?.seconds));

  const real = read(`${date}-real.json`);
  if (!real) row('6 real', false, 'did not run');
  else {
    const g = real.gen3d ?? {};
    const v = real.voices ?? {};
    const says = `X-wing ${g.verdict ?? '?'}/10, ${g.tris ? `${g.tris.hq} / ${g.tris.mid} / ${g.tris.lo} triangles` : 'no cuts'}; Han ${v.made ?? 0} made, ${v.doubtful ?? '?'} doubtful${real.short?.length ? ` (${real.short.join('; ')})` : ''}`;
    row('6 real', real.ok, says, mins((g.seconds ?? 0) + (v.seconds ?? 0)));
  }

  const drift = read(`${date}-drift.json`);
  if (!drift) row('6 drift', false, 'did not run');
  else if (!drift.blessed) row('6 drift', true, 'no golden yet: bless a good night');
  else row('6 drift', drift.ok, drift.moves.length ? drift.moves.map((m) => `${m.key} ${m.was} → ${m.now ?? 'missing'} (${m.change})`).join('; ') : 'within the golden');

  const ok = rows.every((r) => r.ok);
  const markdown = [`AI health, ${date}: ${ok ? 'every tier green' : `red: ${rows.filter((r) => !r.ok).map((r) => r.tier).join(', ')}`}`, '', '| tier | result | what it says | time |', '| --- | --- | --- | --- |', ...rows.map((r) => `| ${r.tier} | ${r.ok ? 'ok' : '**red**'} | ${r.says.replace(/\|/g, '/')} | ${r.time} |`)].join('\n');
  return { ok, markdown, rows };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.env.AI_RESULTS ?? join(HERE, 'results');
  const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  const r = report(dir, date);
  writeFileSync(join(dir, `${date}-report.md`), `${r.markdown}\n`);
  console.log(r.markdown);
  process.exit(r.ok ? 0 : 1);
}
