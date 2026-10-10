# Battlefront 2017 pipeline, lane W: the worlds on the game's kits, under the game's skies. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each Star Wars world the game has is built from the game's pieces (Echo Base's hangar, Endor's bunker and platform, Mos Eisley and Jabba's palace, Yavin's temple grounds, the Death Star's corridors, Theed, Tipoca, the Wookiee village, Cloud City, Scarif's station) and lit by the game's own sky and light probe for that level, at a laptop's `high` by default and `ultra` where the GPU allows, within every world's budget row, one world per PR.

**Architecture:** The import (phase 0) over the manifest's `objects/architecture/<world>/`, `objects/nature/<set>/` and `levels/mp/<world>_01/` folders, into a lane-owned catalogue group per world (`catalog/bf2017-<world>.js`), with **pieces that share a material merged into one GLB per material set** (a kit of 110 hangar pieces must not be 330 textures: the texture contract is 60 a world). The world's `props/*.js` and `sites/*.js` place the pieces where the built ones stood (`wear: { url }` where a built prop can wear a model, a new `kit` placement where it cannot). A new `src/lib/three/levelSky.js` loads a level's sky HDR and probe through PMREM as the world's environment and sun, replacing the shader dome for that world only. The far pieces take the game's far LODs; nature sets go through the existing instanced ground-cover path.

**Tech Stack:** phase 0's import and fetch, the lane S loader when merged (until then same-origin), three.js (`PMREMGenerator`, `RGBELoader`), Vitest, `scripts/galaxy-check.mjs`, `scripts/glb-shot.mjs`, `scripts/surface-shot.mjs`, `scripts/hoth-check.mjs`.

**Spec:** sections 5 (phases 6 to 8), 6, 10 and 11 of `docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md`; `inventory.md`'s per-world piece counts and the lightmap/probe counts.

## Global Constraints

