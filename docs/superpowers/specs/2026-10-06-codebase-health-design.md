# Codebase health: the measure, the ratchet and the steward — design

The site owner's ask: the codebase is massive (about 1,400 files and 400,000 lines under `src/`, 31 files over 1,500 lines, fourteen worlds that reach into one another) and it must get stronger, not just bigger. Something has to measure its health, stop it getting worse, and make it a little better on a schedule, the way the autopilot (`2026-10-05-autopilot-design.md`) makes the site better.

Three parts: **the measure** (`scripts/health.mjs`: a dozen numbers about the code, each one a file of its own, run in under a minute without a browser), **the ratchet** (`docs/health/budgets.json`: a ceiling per number that CI enforces on every pull request and that only ever comes down), and **the steward** (a skill and a scheduled Routine: one run, one repair, picked from the worst number, verified, merged, and the ratchet tightened behind it).

## Brief

- **Measured, not felt.** Health is a set of numbers anyone can rerun: `node scripts/health.mjs`. Each number has a name, a unit, a direction ("lower is better"), and a detail list naming the files behind it.
- **Never worse.** Every pull request runs the measure against the budgets. A number over its budget is a red check, the same as a failing test. The budget for a number falls to its new value when a merge improves it, and never rises by hand without a sentence saying why in the commit.
- **A little better, on a schedule.** The steward is the autopilot's sibling: a fresh session, one repair done well (split a file, cut a cycle, test an untested rule, drop dead code), checked with the same gate (`scripts/autopilot-check.mjs`), one pull request, merged, logged on `/changes`.
- **Cheap to run.** The measure needs no browser and no network. Only the bundle numbers need a build, and they reuse `dist/` when it is fresh.
- **The rules are written down.** `docs/health/RULES.md` says what may import what, how big a file may grow, which modules must have tests, and how to split a world's file. The measure checks what it can; the steward and the lint config enforce the rest.
- **Non-goals.** No mass reformatting, no renames for their own sake, no new framework, no TypeScript migration. The steward never touches `src/data/` content (roles, projects, résumé) and never changes what a page looks like: a repair leaves the screenshots the same.

## The measure

`node scripts/health.mjs [--check] [--ratchet] [--skip build] [--json] [--only big-files,cycles]`

A thin runner (`scripts/health.mjs`) and one module per metric in `scripts/health/<id>.mjs`. Each module exports a function `(ctx) => Promise<Metric>`:

```js
// ctx: { root, src: [absolute paths of src/**/*.{js,jsx}], read(path) }
// Metric: { id, label, value, unit, better: 'lower', detail: [{ file, n, note? }], note? }
```

`detail` is sorted worst first and capped at 25 rows. `value` is always a number so the ratchet can compare it.

