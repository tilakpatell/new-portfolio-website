# Handoff: one feel, every world (eleven lanes)

Bruno Simon’s folio-2025 feel, site-wide: one art a world, the house tone mapper and emissive-only bloom, every hit a thud, a puff and a shake, a car in two halves, one tuning panel behind `?debug`, and colliders from a model’s node names. Read these first, in this order:

1. `docs/superpowers/specs/2026-10-08-one-feel-site-wide-design.md` (what exists already, the gap, the six pieces, the roster of every world, the decisions)
2. `docs/superpowers/plans/2026-10-08-one-feel-site-wide.md` (your lane’s tasks: files, interfaces, tests)
3. `docs/research/2026-10-06-bruno-simon-folio.md` and `docs/research/2026-10-08-folio-2025-physics-terrain-streaming.md` (his code, with the numbers the plan quotes)
4. `docs/superpowers/specs/2026-10-07-house-look-design.md` and `src/lib/three/house.js`’s header (the look you build on), `src/lib/physics/world.js`’s and `vehicle.js`’s headers (the physics you wire), `src/lib/debugPanel.js` (the panel you grow)
5. For a Phase 2 lane: `docs/superpowers/HANDOFF-world-runtime.md` (what `rt` gives a module) and your worlds’ own handoffs (`HANDOFF-*.md`) for what is in flight there

## Which lane is yours

| lane | branch | starts from | blocked by |
|---|---|---|---|
| 1A the art | `claude/one-feel-art` | `main` | nothing |
| 1B the hits | `claude/one-feel-hits` | `main` | nothing |
| 1C the car | `claude/one-feel-car` | `main` | nothing |
| 1D the panel | `claude/one-feel-panel` | `main` | nothing |
| 1E the colliders | `claude/one-feel-colliders` | `main` | nothing |
| 2A Middle-earth | `claude/one-feel-middleearth` | `main` after Phase 1 | 1A–1E |
| 2B Star Wars | `claude/one-feel-starwars` | `main` after Phase 1 | 1A–1E |
| 2C the universe | `claude/one-feel-universe` | `main` after Phase 1 | 1A–1E |
| 2D the cities | `claude/one-feel-cities` | `main` after Phase 1 | 1A–1E |
| 2E the games | `claude/one-feel-games` | `main` after Phase 1 | 1A–1E |
| 2F the rest | `claude/one-feel-rest` | `main` after Phase 1 | 1A–1E |

Phase 1’s five lanes run at once; each owns the files its row in the spec’s rollout names and no others. Two pairs meet in one file (1A and 1D in `lib/stage3d.js`; 1B and 1E in the landings): whichever merges second merges `main` in first and keeps both. Phase 2’s six lanes run at once from `main` once all five are merged; each owns its worlds’ folders and edits nothing shared (a need for a shared change is a line under “Findings” below, for the owner).

## The rules (don’t break)

