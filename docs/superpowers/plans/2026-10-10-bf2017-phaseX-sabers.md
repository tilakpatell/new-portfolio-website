# Battlefront 2017 pipeline, lane X: the sabers from the game's clips. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** A 2017 hero's lightsaber combat is the game's: each hero's own strikes in the game's chain with contact windows measured from the game's clips, directional blocks, blocked reactions, staggers, dodges, the dash and the jump attack, both hands and every finger on the hilt from the clip, the blade lighting its wielder; the duellists fence at the game's cadence; nothing a non-2017 figure does changes.

**Architecture:** A script measures each hero's clip set into a stroke table (`src/data/bf2017/strokes/<hero>.json`); a pure `src/components/galaxy/surface/stanceFromTable.js` turns a table into the stance shape `combatRules.js`'s `stanceOf` returns, so `saber.js`, `duellists.js` and `duel.js` run the game's strokes through the interfaces they have (`swing({ clip })`, `strokeFor`). The hold skips the site's guard poses for a `walrus` figure (the clip poses both hands); the blade's geometry comes from the game's rod mesh and each hilt's emitter; a lit blade lights the scene.

**Tech Stack:** phase 1's `walrus.js`, `walrusRig.js`, `walrusClips.js`, the clip packs under `public/models/galaxy/bf2017/`; `scripts/ual-bake.mjs`'s exported `contactWindow` and `rootTravel`; `@gltf-transform/core` to read clips in Node; three.js; Vitest (`saber.test.js`'s headless pattern); `scripts/saber-check.mjs`, `scripts/saber-sheet.mjs` (saber-forms lane 0; if they do not exist on `main`, write `saber-check.mjs` from `surface-shot.mjs`'s prelude).

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-levels-lighting-sabers-design.md` ("The sabers"); the pipeline design's section 7; `docs/superpowers/HANDOFF-saber-forms.md` (the map of `saber.js`, `combatRules.js`, `duellists.js`, `duel.js`: line numbers may have drifted); the clip names in `docs/superpowers/evidence/bf2017-assets/inventory.md` ("A hero's own set").

## Global Constraints

- Phase 0's and phase 1's Global Constraints (keys, the rig whole, the clip files, the gates).
- **Starts from `main` after phase 1 merges** (the heroes on the game's skeleton, the hilts in `Wep_Root`, `walrusClips.js`). Tasks 1 and 2 need only the clips and run before; if phase 1 is not on `main` when the session starts, do tasks 1 and 2, open the PR as a draft, and say so.
- **Files this lane owns**: `scripts/bf2017-strokes.mjs`, `scripts/lib/bf2017-strokes.mjs` (+ test), `src/data/bf2017/strokes/*.json`, `src/components/galaxy/surface/stanceFromTable.js` (+ test), `combatRules.js` (`stanceOf` branches to the table for a 2017 hero: additive), `saber.js` (the `walrus` hold: additive; the blade's geometry from `saberRules.js`'s `BLADE_OF[hilt]`), `saberRules.js` (`BLADE_OF`), `lib/combat/duel.js` (cadence from the table: additive, the constants stay for the rest), `duellists.js` (`duelFor` reads the table), `surface/saberLight.js` (new: the blade's light), `scripts/fixtures/bf2017/web/anims/` (one trimmed strike clip under 40 KB). It does not touch `gunplay.js`, `activity.js`, `lib/combat/blade.js`, the forms (saber-forms B), the Force (D) or dismemberment (E).
- **Nothing a visitor can do is lost**: a Meshy or UAL figure's saber is byte-identical in behaviour (`saber.test.js` and `duellists.test.js` unchanged and green); `STANCE_IDS` unchanged; the walk packet unchanged.
- **The table is data**: a stroke's `contact` is measured, never typed; `dir` is read from the tip's path; the chain is the game's order; a hero whose set lacks a block or a dodge falls back within the table (the generic `A_HM_*` set), never to a UAL clip.
- Files under 800 lines; pure logic tested; the gates.

## Review Focus

1. **The contact window on the game's rig**: `ual-bake.mjs`'s `contactWindow` reads the right fist's tip on Meshy's bones; here the blade's tip is `Wep_Root` plus the blade's length along the hilt's axis (phase 1's measured socket frame). A window measured on the wrong axis lands every stroke early; the fixture clip's window is checked by hand once (the frames where the hand is fastest) and pinned.
2. **Strikes that travel**: `distance` in `anims.jsonl` is the root's travel; a strike with 1.2 m of travel must step the figure (`saber.js`'s `rootAt` from the clip's `root` extras); the table carries `root` rows the way `ual-bake` writes them so the existing code reads them.
3. **A `_BackToIdle` is not a stroke**: it is the return, played by `saber.js` after the strike when the chain is not continued; the table marks it `return` and `stanceFromTable` never lists it as a strike; a strike's `cancel` window is the return's first 0.05 s (`CANCEL` stays).
4. **Blocks by direction**: `Stand_Block_SwingLeft_01..04` and `SwingRight` are the hero turning a stroke aside; the incoming stroke's `dir` chooses left or right; the site's `BLOCK_CLIP` path keeps its hold at `BLOCK_AT`; a hero with no directional block (Luke has `Block_Stagger` only) blocks with it.
5. **The blade's light under bloom**: a `PointLight` at the blade's middle, colour the blade's, intensity by tier, within 12 m, off on low and mid; it must not double the bloom (the blade's emissive is `toneMapped: false`); `saber-check` shoots ignite and clash before and after, and the frame time with four lit blades is in the PR.

---

### Task 1: The stroke tables

**Files:**
- Create: `scripts/bf2017-strokes.mjs`, `scripts/lib/bf2017-strokes.mjs` (+ test), `src/data/bf2017/strokes/luke.json` (then vader, obiwan, anakin, maul, dooku, yoda, grievous, palpatine), the fixture clip

**Interfaces:**
- Produces:
  - `classify(name) → { hero, kind: 'strike' | 'return' | 'block' | 'blocked' | 'stagger' | 'dodge' | 'dash' | 'jump' | 'force' | 'defeat' | 'locomotion' | 'other', index, variant, dir? }` (pure, from the clip's name: `A_Luke_AttackLoop_Strike3_V2_BackToIdle` → `{ hero: 'luke', kind: 'return', index: 3, variant: 2 }`).
  - `measure(clip, rig) → { duration, contact: [t0, t1], dir, plane, root: rows, tipPath }` with the tip on `Wep_Root` along the socket's axis.
  - `tableFor(hero, clips) → { hero, strikes: [{ name, index, variant, duration, contact, dir, root, return: name }], blocks: { left, right, any }, blocked: [name × 6], staggers: { front: [], back: [] }, dodges: { back, front, left, right }, dash, jump, defeat, idle }` with the generic humanoid's names filled where the hero's set lacks one.
  - CLI `node scripts/bf2017-strokes.mjs <hero> [--list]`: fetches the hero's `A_<Hero>_*` clips (the manifest's `web/anims.jsonl`; `--list` prints what the bucket has), measures, writes the table, prints it.

- [ ] **Step 1: Failing tests**: `classify` on twelve names from the inventory; `measure` on the fixture clip gives the pinned window and a `dir` in `DIRS`; `tableFor` fills a missing block from the generic set and never names a UAL clip.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; run for Luke and Vader; put Luke's table in the PR.
- [ ] **Step 5: Commit** `Stroke tables measured from the game's clips: strikes, returns, blocks, reactions`.

### Task 2: The stance from the table

**Files:**
- Create: `src/components/galaxy/surface/stanceFromTable.js` (+ test)
- Modify: `combatRules.js` (`stanceOf(id, hero)` returns `stanceFromTable(table)` when `hero.rig === 'walrus'` and a table exists), `lib/combat/duel.js` (`DUEL` cadence from `table.strikes` durations and returns when given), `duellists.js` (`duelFor` passes the table)

- [ ] **Step 1: Failing tests**: `stanceFromTable(luke)` has the stance shape `STANCES` entries have (every field the saber reads), six light strikes in the game's order with their contact windows, the heavies from `jump` and `dash`, the block names; `strokeFor` on that stance returns the game's names; the duel's punish window equals the chosen return's duration; `saber.test.js` and `duellists.test.js` still pass unchanged.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `A 2017 hero's stance is the game's strike chain; the duel keeps its cadence`.

### Task 3: The hold, the blade, the light (after phase 1)

**Files:**
- Modify: `saber.js` (`walrus`: skip `pose`/`poseLeft`, the arms laid from the clip with `Spine1`, `Spine2`, `Neck` in `ARMS`; the blade's base and length from `BLADE_OF`), `saberRules.js` (`BLADE_OF[hilt] = { base: [x, y, z] in the hilt's frame, length, radius }` measured from the game's rod and each hilt's emitter by `scripts/bf2017-strokes.mjs --blade`)
- Create: `surface/saberLight.js` (+ test): `createSaberLight({ scene, color, tier }) → { update(base, tip, lit), dispose }`

- [ ] **Step 1: Failing tests**: a `walrus` figure's guard leaves the clip's hand transforms untouched (a fake figure with recorded bone quaternions); `BLADE_OF.luke.length` is within 10% of the rod mesh's; the light is made on high, not on mid, and follows the blade's middle.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: See it**: Luke on Tatooine lit, swinging through the six strikes (`__surfaceScene.swing`), a duel with Vader on Dagobah (`HANDOFF-saber-forms.md`'s "How to check"); `anim-check` the fight; `saber-check` ignite, stroke, block, clash; frame time with four lit blades; into `docs/superpowers/evidence/bf2017-sabers/`.
- [ ] **Step 6: Commit** `The hilt in the game's hands, the blade from the game's rod, lighting the one who holds it`.

### Task 4: The PR, the hand-off

- [ ] The gates, the regenerated files restored, the lane's section in `docs/superpowers/HANDOFF-bf2017.md` (Done; Left: the forms lane reads the tables (saber-forms B), the clash sheet (lane F), the sounds (an exporter); Checking it), a line in `HANDOFF-saber-forms.md`'s status table pointing here, merge `origin/main`, push, PR `Lightsabers from the game's clips: each hero's strikes, blocks and reactions, the hilt in both hands, the blade's light`. MERGE per the slot.
