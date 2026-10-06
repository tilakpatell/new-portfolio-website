# Codebase Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure the codebase's health in numbers, stop any of them rising, and run a scheduled steward that makes one of them better per run.

**Architecture:** A runner (`scripts/health.mjs`) imports one module per metric from `scripts/health/`, prints a table, writes `src/data/health/latest.json`, and with `--check` compares against `docs/health/budgets.json` (CI runs that on every pull request). `--ratchet` lowers budgets to today's numbers. A skill (`.claude/skills/health/SKILL.md`) and a Routine run one repair per session, verified with the existing `scripts/autopilot-check.mjs`, merged, logged on `/changes`.

**Tech Stack:** Node 22 ESM, vitest, eslint 9 flat config, GitHub Actions. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-06-codebase-health-design.md`

## Global Constraints

- No new dependency (the spec's non-goals; the import graph is hand-rolled).
- The measure runs without a browser and without the network; only bundle metrics read `dist/`.
- Every metric module returns the shape in `scripts/health/context.mjs`'s `metric()`: `{ id, label, value, unit, better: 'lower', detail: [{ file, n, note? }] }`, detail worst first, 25 rows at most. `value` is a number.
- A metric without a budget never fails `--check`.
- British spelling, plain sentences, comments say why, in the file's voice. No model names anywhere in the repo.
- Don't reformat lines you aren't changing. Don't touch files an open pull request touches (`mcp__github__list_pull_requests`, state `open`).
- Each task ends green: `npm run lint && npx vitest run scripts/health.test.mjs && node scripts/health.mjs --check --skip build`.

## Review Focus

1. A relative import the graph resolver misses (`'../x'` to `x/index.js`, `'./y.jsx'`, `import.meta.glob('./changes/*.json')`), so a cycle or a boundary break hides.
2. A metric that counts its own source (the way `lint-disables` once did), so the baseline is off by the measure itself.
3. `--check` red on `main` the moment this merges: every new budget must be written from `main`'s numbers, not a branch's.
4. The kB rounding in the ratchet: a budget of 145 with a value of 141 must stay 145, and a value of 146 must fail.
5. The steward changing a pixel: the skill must shoot before and after and compare.

## Worked example (done, on this branch)

Task 0 is the pattern every later task follows. Read these files first:

- `scripts/health.mjs`: the runner, `METRICS`, the table, `--check`, `--ratchet`, `--json`, `--only`, `$GITHUB_STEP_SUMMARY`.
- `scripts/health/context.mjs`: `makeContext(root)`, the file walk, `metric()`.
- `scripts/health/big-files.mjs`, `lint-disables.mjs`, `todo-notes.mjs`: three metrics, each under 30 lines.
- `scripts/health/ratchet.mjs`: `check`, `ratchet`, `describe`.
- `scripts/health.test.mjs` and `scripts/health/fixtures/tree/`: each metric against a fixture tree; the ratchet's rules.
- `docs/health/budgets.json`: the first three budgets. `src/data/health/latest.json`, `history.jsonl`: the first line.
- `.github/workflows/ci.yml`: `node scripts/health.mjs --check --skip build` after the build.

A new metric is: a fixture that shows it, a failing test, the module, `METRICS` gaining its id, a run of `node scripts/health.mjs` to see the real number, and a budget only once the number is what `main` has.

## File Structure

| File | Responsibility |
| --- | --- |
| `scripts/health/graph.mjs` | the import graph of `src/`: nodes, edges, `resolve(from, specifier)`, `cycles()`; built once per run, memoised on `ctx` |
| `scripts/health/cycles.mjs` | metric: strongly connected components with more than one node |
| `scripts/health/boundary-breaks.mjs` | metric: edges that cross a forbidden boundary; the rules as data at the top of the file |
| `scripts/health/untested-logic.mjs` | metric: pure modules without a sibling test |
| `scripts/health/lint-warnings.mjs` | metric: `eslint . -f json`, warnings summed, detail per file |
| `scripts/health/bundle.mjs` | shared: reads `dist/assets/*.js` sizes; builds when stale unless `--skip build` |
| `scripts/health/entry-kb.mjs`, `total-js-kb.mjs`, `biggest-chunk-kb.mjs` | metrics over `bundle.mjs` |
| `scripts/health/world-mb-drift.mjs` | metric: `WORLD_MB` against `public/` on disk, by a map of world → folders |
| `scripts/health/test-seconds.mjs` | metric: wall time of `vitest run`, skipped under `--skip test` |
| `.claude/skills/health/SKILL.md` | the steward's protocol |
| `src/data/changes.js`, `changes.test.js`, `src/pages/Changes.jsx` | the kind `health`, the hull line |
| `eslint.config.js` | `no-restricted-imports`, `max-lines` |

## Task 1: the import graph, and `cycles`

**Files:** `scripts/health/graph.mjs`, `scripts/health/cycles.mjs`, `scripts/health/fixtures/graph/` (new tree), `scripts/health.test.mjs`, `scripts/health.mjs`.

- [ ] Fixture: `scripts/health/fixtures/graph/src/` with `a.js → b.js → c.js → a.js` (a cycle of three), `d.js → e/index.js` (a folder import), `f.jsx → './g'` (no extension, `g.jsx`), `h.js` with `import.meta.glob('./data/*.json')` and `data/one.json`, `i.js` importing `'react'` (bare, no node), `j.js → k.js` with `k.js → j.js` (a cycle of two). No cycle through `d`, `f`, `h`, `i`.
- [ ] Failing tests: `resolve` finds `e/index.js`, `g.jsx`, and both `data/*.json` files; `cycles()` returns exactly two cycles, shortest first, each a list of relative paths starting at the alphabetically first file: `[['src/j.js','src/k.js'], ['src/a.js','src/b.js','src/c.js']]`.
- [ ] `graph.mjs`: `export async function graph(ctx)` memoised on `ctx.graph`; edges from `import … from '…'`, `export … from '…'`, `import('…')` with a string literal, `import.meta.glob('…')` (glob over the file's folder, `*` and `**` only). Tarjan's SCC. Ignore `.test.` files as sources.
- [ ] `cycles.mjs`: `detail` rows `{ file: cycle.join(' → '), n: cycle.length }`, `value` = number of cycles, `unit: 'cycles'`.
- [ ] Add `'cycles'` to `METRICS`. Run `node scripts/health.mjs --only cycles`. Write the number in the commit message. Do not budget yet.
- [ ] Lint, test, commit: "Health: the import graph, and the cycles in it".

## Task 2: `boundary-breaks`

**Files:** `scripts/health/boundary-breaks.mjs`, fixture additions, test, `METRICS`.

- [ ] Rules as data, in this order, from `docs/health/RULES.md`:
  ```js
  export const RULES = [
    { from: /^src\/lib\//, to: /^src\/(components|pages)\//, why: 'lib knows no page' },
    { from: /^src\/runtime\//, to: /^src\/(components|pages)\//, why: 'the runtime knows no world' },
    { from: /^src\/components\/([^/]+)\//, to: /^src\/components\/([^/]+)\//, unless: (a, b, toPath) => a === b || /\/(index\.js|shared\/)/.test(toPath) || !WORLDS.has(b), why: 'worlds are islands' },
    { from: /^src\/(?!App\.jsx)/, to: /^src\/pages\//, why: 'only App.jsx mounts a page' },
  ];
  ```
  `WORLDS` is the set of folder names under `src/components/` that have a `*World.jsx` or `scene.js` (compute it from `ctx.src`; the shared folders like `ambience`, `worlds`, `contact` are not worlds).
- [ ] Fixture: `src/lib/bad.js → ../components/x/thing.js`; `src/components/alpha/scene.js → ../beta/props.js` (break) and `→ ../beta/index.js` (allowed) and `→ ../beta/shared/kit.js` (allowed); `src/components/beta/scene.js`.
- [ ] Failing test: exactly two breaks, detail `{ file: 'src/lib/bad.js → src/components/x/thing.js', n: 1, note: 'lib knows no page' }` and the alpha→beta one.
- [ ] Implement over `graph(ctx)`. `value` = count, `unit: 'imports'`.
- [ ] `METRICS`, run, commit: "Health: the imports that cross a boundary". Say the real number.

## Task 3: `untested-logic` and `lint-warnings`

- [ ] `untested-logic`: candidates are every `rules.js`, `kinds.js`, `budget.js` under `src/`, and every non-test `.js` under `src/lib/` and `src/runtime/` whose source imports neither `'react'` nor `'three'` (a regex over import lines). A candidate passes when `<name>.test.js` or `<name>.test.jsx` exists beside it. Detail `{ file, n: lines }` so the biggest untested module is first.
- [ ] Fixture: `src/game/rules.js` without a test, `src/game/kinds.js` with `kinds.test.js`, `src/lib/pure.js` without a test, `src/lib/drawn.js` importing `three` without a test (not counted).
- [ ] `lint-warnings`: `execFileSync('npx', ['eslint', '.', '-f', 'json'])` with `maxBuffer: 64 MB`, tolerate exit 1 (warnings only exit 0, but be safe), sum `warningCount` per file. Skipped (with `skipped: true`, `value: 0`) when `--skip lint`. No fixture: test it with a stub runner injected through `ctx.exec` (default `execFileSync`).
- [ ] `health.mjs`: parse `--skip` into `ctx.skip` (a Set) in `makeContext`; a skipped metric prints `skipped` in the table and is left out of `--check` and `--ratchet` (the ratchet already does).
- [ ] Both in `METRICS`. Commit: "Health: untested logic, and the lint warnings".

## Task 4: the bundle metrics and `world-mb-drift`

- [ ] `bundle.mjs`: `export async function bundle(ctx)` memoised: if `ctx.skip.has('build')` and no `dist/assets`, return `null`; if `dist/` is older than the newest file under `src/` and build isn't skipped, run `npm run build` (`stdio: 'inherit'`); then `[{ name, kb }]` sorted biggest first. The vendor set the spec names: `/^(vendor|three\.core|three|renderer)-/`.
- [ ] `entry-kb` (`index-*.js`), `total-js-kb`, `biggest-chunk-kb` (biggest not in the vendor set; detail: the top ten chunks). Each `skipped` when `bundle()` is null. `unit: 'kB'`, values rounded to whole kB.
- [ ] Test the three over a fixture `dist/assets/` with three small files and `ctx.skip = new Set(['build'])`, asserting values and the vendor exclusion.
- [ ] `world-mb-drift`: a map at the top of the file from each `WORLD_MB` key to the `public/` folders it downloads (read the comments in `worlds.js` and the loaders in each world to fill it; where a world's folders aren't knowable, leave it out of the map and say so in a comment). `value` = worlds whose folders' bytes, in MB rounded up, exceed the declared number. Detail: every mapped world, `{ file: route, n: measuredMb, note: 'declared ' + declared }`. Parse `WORLD_MB` with the regex `autopilot-check.mjs` uses.
- [ ] `METRICS`. Commit: "Health: the bundle's sizes, and what each world weighs".

## Task 5: `test-seconds`, the budgets, the summary

- [ ] `test-seconds`: time `npx vitest run --reporter=dot` (seconds, one decimal), skipped under `--skip test`. Not in CI's `--check` run (CI already ran the tests): add `test` to CI's `--skip` list: `--skip build,test`.
- [ ] On `main` (fresh `git fetch origin main`, a worktree or a clean checkout), run `node scripts/health.mjs --ratchet` so every metric gets a budget from `main`'s numbers. Copy the resulting `budgets.json`, `latest.json`, `history.jsonl` onto the branch. The budgets must be `main`'s numbers, not the branch's.
- [ ] Table: a `skipped` column state; the markdown summary too.
- [ ] Commit: "Health: the test suite's time, and the first full set of budgets".

## Task 6: the steward's skill and the ship's log

- [ ] `.claude/skills/health/SKILL.md`, in the autopilot skill's shape and voice (`.claude/skills/autopilot/SKILL.md` is the model: Orient, Budget, Pick one repair, Branch, Repair, Check, Ship, Ratchet, Hand off, Never). The spec's "The steward" section has the eight steps and the order of worth. Frontmatter `name: health`, description naming the triggers: "You are the tilakverse health steward", "run the health steward", "repair the codebase".
- [ ] `docs/autopilot/budget.json`: add `"healthRunsPerDay": 2`. The autopilot skill's step 2 counts entries with `kind` other than `health` for `runsPerDay`; the health skill counts `kind: "health"`. Update the autopilot skill's one line accordingly.
- [ ] `src/data/changes.js`: `kinds` gains `health`. `changes.test.js` accepts it and `measured.metric`/`before`/`after`. `src/pages/Changes.jsx`: a chip and a colour for `health`.
- [ ] `src/pages/Changes.jsx`: the hull line above the entries: each metric in `src/data/health/latest.json` as "`label` `value`" with the change since `history.jsonl`'s first line in brackets, green when lower. Import `history.jsonl` with `?raw` and split on newlines. Keep it one component in `src/components/Hull.jsx` with a test over a fake latest and history.
- [ ] `docs/health/README.md`: remove "(to come: the plan's task 6)".
- [ ] `node scripts/autopilot-check.mjs --routes /changes --shots <id>` to see the hull line. Commit: "Health: the steward's protocol, and the hull line on the ship's log".

## Task 7: guards at write time

- [ ] `eslint.config.js`: a block for `src/lib/**/*.{js,jsx}` with `'no-restricted-imports': ['error', { patterns: ['../components/*', '../../components/*', '../pages/*', '../../pages/*'] }]`; a block for `src/components/**` forbidding `../../pages/*` and `../pages/*`; `'max-lines': ['warn', { max: 1500, skipBlankLines: false, skipComments: false }]` for `src/**`.
- [ ] Expect `lint-warnings` to jump by the number of files over 1,500 lines; run `node scripts/health.mjs --ratchet` is NOT the answer: raise `lint-warnings`'s budget by exactly that number in `budgets.json`, and say so in the commit message (the one legitimate raise).
- [ ] The two known lib breaks (`src/lib/view.js`, `src/lib/seeded.test.js`) now fail lint. Fix them in this task: move what `view.js` needs or invert the import; move `seeded.test.js`'s data to `src/data` or the test beside the component. `boundary-breaks` falls by two; ratchet it by hand to the new number in the same commit.
- [ ] Commit: "Health: lint forbids a lib import of a page, and warns on a file over 1,500 lines".

## Task 8: the Routine

- [ ] From a session with the `claude-code-remote` tools: `mcp__claude-code-remote__create_trigger` with `name: "Health: one repair"`, `cron_expression: "0 2,10,18 * * *"` (UTC; the autopilot is at 0, 4, 8, …), `create_new_session_on_fire: true`, `initiation: human_request`, `prompt`: "You are the tilakverse health steward. Read `.claude/skills/health/SKILL.md` and follow it exactly: one repair, verified, merged, ratcheted, logged; or nothing and say why." Say in the final report which trigger id was created.
- [ ] `docs/health/README.md`'s steward section: the Routine's name and how to pause it (the autopilot's `paused` switch covers both; the Routine's own switch on claude.ai stops it alone).

## Task 9: the first repair, by the book

- [ ] Run the health skill once, by hand, in this session: the top item of `docs/health/backlog.md` (`src/lib/view.js` is done by task 7; so the first `big-files` item, `moria/props.js`, by the recipe in `RULES.md`). Shoot `/middle-earth/moria` before and after; the screenshots must match. Its own pull request, merged, logged, ratcheted. This proves the protocol before the Routine does.

## Done when

- `node scripts/health.mjs` prints twelve metrics with budgets; `--check` is green on `main`.
- CI shows the health table in the step summary of a pull request.
- `/changes` shows the hull line and accepts `kind: "health"`.
- The Routine exists and its first run merged one repair.
