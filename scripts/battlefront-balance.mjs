// The Battlefront balance runner (spec section 9): the sim headless in Node,
// N times, a line a run and a summary, for the PR body and the hand-off.
//
//   node scripts/battlefront-balance.mjs --skirmish [--runs 10] [--bots 20] [--seconds 180] [--seed 1] [--profile]
//
// --skirmish   two teams of bots on Hoth's arena navgrid (fixtures/hothFlat.js), no mode
// --profile    the share of the run spent thinking, stepping bolts and finding paths
// A bot is "stuck" when alive, not in cover or hiding, and standing on one
// spot for 400 steps (20 s): the arena test's rule.

import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? def : Number(args[i + 1]);
};
const flag = (name) => args.includes(`--${name}`);

if (!flag('skirmish')) {
  console.log('usage: node scripts/battlefront-balance.mjs --skirmish [--runs 10] [--bots 20] [--seconds 180] [--seed 1] [--profile]');
  process.exit(1);
}

const runs = opt('runs', 10);
const bots = opt('bots', 20);
const seconds = opt('seconds', 180);
const first = opt('seed', 1);

// src modules use Vite's extensionless imports and JSON: loaded through Vite
const { createServer } = await import('vite');
const vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { loadRulebook } = await vite.ssrLoadModule('/src/lib/battlefront/rulebook.js');
  const { hothFlatNav } = await vite.ssrLoadModule('/src/lib/battlefront/fixtures/hothFlat.js');
  const { runSkirmish } = await vite.ssrLoadModule('/src/lib/battlefront/skirmish.js');
  const { profile } = await vite.ssrLoadModule('/src/lib/battlefront/core.js');
  const rb = loadRulebook();
  const nav = hothFlatNav(rb);
  profile.on = flag('profile');
  const rows = [];
  console.log('seed  kills1  kills2  alive1  alive2  stuck  offNav  ms');
  for (let r = 0; r < runs; r++) {
    const seed = first + r;
    const t = performance.now();
    const out = runSkirmish({ rulebook: rb, nav, seed, bots, seconds });
    const ms = Math.round(performance.now() - t);
    rows.push({ seed, ...out, ms });
    console.log([seed, out.kills[1], out.kills[2], out.alive[1], out.alive[2], out.stuck, out.offNav, ms].map((v) => String(v).padEnd(6)).join('  '));
  }
  const sum = (f) => rows.reduce((n, r) => n + f(r), 0);
  const mean = (f) => (sum(f) / rows.length).toFixed(1);
  const wins1 = rows.filter((r) => r.alive[1] > r.alive[2]).length;
  const wins2 = rows.filter((r) => r.alive[2] > r.alive[1]).length;
  console.log(`\n${runs} runs, ${bots} a side, ${seconds} s: kills ${mean((r) => r.kills[1])} (Rebels) to ${mean((r) => r.kills[2])} (Empire); more alive at the end: Rebels ${wins1}, Empire ${wins2}, even ${runs - wins1 - wins2}; stuck ${sum((r) => r.stuck)}, off the navgrid ${sum((r) => r.offNav)}; ${mean((r) => r.ms)} ms a run`);
  if (profile.on) {
    const total = sum((r) => r.ms);
    const pct = (v) => `${((100 * v) / total).toFixed(1)} %`;
    console.log(`profile: think ${pct(profile.think)}, bolts.step ${pct(profile.bolts)}, findPath ${pct(profile.path)}`);
  }
} finally {
  await vite.close();
}
