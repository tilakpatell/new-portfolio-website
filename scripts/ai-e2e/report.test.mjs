// The nightly report: one table from every tier's results, for the
// ai-health issue and the run's summary.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { report } from './report.mjs';

const DATE = '2026-10-07';
function night(files) {
  const dir = mkdtempSync(join(tmpdir(), 'ai-e2e-report-'));
  for (const [name, value] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), JSON.stringify(value));
  }
  return dir;
}
const GOOD = {
  'doctor.json': [{ group: 'machine', name: 'gh', ok: true, need: true }, { group: 'gen3d', name: 'Blender', ok: true, need: true }],
  'render.json': { tier: 'render', coverage: 0.04, models: [{ file: 'a.glb', look: 'plain', coverage: 0.3, errors: [] }, { file: 'a.glb', look: 'toon', coverage: 0.2, errors: [] }] },
  [`${DATE}-evals.json`]: { tier: 'evals', ok: true, steps: [{ name: 'vision', ok: true, seconds: 600 }, { name: 'hearing', ok: true, seconds: 90 }] },
  [`${DATE}-vision.json`]: { ok: true, results: [{ backend: 'claude', judge: { accuracy: 0.9375, mae: 1.1 }, pick: { right: 5, n: 5 } }] },
  [`${DATE}-hearing.json`]: { ok: true, wer: 0.01, speaker_first: 1, ordered: true },
  [`${DATE}-real.json`]: { tier: 'real', ok: true, gen3d: { ok: true, verdict: 8, tris: { hq: 8000, mid: 4000, lo: 1333 }, seconds: 300 }, voices: { ok: true, made: 1, doubtful: 0, seconds: 120 }, short: [] },
  [`${DATE}-drift.json`]: { tier: 'drift', ok: true, blessed: true, moves: [] },
};

describe('the nightly report', () => {
  it('is a row a tier, each with how it went and its headline number', () => {
    const r = report(night(GOOD), DATE);
    expect(r.ok).toBe(true);
    expect(r.markdown).toMatch(/^\| tier \| result \| what it says \| time \|/m);
    expect(r.markdown).toMatch(/\| doctor \| ok \| 2 of 2 ready \|/);
    expect(r.markdown).toMatch(/\| 3 render \| ok \| 2 renders, every one drawn \|/);
    expect(r.markdown).toMatch(/\| 5 vision \| ok \| claude: 94% in band \(MAE 1\.10\), picks 5\/5 \|/);
    expect(r.markdown).toMatch(/\| 5 hearing \| ok \| WER 1\.0%, right speaker first 100%, bad under good \|/);
    expect(r.markdown).toMatch(/\| 6 real \| ok \| X-wing 8\/10, 8000 \/ 4000 \/ 1333 triangles; Han 1 made, 0 doubtful \| 7 min \|/);
    expect(r.markdown).toMatch(/\| 6 drift \| ok \| within the golden \|/);
  });

  it('is red when a tier was, and says what fell short', () => {
    const dir = night({
      ...GOOD,
      'doctor.json': [{ group: 'gen3d', name: 'Blender', ok: false, need: true, fix: 'install it' }],
      [`${DATE}-drift.json`]: { ok: false, blessed: true, moves: [{ key: 'gen3d.verdict', was: 8, now: 6, change: '-25%' }] },
      'render.json': { coverage: 0.04, models: [{ file: 'b.glb', look: 'plain', coverage: 0.01, errors: [] }] },
    });
    const r = report(dir, DATE);
    expect(r.ok).toBe(false);
    expect(r.markdown).toMatch(/\| doctor \| \*\*red\*\* \| missing: Blender \|/);
    expect(r.markdown).toMatch(/\| 6 drift \| \*\*red\*\* \| gen3d\.verdict 8 → 6 \(-25%\) \|/);
    expect(r.markdown).toMatch(/\| 3 render \| \*\*red\*\* \| 1 renders, 1 not drawn: b\.glb \|/);
  });

  it('says so of a tier that never ran, rather than leaving it out', () => {
    const r = report(night({ 'doctor.json': GOOD['doctor.json'] }), DATE);
    expect(r.ok).toBe(false);
    expect(r.markdown).toMatch(/\| 6 real \| \*\*red\*\* \| did not run \|/);
  });

  it('notes a night with no golden yet without calling it red', () => {
    const r = report(night({ ...GOOD, [`${DATE}-drift.json`]: { ok: true, blessed: false, moves: [] } }), DATE);
    expect(r.markdown).toMatch(/\| 6 drift \| ok \| no golden yet: bless a good night \|/);
  });
});
