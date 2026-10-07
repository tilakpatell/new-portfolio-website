// May this autopilot run do anything? The budget check every run makes
// first (.claude/skills/autopilot, section 2), as a command, so it is the
// same every time and tested (scripts/ai-e2e/agent/budget.test.mjs):
//
//   AUTOPILOT_UTILIZATION=0.42 AUTOPILOT_STATUS=allowed [AUTOPILOT_OVERAGE=true] node scripts/autopilot-budget.mjs
//   → prints `go`, exit 0; or `stop: <why>`, exit 1
//
// The session reads the plan's figures (get_session's rate_limit_info:
// utilization, status, isUsingOverage) and passes them in; this reads
// docs/autopilot/budget.json and today's entries in src/data/changes/.
// (AUTOPILOT_BUDGET, AUTOPILOT_CHANGES and AUTOPILOT_TODAY point it
// elsewhere, for the tests.)

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

export function decide({ budget, utilization, status, overage = false, today, entries }) {
  if (budget.paused) return { go: false, why: 'paused (docs/autopilot/budget.json)' };
  const done = entries.filter((e) => e.date === today).length;
  if (done >= budget.runsPerDay) return { go: false, why: `today has ${done} entries already (runsPerDay ${budget.runsPerDay})` };
  if (overage) return { go: false, why: 'the plan is in overage' };
  if (!status) return { go: false, why: 'no plan status given (AUTOPILOT_STATUS)' };
  if (status !== 'allowed') return { go: false, why: `the plan’s status is ${status}, not allowed` };
  // no utilisation figure (a promotional or unmetered limit): the status alone, and the pace knobs
  if (utilization != null && utilization >= budget.stopAtUtilization) return { go: false, why: `the plan is ${Math.round(utilization * 100)}% used (stop at ${Math.round(budget.stopAtUtilization * 100)}%)` };
  return { go: true, why: 'within budget' };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const env = process.env;
  const budget = JSON.parse(readFileSync(env.AUTOPILOT_BUDGET ?? join(ROOT, 'docs', 'autopilot', 'budget.json'), 'utf8'));
  const dir = env.AUTOPILOT_CHANGES ?? join(ROOT, 'src', 'data', 'changes');
  const entries = existsSync(dir) ? readdirSync(dir).filter((f) => /^\d{4}\.json$/.test(f)).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8'))) : [];
  const figure = env.AUTOPILOT_UTILIZATION;
  const r = decide({
    budget,
    utilization: figure === undefined || figure === '' ? null : Number(figure),
    status: env.AUTOPILOT_STATUS,
    overage: /^(true|1|yes)$/i.test(env.AUTOPILOT_OVERAGE ?? ''),
    today: env.AUTOPILOT_TODAY ?? new Date().toISOString().slice(0, 10),
    entries,
  });
  console.log(r.go ? 'go' : `stop: ${r.why}`);
  process.exit(r.go ? 0 : 1);
}