- Phases 0 to 2's Global Constraints (keys, caps, the sequel list, the gates, the game first).
- **Files this lane owns**: `catalog/bf2017-<world>.js` per world, `src/lib/three/levelSky.js` and its test, `props/<world>.js`, `sites/<world file>.js`'s props and zones (not its `life`: phase 2's), `surface/sky.js` only to accept an image environment, `scripts/bf2017-kit.mjs` (the merge-by-material step, if the import's `--join` does not cover unskinned kits), `public/cc0/galaxy/` nothing. It does not touch `crew*.js`, `walrus*.js`, `actors.js`, `walkers.js`, `src/lib/net/*`.
- One world per PR, in this order: hoth, endor, tatooine, yavin, deathstar (the interior: `inside/scene/kit.js` wears the pieces, the room layout stays), naboo, kamino, kashyyyk, bespin, scarif, geonosis (from the campaign's `a3/` set). Each PR: the kit, the sky, the sheets, the before/after budget table.
- Textures: section 6's mix; a world's kit under 60 textures and 256 MB on a desktop (read from `renderer.info`); a kit's shared trim sheets at 2048 on `ultra` only.
- The sky: each world's level under `textures/levels/mp/<world>_01/` (or `levels/<name>_01/` for Jabba's palace and Cloud City) has sky and probe textures; the one chosen is the daytime, outdoor probe of the main arena (named in the evidence), loaded as a `.hdr` at 1024×512 for `high`, 2048×1024 for `ultra`, 512×256 below, published by lane S's manifest when merged.
- Per-world triangle and call rows do not move (`src/lib/budgets.js`); Endor stays held to its baseline; a kit over its row takes the next LOD for its far pieces and places fewer, said in the PR.

## Review Focus

1. The pieces are modular with a grid (`hangarsystemfloorenddoor_01_2048x768x1024`): their origins are at a corner or an edge, not the centre; `--keep-origin` must be on for kit pieces, and the placement code snaps by the piece's declared size (the name's `WxHxD` in centimetres), tested in a pure `kitGrid.js`.
2. Merging pieces by material changes nothing visible but must keep each piece selectable by name for the placement (a merged GLB keeps one node per piece, `join({ keepNamed: true })`), tested on a two-piece fixture.
3. An HDR sky at 2048×1024 as a float texture is 16 MB of GPU memory and over 5 MB on the wire even as RGBE; `levelSky.js` loads the size the tier allows and never two at once (the previous world's is disposed before the next loads), tested with a fake loader.
4. The Death Star interior's `inside/pack.js` lists every file it loads, and `scripts/pack-check.mjs` fails a build whose source names an asset its pack misses: the kit pieces go into that pack.
5. A world that keeps a built prop where the game has no piece (Hoth's shield generator) must not mix a third style: the built prop takes the game's trim textures (section 6's `scanned` look) so `art-mix` does not count it.

---

### Task 1: The sky and probe of a level as the world's light

**Files:** `src/lib/three/levelSky.js`, `levelSky.test.js`, `surface/sky.js` (accepts `{ env, sun }` from a loaded sky in place of its dome), `surface/scene.js:279-280` (the PMREM source).

- [ ] **Step 1: Failing tests**: `skySizeFor(level) → [w, h]` gives `[512, 256]`, `[1024, 512]`, `[1024, 512]`, `[2048, 1024]` for low, mid, high, ultra; `loadLevelSky(url, { tier, loader })` with a fake loader returns `{ env, sun: { dir, color, intensity } }` where `sun.dir` is a unit vector read from the brightest texel; loading a second sky disposes the first (the fake's `dispose` called once).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; pick Hoth's probe (list `textures/levels/mp/hoth_01/` with the fetch; the outdoor one of the main arena), fetch it, convert to the three sizes with `sharp` (`.hdr` in, `.hdr` out; `scripts/bf2017-sky.mjs`, ten lines over `sharp`), place under `public/textures/galaxy/sky/hoth-<size>.hdr` (or the bucket when lane S is in), and wire Hoth's site to it. **Step 4: Run** → PASS; `surface-shot.mjs` Hoth before and after.
- [ ] **Step 5: Commit** `A world lit by the game's sky and probe for its level`.

### Task 2: The kit import and the grid

**Files:** `scripts/bf2017-kit.mjs` (or the import's `--kit` flag: fetch a folder's pieces at the plain LOD, merge by material keeping named nodes, write one GLB per material set and a `kit.json` of piece names, sizes from the names and bounds), `src/components/galaxy/surface/kitGrid.js`, `kitGrid.test.js`.

- [ ] **Step 1: Failing tests**: `sizeFromName('hangarsystemfloorenddoor_01_2048x768x1024_01_mesh') → [20.48, 7.68, 10.24]`; `snap(pos, size, grid = 2.56)`; a two-piece fixture merged keeps two named nodes and one material.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Kits from the game's modular pieces, merged by material, placed on their grid`.

### Task 3: Hoth

- [ ] **Step 1:** `objects/architecture/hoth/hangarsystem_01` (110), `corridorsystem_01` (16), `wallsystem_01` (24), the fuel silo, the DF.9 stack, `objects/nature/arctic/` (130: rocks, ice, the backdrops) into `catalog/bf2017-hoth.js`; Echo Base rebuilt from the pieces where `echoLayout.js` built boxes (the hangar's floor, walls, doors, the snow cave); the backdrop ridges from `arcticbackdrop_01`; `hoth-check.mjs` green (no `userData.built` on anything the game has a piece for); the Hoth sky from task 1.
- [ ] **Step 2:** `galaxy-check.mjs surface hoth` under `BUDGET=1` at `high` and `low`, before and after; sheets; `WORLD_MB`.
- [ ] **Step 3: Commit, PR** `Hoth on the game's Echo Base, under the game's sky`. MERGE per the slot, then the next world on a fresh branch from main.

### Task 4: Endor, Tatooine, Yavin, the Death Star interior

The same three steps per world:
- **Endor**: `objects/architecture/endor/landingplatform_02` (24), `powercoreroom_01`, `_galacticempire/bunkersystem_01` (68), `objects/nature/forest/` (196: the redwoods, ferns, shrubs with their own skeletons for wind), `levels/mp/endor_01/objects` (72); the forest's instanced ground cover from the game's ferns in place of Quaternius'; Endor stays at its baseline (the near redwoods at the next LOD).
- **Tatooine**: `tatooine/moseisley` (96), `tatooine/jabbaspalace` (133), `objects/nature/desert` (58), `levels/mp/tatooine_01/objects` (76) and its terrain pieces; the Meshy cantina, homestead and spire replaced where the sheet says.
- **Yavin**: `objects/nature/yavin/` (551: the temple grounds' trees, stones, roots), the rebel base pieces; the massassi temple stays Meshy's `.ultra` unless the game's pieces make a better one on the sheet.
- **The Death Star interior**: `_galacticempire/deathstar_interior` (216), `deathstar_panels_*`, `tractorbeamgenerator_01`, `deathstar_debris`; `inside/scene/kit.js` wears the pieces on its room layout; `inside/pack.js` lists them; `deathstar-check.mjs` green; the interior's own budgets (750k triangles, 300 calls desktop).

### Task 5: Naboo, Kamino, Kashyyyk, Bespin, Scarif, Geonosis

The same, one PR each: Naboo (`naboo/palace` 187, `hangar` 52, `canal` 19, the facades and trim sets, `objects/nature/naboo` 113), Kamino (`kamino/cloningfacility` 169, `domes` 252, `corridor` 102, `platforms` 42, `hangarbay` 39), Kashyyyk (`kashyyyk/village` 23, `walkways`, `venator_kashyyyk_01` 24, `objects/nature/kashyyyk` 135), Bespin (`bespin/_upperlevels` 41, `buildings` 37, `platformsystem_01`, `plaza_*`, `backdrop` 17), Scarif (`scarif/trainstation_01` 22, `barrack_01`, `objects/nature/beach` 112), Geonosis (the campaign's `a3/objects/architecture` 168 and `a3/levels/sp`, with the Geonosis lightmaps' probe).

### Task 6: Per world, before the PR

- [ ] The sheets (`surface-shot.mjs` from the site's named views, before and after), the budget table at `high` and `low`, `renderer.info.memory.textures`, `anim-check` where the world has people, the gates, the regenerated files restored, the world's line in `docs/superpowers/HANDOFF-bf2017.md` (lane W: Done per world, Left: the next world and anything the sheet rejected), merge `origin/main`, push, the PR named for the world. MERGE per the slot.
