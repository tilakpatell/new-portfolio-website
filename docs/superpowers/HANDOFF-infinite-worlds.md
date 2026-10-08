# Handoff: infinite worlds (one phase per session)

Six phases, one pull request each, three of them in parallel. Read these first, in this order:

1. `docs/superpowers/specs/2026-10-07-infinite-worlds-design.md` (the four answers, the decisions, the phase table)
2. `docs/superpowers/plans/2026-10-07-infinite-worlds.md` (your phase's tasks: files, interfaces, tests)
3. `docs/superpowers/HANDOFF-world-runtime.md` (the runtime's rules and what `rt` gives a module)
4. For Phase 3 and after: `src/components/minecraft/module.js` lines 104 to 235 (the chunk loop you generalise) and `src/components/minecraft/rules/jobs.js` (the worker protocol)

## Which phase is yours

| Session | Phase | Branch | Starts from | Blocked by |
|---|---|---|---|---|
| A | 0: smooth worlds (`docs/superpowers/plans/2026-10-07-smooth-worlds.md`, as written) | `claude/smooth-worlds` | main | nothing |
| B | 1: install packs | `claude/infinite-worlds-p1` | main | nothing |
| C | 2: store and registry | `claude/infinite-worlds-p2` | main | nothing |
| D | 3: chunk services | `claude/infinite-worlds-p3` | main | 0 merged, for Task 3.3's GPU queue (3.1, 3.2, 3.4 can start before) |
| E | 4: the Expanse | `claude/infinite-worlds-p4` | main after 3 | 3 |
| F | 5: landing on the Expanse | `claude/infinite-worlds-p5` | main after 4 | 3, 4 |
| G | 6: worlds for others | `claude/infinite-worlds-p6` | main after 2 and 4 | 2, 4; Task 6.1's week-long measurement |

Start A, B, C, D together. When Phase 1 and Phase 2 both touch `src/pages/Worlds.jsx`, the later to merge takes the page from main and adds its list (the plan's Task 2.4 says so).

## The rules (don't break)

- **Nothing a visitor can do is lost.** Minecraft plays the same after Phase 2 and Phase 3; the universe map plays the same inside the rim after Phase 4. Existing tests stay green and are not loosened.
- **Save keys keep their names.** `tp-mc` is read on first run and copied, never deleted. `tp-pilot` and `tp-gcw` do not move.
- **Pure first.** `src/runtime/*.js` and `src/components/expanse/gen/*.js` import no three.js and run in Node. The plan's constants are the spec's: `SECTOR = 80000`, `ORIGIN_CELL = 50000`, `CELL = 64`, `UNIVERSE_SEED = 'tilakverse'`, kind `30078`, `60 * 1024`.
- **The service worker is passive.** It never precaches, never touches navigations or `wss:`. If in doubt, make it do less.
- **Generated content is never stored.** Seeds and deltas only. If a task tempts you to save terrain, stop and re-read the spec's answer 3.
- **One phase per session, merged on its own.** PR to `main`, CI green, merge commit. Never merge red, never force-push.
- **Before the PR:** `npx eslint .`, `npx vitest run`, `npx vite build`, `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes <your routes>`. Phase 1 also runs `node scripts/sw-check.mjs` against `npx vite preview`. Phase 3 and 5 also run `node scripts/perf-probe.mjs` on their routes and quote the worst frame.
- Keep output terse. Commits end with the harness's attribution lines; no model names in code or docs.

## What done looks like, per phase

- **1**: `/earth` shows a card with its true pack size, Install fills a bar, Open starts the world; a reload serves its GLBs from the service worker; `/worlds` lists it with Remove.
- **2**: `/dot-matrix/minecraft` keeps your edits across reloads from IndexedDB; `?world=7` is another world; `/worlds` lists both, renames, exports and imports one.
- **3**: Minecraft asks for the same chunks as before through `rt.chunks` and `rt.workers`; `rt.origin` exists and is tested; nothing visible changed.
- **4**: fly past the rim and star systems appear ahead in sectors, with lanes between them; the roster says `E:1,0`; `/universe?seed=marble` is a different universe listed on `/worlds`.
- **5**: land on a generated planet, walk, take off.
- **6**: a world you share appears on another browser's `/worlds` under Worlds from others, and opens.

## When something in the plan is wrong

Follow the spec over the plan, the code over both. Fix the plan's line in your PR (the plan is a document in the repo) and say so in the PR body in one sentence.
