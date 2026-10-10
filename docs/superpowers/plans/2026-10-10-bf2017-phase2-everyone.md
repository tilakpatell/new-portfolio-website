# Battlefront 2017 pipeline, phase 2: everyone the game has, and the cost of it. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every person, droid and beast the seventeen worlds place that the 2017 game has is the game's figure, on the game's skeleton and the game's clips, at a per-world cost the site's budgets hold at every quality level, with the compression settled by measurement rather than guessed.

**Architecture:** The same pipeline as phase 1 (import, packs, the walrus loader) run over the audit's kinds, plus three things that make a cast of this size affordable: one shared humanoid clip pack loaded once per world and hero packs loaded only when a hero is picked or a duellist spawns; the game's own far LODs as each kind's `.lod1` and a new `.far` cut for the assault's distant squads; and a texture mix per quality level chosen by a measured rule (colour and packed maps as WebP, normals as WebP below ultra and KTX2 at ultra, since the KTX2 normal is ten times the WebP's bytes). `scripts/galaxy-figures-audit.mjs` gains an `EXPECTED` row per kind moved so nothing slips back.

**Tech Stack:** phases 0 and 1; `scripts/galaxy-figures-audit.mjs`; `scripts/galaxy-check.mjs` with `BUDGET=1`; `scripts/anim-check.mjs`; `scripts/ktx2.mjs`'s `verdict`.

**Spec:** `docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md` (section 5 phases 2 and 3; section 6 as revised with this plan's numbers). Inputs measured in this plan's writing (2026-10-10, 03:10): `docs/superpowers/evidence/bf2017-assets/inventory.md`, "Costs measured".

## Global Constraints

- Everything in phases 0 and 1's Global Constraints: the rig whole, the game's clips only, no sequel era, the caps, the gates.
- **Per-world budgets do not move** (`src/lib/budgets.js`): low 0.8M triangles, 350 calls, 20 MB of models; mid 1.5M, 500, 40 MB; high 3M, 700, 60 MB; ultra 1,500 calls, 240 MB. `galaxy-check.mjs surface <world>` with `BUDGET=1` at `QUALITY=high` and `QUALITY=low` on every world this phase touches, before and after, and the PR carries both tables. Endor stays held to its own baseline (`galaxy-budget.mjs`'s `KNOWN_OVER`).
- **Texture mix per level** (measured on Luke's six maps, `inventory.md` "Costs measured"; the import's `--tex`/`--maps` and the `.lod1` halving give it): low colour 512 WebP, others 256 WebP; mid colour 1024, ORM 512, normal 512 WebP; high colour 1024, ORM 512, normal 1024 WebP; ultra (`.ultra` only) colour 2048 WebP, normal 2048 KTX2 UASTC. A normal goes KTX2 below ultra only where `verdict` says `convert` (it will not: the WebP is a tenth of the bytes).
- **A kind's files**: plain at the LOD with ≤ 8,000 triangles, `.lod1` at the LOD with ≤ 1,500 triangles (the game's LOD4, not LOD3: a soldier at forty metres needs no more), and, for the kinds the assaults field, `.far` at the last LOD (≤ 700 triangles) with 256 maps. Caps: plain under 2.5 MB (people are not `hero`), `.lod1` under 0.7× the plain, `.far` under 150 KB.
- **Packs**: `clips-humanoid.glb` under 3 MB, loaded once per world when the first 2017 person is near; a hero pack under 2.5 MB, loaded when its hero is picked or spawns, never on world load. A clip ships channels only for bones that carry weight or are sockets (`Camera*`, `Traj*`, `Connect*`, `AITrajectory`, `Reference` channels dropped: nothing in the site reads them), constant channels dropped, combat clips at 30 fps, locomotion at 24, idles and ambient at 15.
- The kind names the worlds use (`sites/*.js` `life`, `ground/troops.js` `TROOPS`, `missions/assaults.js` sides) do not change: a 2017 figure takes over a kind by name, the way `battlefront.js` took over the 2005 kinds.

## Review Focus

1. A world that places thirty of one kind (Hoth's assault: 14 soldiers a side at high): one skinned mesh per figure is thirty draw calls per material; a kind imported with its parts joined per material (`join` on the skinned primitives that share a material) keeps a trooper at two or three calls. Task 2 asserts the call count of each kind's plain file.
2. The humanoid pack must not load for a world with no 2017 person (the Mandalorian worlds): task 4's loader test with a world that never calls `loadWalrusFigure` fetches nothing.
3. A kind whose body has no `IK_Joint_RightHand` or `Wep_Root` (a droid on its own rig, a creature): the walrus loader must refuse it, and the own-rig loader (task 5) take it, never a silent bind pose. `checkWalrus` already says which; task 5's test pins the hand-over. If PR #781 (Rapier body, hurtboxes from bone names) has merged, every 2017 kind needs `HURTBOX_REGIONS` (phase 1's `walrusRig.js`) and each own rig its own region map, or a hostile cannot be hit: task 5 adds the maps and a test that every own-rig kind has one.
4. The `.far` cut at 700 triangles has no fingers to speak of and a 256 map: it must never be the cut drawn within the `near` distance of the level (`budgets.js`'s `near`, 30 to 110 m). Task 3's `wantsLod`-style helper is tested on the three distances.
5. Memory, not bytes: 102 kinds × plain-file textures could reach the 256 MB desktop contract if a world placed them all; no world does (Tatooine places the most, 19 kinds). Task 6 records `renderer.info.memory.textures` per world at high in the evidence and the PR, and the contract (60 textures, 256 MB desktop, 128 MB phone) holds.

---

### Task 1: The cast, mapped (a half-day, no code)

**Files:**
- Create: `docs/superpowers/evidence/bf2017-phase2/cast.md`
- Modify: `scripts/galaxy-figures-audit.mjs` (`EXPECTED` rows, task 7)

The audit (`node scripts/galaxy-figures-audit.mjs`) lists 102 kinds. Write `cast.md`: one row per kind with the game's manifest name(s) it takes, or "stays" with why. Start from this mapping, check each name against `lab/assets/bf2017/web/models.jsonl` (`node scripts/bf2017-fetch.mjs --list 'characters/…'`), and fix what the manifest says differently:

| kind (today) | the game's body (`characters/…`) | notes |
| --- | --- | --- |
| stormtrooper (crew, 2005) | `imperial/imperial_stormtrooper/imperial_stormtrooper_male_01/imperial_stormtrooper_male_01_fullbody_mesh` | the shadowtrooper beside it is a new kind, `shadowtrooper`, for the Death Star interior's cast |
| sandtrooper | `dark/d_heavy_orig/d_heavy_orig_mos_01/d_heavy_orig_mos_01_mesh` | `mos` is Mos Eisley |
| snowtrooper | `dark/d_assault_orig/d_assault_orig_ho_01/d_assault_orig_ho_01_mesh` + `_helmet_mesh` + `_cape_mesh` | `ho` is Hoth |
| scouttrooper | `imperial/imperial_scoutrooper/imperial_scoutrooper_male_01/imperial_scoutrooper_male_01_mesh` | |
| shoretrooper | `imperial/imperial_beachtrooper/imperial_beachtrooper_mesh` | or `dark/d_heavy_orig/d_heavy_orig_beachtrooper_01`: compare on the sheet |
| deathtrooper | `hero/deathtrooper/deathtrooper_01/deathtrooper_01_mesh` | |
| hothtrooper, rebel | `light/l_assault_orig/…`: the Hoth outfit (`_ho_`) for hothtrooper, `l_assault_orig_pathfinder_01` (Endor) and `l_assault_orig_ds_01` for rebel | list the folder; Yavin's is `light/l_heavy_orig/l_heavy_orig_ya_01` |
| clone | `light/l_assault_preq/l_assault_preq_01/l_assault_preq_01_mesh` + one of the four helmets (`_01`..`_04`, the legions) | the four helmets make four clone kinds for Kamino, Kashyyyk, Geonosis, Coruscant |
| clonephase1 (legs) | `npc/humans/rebel_clonetrooper/rebel_clonetrooper_kam_01_mesh` | Kamino's phase I |
| battledroid (crew, 2005) | `dark/d_assault_preq/d_assault_preq_01/d_assault_preq_01_mesh` + `_backpack_mesh` | own rig `D_Assault_Preq_01_Ske`, 532 clips: task 5 |
| superdroid | `hero/b2/b2_01/b2_01_mesh` | own rig, 337 clips: task 5 |
| droideka, dwarfspider | `gameplay/vehicles/ground/droideka_01/droideka_01_mesh`, `…/dwarfspiderdroid/…` | own rigs; droideka 52 clips |
| villager (built, nine worlds), farmer, caretaker, jocasta, zam | `npc/humans/civ_moseisley/civ_moseisley_0{1,2,3}`, `npc/humans/civ_theed/civ_theed_0{1,2}`, and the modular `civ_vardos` set (coats, robes, pants, hats, boots on the shared body) | the villager becomes a pool: the world's `look` picks desert, Theed or Vardos; `actors.js`'s seed picks the variant |
| kenobi (built) | phase 1's `kenobi` | already shipped |
| Hoth's named people, if PR #795 (another account's, Meshy-made: `lukehoth`, `hanhoth`, `leiahoth`, `veers`, `rieekan`, `torynfarr`, `twoonebee`, `astromech2`, `astromech3`) has merged | `hero/luke/luke_hoth_01/…` (+ helmet, gloves, scarf), `hero/hansolo/hansolo_hoth_01/…` (+ helmet, skirt), `hero/leia/leia_01` in the Hoth outfit if the manifest has one (else `leia_01`), `dark/d_officer_orig/…` for Veers with `heads/…`, `npc/humans/rebel_personnel/rebel_personnel_orig_ds_01` for Rieekan and Toryn Farr with a head each, `npc/droids/astromech/r2d2_01` and `r5d4_01` for the astromechs; 2-1B stays (the game has no medical droid) | the kind names stay as the world names them; the Meshy files are replaced under the same rows (`rig: 'walrus'`) |
| rebelpilot (own clips, Mixamo) | `npc/humans/rebel_pilot/rebel_pilot_male_02_mesh` | |
| rebeltech | `npc/humans/rebel_technician_orig/rebel_technician_orig_01/rebel_technician_orig_01_mesh` | |
| imperial officer kinds (`wingguard`, `senateguard` stay; add `officer`, `navycrewman`, `admiral`, `personnel`) | `dark/d_officer_orig/d_officer_orig_01/d_officer_orig_01_parts_mesh`, `hero/imperialofficer/imperialofficer_01_mesh`, `dark/d_navycrewman_orig/…`, `npc/humans/sp_imperial_admiral_orig/sp_imperial_admiral_orig_01_mesh`, `npc/humans/imperial_personnel/imperial_personnel_orig_ds_01/…` | for the Death Star interior's cast (`inside/pack.js`) and Scarif |
| astromech, r5, droid (built) | `npc/droids/astromech/r2d2/r2d2_01_mesh`, `…/r5d4/r5d4_01_mesh`, `…/r4i9/…` | own rig `Astromech_01_Ske` |
| mousedroid | `npc/droids/mouse_01/mouse_01_mesh` | |
| probe | `npc/droids/viper_01/viper_01_mesh` | own rig |
| c3po (own clips, Mixamo) | `npc/droids/protocoldroid/protocoldroid_01_mesh` | walrus rig? check `skeleton` in the manifest |
| gonk (add), interrogation droid (add, for the Death Star inside) | `npc/droids/droidgonk/droidgonk_01/droidgonk_01_mesh`, `npc/droids/interrogationdroid_01/interrogationdroid_01_mesh` | |
| ewok (legs) | `npc/creatures/ewok/ewok_01/ewok_01_mesh` + `_fur_mesh` + `_hood_mesh` | own rig, 77 clips: task 5 |
| jawa (still) | `npc/creatures/jawa/jawa_01/jawa_01_mesh` | own rig |
| kaminoan (legs) | `npc/creatures/kaminoan/kaminoan_01/kaminoan_01_mesh` | |
| gamorrean | `npc/aliens/gamorreanguard/gamorreanguard_01/lw_gamorreanguard_01_mesh` | |
| bith | `npc/aliens/bith/bith_01/bith_01_mesh` + an instrument | |
| wookiee | `hero/wookiewarrior/wookiewarrior_01/wookiewarrior_01_mesh` + `_haircards_cloth_mesh` | |
| tauntaun, dewback, bantha, eopie, ronto | `npc/creatures/<name>/<name>_01/<name>_01_mesh` (+ `_saddle_mesh`) | own rigs; tauntaun 44 clips, the rest statues until theirs show |
| aiwha | `npc/creatures/aiwha/…` | |
| **stay** (the game lacks them) | ahsoka, mando, dindjarin, armorer, grogu, the Rogue One five (jyn, cassian, k2so, baze, chirrut, krennic), mace, quigon, jango, tusken, twilek, aqualish, ugnaught, lobot, bibfortuna, greedo, wuher, neimoidian, mustafarian, dex, hutt, wampa, rancor, acklay, reek, nexu, kaadu, fambaa, blurrg, lothcat, lothwolf, bogwing, lavaflea, happabore, geonosian, gungan, sullustan, ithorian, ig11, cloudcar, the walkers (phase 4) | their Meshy, Sketchfab or built figures stay as they are |

- [ ] **Step 1: Write `cast.md`** as above, every name checked, with the kind's worlds from the audit and its tier (duellist, soldier, civilian, droid, beast) so the packs and cuts follow.
- [ ] **Step 2: Commit** `The cast the game can replace, kind by kind`.

### Task 2: The soldiers and civilians, imported, at the measured cost

**Files:**
- Create: `public/models/galaxy/crew/<kind>.glb` and `.lod1.glb` (and `.far.glb` for the assault kinds) for every walrus-rig kind in `cast.md`; `docs/superpowers/evidence/bf2017-phase2/` sheets
- Modify: `scripts/bf2017-import.mjs` (`--far` writes the last-LOD cut with 256 maps; `--join` joins skinned primitives per material), `scripts/bf2017-import.test.mjs`, `crewList.js` (rows with `rig: 'walrus'`, `tall`, `far: true` where written), `catalog.test.js` (the `.far` file's cap and that every `.far` on disk has `far: true`)

- [ ] **Step 1: Failing tests** for the import's two flags: on the hilt fixture `--far` writes `<kind>.far.glb` under 150 KB with 256 maps; `--join` on a two-material fixture (make one in the test from the hilt by cloning its primitive with a second material) leaves two primitives, and on a three-primitive, two-material fixture leaves two.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Import the cast**, one command per kind from `cast.md` with `--rig --crew --join --metres <TROOPS[kind].tall or the row's tall>`, `--far` for the kinds in `assaults.js`'s sides and `TROOPS`. After each: `skins.length === 1`, `checkWalrus` ok, draw calls (primitives) ≤ 4, bytes under the caps. Sheets for every kind beside the figure it replaces.
- [ ] **Step 6: The villager pool**: three Mos Eisley, two Theed and three Vardos civilians as kinds `civdesert1..3`, `civtheed1..2`, `civcity1..3`; `actors.js`'s resolver maps `villager`, `farmer`, `caretaker`, `jocasta`, `zam` to a pool by the site's `look` (a pure `poolFor(kind, look, seed) → kind` in a new `surface/pools.js`, tested: desert worlds get `civdesert*`, Naboo `civtheed*`, Coruscant and Bespin `civcity*`, a world with no pool keeps the built figure).
- [ ] **Step 7: Commit** in batches by world: `Hoth's and Endor's soldiers from the game`, `The Republic, the Separatists and the civilians from the game`, and so on.

### Task 3: The far cut and when it is drawn

**Files:**
- Create: `src/components/galaxy/surface/farCut.js`, `farCut.test.js`
- Modify: `src/components/galaxy/surface/catalog/index.js` (`surfaceFarUrl`), `actors.js:268` and `placer.js` (where `lodUrlFor` is asked: ask `farUrlFor` beyond the level's `mid` distance), `ground/*.js` (the assault's far squads take the far cut from the start)

**Interfaces:**
- Produces: `cutFor(distance, level: { near, mid }, { hasLod, hasFar }) → 'plain' | 'lod1' | 'far'` (pure): `plain` within `near`, `lod1` within `mid` when it exists, `far` beyond `mid` when it exists, else the nearest that exists. `surfaceFarUrl(kind) → '/models/galaxy/crew/<kind>.far.glb'`.

- [ ] **Step 1: Failing tests**: `cutFor(20, { near: 70, mid: 220 }, { hasLod: true, hasFar: true })` → `'plain'`; `cutFor(100, …)` → `'lod1'`; `cutFor(300, …)` → `'far'`; `cutFor(300, …, { hasLod: true, hasFar: false })` → `'lod1'`; `cutFor(300, …, { hasLod: false, hasFar: false })` → `'plain'`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement and wire.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `A far cut for the squads at the edge of the fog`.

### Task 4: The packs that load when needed, and not before

**Files:**
- Modify: `src/lib/three/walrus.js` (`loadWalrusPacks` is lazy per url, shared per page; a figure's `packs` from its row), `crew.js` (the row's `packs`), `heroes.js` (a hero's `packs`), `scene.js:679-696` (the picked hero's pack loads with the hero; the duellist's with the duellist)
- Create: `src/lib/three/walrusPacks.test.js`

- [ ] **Step 1: Failing tests**: with an injected loader, `loadWalrusPacks(['a', 'b'])` twice calls the loader twice in all (cached); `loadWalrusPacks(['a'])` then `loadWalrusPacks(['a', 'c'])` calls it once more, for `c`; a figure loaded with `packs: []` plays nothing and does not throw (it stands at rest, which `anim-check` would catch: the test asserts `figure.anim === null`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Measure**: open Hoth at high and read the network panel (or `galaxy-check.mjs`'s bytes): the humanoid pack once, no hero pack until a hero is picked; put the numbers in the PR.
- [ ] **Step 6: Commit** `The game's clip packs load once per world, and a hero's only with the hero`.

### Task 5: The own-rig cast: B1, B2, droideka, ewok, astromech, probe, tauntaun

*Lane V (`-phaseV-vehicles.md`, task 2) writes `src/lib/three/ownRig.js` and the `--skeleton` form of `bf2017-clips.mjs` for the walkers; if it has merged by the time this task runs, reuse them and add the rigs below to `rigSets.js`; if not, write them here and lane V reuses yours. Merge main first and look.*

**Files:**
- Create: `src/lib/three/ownRig.js`, `ownRig.test.js`, `public/models/galaxy/bf2017/clips-<rig>.glb` per rig (`b1`, `b2`, `droideka`, `ewok`, `astromech`, `tauntaun`), the bodies under `crew/`
- Modify: `scripts/bf2017-clips.mjs` (a pack for a named skeleton other than the walrus: `--skeleton <manifest skeleton path>`, the map for it in `walrusClips.js`'s `PACKS` as `RIG_SET(rig)`), `crew.js` (`rig: 'own'` rows with `skeleton` and `packs` go through `ownRig.js`)

**Interfaces:**
- Produces: `loadOwnRigFigure(url, { tall, packs, bones: { hips, head, feet } })`: the walrus loader's shape without the walrus check: bones found by `rig.js`'s `findBones` where its roles match, else by the names the row gives; clips from the rig's pack by name with the same track filter and fallback. `RIG_SET('b1')` maps `idle`, `walk`, `run`, `die.*`, `hit.*`, `aim.rifle`, `shoot.rifle` to the B1's clip names (`anims.jsonl`, skeleton `D_Assault_Preq_01_Ske`, 532 clips), likewise `b2`, `droideka` (roll, deploy, fire), `ewok`, `astromech`, `tauntaun` (idle, walk, run, with a rider from the `A_TauntaunRider_*` walrus clips in phase 3's rider work).

- [ ] **Step 1: Failing tests**: `RIG_SET('b1')` has every key `HUMANOID_SET` has for a soldier (`idle`, `walk`, `run`, `die.fwd`, `die.back`, `hit.chest`, `aim.rifle`, `shoot.rifle`); `loadOwnRigFigure` with an injected loader whose tree lacks the row's `hips` name rejects naming it; `crew.js`'s `figureLoaderFor({ rig: 'own' })` → `'own'`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**, build the six packs, import the bodies (`--rig --crew --no-walrus-check`). **Step 4: Run** → PASS; `anim-check` on Geonosis (B1, B2, droideka), Endor (ewok), Hoth (tauntaun, probe).
- [ ] **Step 5: Commit** `The droids, the Ewok and the tauntaun on their own rigs and the game's clips`.

### Task 6: The cost, measured, and the compression settled

**Files:**
- Create: `docs/superpowers/evidence/bf2017-phase2/costs.md`
- Modify: `docs/superpowers/evidence/bf2017-assets/inventory.md` ("Costs measured": correct any number this plan's writing got wrong), `src/components/worlds/worlds.js` (`WORLD_MB['/galaxy']`)

- [ ] **Step 1: Verify the texture rule** on three kinds (a trooper, a civilian, a droid): for each normal map, `node scripts/ktx2.mjs report <png>` at 1024; record `verdict`. Expected: `keep` (WebP) below ultra for all three; if one says `convert`, ship it as KTX2 and say so.
- [ ] **Step 2: Verify the clip rule** on the humanoid pack: bytes with and without the dropped channels, at 30/24/15 fps by class; the pack under 3 MB; if not, say which clips are dropped from the generic pack (an `AI_Officer_*` patrol set can go) and keep the cap.
- [ ] **Step 3: `galaxy-check.mjs surface` with `BUDGET=1`** at `QUALITY=high` and `QUALITY=low` on every world touched (hoth, endor, tatooine, yavin, naboo, kamino, geonosis, coruscant, scarif, bespin, kashyyyk, mustafar, dagobah): triangles, calls, model bytes, `renderer.info.memory.textures`, frame p95 where a GPU is there; before (main) and after. Every row under its budget, or the PR says which kind's count the world lowers to get there (`sites/*.js` `life` counts), never the budget.
- [ ] **Step 4: `anim-check.mjs --limit 0.15 --strict`** on the same worlds.
- [ ] **Step 5: Write `costs.md`** (the tables) and update `WORLD_MB`, with the before and after in the commit.
- [ ] **Step 6: Commit** `The cast's cost, measured on every world, within budget`.

### Task 7: The audit holds, the PR, the hand-off

- [ ] **Step 1: `EXPECTED` rows** in `scripts/galaxy-figures-audit.mjs` for every kind moved (`crew` on the walrus or own rig), so `node scripts/galaxy-figures-audit.mjs` exits 1 if one slips back to `still`, `built` or `legs`. Run it: green.
- [ ] **Step 2: Gates**: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`; restore the two regenerated files.
- [ ] **Step 3: Hand-off** `docs/superpowers/HANDOFF-bf2017.md`: Done (phases 0 to 2), Left (phase 3's beasts' own-rig packs; the kinds that stay and why; the Death Star interior's cast swap, which is its own lane since `inside/pack.js` lists its models), Checking it (the audit, the two checks, the budgets' before/after).
- [ ] **Step 4: Commit, merge `origin/main`, push, PR** titled `Everyone the game has: the galaxy's soldiers, civilians, droids and beasts from Battlefront II (2017), within budget`, body with the cast table, the cost tables and the sheets. MERGE per the session's slot.
