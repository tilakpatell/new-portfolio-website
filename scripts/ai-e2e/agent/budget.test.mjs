// Tier 7, the autopilot's budget guard (scripts/autopilot-budget.mjs): the
// check a run makes before it does anything, as the skill's section 2 says.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decide } from '../../autopilot-budget.mjs';
import { REPO, run } from '../contract/repo.mjs';

const BUDGET = { paused: false, runsPerDay: 6, stopAtUtilization: 0.8 };
const TODAY = '2026-10-07';
const entries = (n, date = TODAY) => Array.from({ length: n }, (_, i) => ({ id: i + 1, date }));

describe('the budget guard', () => {
  it('stops a paused autopilot', () => {
    expect(decide({ budget: { ...BUDGET, paused: true }, status: 'allowed', today: TODAY, entries: [] })).toEqual({ go: false, why: 'paused (docs/autopilot/budget.json)' });
  });
  it('stops at 80% of the plan, and goes at 79%', () => {
    expect(decide({ budget: BUDGET, utilization: 0.8, status: 'allowed', today: TODAY, entries: [] })).toEqual({ go: false, why: 'the plan is 80% used (stop at 80%)' });
    expect(decide({ budget: BUDGET, utilization: 0.79, status: 'allowed', today: TODAY, entries: [] }).go).toBe(true);
  });
  it('goes with no utilisation figure when the status is allowed, and stops on any other status', () => {
    expect(decide({ budget: BUDGET, status: 'allowed', today: TODAY, entries: [] })).toEqual({ go: true, why: 'within budget' });
    expect(decide({ budget: BUDGET, status: 'allowed_warning', today: TODAY, entries: [] })).toEqual({ go: false, why: 'the plan’s status is allowed_warning, not allowed' });
    expect(decide({ budget: BUDGET, today: TODAY, entries: [] })).toEqual({ go: false, why: 'no plan status given (AUTOPILOT_STATUS)' });
  });
  it('stops in overage', () => {
    expect(decide({ budget: BUDGET, status: 'allowed', overage: true, today: TODAY, entries: [] })).toEqual({ go: false, why: 'the plan is in overage' });
  });
  it('stops once today has its runsPerDay entries in the log, counting only today’s', () => {
    expect(decide({ budget: BUDGET, status: 'allowed', today: TODAY, entries: entries(6) })).toEqual({ go: false, why: 'today has 6 entries already (runsPerDay 6)' });
    expect(decide({ budget: BUDGET, status: 'allowed', today: TODAY, entries: [...entries(5), ...entries(9, '2026-10-06')] }).go).toBe(true);
  });
});

describe('the budget guard’s command line (a subprocess)', () => {
  it('prints go or stop with the reason, exits 0 or 1, and reads the log’s entries for today', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-e2e-budget-'));
    mkdirSync(join(dir, 'changes'));
    writeFileSync(join(dir, 'budget.json'), JSON.stringify(BUDGET));
    for (const e of entries(6)) writeFileSync(join(dir, 'changes', `${String(e.id).padStart(4, '0')}.json`), JSON.stringify(e));
    const env = { ...process.env, AUTOPILOT_BUDGET: join(dir, 'budget.json'), AUTOPILOT_CHANGES: join(dir, 'changes'), AUTOPILOT_TODAY: TODAY, AUTOPILOT_STATUS: 'allowed' };
    const stop = await run(process.execPath, [join(REPO, 'scripts', 'autopilot-budget.mjs')], { env });
    expect([stop.status, stop.out.trim()]).toEqual([1, 'stop: today has 6 entries already (runsPerDay 6)']);
    const go = await run(process.execPath, [join(REPO, 'scripts', 'autopilot-budget.mjs')], { env: { ...env, AUTOPILOT_TODAY: '2026-10-08', AUTOPILOT_UTILIZATION: '0.42' } });
    expect([go.status, go.out.trim()]).toEqual([0, 'go']);
  });
});
