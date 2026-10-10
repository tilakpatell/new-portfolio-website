# Galaxy asset upgrade and rigging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every person on the galaxy's seventeen worlds moves (statues walk, silent rigs play clips, the built ones are asked for and rigged for free), the assets repo is a source the site's scripts read, and Endor comes under budget on Quaternius ground cover and far trees.

**Architecture:** Nothing in the run-time loaders changes. The work is in scripts (a figure audit, the assets fetch, a retarget that finds bones by role, a Quaternius importer), in catalogue rows (`legs`, `anim`), and in the model files themselves (clips baked into a figure's own GLB). The crew's resolution order in `actors.js` stays.

**Tech Stack:** Node 22 ESM scripts, `@gltf-transform/core|functions|extensions`, `meshoptimizer`, `sharp`, three.js r186 in Node for the retarget, vitest, Playwright (`anim-check.mjs`, `galaxy-check.mjs`, `glb-shot.mjs`).

**Spec:** `docs/superpowers/specs/2026-10-08-galaxy-asset-upgrade-design.md`

## Global Constraints

- No paid service runs: no `MESHY_API_KEY`, no `SKETCHFAB_API_TOKEN`. Any step that would need one stops and says so.
- No sequel-trilogy figure, place or name anywhere (the surfaces hand-off's first rule).
- A surface model file stays under 2.5 MB (4 MB with `hero`); a figure's baked core clip set adds under 60 KB (`catalog.test.js` keeps the size rule).
- Every existing `public/games/meshy/ual-*.glb` re-bakes byte-identical after the retarget change (Task 4's test).
- `src/components/galaxy/surface/actors.js`, `crew.js`, `placer.js`, `src/lib/three/animator.js`, `clipLibrary.js` are not edited. `rig.js` gains one export and one name rule, nothing else.
- Credits: a Sketchfab model in `src/data/modelCredits.json` (its test demands `title`, `author`, `authorUrl`, `license` `CC-BY-…4.0`, `source` on sketchfab.com, a `file` that exists); a CC0 Quaternius model as a line in `public/cc0/README.md` (`models/galaxy/surface/{a,b}.glb`, which `madeKinds` parses) and Quaternius named by `scripts/credits.mjs`.
- One phase per branch (`claude/galaxy-asset-upgrade-p<N>`), from `main`; before each push: `npx eslint .`, `npx vitest run`, `npx vite build`. Commits end with the harness's attribution lines; no model names in code, docs or commits.
- Keep output terse.

## Review Focus

1. A life kind whose row names `anim` but whose GLB lacks a clip of that name: `modelFigureOf` finds no clip and the figure sways instead of walking, silently. Task 6's test reads each baked GLB's animation names against its row.
2. A statue given `legs` whose legs do not part (a robe): `findLegs` returns null and `leggedFigure` returns null, so `modelFigureOf` runs as before (a sway). Task 2's test asserts null on a robe-shaped point cloud and a figure on a parted one.
3. A Mixamo bone name with a suffix the role finder does not strip (`mixamorig:Hips_52`): the retarget finds no hips and must throw with the bone names it saw, never bake an empty clip. Task 3's test.
4. The assets release's part list changing (a file re-split): the fetch joins whatever `part-a?` parts exist in order and the SHA check is the gate. Task 7's test on a fake release directory.
5. Endor's far ring swapped for `qpine` with `solid: false`: nothing the player could collide with disappears, and the near ring (within 640 m) keeps the built redwoods. Task 10's `galaxy-check` run plus a `surface-shot` from the landing.

---

## Phase 1: the audit, and statues that walk

### Task 1: `scripts/galaxy-figures-audit.mjs`

**Files:**
- Create: `scripts/galaxy-figures-audit.mjs`
- Test: `scripts/galaxy-figures-audit.test.mjs`

**Interfaces:**
- Produces: `drawnAs(kind, { CREW, SURFACE_MODELS, FIGURES, WALKERS }) → 'walker' | 'crew' | 'crew-still' | 'own-clips' | 'legs' | 'rig-noanim' | 'still' | 'built' | 'none'` (the order `actors.js`'s `figureFor` resolves in: walker, crew, model, built); `audit(SITES, tables) → [{ kind, how, worlds: [id…] }]` sorted by kind, reading each site's `life` and each zone's `life`; `table(rows) → string` (Markdown). `EXPECTED`: `{ kind: how }` for kinds a phase has moved (empty at first; each later task adds its kinds), and the script exits 1 when a row's `how` differs.
- CLI: `node scripts/galaxy-figures-audit.mjs [--json]`.

- [ ] **Step 1: Write the failing test**: `drawnAs` on fixture tables (a kind in `WALKERS` and `CREW` is `'walker'`; in `CREW` with `still: true` is `'crew-still'`; a model with `anim` is `'own-clips'`; with `legs` and no `anim` is `'legs'`; with `rig: true` and no `anim` is `'rig-noanim'`; a plain model `'still'`; in `FIGURES` only `'built'`; nowhere `'none'`), and `audit` on a two-site fixture with a zone, giving sorted rows with `worlds`.
- [ ] **Step 2: Run** `npx vitest run scripts/galaxy-figures-audit.test.mjs`; expect FAIL (module not found).
- [ ] **Step 3: Implement.** The script imports `SITES` from `src/components/galaxy/surface/sites/index.js`, `SURFACE_MODELS` from `catalog/index.js`, `CREW` from `crewList.js`, `FIGURES` from `figures.js`, `WALKERS` from `walkers.js` (these import three.js and Vite-only paths: load them as `scripts/ultra/counts.mjs` does, through `createServer` from `vite` and `vite.ssrLoadModule('/src/components/galaxy/surface/sites/index.js')`, inside `main` only, so `drawnAs`, `audit` and `table` stay pure and import nothing).
- [ ] **Step 4: Run the test**; expect PASS. Run the script; expect the spec's table (37 crew, 7 own-clips, 4 legs, 3 rig-noanim, 37 still, 8 built, 2 crew-still, 3 none). Save the output as `docs/superpowers/evidence/galaxy-asset-upgrade/audit-before.md`.
- [ ] **Step 5: Commit** (`scripts/galaxy-figures-audit.mjs`, its test, the evidence file).

### Task 2: `legs` on eleven statues

**Files:**
- Modify: `src/components/galaxy/surface/catalog/library.js` (anakin, cassian, chirrut, krennic, baze if it is there, else `fill.js`), `catalog/fill.js` (armorer, baze, clonephase1, jyn, k2so, sullustan), `catalog/outer.js` (dindjarin)
- Modify: `scripts/galaxy-figures-audit.mjs` (`EXPECTED` gains the eleven as `'legs'`)
- Test: `src/components/galaxy/surface/legRig.test.js` (add two cases)

**Interfaces:**
- Consumes: `findLegs(points, { bottom, top, crotch, x })` and `leggedFigure(scene, { seed, legs })` in `legRig.js`, unchanged.

- [ ] **Step 1: Write the failing tests** in `legRig.test.js`: a point cloud of two columns under a torso (legs part at 0.45 of the height) gives `findLegs` a crotch near 0.45 and two legs at ±x; a single column (a robe) gives null.
- [ ] **Step 2: Run**; expect the first to pass already and the second to fail only if `findLegs` returns a bad non-null (it should pass too; if both pass, keep them as the pin and go on).
- [ ] **Step 3: Measure each crotch** on the model sheet: `npx vite --port 5188 --strictPort --host 127.0.0.1`, then `/scripts/preview/surface.html?group=fill&kind=jyn&view=front` (and `library`, `outer`), reading the height where the legs part as a fraction of the figure's height (the Ewok's 0.33, the Gungan's 0.46 are the pattern). A figure whose legs do not part (K-2SO's might: check) gets no `legs`, and the task's note says so.
- [ ] **Step 4: Add the rows**: `legs: { crotch: 0.47 }` (the measured value) on each.
- [ ] **Step 5: Browser check**: `node scripts/anim-check.mjs --route '#/galaxy/scarif/surface' --seconds 6`, then kamino, nevarro, coruscant, naboo (Anakin). Expect no figure in view drifting over 0.15 m/s and the eleven no longer "at the bind pose". Save the JSON (`--json`) under `docs/superpowers/evidence/galaxy-asset-upgrade/anim-p1-<world>.json`.
- [ ] **Step 6: Add the eleven to `EXPECTED`** as `'legs'`; run the audit script; expect exit 0.
- [ ] **Step 7: Run** `npx eslint .`, `npx vitest run src/components/galaxy`, then **commit**.

## Phase 2: the assets source, and the retarget for any skeleton

### Task 3: `rig.js` exports `findBones` and strips a numeric suffix

**Files:**
- Modify: `src/lib/three/rig.js` (`plain` strips a trailing `_\d+`; `export function findBones`)
- Test: `src/lib/three/rig.test.js` (add cases)

**Interfaces:**
- Produces: `findBones(root, named = {}) → { bones: { hips, head, armL, foreL, handL, armR, foreR, handR, thighL, calfL, footL, toeL, thighR, …, toeR }, spine: [Bone…], all: [Bone…] }` (as it is, now exported).

- [ ] **Step 1: Write the failing test**: a skeleton of `THREE.Bone`s named `mixamorig:Hips_52`, `mixamorig:Spine_38`, `mixamorig:Head_0`, `mixamorig:LeftUpLeg_7`… resolves `hips`, `head`, `thighL`; the spine lists the bones between.
- [ ] **Step 2: Run**; expect FAIL (`findBones` not exported / hips null).
- [ ] **Step 3: Implement**: `plain` gains `.replace(/_\d+$/, '')` after its prefix strips; `export` the function.
- [ ] **Step 4: Run** `npx vitest run src/lib/three/rig.test.js`; expect PASS, and the rest of the file's cases unchanged.
- [ ] **Step 5: Commit.**

### Task 4: the retarget targets bones by role

**Files:**
- Modify: `scripts/preview/ualRetarget.js` (`prepare`, `retargetUal`: the target's map from `findBones` when the Meshy names are absent)
- Test: `scripts/preview/ualRetarget.test.mjs` (new; the pure parts), and a byte-identity check in `scripts/ual-bake.test.mjs` (new)

**Interfaces:**
- Consumes: `findBones` (Task 3).
- Produces: `targetMap(root) → { [meshyName]: Bone }` (pure, exported): on a Meshy rig, the bones by `UAL_MAP`'s names; on any other, by role (`hips → Hips`, spine chain → `Spine02, Spine01, Spine` by position from the hips (one bone: `Spine`; two: `Spine01, Spine`; four or more: the first, the middle, the last), `head → Head`, the neck as `neck` when the head's parent is not in the spine, `armL → LeftArm`, `foreL → LeftForeArm`, `handL → LeftHand`, `thighL → LeftUpLeg`, `calfL → LeftLeg`, `footL → LeftFoot`, `toeL → LeftToeBase`, and the right side; shoulders `LeftShoulder`/`RightShoulder` only when a bone sits between the spine's top and the arm). `ORDER` entries with no target bone are skipped (no track written). `retargetUal(src, clip, target, { fps, prep })` writes tracks on the target's *own* bone names.
- Throws `Error('no hips in <names…>')` when no hips resolve.

- [ ] **Step 1: Write the failing tests**: `targetMap` on `meshyRig.fixture.js`'s model equals the Meshy names; on a Mixamo-named skeleton (Task 3's fixture extended to the limbs) maps every role; on a skeleton with no hips throws naming the bones.
- [ ] **Step 2: Run**; expect FAIL.
- [ ] **Step 3: Implement** `targetMap`; thread it through `prepare` (`tBones`, `tRest`, `align`, `AIM` by target name) and `retargetUal` (track names from the bone's `.name`, not the Meshy key; the hips' position track on the hips bone's name).
- [ ] **Step 4: Byte identity.** Before touching the bake script, copy `public/games/meshy/ual-talk.glb` and `ual-sit.enter.glb` aside. Write `scripts/ual-bake.test.mjs`: it skips unless `scripts/preview/.ual/ual.glb` (or `lab/assets/ual1/Unreal-Godot/UAL1.glb`) exists; when it does, it runs the `life` set's `talk` through the bake path into a temp file and compares bytes with the shipped file. Fetch the pack (`node scripts/assets-fetch.mjs ual1`) so the test runs in this session.
- [ ] **Step 5: Run** the retarget tests and the bake test; expect PASS (identical bytes). If a byte differs, the Meshy path has changed: fix until identical. Do not regenerate the shipped files.
- [ ] **Step 6: Commit.**

### Task 5: `ual-bake.mjs --rig <figure.glb> --into <out.glb>` and the `core` set

**Files:**
- Modify: `scripts/ual-bake.mjs` (`SETS` gains `core`; `--rig`, `--into`, `--set core`; the rest skeleton read from the figure's file; the output written as the figure's GLB with the clips as its animations, quantized shorts)
- Test: `scripts/ual-bake.test.mjs` (add)

**Interfaces:**
- Produces: `bakeInto(figureFile, outFile, { set, pack }) → { clips: [name…], bytes }`: reads the figure with `NodeIO` (meshopt decoder registered), builds its rest rig from the JSON nodes as `restRig` does (every skin's joints), retargets each clip of the set through Task 4, and writes the figure's document with the animations added (`@gltf-transform` `Animation` with `QuaternionKeyframeTrack` data as normalized shorts via the existing `short` path; the hips' position as floats), meshopt re-applied. Existing animations are kept; one with a set clip's name is replaced.
- `core` set: `{ Idle_Loop: 'idle', Walk_Loop: 'walk', Jog_Fwd_Loop: 'run', Idle_Talking_Loop: 'talk', Hit_Chest: 'hit.chest', Death01: 'die', Sitting_Idle_Loop: 'sit.idle' }`, `short: true`, `pack: 'ual1'`.

- [ ] **Step 1: Write the failing test**: `bakeInto` on `meshyRig.fixture.js`'s model exported to a temp GLB (use `GLTFExporter` in Node, or hand-write a minimal skinned GLB with `@gltf-transform` from the fixture's bones) with set `core` adds seven animations named as above, the file grows by under 60 KB, and reading it back with `NodeIO` lists them.
- [ ] **Step 2: Run**; expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run**; expect PASS. Then run `--report` on the Meshy path once to be sure the existing sets still report float noise.
- [ ] **Step 5: Commit.**

### Task 6: the three silent rigs play the core set

**Files:**
- Modify: `public/models/galaxy/surface/ithorian.glb`, `rebelpilot.glb`, `rebeltech.glb` (re-written by Task 5)
- Modify: `src/components/galaxy/surface/catalog/fill.js` (their rows: `anim: { idle: 'idle', walk: 'walk', run: 'run' }`)
- Modify: `scripts/galaxy-figures-audit.mjs` (`EXPECTED`: the three as `'own-clips'`)
- Test: `src/components/galaxy/surface/catalog/catalog.test.js` (add: every row with `anim` names clips the GLB has)

**Interfaces:**
- Consumes: `bakeInto` (Task 5).

- [ ] **Step 1: Write the failing test** in `catalog.test.js`: for each row with `anim`, read the GLB's JSON chunk (as `ual-bake.mjs`'s `glbJson` does: no decoding needed) and expect each named clip among `animations[].name`. Expect FAIL on the three (and PASS on every existing `anim` row: if one fails, that is a real bug to note, not to loosen).
- [ ] **Step 2: Bake**: `node scripts/ual-bake.mjs --rig public/models/galaxy/surface/ithorian.glb --into public/models/galaxy/surface/ithorian.glb --set core`, and the two others. Check sizes stay under 2.5 MB.
- [ ] **Step 3: Add the rows' `anim`.** Run the test; expect PASS.
- [ ] **Step 4: Browser check**: `node scripts/anim-check.mjs --route '#/galaxy/yavin/surface' --seconds 6 --json docs/superpowers/evidence/galaxy-asset-upgrade/anim-p2-yavin.json`, then endor and scarif. Expect the three walking (toes planted under 0.15 m/s), none at bind pose. Take `OUT=lab/shots node scripts/surface-shot.mjs yavin "<x>,<z>,8,30,techs"` at the hangar for the PR.
- [ ] **Step 5: `EXPECTED` gains the three** as `'own-clips'`; audit exits 0.
- [ ] **Step 6: Commit.**

### Task 7: `assets-fetch.mjs` learns the repo and the Star Wars release

**Files:**
- Modify: `scripts/assets-fetch.mjs`
- Modify: `docs/assets/quaternius.md` (a "Star Wars originals" section and the `--repo` route)
- Test: `scripts/assets-fetch.test.mjs` (new)

**Interfaces:**
- Produces: `PACKS.starwars = { release: 'https://github.com/tilakpatell/tilakverse-assets/releases/download/sketchfab-star-wars', models: { b1: { file: 'b1-battle-droid.glb', title: 'B1 Battle Droid', author: 'leoxx300', authorUrl: 'https://sketchfab.com/leoxx300', license: 'CC-BY-4.0', licenseUrl: 'http://creativecommons.org/licenses/by/4.0/', source: 'https://sketchfab.com/3d-models/b1-battle-droid-star-wars-f0ca5d7dd5b64869907c6e781d7c660a' }, atat1k: {…}, atat: {…}, tie: {…}, venatorcw: {…}, venator: {…} } }` (from the assets repo's `sketchfab/star-wars/README.md`); `partsOf(file, n) → ['<file>.part-aa', '-ab', …]` (pure); `joinParts(dir, file) → path` (joins every `<file>.part-??` present, in name order); `checkSums(dir, sums) → [bad…]` (pure on `{ file: sha }`). CLI: `node scripts/assets-fetch.mjs starwars [b1 …]` fetches `SHA256SUMS`, then each model's parts until a 404, joins, checks, into `lab/assets/starwars/<file>`; `node scripts/assets-fetch.mjs --repo <pack>` sparse-checks `quaternius/<folder>` out of the repo into `lab/assets/<pack>/` (`git clone --filter=blob:none --sparse --depth 1` into `lab/assets/.repo/` once; `git sparse-checkout add quaternius/<folder>`; a symlink or copy to `lab/assets/<pack>/`), with `FOLDERS = { ual1: 'universal-animation-library', ual2: 'universal-animation-library-2', naturemega: 'stylized-nature-megakit', … }`.

- [ ] **Step 1: Write the failing tests**: `partsOf`, `joinParts` on a temp dir with three fake parts (and a stray `part-ad` of another file ignored), `checkSums` with one bad sum.
- [ ] **Step 2: Run**; expect FAIL.
- [ ] **Step 3: Implement**; keep the release-zip path as it is.
- [ ] **Step 4: Run** the tests; then `node scripts/assets-fetch.mjs starwars b1` for real (33 MB in five parts: the parts are `part-aa`…`part-ae`, checked in the architecting session, sha `399aad18…`), and `node scripts/assets-fetch.mjs --repo naturemega` (the glTF folder is what Phase 4 reads). Expect both in `lab/assets/`.
- [ ] **Step 5: Docs**; **commit** (no files under `lab/`).

## Phase 3: the B1 battle droid, by geometry

### Task 8: the B1 rigged from the troops' battle droid

**Files:**
- Create: `scripts/b1-import.mjs` (thin: `sketchfab-import.mjs` then `rig-transfer.mjs`, with the credit)
- Modify (only on success): `public/models/galaxy/troops/battledroid.glb` (the new), `public/models/galaxy/troops/battledroid.bf.glb` (the old, kept), `src/data/modelCredits.json` (`troops-battledroid`: leoxx300, CC-BY-4.0), `scripts/credits.mjs` if it lists the troops, `docs/superpowers/HANDOFF-galaxy-asset-upgrade.md` (the outcome either way)
- Test: `scripts/b1-import.test.mjs` (the pure `creditFor`)

**Interfaces:**
- Consumes: `lab/assets/starwars/b1-battle-droid.glb` (Task 7), `rigFrom(donorFile, meshFile, outFile, { tex })` from `scripts/rig-transfer.mjs` (returns `{ tris, joints, spread }`), `scripts/sketchfab-import.mjs <in> <out> --size 1.91 --tex 1024 --tris 12000` (no `--keep`: the unnamed skeleton is dropped so the mesh is unrigged for the transfer; `unskinned` in `scripts/lib/surface-model.mjs` does this if `sketchfab-import` keeps skins).
- Produces: `creditFor(model) → modelCredits entry` (pure, from `PACKS.starwars.models.b1`, `where: 'galaxy-surface'`, `as: 'the battle droids'`, `file: '/models/galaxy/troops/battledroid.glb'`, `also: ['galaxy']`).

- [ ] **Step 1: Write the failing test** for `creditFor`; run; FAIL; implement; PASS.
- [ ] **Step 2: Shrink**: `node scripts/sketchfab-import.mjs lab/assets/starwars/b1-battle-droid.glb lab/b1/b1-web.glb --size 1.91 --tex 1024 --tris 12000`. Stand it as the donor stands: open `/scripts/preview/crew.html` (or `glb-shot.mjs lab/b1/b1-web.glb lab/b1/sheet.png three,front,side`) beside `troops/battledroid.glb` and note facing and arm pose. The transfer stands the mesh in the donor's box (`fitTo`), so only the pose has to match: if the B1's arms hang and the donor's stand out, stop here and write the hand-off note (Phase 3 ends; nothing changes).
- [ ] **Step 3: Transfer**: `node scripts/rig-transfer.mjs public/models/galaxy/troops/battledroid.glb lab/b1/b1-web.glb lab/b1/b1-rigged.glb --tex 1024`. Expect `spread` near 0 and `joints` 24.
- [ ] **Step 4: Judge**: `node scripts/glb-shot.mjs lab/b1/b1-rigged.glb lab/b1/rigged.png three,front,side` and, on a scratch copy of `troops/battledroid.glb` swapped for it, `node scripts/anim-check.mjs --route '#/galaxy/geonosis/surface' --seconds 6` (and a `surface-shot` of a droid column). Legs that tear or a hip that folds mean no: revert the scratch swap and write the note.
- [ ] **Step 5: On a yes**: move the old file to `battledroid.bf.glb`, the new one in, the credit in (`modelCredits.test.js` passes: the file exists and a page shows the credit; the surface page lists `troops` files through `crewList.js`'s `filesOf`: check it does for troops, else add the credit's `file` to what it shows), `galaxy-check surface geonosis,naboo,mustafar` within budget.
- [ ] **Step 6: Commit** either the swap or the hand-off note.

## Phase 4: Quaternius ground cover and far trees

### Task 9: `scripts/quaternius-import.mjs` and `catalog/quaternius.js`

**Files:**
- Create: `scripts/quaternius-import.mjs`, `src/components/galaxy/surface/catalog/quaternius.js`
- Modify: `src/components/galaxy/surface/catalog/index.js` (`GROUPS` gains `quaternius` before `made`), `public/cc0/README.md` (a Quaternius line: `models/galaxy/surface/{qfern,qclover,qmushroom,qpebble,qgrass,qpine,qdeadtree}.glb`), `scripts/credits.mjs` (its CC0 list, lines 63–70, reads `public/games/credits.json`, `public/games/caribbean/credits.json` and `public/hq/CREDITS.md`, not `public/cc0/README.md`: add one `cc0.push({ name: 'Stylized Nature MegaKit (the galaxy's ground cover and far trees)', source: 'https://quaternius.com', by: 'Quaternius' })` guarded by the README line's presence, then `npm run credits` and commit `CREDITS.md`)
- Test: `scripts/quaternius-import.test.mjs` (the pure `specFor`), `catalog.test.js` (as it is: the new rows must pass it)

**Interfaces:**
- Produces: `node scripts/quaternius-import.mjs <pack> <Model> --kind <kind> --metres <m> [--along y] [--tex 512] [--tris 4000]`, reading `lab/assets/<pack>/glTF/<Model>.gltf` (the MegaKit's folder; `--from <file>` for another), through `dequantize, dedup, metalRough, prune, bareWhereUntextured, weld, flatten, join, weld` then `simplified(tris)`, `grounded({ metres, along, yaw: 0, up: 'y' })`, `textureCompress` WebP at `tex`, `meshopt`, to `public/models/galaxy/surface/<kind>.glb`; prints the catalogue row. `specFor(args) → { kind, metres, along, tex, tris, src }` (pure). Rows: `{ made: 'quaternius', as: 'the ferns', metres: 0.9, along: 'y', tris: 4000, tex: 512 }` for `qfern` (Fern_1), `qclover` (Clover_1, 0.25 m), `qmushroom` (Mushroom_RedCap, 0.4 m), `qpebble` (Pebble_Round_1, 0.3 m, `along: 'max'`), `qgrass` (Grass_Common_Tall, 0.6 m), `qpine` (GiantPine_1, 42 m), `qdeadtree` (DeadTree_1, 14 m).
- `catalog.test.js`'s credit rule (its lines 44–48) asserts `m.made === 'meshy'` for every made kind: extend it to `expect(['meshy', 'quaternius']).toContain(m.made)`, keeping the README rule (`madeKinds`) for both.

- [ ] **Step 1: Write the failing test** for `specFor` (defaults, `--along max`, a missing `--kind` throws).
- [ ] **Step 2: Run**; FAIL; **implement**; PASS.
- [ ] **Step 3: Import the seven** from `lab/assets/naturemega/glTF/`. Each under 300 KB (the kit's maps are shared atlases: `textureCompress` at 512 keeps them small). Look at them on the sheet: `/scripts/preview/surface.html?group=quaternius`. The foliage should read with lifted normals: `placer.js` does not call `lib/three/foliage.js` today (the built fern in `props/forest.js` lifts its own normals at build time, `liftNormals`). So lift them at import time instead: `quaternius-import.mjs` gains `--foliage`, which runs the same spherify-and-lift on the mesh's normals in the script (port `liftNormals`'s arithmetic from `src/lib/three/foliage.js` to `scripts/lib/surface-model.mjs` as `lifted(opts)`, a transform, tested), and no loader changes. Use it on `qfern`, `qclover`, `qgrass`, `qpine`, `qdeadtree`; not on the mushroom or the pebble.
- [ ] **Step 4: README line, credits**; `npx vitest run src/components/galaxy/surface/catalog`; PASS. **Commit.**

### Task 10: the forest worlds' scatter, and Endor under budget

**Files:**
- Modify: `src/components/galaxy/surface/sites/forest.js` (endor: `qfern` and `qmushroom` within 60 m, `n` 120 and 30; the far redwood ring beyond 640 m replaced by `qpine` `solid: false`, `scale` [0.9, 1.4]; dagobah: `qfern` within 80 m, `qmushroom`; kashyyyk: `qfern`; yavin: `qfern`, `qclover`), `sites/core.js` (naboo: `qclover`, `qgrass`), `sites/outer.js` (sorgan: `qgrass`, `qclover`; lothal: `qgrass`)
- Modify: `scripts/galaxy-budget.mjs` (`KNOWN_OVER`: endor removed)
- Test: `scripts/galaxy-budget.test.mjs` (endor no longer known), `sites/sites.test.js` (as it is: every scatter kind must be a model or a prop)

- [ ] **Step 1: Baseline**: `QUALITY=high JSON=1 OUT=/tmp/b node scripts/galaxy-check.mjs surface endor` on `main`'s tree (before the edit); note triangles and calls.
- [ ] **Step 2: Edit the sites.** Run `npx vitest run src/components/galaxy/surface/sites`; PASS.
- [ ] **Step 3: Measure**: the same `galaxy-check` on endor, then dagobah, kashyyyk, yavin, naboo, sorgan, lothal. Expect endor under 3,000,000 triangles at high and calls within the row (700). If the far pines alone do not bring it under, lower the near redwood count in the 640 m ring by a tenth at a time and say so in the PR; never touch the landing clearing.
- [ ] **Step 4: Pictures**: `OUT=lab/shots node scripts/surface-shot.mjs endor "0,0,30,20,landing" "0,0,900,10,far"` and one of dagobah's floor, into the PR.
- [ ] **Step 5: Remove endor from `KNOWN_OVER`**, fix its test, `npx vitest run scripts/galaxy-budget.test.mjs`; PASS. Update `lab/baseline/surface-high.json` only if the project's rule (`galaxy-check.mjs`'s header) says a lowered baseline is re-recorded; else leave it.
- [ ] **Step 6: Commit.**

## Phase 5: the built people, asked for

### Task 11: ten gen3d asks, A-posed, and their crew rows ready

**Files:**
- Create: `docs/superpowers/evidence/galaxy-asset-upgrade/gen3d-asks.md` (each issue's title and body, from `--dry-run`)
- Modify: `docs/superpowers/HANDOFF-galaxy-asset-upgrade.md` (the table: kind, donor, command, `CREW` row)

**Interfaces:**
- Consumes: `node scripts/desktop/ask.mjs gen3d <name> --what "…" --image <url> --faces 30000 --note "…" [--dry-run]`; `rigFrom` (for the hand-off's commands).

- [ ] **Step 1: Pick a picture** for each from Wookieepedia (`scripts/wiki-refs.mjs` fetches a reference sheet by title: use it to confirm the file names): `villager` (a Tatooine settler, Mos Espa crowd), `farmer` (a Naboo farmer), `pilot` (a Rebel pilot in orange: there is a Sketchfab one, `rebelpilot`; the built `pilot` kind is the one `life` asks for on five worlds, so the cheaper fix is a `CREW`-free alias: check whether `pilot` can simply resolve to `rebelpilot`'s model by a catalogue row `pilot: { …rebelpilot's row }`; if so, do that in this task and ask for no model), `kenobi` (young Obi-Wan, Attack of the Clones), `jocasta` (Jocasta Nu), `zam` (Zam Wesell as the woman in the club), `caretaker` (a Jedi Temple caretaker), `ghostben` (Ben's Force ghost: ask for old Ben in robes; the ghost look is a material the scene adds), `wa7` (the WA-7 waitress droid, a prop), `shaak` (the shaak, a prop).
- [ ] **Step 2: Dry-run each**, with `--what` ending "standing straight in an A-pose, arms held out from the sides at about forty-five degrees, feet together, on a plain white background, so it can be rigged by transfer from the site's crew" for the people (not the droid or the beast). Save the bodies.
- [ ] **Step 3: File them** (`ask.mjs` without `--dry-run`). If `gh` is refused in the session, the evidence file is the deliverable and the hand-off says the owner files them.
- [ ] **Step 4: The hand-off table**: for each person, the donor (`officer` for villager, farmer, kenobi, caretaker; `twilek` for zam; `jedi3` for jocasta and ghostben), the command `node scripts/rig-transfer.mjs public/models/galaxy/crew/<donor>.glb public/models/gen3d/<name>.glb public/models/galaxy/crew/<name>.glb --tex 1024`, and the `CREW` row `name: { url: '/models/galaxy/crew/<name>.glb', tall: <m> }`; for the droid and the beast, a plain catalogue row in `catalog/made.js` once the GLB is copied to `public/models/galaxy/surface/<kind>.glb` (no surface kind reads `public/models/gen3d/` today: the trench run's ships do, through `lib/three/gen3d.js`; copying keeps the surface's one folder and `madeKinds` rule), listed in `public/cc0/README.md` as the Meshy ones are, with `made: 'meshy'` replaced by a new `made: 'gen3d'` value added to `catalog.test.js`'s allowed list.
- [ ] **Step 5: Commit.** Run the audit script once more and save `audit-after.md` beside `audit-before.md`: the difference is the PR's summary.
