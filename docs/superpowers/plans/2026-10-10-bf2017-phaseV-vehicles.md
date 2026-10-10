# Battlefront 2017 pipeline, lane V: the vehicles, in depth. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every ground vehicle, walker, fighter and turret the galaxy shows is the game's, with the game's own rig and clips where it has one (the walkers walk, turn, fire and die as in the game), its cockpit where the site puts the visitor inside, and its far cuts for the fleets and the horizon, within every world's budget row.

**Architecture:** The same import as phases 0 to 2, run with `--parts` over the manifest's vehicle folders, into a lane-owned catalogue group `catalog/bf2017-vehicles.js` (so this lane never edits the file the people lanes write). Rigged walkers go through a generic own-rig loader `src/lib/three/ownRig.js` (this lane writes it; phase 2 reuses it for the droids and beasts) with a clip pack per rig built by `scripts/bf2017-clips.mjs --skeleton`. The site's `WALKERS` (`walkers.js`), the rides, the chase and the space layer's `shipModels.js` take the game's models under their existing rules, with cockpits as a second GLB loaded only when the visitor boards.

**Tech Stack:** phase 0's import and fetch, phase 1's `bf2017-clips.mjs` (`--skeleton` added here if phase 1 has not), three.js, Vitest, `scripts/galaxy-check.mjs`, `scripts/glb-shot.mjs`, `scripts/anim-check.mjs`.

**Spec:** sections 5 (phases 4 and 5), 6, 10 and 11 of `docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md`; the numbers in `docs/superpowers/evidence/bf2017-assets/inventory.md`.

## Global Constraints

- Phases 0 to 2's Global Constraints (keys, caps, the sequel list, the gates, the game first).
- **Files this lane owns**: `src/components/galaxy/surface/catalog/bf2017-vehicles.js`, `src/lib/three/ownRig.js` and its test, `scripts/bf2017-clips.mjs`'s `--skeleton` form, `walkers.js`, `rides` and the chase's model rows, `src/components/universe/shipModels.js`'s galaxy rows, the vehicle rows of `sites/*.js` (`life` and `props` entries naming a vehicle kind), `scripts/fixtures/bf2017/` additions. It does not touch `crew.js`, `walrus*.js`, `actors.js`'s figure order, `saber.js` or `src/lib/net/*`.
- Cuts: a vehicle's plain at the LOD under 25,000 triangles (the AT-AT's LOD2, the X-wing's LOD2), `.lod1` under 7,000, `.far` under 1,000 with 256 maps for the fleets and the horizon; `hero: true` on the walkers and the Falcon (4 MB). Textures per level as section 6. Cockpits: their own GLB under 2 MB at 1024 maps, loaded on boarding only.
- Own-rig packs under 1.5 MB each (AT-ST, AT-AT, AT-TE, AT-RT, AT-M6, droideka); clips at 24 fps, constant channels dropped.
- Every world a vehicle stands on re-measured with `galaxy-check.mjs surface <world>` under `BUDGET=1` at `high` and `low`; the fleet war (`galaxy-check.mjs space`) likewise.

## Review Focus

1. A walker's rig is not humanoid: `rig.js`'s roles do not apply, and the walk cycle's foot planting is the clip's, not `legRig.js`'s; `anim-check` must still see planted feet (the AT-ST's clips carry them), so task 2's loader exposes the feet by the names the row gives.
2. The AT-AT's death clips (`A_ATAT_Stand_Death_*`, with hill variants) and destruction skeletons (`ATAT_Destruction_01_*`): the site's walker battle (`warpieces/hoth.js`, the assault) must play a death when the rules say down, with the tow-cable one on the cable trip; task 4 wires the names.
3. A fighter's cockpit at the wrong origin: the game's cockpit meshes are modelled in the hull's frame, so the seat sits where the hull's cockpit is only if the cockpit GLB keeps the hull's origin (`--keep-origin`); task 3 asserts the cockpit's bounds lie inside the hull's.
4. Instancing the far fleet: sixty-four TIEs as sixty-four skinned or separate meshes would blow the call budget; the `.far` cut has no skin and is drawn through the existing instanced far-fighter path (`HANDOFF-fleet-war.md`), so task 5 keeps it unskinned and tests the cut's draw count.
5. The speeder chase at Endor (`chase.js`) drives the speeder bike with its rider: the game's bike (`74z`) and the rider's `A_HM_SpeederBike_*` clips (humanoid rig) must meet at the bike's seat socket; task 4 measures the seat once and tests the row.