| id | What it counts | Why | Today |
| --- | --- | --- | --- |
| `big-files` | files under `src/` over 1,500 lines (detail: every file over 800, with its line count) | the 4,500-line prop files are where edits go wrong and context runs out | 31 |
| `lint-disables` | `eslint-disable` comments under `src/` and `scripts/` | each one is a rule we stopped enforcing | 54 |
| `lint-warnings` | warnings from `eslint . -f json` | warnings become errors nobody reads | measure |
| `cycles` | import cycles among `src/` modules (a relative-import graph; Tarjan's strongly connected components; one row per cycle, shortest first) | a cycle makes a module unloadable on its own and defeats code splitting | measure |
| `boundary-breaks` | imports that cross a boundary `RULES.md` forbids: `src/lib/**` importing `src/components/**`; `src/components/<world>/**` importing another world's files except through that world's `index.js` or `shared/`; anything importing `src/pages/**` but `App.jsx` | a world that reaches into another world's props can't be split, lazy-loaded or deleted | 2 lib breaks, world breaks to measure |
| `untested-logic` | pure modules without a sibling `.test.js`: every `rules.js`, every file under `src/lib/` and `src/runtime/` that imports neither `react` nor `three`, every `*/kinds.js` and `*/budget.js` | the site's rule is game logic tested apart from the drawing | measure |
| `entry-kb` | `dist/assets/index-*.js` in kB | the first paint | 139 |
| `total-js-kb` | all of `dist/assets/*.js` in kB | the whole download | measure |
| `biggest-chunk-kb` | the largest chunk that isn't `vendor`, `three.core` or the renderer | one world should not be one megabyte of JavaScript | measure |
| `world-mb-drift` | worlds whose files under `public/` weigh more than `WORLD_MB` in `src/components/worlds/worlds.js` says, counted; detail shows declared against measured for every world | the phone gate asks before loading on those numbers | measure |
| `test-seconds` | wall time of `vitest run` | a slow suite stops being run | measure |
| `todo-notes` | `TODO`, `FIXME`, `HACK` in `src/` | the owner's rule is comments say why; a TODO is a promise | 0 |

Output: a table on stdout (id, value, unit, budget, the first three detail rows), the whole thing to `src/data/health/latest.json` (`{ date, sha, metrics: { id: { value, unit, detail } } }`), and with `--json` only the JSON. On GitHub Actions the table is also appended to `$GITHUB_STEP_SUMMARY`.

The bundle metrics need `dist/`. Without `--skip build` the runner builds when `dist/` is older than the newest file under `src/`; with it, a missing `dist/` marks those metrics `skipped` and they neither pass nor fail.

The import graph is built once per run (`scripts/health/graph.mjs`) and shared by `cycles` and `boundary-breaks`. It resolves relative specifiers only (`./x`, `../x`, with or without `.js`/`.jsx`/`/index.js`), ignores dynamic imports' arguments that aren't string literals, and treats `import.meta.glob` patterns as edges to every matching file. Bare specifiers (packages) are not nodes.

## The ratchet

`docs/health/budgets.json`:

```json
{
  "big-files": 31,
  "lint-disables": 54,
  "cycles": 12,
  "entry-kb": 145,
  "...": "one key per metric, the number it may not exceed"
}
```

- `health.mjs --check` exits 1 and names each metric over budget with its worst detail rows. A metric with no budget key is reported but never fails (that's how a new metric lands: measured first, budgeted a merge later).
- `health.mjs --ratchet` rewrites `budgets.json` with `min(budget, value)` for every metric, plus a small slack for the bundle sizes (`entry-kb` and the other kB metrics round up to the next 5 kB, so a one-byte change in a hash doesn't go red). The steward runs it after every merge; CI never does.
- Raising a budget is a human decision: the commit that raises it says why in its message, and the steward never does it.
- `src/data/health/history.jsonl` gets one line per ratchet (`{ date, sha, pr, metrics: { id: value } }`), so `/changes` can draw the trend and a reader can see which pull request moved which number.

CI (`.github/workflows/ci.yml`) adds one step after the build: `node scripts/health.mjs --check --skip build`. It uses the `dist/` the build step just made.

## The rules (`docs/health/RULES.md`)

The target shape of the code, written for a session that has to split a file or decide where something goes:

- **Layers.** `src/lib` (no React, no page knowledge) ← `src/lib/three` (Three.js helpers, no page knowledge) ← `src/runtime` (the world runtime) ← `src/components/<area>` ← `src/pages` ← `App.jsx`. Arrows point at who may import whom. `src/data` may be imported by anyone and imports nothing but other data.
- **Worlds are islands.** A world (`src/components/<world>/`) imports from `src/lib`, `src/runtime`, `src/data`, its own files, and another world only through that world's `index.js` or `shared/` folder. Things two worlds need move to `src/lib` or `src/runtime`.
- **Size.** A file stays under 800 lines; 1,500 is the ceiling the measure counts. A prop file over that splits by what it draws (`props/buildings.js`, `props/furniture.js`, `props/signs.js`), each exporting builders with the same signatures, and the old file becomes a barrel that re-exports them, so no caller changes in the same pull request.
- **Logic apart from drawing.** A game's rules live in a pure `rules.js` with tests; a scene file composes and draws. Anything that can be tested without a canvas is.
- **Tests go beside the file.** `x.js` has `x.test.js`. A test runs under a second and touches no network.
- **Splitting without changing a pixel.** The steward's repair recipe: shoot the route before, move code, keep the export names, run the same route's check after, compare the screenshots; a changed pixel means the repair is wrong.

## The steward

`.claude/skills/health/SKILL.md`, the autopilot's protocol with the repair in place of the improvement:

1. **Orient.** `git fetch origin main && git checkout -B main origin/main`, `npm ci`, `node scripts/health.mjs --skip build`, read `docs/health/RULES.md`, `docs/health/backlog.md`, the newest ship's-log entries. Don't touch files an open pull request touches (`mcp__github__list_pull_requests`).
2. **Budget.** The autopilot's switches apply (`docs/autopilot/budget.json`: `paused`, `stopAtUtilization`, the plan's status), plus `healthRunsPerDay` (2) counted from today's `kind: "health"` entries.
3. **Pick one repair.** In order: a metric over its budget on `main` (something regressed: fix the regression); the top open item in `docs/health/backlog.md`; else the worst `detail` row of the metric with the most room, in this order of worth: `boundary-breaks`, `cycles`, `untested-logic`, `big-files`, `lint-disables`, `biggest-chunk-kb`, `world-mb-drift`, `lint-warnings`, `todo-notes`. One file, one cycle, one module: a slice that stands on its own.
4. **Branch.** `health/<id>-<slug>` from `main`, `<id>` from `scripts/autopilot-log.mjs --next`.
5. **Repair.** With `safe-refactor` for a split or a move, `test-driven-development` for a test, `systematic-debugging` for anything that breaks. No behaviour change, no new dependency, no reformatting of lines not moved.
6. **Check.** `node scripts/health.mjs --skip build` shows the number moved and nothing else moved up. Then `node scripts/autopilot-check.mjs --routes <the routes whose files moved> --shots <id>`, with `--before` on `main` first for anything under `src/components`; the before and after screenshots must match by eye.
7. **Ship.** Commit, push, pull request (title: the repair; body: the metric before and after, the files, the screenshots), the ship's-log entry with `kind: "health"` and `measured: { metric, before, after }`, wait for the `CI` check, merge with a merge commit.
8. **Ratchet.** On `main` after the merge: `node scripts/health.mjs --ratchet --skip build`, commit `budgets.json`, `latest.json` and `history.jsonl` straight to `main` ("Health: ratchet after #<pr>"). Tick the backlog item or write what's left.

A run is one repair, finished and merged, or none. The Routine is "Health: one repair", every eight hours, offset from the autopilot's four (the autopilot at 0, 4, 8, …; the steward at 2, 10, 18). Both read the same pause switch.

The ship's log gains the kind `health` (the `kinds` list in `src/data/changes.js` and its test, the chip on `/changes`). `/changes` also gets a short "hull" line above the entries: the latest numbers from `src/data/health/latest.json` with the change since the first line of `history.jsonl`.

## Guards at write time

The ratchet catches a regression at the pull request; two lint rules catch it in the editor:

- `no-restricted-imports` in `eslint.config.js`: files under `src/lib/**` may not import `../components/*` or `../pages/*`; files under `src/components/**` may not import `../../pages/*`. Error, not warning.
- `max-lines` at 1,500, `warn`, counted by `lint-warnings` and so by the ratchet. Files already over are listed in `budgets.json`'s detail via `big-files`, not exempted.

## Tests

- `scripts/health.test.mjs`: each metric against fixture trees under `scripts/health/fixtures/` (a tree with a cycle, a tree with a boundary break, a long file, an untested `rules.js`); the ratchet's `min` and its kB rounding; `--check`'s exit code and message; a metric without a budget never fails.
- `src/data/changes.test.js` accepts `kind: "health"` and `measured.metric`.
- CI runs the whole thing on this pull request, so the first budgets are the numbers on `main` the day this lands.

## Order of work

The implementation plan (`docs/superpowers/plans/2026-10-06-codebase-health.md`) carries the tasks. The first slice, on this branch as the worked example: the runner, `big-files`, `lint-disables`, `todo-notes`, `budgets.json` with those three, `--check`, the test, the CI step. Everything after follows the same shape.
