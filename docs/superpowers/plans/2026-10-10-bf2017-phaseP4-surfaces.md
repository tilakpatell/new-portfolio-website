# Battlefront 2017 physics, lane P4: surfaces. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** What a bolt, a foot or a wheel does on a surface depends on what the surface is, as the game’s material grid says: snow puffs, metal sparks, sand kicks up, a print stays in the snow; and the shapes’ friction and restitution come from the same grid.

**Architecture:** A builder reads a level’s `MaterialGridData` into `materials.json` for the material indices the level’s shapes use: the physics properties, and for each pair the effect, sound, decal and footprint names. A pure `materials.js` answers what a hit on a tagged collider is. The surface’s effects pick by that answer.

**Tech Stack:** Node 22, Vitest, lane 0’s parser when on `main`, the surface’s `fx.js`, `marks.js`, `blaster.js`.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-physics-design.md` (§5, §7, §8; “Departures” 3).

## Global Constraints

- Phase 0’s, P0’s and P1’s Global Constraints. The grids: `data/levels/mp/<level>/<level>/materialgrid_win32.json.gz` (Hoth’s is 2.2 MB; the fixture is a cut of its root, the `MaterialProperties` entries for four indices and six pairs, under 40 KB).
- **Files this lane owns**: `scripts/lib/bf2017-materials.mjs` (+ test), `src/data/bf2017/physics/materials.json` (Hoth’s, keyed by level; other levels appended by their lanes), `src/lib/physics/materials.js` (+ test), the effect pick in `src/components/galaxy/surface/fx.js` and `blaster.js` (a `material` on the hit event picks the puff), `marks.js` (a print kind by material). It does not touch `walker.js`, the sites, or lane P0’s files beyond reading the collider `tag`.
- The material name column is hand (from the pairs’ effect names) and says so; the index is the key.
- Files under 800 lines; British spelling and curly quotes; commits one plain sentence with the attribution lines; merge commits; the gates before the PR.

## Review Focus

1. **The packed index**: a shape’s material slot carries `materialIndex` already (lane P0 writes it as the collider `tag`); the grid’s `MaterialProperties[i]` is indexed by that number through the grid’s index map when it has one, else directly; the test asserts index 14 (Hoth’s most used after 0) resolves to the entry whose pair with the blaster material names a snow or ice effect, and says in `NOTES.md` which it was.
2. **A pair not in the grid** falls back to the default material’s pair, then to the site’s generic puff; never `undefined` in an effect name.
3. **Speed bands**: `ImpactEffects[]` has `MinSpeed`/`MaxSpeed`; a bolt at 700 m/s and a thrown grenade at 15 m/s may pick different effects; the test asserts the band.

---

### Task 1: The builder and the rulebook

- [ ] `materialRulebook(asset, usedIndices) → { level, default, materials: { <i>: { name (hand), friction, restitution, penetration } }, pairs: { "a,b": { effects: [{ min, max, effect }], sound, decal, exitDecal, footprint, terrainDestruction } } }`; tests on the fixture (Review Focus 1 to 3); build Hoth’s from the fetched grid with the indices lane P0’s pack lists (or `physics.jsonl`’s for Hoth’s meshes until then). Commit `The material grid as a rulebook: what a hit on each surface is`.

### Task 2: `materials.js`

- [ ] `materialOf(book, tag)`, `impactOf(book, { tag, speed, by = 'blaster' }) → { effect, sound, decal }`, `footprintOf(book, tag)`, `frictionOf(book, tag) → { friction, restitution }`; tests. Commit `A tagged collider says what it is made of`.

### Task 3: The surface picks by material

- [ ] `blaster.js`/`boltPlay.js`: a `solid` event on a physics world carries the collider’s `tag`; `fx.js`’s impact picks `snow` | `metal` | `sand` | `rock` | `wood` | `generic` by `impactOf`’s effect name family (a small map in `materials.js`, hand); `marks.js` leaves a print kind by `footprintOf` under the player’s feet on snow and sand; `physics-check.mjs` gains a shot at the hangar wall (metal) and the snow (snow) and records the pick. Evidence into `docs/superpowers/evidence/bf2017-physics/p4/`. Commit `A bolt on snow puffs, on metal sparks: the surface says which`.

### Task 4: The PR and the hand-off

- [ ] The gates; the lane’s section in `docs/superpowers/HANDOFF-bf2017-physics.md` (Done; Left: the other levels’ grids as their worlds land; the game’s own effect blueprints when lane F ships them); merge `origin/main`, push, PR `Surfaces from the game’s material grid: effects, sounds, decals and prints by what was hit`. Merge per the slot.
