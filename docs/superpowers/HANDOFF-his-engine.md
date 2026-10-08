# Handoff: his engine, our universe (five lanes, one pull request each)

The Expanse retired whole, its stream, worker job, driver and land scene lifted into the runtime and the libraries as `rt.land`, and the existing worlds taking what it proved: a walker on Rapier (the galaxy’s worlds, the landings, the towns’ seam), the galaxy’s land streamed in cells and solid round you, the universe map’s places built as you come near, and Albuquerque’s car on Bruno Simon’s car. Read these first, in this order:

1. `docs/superpowers/specs/2026-10-08-his-engine-our-universe-design.md` (what the owner asked, what exists, what Bruno does that we keep and who takes it, the seven decisions, the roster, what this does to the lanes in flight)
2. `docs/superpowers/plans/2026-10-08-his-engine-our-universe.md` (your lane’s tasks: files, interfaces, tests, checks)
3. `docs/research/2026-10-08-folio-2025-physics-terrain-streaming.md` (his code with every number; the libraries quote its sections)
4. `docs/superpowers/HANDOFF-world-runtime.md` (what `rt` gives a module), `src/lib/physics/world.js`’s header, `src/runtime/chunkGrid.js`’s header; for lane 2 also `src/lib/three/chunks.js` and `src/components/galaxy/surface/thingCells.js` from #656 once it is on `main`
5. The open pull requests your lane waits for (the table below), read for their files before you branch

## Which lane is yours