---

### Task 1: The vehicles, mapped

- [ ] **Step 1: Write `docs/superpowers/evidence/bf2017-vehicles/cast.md`**: one row per vehicle kind the site uses (`WALKERS`, the rides, `shipModels.js`'s galaxy rows, the sites' vehicle props, the fleet war's fighters and capital ships) with the game's manifest names: atat ← `gameplay/vehicles/ground/at-at/vehicle_ground_at-at_sp_mesh` (own rig `ATAT_Ske`, 39 clips); atst ← `ground/at-st/…` (`ATST_Ske01`, 69); atte ← `ground/at_te/…` (`AT_TE_Ske`, 41); atrt ← `ground/atrt/…` (`ATRT_Ske`, 31); droideka ← `ground/droideka_01/droideka_01_mesh` (52); aat, mtt, hailfire, homing and dwarf spider droids, stap, barc, speederbike ← `ground/74z/…`, x34 landspeeder, turbo tank; turrets e-web, df9, atgar, mark ii, turbolaser, AA; air: xwing ← `air/xwing_t65/…` + `_cockpit`, ywing, awing, uwing, tiefighter (+ cockpit), tiebomber, tieinterceptor, tieadvanced, falcon ← `air/millenniumfalcon/…` + `_ot_cockpit`, slave1, snowspeeder ← `air/airspeeder/…` + `airspeeder_cockpit` + the tow-cable rope, laat, arc170, n1, vwing, vulture, tri-fighter, hyena, cloud car; capital: imperial cruiser, venator, mc80, cr90, lucrehulk (the fleet war). Each with its tier (ride, walker, prop, fleet) and the worlds it stands on. Check every name with `bf2017-fetch.mjs --list`.
- [ ] **Step 2: Commit** `The vehicles the game replaces, kind by kind`.

### Task 2: The own-rig loader and the walker packs

**Files:** `src/lib/three/ownRig.js`, `ownRig.test.js`; `scripts/bf2017-clips.mjs` (`--skeleton <manifest skeleton path> --pack <name> --names <json map>`), `src/lib/three/rigSets.js` (`RIG_SET(rig)` maps for `atst`, `atat`, `atte`, `atrt`, `atm6`, `droideka`), `rigSets.test.js`; `public/models/galaxy/bf2017/clips-<rig>.glb` ×6.

**Interfaces:** `loadOwnRigFigure(url, { tall, packs, bones: { root, feet: string[] } }) → figure` with the shape `crew.js` returns (`model`, `anim`, `bones`, `play`, `stop`, `base`, `update`, `dispose`, `rig: 'own'`), tracks filtered to bones the body has, a missing name falling back by `CLIP_FALLBACK`. `RIG_SET('atst') = { idle: 'C_ATST_Stand_Idle_01' (or the first idle the pack has), walk: 'C_ATST_Stand_Walk_FWD', 'walk.back': 'C_ATST_Stand_Walk_BWD', 'turn.left': …, 'turn.right': …, fire: …, die: 'A_ATST_…Death…' }`, likewise `atat` (`C_ATAT_Stand_Walk_FWD`, `C_ATAT_Stand_Walk_BWD`, `A_ATAT_Stand_Death_Fwd_01`, `'die.cable': 'A_ATAT_Stand_Death_TowCable_Fwd_01'`), `atte`, `atrt`, `droideka` (`roll`, `deploy`, `fire`, `stagger.*`, `die`).

- [ ] **Step 1: Failing tests**: `RIG_SET('atat')['die.cable']` is the tow-cable death; every value exists in `anims.jsonl` for that skeleton (the test reads a committed excerpt `scripts/fixtures/bf2017/anims-walkers.jsonl` of the six rigs' lines); `loadOwnRigFigure` with an injected loader whose tree lacks `bones.root` rejects naming it; `clipsFor` filters to present bones.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; build the six packs (`node scripts/bf2017-clips.mjs --skeleton 'Gameplay/Vehicles/Ground/AT-AT/ATAT_Ske' --pack atat …`); bytes in the PR. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `A loader for figures on their own rigs, and the walkers' packs from the game's clips`.

### Task 3: The vehicles imported, with cockpits

- [ ] **Step 1: Import** each kind from `cast.md` with `node scripts/bf2017-import.mjs <name> --kind <kind> --as '<as>' --asis --parts '<parts>' --catalog src/components/galaxy/surface/catalog/bf2017-vehicles.js [--rig for the walkers] [--hero for walkers and the Falcon] --far [--ultra for the walkers, the Falcon, the X-wing and the TIE]`; cockpits as `<kind>cockpit` with `--keep-origin`. After each: the sheet, the caps, and for a cockpit a one-line check that its bounds lie inside the hull's.
- [ ] **Step 2: `GROUPS`** gains `bf2017vehicles` after `bf2017` (a one-line change in `catalog/index.js` and the duplicate-kind exemption in `catalog.test.js`, the way `bf2017` was added).
- [ ] **Step 3: Commit** in batches: `The walkers from the game`, `The fighters and their cockpits from the game`, `The speeders, turrets and capital ships from the game`.

### Task 4: The walkers walk, fire and die; the rides and the chase take the game's

**Files:** `walkers.js` (rows point at the own-rig figure and its pack; the cut-at-the-joints walk is retired for a kind with a pack), `warpieces/hoth.js` and the assault's walker rules (play `die` / `die.cable`), `rides` (the snowspeeder, the speeder bike, the AT-ST ride) and `chase.js` (the 74-Z and the rider's `A_HM_SpeederBike_*` clips at the seat socket), `shipModels.js` (galaxy rows).

- [ ] **Step 1: Failing tests** on the pure rules: a walker row with a pack resolves to `own` not `walker`; the assault's "down" event names `die.cable` when the cable tripped it, else `die`; the seat socket row for the 74-Z (`seat: { node, offset }`) measured once and pinned.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement and wire.** **Step 4: Run** → PASS; `anim-check` on Hoth (AT-AT, AT-ST), Endor (AT-ST, speeder bike), Geonosis (AT-TE, droideka), Kashyyyk (AT-RT).
- [ ] **Step 5: Commit** `The walkers walk, fire and fall as in the game; the rides and the chase take the game's vehicles`.

### Task 5: The fleets and the far cuts

- [ ] **Step 1:** the space layer's galaxy ships and the fleet war's fighters take the `.far` and `.lod1` cuts (the instanced far-fighter path unskinned), the `hq/` destroyer and nebulon replaced by the imperial cruiser and the CR90 at `.ultra`; `galaxy-check.mjs space endor,hoth,scarif` under budget at `high`; frame p95 where a GPU is there.
- [ ] **Step 2: Commit** `The fleets fly the game's ships at three distances`.

### Task 6: The cost, the gates, the PR

- [ ] `galaxy-check.mjs surface` under `BUDGET=1` at `high` and `low` on hoth, endor, geonosis, kashyyyk, scarif, tatooine (before and after, in the evidence); the gates; the two regenerated files restored; the lane's section in `docs/superpowers/HANDOFF-bf2017.md` (Done, Left: the vehicles' sounds when audio lands, the destruction skeletons' leftovers if not wired, Checking it); commit, merge `origin/main`, push, PR `Every vehicle the galaxy shows is the game's, walking, flying and falling as in the game`. MERGE per the slot.
