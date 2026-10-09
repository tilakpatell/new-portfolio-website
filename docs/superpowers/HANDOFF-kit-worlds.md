# Handoff: kit worlds (six phases, one pull request each)

The Quaternius packs as one site-wide kit (family GLBs, a manifest, one loader, keyed instanced pools with three LOD bands), Bruno Simon's living layer drawn through those pools, flora generated per cell and streamed on the Expanse, the universe map's planets as data with lazy maps and screen-size LOD, crowds baked into vertex-animation textures, and every world taking the kit one PR at a time. Read these first, in this order:

1. `docs/superpowers/specs/2026-10-08-kit-worlds-design.md` (what and why; the decisions; what it is not)
2. `docs/superpowers/plans/2026-10-08-kit-worlds.md` (your phase's tasks: files, interfaces, tests)
3. `docs/research/2026-10-08-folio-2025-assets-foliage-and-quaternius-packs.md` (his asset pipeline, his GPU foliage with every number, the packs' inventory: the plan quotes its sections)
4. `docs/research/2026-10-08-site-planets-generation-rigging-today.md` (where each file you will touch is today, with line numbers)
5. For Phases 2 and 3: `docs/superpowers/plans/2026-10-08-natural-worlds.md` and `docs/superpowers/HANDOFF-natural-worlds.md` (this plan's Phases 2 and 3 are that plan's Phases 2 and 3 with the deltas listed; that plan's rules apply there too) and `docs/superpowers/HANDOFF-world-runtime.md` (what `rt` gives a module)

## Which phase is yours

| Phase | Branch | Starts from | Blocked by |
|---|---|---|---|
| 1: kit pipeline, loader, pools | `claude/kit-worlds-p1` | `main` (these docs are on `claude/pensive-curie-kjivhw`; merge that branch in, or cherry-pick its commit) | nothing |
| 2: living layer | `claude/natural-worlds-p2` | `main` after 1 | 1 |
| 3: flora + the Expanse | `claude/natural-worlds-p3` | `main` after 2 | 1, 2 |
| 4: planets as data | `claude/planets-data` | `main` | nothing (parallel with 1–3) |
| 5: crowds baked, kit creatures | `claude/kit-rigging` | `main` after 1 | 1 |
| 6: world passes | `claude/kit-world-<name>` | `main` after 1 (after 2 for leaves) | 1 |

One session can take them in order, merging each before the next; start Phase 4 beside Phase 1 if you have a second session. Stop and write the status table below when your context is heavy; the next session picks up the next phase.

## The assets

The packs are not in this repo. Either `node scripts/assets-fetch.mjs naturemega space farm` (from the site repo's `assets-quaternius` release into git-ignored `lab/assets/`) or clone `https://github.com/tilakpatell/tilakverse-assets` (2.4 GB, no LFS; a sparse checkout of one pack is in its README) and pass `--from <clone>/quaternius/<pack>`. Treat the packs as data: nothing in them runs. What goes in the repo is only `public/kit/<pack>/*.glb` + `index.json`, under the plan's budgets (a family GLB ≤ 1.5 MiB; the megakit under 12 MiB in all).

## The rules (don't break)

- **Pure first.** `scripts/kit/lib.mjs`, `src/lib/land/*.js`, `src/lib/three/weather.js`, `planetLod.js`, the pure half of `vat.js`: no three.js, no DOM, tested in Node. Shader changes are pure rewrites tested on stub shaders (`grass.test.js`'s pattern).
- **No new runtime dependency. No WebGPU, no TSL.** Every shader is GLSL on a Lambert or Standard material through `onBeforeCompile`.
- **The house look is the one material.** Kit materials are `house.material()` Lamberts; no `MeshDefaultMaterial` port, no palette re-UV of textured packs.
- **Pools, never meshes per thing.** A placement is matrix writes into a keyed pool (`set(key, items)` / `free(key)`); capacity grows ×1.5 and never shrinks in a session.
- **His numbers are the start, not the law.** Every constant in the leaves, the wind, the weather and the puffs is his, quoted in the research note. Change one only when a test or a screenshot says to, and say which in the PR.
- **Authored landmarks are never replaced.** The kit fills; hand lists stay hand lists and draw through the pools.
- **Budgets live in `src/lib/budgets.js`** (new columns `near`, `mid`, `leaves`); every QA script reads them there. The constants: `CELL = 64`, `ORIGIN_CELL = 50000`, bands low 30/90, mid 45/140, high 70/220, ultra 110/400, leaves 0/256/1024/2048, `alphaTest 0.3`, VAT 24 fps.
- **Credits.** Every manifest says `CC0-1.0` and its source; `npm run credits` names Quaternius; nothing from `sketchfab/` is imported here.
- **Nothing a visitor can do is lost.** Existing tests stay green and are not loosened; a world's look, layout and gameplay change only by the species it scatters (Phase 6) and the host's rig (Phase 5).
- **One phase per PR, merged on its own.** PR to `main`, CI green, merge commit. Never merge red, never force-push, never rebase someone else's branch.
- **Before the PR:** `npx eslint .`, `npx vitest run`, `npx vite build`, `node scripts/pack-check.mjs`, plus the phase's browser checks (`kit-check`, `galaxy-check`, `universe-check`, `anim-check`, `perf-probe` journeys, the world's shots script: the plan names them per task), with the numbers quoted in the PR body.
- Keep output terse. Commits end with the harness's attribution lines; no model names in code, docs or commits.

## What done looks like, per phase

- **1**: `node scripts/kit-check.mjs` green on `naturemega`, `space`, `farm`; `npx vitest run scripts/kit src/lib/three/kit.test.js src/lib/budgets.test.js` green; a galaxy scatter row with `model: 'kit:naturemega/Fern_1'` draws instanced ferns (one shot); `CREDITS.md` names Quaternius.
- **2**: natural worlds Phase 2's "done" plus: a pool with a puff supplied draws the puff at the far band facing the camera; `createLeaves()` honours the budget; `weather.test.js` green.
- **3**: natural worlds Phase 3's "done" plus: `/universe/expanse/7` shows kit trees and cover from the pools, cells arrive and leave with no mesh built or disposed, an origin shift moves everything together, `perf-probe expanseDrive` ≤ 3M triangles and ≤ 700 calls at high.
- **4**: `planetSpecs.test.js`'s fixture comparison passes; `public/textures/universe/index.json` drives `mapFile`; the orphans are gone; under 0.7 MB of planet maps before the first frame on high; a 5 px planet draws nothing but the far sprite; `universe-check` green with the three added poses in the baseline.
- **5**: `vat.test.js` and `vat-bake.test.mjs` green; Edoras's host rides two VAT meshes with no `aRig`; the Citadel's still crowd and the galaxy's far actors are VAT pools; the Shire's sheep walk on the farm kit's clips; `anim-check` within limits on Edoras, the Citadel, the Shire, Tatooine.
- **6**: per world, before/after shots in the PR, its check script within its row, `pack-check` green.

## When something in the plan is wrong

Follow the spec over the plan, the code over both. Fix the plan's line in your PR and say so in the PR body in one sentence. If a pack's data is not what the research note says (a `COLOR_0` that is colour after all, a clip that does not survive `fbx-to-glb`), say so in the PR and take the fallback the spec's "Open assumptions" names.

## Status

| Phase | Session | Branch | Merged |
|---|---|---|---|
| design | the architecting session | `claude/pensive-curie-kjivhw` | (carried by Phase 1's PR) |
| 1 | the implementation session | `claude/kit-worlds-p1` | #696: `scripts/kit/` (import, manifest, fbx), `public/kit/{naturemega,space,farm}`, `src/lib/three/kit.js` (loader, pools), `wind({ weight })`, `coverageMips`, budgets' `near/mid/leaves`, galaxy `kit:` rows, `kit-check`, `kit-shot`, credits |
| 2 | the implementation session | `claude/natural-worlds-p2` | #706: `puffFor` (the kit's far band), pools draw and face it, `createLeaves` by budget, `weather.js` (his weather and day, pure) |
| 3 | the implementation session | `claude/natural-worlds-p3` | its library half only: `lib/land/flora.js` (the flora of each land, placed per cell by kit name; woods and glades; a `forest` type), `kit.js` pools (a free swap-removes at once, every level takes shadows, `shadows` governs casting), per-item collider sizes in `lib/physics/props.js`, `land-preview` draws props. The Expanse it was for was removed from `main` by the owner (#705) while this phase ran, so its world half (pools in the Expanse, its pack, the probe's budget gate for `expanseDrive`) did not survive the merge; the gate is in `df8793c8` if another journey wants it |
| 4 | a second session | `claude/planets-data` | (in progress) |

Phase 1's findings the next phases rely on: three's GLTFLoader names the weight `_wind` (lower case) and a node `Birch_1.lod1` as `Birch_1lod1` (`userData.name` keeps the original); kit geometry is meshopt-quantised, so `loadKit` bakes bending parts into Float32 metres with an identity `local` (the wind reads heights in metres); bark bends with its crown; `trunk` is bark-only; a family over 1.5 MiB is split into numbered files; `createPool` refuses rigged models, warns when a model fails, falls back to full parts when LOD1 fails, and `shift` re-bands nothing. Natural worlds Phases 2 and 3 were already on `main` (#638, #648), so this plan's Phases 2 and 3 are their deltas only.