| Lane | Branch | Starts from | Blocked by |
|---|---|---|---|
| 0: the Expanse retired, its halves lifted, `rt.land` | `claude/remove-expanse` (#705, taken on) | that branch with `origin/main` merged in | nothing; #701 adds two Expanse files: delete them here if it merges first |
| 1: the walker on Rapier | `claude/his-engine-walker` | `main` after 0 | 0, #566 (it edits `galaxy/surface/walker.js`) |
| 2: the galaxy’s land as cells | `claude/his-engine-galaxy-land` | `main` after 0 and 1 | 0, 1, #656, #669 (both edit `galaxy/surface/scene.js` and `placer.js`) |
| 3: the map’s places as cells | `claude/his-engine-map-places` | `main` after 0 | 0, #656 (its `universe/nearGrid.js` is what this lane widens) |
| 4: Albuquerque’s car on his car | `claude/his-engine-abq-car` | `main` after 0 | 0; takes three library files from the closed #700 (`origin/claude/one-feel-car`) |

Lane 0 first, alone. Then 1, 3 and 4 at once; 2 after 1. A lane whose blocker is still open starts anyway from `main` and merges `main` in once the blocker lands, before opening; it does not edit the blocker’s files meanwhile.

## The rules (don’t break)

- **Pure first.** `src/lib` and `src/runtime` import no React and no DOM; `src/lib/physics` and `src/lib/land` import no three.js. Every new rule has its Node test before its drawing half; the physics ones run against the real engine (`createPhysics` in `beforeAll`), never a mock.
- **A seam, not a rewrite.** A world takes a `move`, a `stream: true`, an item list, a `drive`; without it, it plays and draws exactly as it did. Take the before shots on `main` before you change anything (`node scripts/autopilot-check.mjs --skip lint,test --routes <route> --shots his-engine-<lane> --before`); the after goes beside it in the pull request. A world that did not opt in and changed a pixel is a bug.
- **Nothing a visitor can do is lost.** Every key, save key (`tp-mc`, `tp-pilot`, `tp-gcw`, Albuquerque’s), achievement, sound and dev hook works after as before. The Expanse’s own are the exception, and `/worlds` lists no planet or pocket row.
- **His numbers are the start, not the law.** `WALK`, `FOOT`, `CAR`, the walker’s `0.38 / 0.55 / 0.6 / 0.3`, the cells column, `nearGrid`’s `GRID`: change one only when a test or a screenshot says to, and say which in the pull request.
- **No new dependency.** Rapier stays imported only by `src/lib/physics/world.js`, dynamically. No WebGPU, no TSL.
- **Draw calls and triangles no higher** at any checked route (`renderer.info` before and after; say the numbers). A streamed site at `high` stays within `lib/budgets`’ row.
- **One lane, one pull request, merged on its own.** PR to `main`, CI green, merge commit. Merge `origin/main` in before opening and again before merging. Never merge red, never force-push, never rebase anyone’s branch.
- **Before the pull request:** `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `node scripts/autopilot-check.mjs --only smoke --routes <your routes>`, and your lane’s own check (lane 0: `online-check`; lane 1: `galaxy-check`, `landing-check`, `standing-check`; lane 2: `galaxy-check`, `pack-check`, `perf-probe yavinWalk`; lane 3: `universe-check`, `universe-war-check`; lane 4: `perf-probe abqDrive`), with the numbers quoted in the body.
- Keep output terse. Commits end with the harness’s attribution lines; no model names in code, docs or commits. British spelling, curly quotes, plain sentences; comments say why.

## What done looks like, per lane

- **0**: `src/components/expanse/` is gone; `/universe/expanse/7` is a 404 and `/universe?seed=x` is the map; the ship turns back at the rim; a pose is ten numbers and an eleven-number one reads as before or null; `/worlds` lists Minecraft worlds only; `npx vitest run src/runtime/landStream.test.js src/runtime/land.test.js src/lib/land/job.test.js src/lib/physics/driver.test.js src/lib/three/landScene.test.js` is green; `docs/architecture.md` says where the pieces live; each older hand-off has its one line.
- **1**: `npx vitest run src/lib/physics/walker.test.js` green against the engine; on `/galaxy/yavin/surface` you stop against the same trees and the temple, walk up the same steps, and a barrel moves when walked into; on `/galaxy/hoth/surface` nothing changed; on a landing the figure walks the sphere as a body (or the hand-off says why not, per the open assumption); `towns/walker.js` takes a `move` and no town uses one.
- **2**: `/galaxy/yavin/surface` loads its land in cells round the landing site (the veil shorter), the ground is solid one cell round you with the slab under you until it is, the scatter comes with its cell through the pools, nothing sleeps awake outside the view; `perf-probe yavinWalk` after the veil shows no frame over 100 ms and p99 under 33 ms; `/galaxy/tatooine/surface` is pixel for pixel as before.
- **3**: at home the map draws what it drew; fly toward Middle-earth and its planet is built as its far star fades, let go behind you; `universe-check` within its baseline with the three new poses; `renderer.info` at home no higher.
- **4**: the Aztek drives on four wheels, leans into turns, squashes on a landing, stops at the kerbs and the buildings, is shoved by traffic and not flung, `R` brings it back where it last stood; its top speed is today’s within 0.5 m/s; `abqDrive`’s worst frame quoted; the town’s picture the same.

## When something in the plan is wrong

Follow the spec over the plan, the code over both. Fix the plan’s line in your pull request and say so in its body in one sentence. A spec decision you disagree with is a line under “Findings” and the work goes on as written.

## Status

| Lane | Session | Branch | Pull request | Merged |
|---|---|---|---|---|
| design | the architecting session | `claude/awesome-mccarthy-q550gm` | | |
| 0 | | `claude/remove-expanse` | #705 (to be taken on) | |
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |

## Findings (for the owner and the next lane)

- (a lane writes here what it found and could not do in its files: a shared change it needs, a spec decision it questions, a world that will not take a piece and why)
- **Design, for the owner:** two worlds the spec names as next and leaves out: Invincible (6,400 m of towers, the one authored world big enough for `rt.chunks`: its tower field and its life by cell, the ground staying analytic) and Middle-earth’s towns on the walker seam with their props as bodies (a town-by-town pass once lane 1 has the seam). Say the word and either is a lane with this spec’s shape.
- **Design, for lane 0:** #705 deletes `expanse/surface/stream.js`, `job.js`, `worker.js`, `rules.js` and `scene.js` outright; the plan restores them from `origin/main`’s history into their new homes before the folder goes, so the move keeps its tests. Do not rewrite them.
- **Design, for lane 1:** Rapier’s `KinematicCharacterController` with a changing `up` (a sphere’s radial) is untested here; Task 1.1’s test (f) decides whether the landings’ player takes the walker or keeps `foot.js`’s own walk over a pusher.
- **Design, for lane 3:** `nearGrid.js` holds at most two heavy cells (the near maps are 11 to 100 MB each on the chip); a place’s mesh is light and follows its own `realAt`; if `low` cannot hold every place’s mesh within `realAt`, keep the heavy items at two and let only the light ones follow.
