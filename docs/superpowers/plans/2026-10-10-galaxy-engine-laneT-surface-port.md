# The galaxy's engine, lane T: the surface on the node renderer. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** `galaxy-surface` is a `'nodes'` world: every material it draws with is TSL, its post chain is data the runtime builds, so it runs on WebGPU where the browser has it and on the node renderer over WebGL 2 elsewhere, draws the same picture as today within the parity check's tolerance, and takes lane R's light (`applyGameLight`) and the physics design's ground and body (lanes P0 and P1) on the worlds that have the game's level. The shared shaders it needs get TSL twins beside their GLSL originals, so the other worlds keep shipping as they are.

**Architecture:** The WebGPU design's recipe (`docs/superpowers/specs/2026-10-08-webgpu-acceleration-design.md`, "The ports, in order", steps 1 and 4): each GLSL site becomes a TSL `Fn` in a `nodes.js` beside the scene (the surface's own) or a `<name>Nodes.js` beside a shared file (`src/lib/three`), each a factory returning a node material and its uniform nodes under the names the frame code already writes, so the per-frame code changes only where it imports the materials. The module flips to `'nodes'` last, when `shading.test.js`'s closure is clean; the parity and perf tables go in the PR.

**Tech Stack:** `three/webgpu`, `three/tsl` (`Fn`, `uniform`, `attribute`, `texture`, `positionLocal`, `normalWorld`, `MeshStandardNodeMaterial`, `MeshBasicNodeMaterial`, `PointsNodeMaterial`, `SpriteNodeMaterial`), `src/runtime/` (`gfx.post`, `shadingClosure.js`, `shading.test.js`), lane R's `src/lib/three/light/` and `applyGameLight`; the physics design's P0 (`src/lib/level/collision.js`'s `createLevelCollision`, on `claude/bf2017-p0-shapes`) and P1 (`surface/playerBody.js`, on `claude/bf2017-p1-body`); `scripts/gpu-parity.mjs <route> --before --view <name>` (`scripts/gpu-parity/README.md`), `scripts/perf-probe.mjs` with `GPU=`, `scripts/galaxy-check.mjs surface`, `scripts/surface-shot.mjs`; Vitest.

**Spec:** `docs/superpowers/specs/2026-10-10-galaxy-engine-design.md` ("The surface port"); the WebGPU design for the recipe, the guard and the parity check; the two ports on `main` as the worked examples (`src/components/earth/nodes.js`, `src/components/minecraft/scene/nodes.js` and their tests).

## Global Constraints

- **Files this lane owns**: `src/lib/three/*Nodes.js` (+ tests; new, beside each original), `src/components/galaxy/surface/nodes.js` (+ test; may split into `nodes/<topic>.js` under 800 lines each), `surface/scene.js` (import lines, the post chain through `rt.gfx.post`, the light through `applyGameLight` where `site.gameLight` is set, the ground through P0's `createLevelCollision` and the player through P1's `playerBody.js` where `site.level` is set, each read from its branch as it lands and stubbed to fall through until then: additive, the smallest diff that works), `surface/module.js` (the flip), `docs/stack/webgpu-tsl.md` ("Where it is used").
- **The GLSL originals are not edited**: a twin is a new file; `glsl-sites` goes down only when the surface's import moves, never by deleting a shared shader another world draws with.
- **The names stay**: a twin's factory has the original's signature and returns a material with the same flags (`transparent`, `blending`, `side`, `depthWrite`) and uniforms of the same names; the `nodes.test.js` beside it builds every material in Node and asserts the names and the flags against the original (the Earth port's test is the pattern).
- **The closure is the measure**: `node -e` over `src/runtime/shadingClosure.js`'s `closure('src/components/galaxy/surface/module.js')` lists what is left; the PR's table is that list at the start and at the end (zero).
- **The flip waits**: lanes G, L and K are editing `surface/scene.js`, `sky.js`, `weather.js` and `bodies.js` now. Twins and `nodes.js` are new files and start at once; the commit that changes `scene.js`'s imports and flips `module.js` is the last, after `git fetch origin main` shows those lanes merged (`gh pr list --search bf2017`), with `origin/main` merged first and both sides kept in any conflict.
- Files under 800 lines; tests beside; no network in tests; the gates.

## Review Focus

1. **A twin that drifts**: the parity check's threshold (the README's) on `/galaxy/hoth`, `/galaxy/endor`, `/galaxy/tatooine` and `/galaxy/kamino` (ice, forest, sand, water: the four surface looks) at the named views; a view over the threshold is fixed or the PR says which pixels and why (a TSL noise differing from a GLSL one is the usual cause: port the noise exactly, `lib/three/noise` first).
2. **`onBeforeCompile` chunk swaps** (`grounding.js`, `foliage.js`, `wind.js`, `groundLook.js`): the twin is a node material whose `positionNode`, `colorNode` or `normalNode` is the swapped chunk as a `Fn`; the Expanse step-4 note in the WebGPU design names these as the twins the natural-worlds lane also wants. Tell that lane (`HANDOFF-world-runtime.md` or its open PR) so it reads these twins rather than writing its own.
3. **The post chain**: `universe/post.js`'s surface pass (its exposure, bloom and lane G's LUT) becomes `passesFor` data (lane R) through `rt.gfx.post`; on `'glsl'` `galaxy` (the map, until lane M) the chain stays as it is: the two modules do not share a composer after this lane, and the handover between them (`runtime/handover.js`) is checked in a flight from orbit to ground and back on both backends.
4. **Draw count**: the surface at ultra on Hoth draws fewer or the same `renderer.info.render.calls` as before (the perf probe's table); `BundleGroup` round the placed level instances is lane L's to add on top, not this lane's.
5. **Phones and `nodes-webgl`**: `?gpu=webgl&quality=low` on the four routes draws, and the frame on the probe's phone profile is within 10% of before.

---

### Task 1: The closure, and the shared twins

**Files:**
- Create: `src/lib/three/groundingNodes.js`, `foliageNodes.js`, `groundLookNodes.js`, `puffsNodes.js`, `inkNodes.js`, `windNodes.js`, `surfaceNodes.js`, `rockNodes.js`, `recolourNodes.js`, `keySunNodes.js`, `houseNodes.js`, `groundmapNodes.js`, `explosionsNodes.js`, `dyeNodes.js`, `coreNodes.js` (+ a test each), and twins for whatever else the closure lists under `lib/three` (`noise`, `grass`, `river`, `land`, `tracks`, `windLines` if reached)

- [ ] **Step 1: The list**: run the closure on the surface module; write the table (file, sites) into the PR draft and the evidence folder `docs/superpowers/evidence/galaxy-engine/T/closure-before.md`.
- [ ] **Step 2: Failing tests** for the first five twins (names, flags, uniforms against the originals). **Step 3–4**, then the next five, then the rest; one commit per five: `TSL twins of grounding, foliage, groundLook, puffs and ink` and so on.

### Task 2: The surface's own materials

**Files:**
- Create: `surface/nodes.js` (or `surface/nodes/{sky,water,weather,props,ground,activity,missions}.js`) (+ tests)
- The originals: `surface/sky.js`, `skyfog.js`, `water.js`, `weather.js`, `props/windows.js`, `props/core.js`, `props/forest.js`, `activity.js`, `ground.js`, `missions/assaultScene.js`, and what the closure lists in `universe/` that the surface reaches (`footScene.js`'s matte figures, `post.js`'s surface pass)

- [ ] **Step 1: Failing tests** per file. **Step 2–4.** One commit per topic: `The surface's sky, fog and weather as nodes`, `The surface's water as nodes`, `The surface's props and ground as nodes`, `The surface's missions and figures as nodes`.

### Task 3: The post as data, the light and the ground

**Files:**
- Modify: `surface/scene.js` (`rt.gfx.post(passesFor(tier, entry, rt.gfx.backend))` in place of the composer's surface pass; `applyGameLight` where `site.gameLight`; P0's `createLevelCollision` and P1's `playerBody.js` where `site.level`; each behind its field so a world without stays as it is), `src/components/galaxy/surface/module.js` (unchanged here; the flip is Task 4)

- [ ] **Step 1: A test** that a site without `gameLight` and `level` makes the same light setup as before (count the scene's lights and their intensities) and one with both makes lane R's light and the physics lanes' ground and body.
- [ ] **Step 2: Wire it.** **Step 3: Commit** `The surface takes the runtime's post, the game's light and the level's ground where a world has them`.

### Task 4: The flip, the parity, the perf

- [ ] **Step 1**: `git fetch origin main`; G, L and K merged (`gh pr list --search bf2017 --state merged`); merge `origin/main`, keep both sides of `scene.js`.
- [ ] **Step 2**: `module.js` → `shading: 'nodes'`; `npx vitest run src/runtime/shading.test.js` green (the closure clean); `glsl-sites` in the measure lower by the surface's count.
- [ ] **Step 3**: `node scripts/gpu-parity.mjs /galaxy/hoth --before --view ground --view hangar` and the other three routes; the tables into the evidence folder; `GPU=webgl node scripts/perf-probe.mjs` and `GPU=webgpu` on the surface journey; `scripts/galaxy-check.mjs surface hoth,endor,tatooine,kamino`; `anim-check.mjs` on one route (figures unchanged).
- [ ] **Step 4**: `docs/stack/webgpu-tsl.md` (the surface in "Where it is used"; the twins named); the hand-off's row; tell the WebGPU lane and the natural-worlds lane the twins exist.
- [ ] **Step 5: Commit** `The galaxy's surfaces draw on the node renderer`; push; PR `The galaxy's engine, lane T: the surfaces on the node renderer, under the game's light, on the game's ground` with the closure table (before, after), the parity tables, the perf table on both backends, the four shots before and after.
