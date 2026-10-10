# Battlefront 2017 pipeline, lane F: effects, lighting and lines. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The galaxy's effects look like the game's (bolts, impacts by surface, saber ignition, clash and trail, the Force push, engine and thruster glow, explosions by vehicle, kicked-up snow and sand), its lighting comes from the game's skies and probes on every world lane W has not yet lit, and the game's sound and lines replace the site's synthesised and generated ones under the same names the moment the audio lands, at a laptop's `high` by default.

**Architecture:** Frostbite's effect graphs do not export, so the site's own effect systems keep their rules and take the game's *look*: a lane-owned `src/lib/three/fx/gameLook.js` resolves an effect name to the game's sprite sheet or mesh (from `textures/fx/` and `fx/*/meshes/` through the import's texture path and a small `--fx` form), with the site's procedural look as the fallback for any the bucket lacks. Lighting reuses lane W's `levelSky.js` for the worlds W has not reached. Sound goes through a `src/lib/sound/gameSounds.js` map from the site's sound names (`sounds.js`, `sfx.js`, `clips.js`) to the game's files, filled in when `data/Sound`'s files arrive, with every name falling back to today's sound until then.

**Tech Stack:** phase 0's import and fetch, lane W's `levelSky.js`, three.js (sprites, `InstancedMesh`, additive materials), the site's `saberFx.js` pattern (`HANDOFF-saber-forms.md`), Vitest, `scripts/galaxy-check.mjs`, `scripts/deathstar-hd-shots.mjs`-style shot scripts.

**Spec:** sections 7, 10 and 11 of `docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md`; `inventory.md` (317 effect meshes, 378 effect textures of which 11 were up at 03:40, 1,892 sky and probe textures, no audio yet).

## Global Constraints

- Phases 0 to 2's Global Constraints (keys, caps, the sequel list, the gates, the game first).
- **Files this lane owns**: `src/lib/three/fx/*`, `src/lib/sound/gameSounds.js`, `surface/saberFx.js` (new, per the saber-forms design, lane A's look), the effect calls in `surface/scene.js` (`fx.sparks`, `saberHit`, the bolt pool's material) and `lib/three/combat/trail.js`, `bolts.js`, `scripts/bf2017-fx.mjs`, `public/models/galaxy/bf2017/fx/`. It does not touch the combat rules (`lib/combat/*`), the loaders, the worlds' kits or lane W's `levelSky.js` (it calls it).
- An effect texture ships as a WebP sprite sheet at 1024 for `high`, 512 below, 2048 on `ultra`, additive where the game's material is; every effect under 256 KB; the whole effect set under 6 MB and loaded once per galaxy visit.
- Effects obey `lib/three/pace`: particle counts scale by tier (a quarter on `low`, half on `mid`); no effect adds a draw call per particle (sprites in one `InstancedMesh` or `Points` per effect).
- The audio map is written now with the game's names left `null`; nothing plays from the game until a file exists in the bucket, and the fallback is always today's sound.

## Review Focus

1. A sprite sheet whose frame grid is not square (`T_Wisties_5x1_01`): the flipbook reads the grid from the name (`_5x1_`) or the manifest, tested in a pure `flipbook.js`.
2. Additive effects under the site's bloom (`saberFx.js`'s threshold 1.7): an effect brighter than the threshold blooms, so the sheets' intensities are calibrated once (task 3's shot compares a bolt's bloom radius before and after).
3. An effect texture the bucket does not have yet (367 of 378 at planning time): `gameLook` returns `null` and the procedural look stands, never a missing-texture magenta; tested.
4. Explosions by vehicle must not spawn a mesh per fragment: the game's debris meshes (`deathstar_debris`, the AT-AT destruction leftovers) are instanced, capped per tier.
5. The sound map's names must be the ones `sounds.js`, `sfx.js` and `clips.js` already use, so a game file drops in without code; the test asserts every key exists in those modules' name lists.

---

### Task 1: The game's look for the site's effects

**Files:** `src/lib/three/fx/gameLook.js`, `gameLook.test.js`, `src/lib/three/fx/flipbook.js`, `flipbook.test.js`, `scripts/bf2017-fx.mjs` (fetches an effect texture or mesh by manifest name, converts to the sheet sizes, writes under `public/models/galaxy/bf2017/fx/` and a `fx.json` of `{ name: { file, grid, additive, bytes } }`).

- [ ] **Step 1: Failing tests**: `gridFromName('T_Wisties_5x1_01') → [5, 1]`, `gridFromName('T_Spark_01') → [1, 1]`; `frameUv(grid, i) → { offset, repeat }`; `gameLook('bolt.red', table)` returns the entry when the table has it and `null` when not.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; fetch what is up (`bf2017-fetch.mjs --list 'textures/fx/*'` for the 11, and recheck the bucket each session: say in the PR how many were up). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `The game's effect sheets as the look of the site's effects, with today's look as the fallback`.

### Task 2: Bolts, impacts, the saber, the Force, engines, explosions

- [ ] **Step 1:** `bolts.js`'s bolt takes the game's bolt sheet by colour (red, green, blue, the ion); impacts by surface (metal, stone, snow, sand, flesh) from the game's impact sheets; `saberFx.js` built per the saber-forms design's lane A with the game's ignition flash, clash sparks and the trail's sheet; the Force push's ring and the repulse; engine glow and thruster trails on the fighters and speeders; explosions per vehicle class with instanced debris; snow and sand kicked up by feet and treads. Each effect keeps its procedural look where the sheet is not up.
- [ ] **Step 2:** shots of each effect at `high` before and after (a dev hook that fires an effect at a named spot: `window.__surface.fx(name)`), under the evidence; `galaxy-check.mjs surface hoth,endor,tatooine` under budget; frame p95 with twenty bolts and two explosions on screen where a GPU is there.
- [ ] **Step 3: Commit** in batches by effect family.

### Task 3: Lighting for the worlds lane W has not reached

- [ ] For each world lane W has not lit by the time this lane reaches it (check `HANDOFF-bf2017.md`): pick the level's outdoor probe, convert, wire through `levelSky.js`, shot before and after. Commit per world: `<World> under the game's sky`.

### Task 4: The sound map, ready for the audio

**Files:** `src/lib/sound/gameSounds.js`, `gameSounds.test.js`, `scripts/bf2017-audio.mjs` (when files exist: fetch, convert to the site's format with the repo's audio tooling, write under `public/audio/galaxy/bf2017/`).

- [ ] **Step 1: Failing tests**: every key of `GAME_SOUNDS` (saber ignite, off, hum, swing, clash by kind; blaster by weapon; impacts; the walkers' footfalls; engines by vehicle; the heroes' lines by `heroes.js` id and situation; the troopers' barks) is a name `sounds.js`, `sfx.js` or `clips.js` uses; `soundFor(name, has)` returns the game file when `has`, else `null`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** with every game name `null` until the bucket has audio; recheck the bucket (`data/Sound` records point at the files' names) and fill what is there. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `A map from the site's sounds and lines to the game's, filled as the audio lands`.

### Task 5: The gates, the PR, the hand-off

- [ ] The gates, the regenerated files restored, the lane's section in `docs/superpowers/HANDOFF-bf2017.md` (Done, Left: the effect sheets still to land and the audio, Checking it: the fx dev hook and the shots), merge `origin/main`, push, PR `The galaxy's effects and lighting take the game's look; its sounds and lines are ready for the game's audio`. MERGE per the slot.