- **Pure first.** `src/lib` and `src/lib/physics` import no React and no DOM; `src/lib/physics` imports no three. Every new rule has its test in Node before its drawing half.
- **Nothing a visitor can do is lost.** Every key, save key, achievement, sound, ghost, dev hook (`window.__…`) and gimmick works after as before. A new sound is added, never swapped.
- **No new dependency.** No Tweakpane, no lil-gui, no runtime call to any service.
- **His numbers are the start, not the law.** Every constant in the plan is his or the site’s; change one only when a test or a screenshot says to, and say which in the pull request.
- **A changed picture is on purpose.** Take the before shots on `main` before you change anything (`node scripts/autopilot-check.mjs --skip lint,test --routes <route> --shots one-feel-<lane> --before`); the after goes beside it in the pull request. A glow that vanished under the new bloom threshold is a missed emissive (lift it over 1 with `hot()`), never a reason to lower the threshold.
- **Draw calls and triangles no higher** at any checked route (`renderer.info` before and after; say the numbers).
- **One pull request a lane, merged on its own.** PR to `main`, CI green, merge commit. Never merge red, never force-push, never rebase anyone’s branch. Merge `origin/main` in before opening and again before merging.
- **Before the pull request:** `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `node scripts/autopilot-check.mjs --routes <your routes> --shots one-feel-<lane>`; a lane that touches the Expanse also `node scripts/perf-probe.mjs expanseDrive`, quoting the worst frame.
- Keep output terse. Commits end with the harness’s attribution lines; no model names in code, docs or commits. British spelling, curly quotes, plain sentences; comments say why.

## What done looks like, per lane

- **1A**: `createPalette` tested; `createStage`, `runtime/webgl.js` and `webgpu.js` default to Neutral and `BLOOM`; the Shire and the Expanse have `look.js`; `looks.test.js` fails any other folder that gains or loses one unannounced; `art-mix` measured and budgeted.
- **1B**: a barrel kicked on a landing makes a thud where it is, a puff of dust, and a nudge of the camera; `lib/three/feel.js` and `pool.js` exist and the HQ games and the Expanse import them unchanged.
- **1C**: the Expanse buggy leans into a turn, squashes on landing, whips its antenna; every number of the car and its feel is on the panel’s groups (`carGroups`, `feelGroups`).
- **1D**: `/earth?debug` and `/galaxy/yavin?debug` open one panel built from the module’s `tune()` or the stage’s `tune`; without `?debug` nothing is made; `houseGroups` serves any world on the look.
- **1E**: a GLB node named `crate_physical_dynamic` with a `cuboid` child becomes a sleeping dynamic body through `collidersOf`; `scripts/gen3d/web.mjs` keeps such nodes; `docs/assets/colliders.md` says how to model one.
- **2A–2F**: every world in the lane’s row of the spec’s roster has a `look.js` that validates, no ACES line, no bloom literal, its hits wired, its vehicles on the feel, `tune()` or `stage.tune`, and `collidersOf` where it loads a GLB into Rapier; `EXPECTED_MISSING` in `looks.test.js` has none of the lane’s folders; before and after shots in the pull request.

## When something in the plan is wrong

Follow the spec over the plan, the code over both. Fix the plan’s line in your pull request and say so in its body in one sentence. A spec decision you disagree with is a line under “Findings” and the work goes on as written.

## Status

| lane | session | branch | pull request | merged |
|---|---|---|---|---|
| design | the architecting session | `claude/lucid-hawking-78yzz5` | | |
| 1A | | | | |
| 1B | | | | |
| 1C | `session_01ALnkhhCHveAZqkCSpnBLq2` | `claude/one-feel-car` | #700 | |
| 1D | | | | |
| 1E | `session_01RjXvbwnRgbChu8gMUUMi8B` | `claude/one-feel-colliders` | #698 | |
| 2A | | | | |
| 2B | | | | |
| 2C | | | | |
| 2D | | | | |
| 2E | | | | |
| 2F | | | | |

## Findings (for the owner and the next lane)

- (a lane writes here what it found and could not do in its files: a shared change it needs, a spec decision it questions, a world that will not take a piece and why)
- **1C, for 2C:** the Expanse module has `feel` on the world and on `window.__EXPANSE__`, and `vehicle.spec` is its own copy of `CAR`; its `tune()` is yours: `[...carGroups(world.vehicle), ...feelGroups(world.feel)]`. The chassis’s hit gain is a two-line copy of his law in `module.js` (`hitGain`); swap it for `lib/impact.js`’s once 1B is in.
- **1C, for 2B, 2D and the rest:** `attachVehicleBody` takes `forward: 'z'` for a car modelled facing +z; the default is +x, as the physics car. The body must be one pivot over the chassis meshes, never the wheels, with `base` its underside’s y in the pivot’s parent. A world without a measured acceleration feeds `lateralAccel = speed × yaw rate` and `forwardAccel` its speed’s change over the frame.
- **1C, for 1A and 2C:** the antenna (`buggy-antenna`, 6 sides, no shadow) is one more draw (settle 23 → 24 on `expanseDrive`); it is thin and dark and hard to see from the chase camera at 15 m. On the palette it might take the body’s colour, or a tip. Under a sustained turn the tip sits at `antenna.max` (0.6 × 1.2 = 41°): his numbers, kept; a finding for whoever tunes it on the panel.
- **1E, for 2A–2F:** `collidersOf(model).bodies` gives descs relative to the model’s root; a world that stands the model somewhere adds that place to each body’s `position` and `rotation` (`fromModel.js`’s `colliderIn` composes a collider into its body’s frame). A `physical` node is hidden, so a body that is also the visible mesh vanishes: model the shapes beside the look. three.js’s loader strips `.` from node names (`cuboid.001` loads as `cuboid001`), which the prefix rules allow for.
- **1E, for the landings’ owner:** a model’s physical nodes become one landing body (the first’s type, every collider, the masses summed): `landings/physics.js` sets its own friction, restitution and damping, so a node’s `userData.friction` and `restitution` are not used there yet, and a `kinematic` node stands fixed. `landings/models.js` sizes a model by `Box3.setFromObject`, which counts hidden objects: a physical mesh larger than the look would shrink the look a little (the web cut strips the meshes of the shapes sized by scale, so only a body’s own mesh, a hull or a trimesh can).
- **1E, for the owner:** `scripts/gen3d/README.md` and `docs/README.md`’s `assets/` row don’t yet mention `--check-colliders` and `docs/assets/colliders.md` (outside the lane’s files).
