# Battlefront 2017 pipeline, lane W: the worlds on the game's kits, under the game's skies. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each Star Wars world the game has is built from the game's pieces (Echo Base's hangar, Endor's bunker and platform, Mos Eisley and Jabba's palace, Yavin's temple grounds, the Death Star's corridors, Theed, Tipoca, the Wookiee village, Cloud City, Scarif's station), with every ground, trim and prop texture the game's and none from the site's scan or kit sets, its sky and probe HDRs published for the owner's separate lighting lane, at a laptop's `high` by default and `ultra` where the GPU allows, within every world's budget row, one world per PR.

**Architecture:** The import (phase 0) over the manifest's `objects/architecture/<world>/`, `objects/nature/<set>/` and `levels/mp/<world>_01/` folders, into a lane-owned catalogue group per world (`catalog/bf2017-<world>.js`), with **pieces that share a material merged into one GLB per material set** (a kit of 110 hangar pieces must not be 330 textures: the texture contract is 60 a world). The world's `props/*.js` and `sites/*.js` place the pieces where the built ones stood (`wear: { url }` where a built prop can wear a model, a new `kit` placement where it cannot). The level's sky and probe HDRs are published as files with a note for the owner's lighting lane; this lane builds no lighting (the owner's rule of 04:40). The far pieces take the game's far LODs; nature sets go through the existing instanced ground-cover path.

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
3. A ground role whose game source tiles at a different scale than the scan it replaces (the game's terrain maps are 2 to 4 m a tile; the scans were 1 m): `ground.js`'s `wear` scale per role comes from `ROLE_SOURCES`' `metres`, tested, or every snowfield looks four times too coarse.
4. The Death Star interior's `inside/pack.js` lists every file it loads, and `scripts/pack-check.mjs` fails a build whose source names an asset its pack misses: the kit pieces go into that pack.
5. A world that keeps a built prop where the game has no piece (Hoth's shield generator) must not mix a third style: the built prop takes the game's trim textures (section 6's `scanned` look) so `art-mix` does not count it.

---

### Task 1: The game's textures for the ground and the trim (replaces the level-sky task)

**The owner (2026-10-10, 04:40): the game's textures for everything in a Star Wars world, no pre-existing set; lighting is another lane's, so no sky loader here.**

**Files:** `scripts/bf2017-textures.mjs`, `scripts/bf2017-textures.test.mjs` (the role map is pure), `public/textures/galaxy/bf2017/<role>/{color,normal,arm}.webp` (and `-sm`), `src/lib/three/core.js` or `surface/ground.js` only where the role's folder is resolved (a world whose `look.js` says `scanned: 'bf2017'` reads the game's roles' folder instead of `public/cc0/galaxy/`), `docs/superpowers/evidence/bf2017-<world>/skies.md` (the level's sky and probe HDRs published for the lighting lane: manifest names, the arena each belongs to, sizes; no loader).

- [ ] **Step 1: Failing tests**: `ROLE_SOURCES` maps every role `galaxy-textures.mjs` defines (snow, sand, rock, redrock, redsoil, metal, tiles, concrete, stone, wood, deck, paint, mud, grass, gravel, leaves, needles, bark, mossrock, adobe, ash, beach) to a game source map (a manifest name under `textures/levels/mp/<world>_01/` terrain or `objects/architecture/<world>/_shared` or `objects/nature/<set>`), found with `bf2017-fetch.mjs --list`; `roleFiles(role, size)` names the three WebPs at the size; no role is left on a `cc0` path.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**: fetch each source's colour and packed maps, unpack, split by the manifest's recipe (phase 0's `bf2017-textures.mjs`), write colour 1024, normal 1024, ARM 512 (and the `-sm` halves) as WebP; wire the folder choice by `look.js`. **Step 4: Run** → PASS; `galaxy-check` on Hoth lists no file under `public/cc0/galaxy/` once Hoth's look says so.
- [ ] **Step 5: Publish the skies as data, not a loader**: list Hoth's sky and probe HDRs from the manifest (`textures/levels/mp/hoth_01/…`), fetch the outdoor arena's, convert to 512×256, 1024×512 and 2048×1024 `.hdr` with `sharp`, place under `public/textures/galaxy/sky/hoth-<size>.hdr`, and write `skies.md` for the lighting lane. Do not wire them into `sky.js` or `scene.js`.
- [ ] **Step 6: Commit** `Hoth's ground and trim on the game's maps; its skies published for the lighting lane`.

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
