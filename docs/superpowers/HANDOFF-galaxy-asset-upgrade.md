# Handoff: the galaxy's people and props, upgraded and rigged (five phases, one branch each)

Every person on the seventeen Star Wars worlds moves; the assets repo (`tilakpatell/tilakverse-assets`) becomes a source the scripts read; Endor comes under budget. Read these first, in this order:

1. `docs/superpowers/specs/2026-10-08-galaxy-asset-upgrade-design.md` (what and why; the table of how every life kind is drawn today; the decisions; what it is not)
2. `docs/superpowers/plans/2026-10-08-galaxy-asset-upgrade.md` (your phase's tasks: files, interfaces, tests)
3. `docs/superpowers/HANDOFF-galaxy-surfaces.md` (the surfaces' rules: no sequels, the engine's shape) and `docs/assets/quaternius.md` (the packs)
4. The headers of `scripts/ual-bake.mjs`, `scripts/preview/ualRetarget.js`, `scripts/rig-transfer.mjs`, `src/components/galaxy/surface/legRig.js`, `actors.js` (`figureFor`, `modelFigureOf`) and `src/lib/three/rig.js`

## Which phase is yours

| Phase | Branch | Tasks | Starts from | Blocked by |
|---|---|---|---|---|
| 1: the audit; statues walk | `claude/galaxy-asset-upgrade-p1` | 1, 2 | `main` (merge `claude/galaxy-asset-upgrade-design` in first, or cherry-pick its one commit) | nothing |
| 2: the assets source; the retarget for any skeleton | `claude/galaxy-asset-upgrade-p2` | 3–7 | `main` after 1 | 1 |
| 3: the B1 battle droid | `claude/galaxy-asset-upgrade-p3` | 8 | `main` after 2 | 2 |
| 4: Quaternius ground cover; Endor under budget | `claude/galaxy-asset-upgrade-p4` | 9, 10 | `main` after 2 | 2 (Task 7's fetch) |
| 5: the built people, asked for | `claude/galaxy-asset-upgrade-p5` | 11 | `main` after 3 | 3 (the transfer path seen working, or seen failing and why) |

One session can take the phases in order, merging each before the next; stop and write the status table when your context is heavy, and the next session picks up the next phase.

## The rules (don't break)

- **No paid service.** No Meshy, no Sketchfab API. The assets come from the assets repo and its releases by URL, and from the Quaternius release zips. A step that would need a key stops and says so in the PR.
- **No sequel trilogy** figure, place or name, anywhere.
- **The loaders are not touched**: `actors.js`, `crew.js`, `placer.js`, `animator.js`, `clipLibrary.js`. `rig.js` gains `findBones` exported and a `_<digits>` suffix rule, nothing else. The work is scripts, catalogue rows and model files.
- **Byte identity**: every shipped `public/games/meshy/ual-*.glb` re-bakes identical after Task 4. Do not regenerate them.
- **Sizes**: a surface model under 2.5 MB (4 MB `hero`); a baked core set under 60 KB a figure; nothing under `lab/` is committed.
- **Credits**: Sketchfab models in `src/data/modelCredits.json` (its test is the law); CC0 Quaternius models as a `models/galaxy/surface/{…}.glb` line in `public/cc0/README.md`, and Quaternius in `CREDITS.md` through `scripts/credits.mjs`.
- **Compare, never assume**: the B1 replaces the troops' battle droid only if it rigs and the sheet says it is better. The Venator and TIE in the assets release are not brought in.
- **One phase per PR, merged on its own.** PR to `main`, CI green, merge commit. Never merge red, never force-push, never rebase someone else's branch.
- **Before the PR**: `npx eslint .`, `npx vitest run`, `npx vite build`; the phase's `anim-check` JSON and `surface-shot` PNGs under `docs/superpowers/evidence/galaxy-asset-upgrade/`; the audit script's table before and after.
- Keep output terse. Commits end with the harness's attribution lines; no model names in code, docs or commits.

## What done looks like, per phase

- **1**: `node scripts/galaxy-figures-audit.mjs` prints the spec's table and exits 0; eleven statues (`anakin`, `armorer`, `baze`, `cassian`, `chirrut`, `clonephase1`, `dindjarin`, `jyn`, `k2so`, `krennic`, `sullustan`) have `legs` and walk in `anim-check` on Scarif, Kamino, Nevarro, Coruscant and Naboo with planted toes under 0.15 m/s.
- **2**: `node scripts/assets-fetch.mjs starwars b1` and `--repo naturemega` fill `lab/assets/`; `targetMap` maps a Mixamo skeleton; `node scripts/ual-bake.mjs --rig <figure.glb> --into <out.glb> --set core` bakes seven clips into a figure; `ithorian`, `rebelpilot`, `rebeltech` walk on Yavin, Endor and Scarif; the shipped `ual-*.glb` files are byte-identical.
- **3**: either `troops/battledroid.glb` is leoxx300's B1 rigged by transfer and credited, walking on Geonosis, with the Battlefront one kept as `battledroid.bf.glb`; or the status table below says exactly why not (pose, spread, torn legs) with the sheet PNG.
- **4**: seven `q*` kinds in `catalog/quaternius.js`, imported by `scripts/quaternius-import.mjs`, listed in the README and `CREDITS.md`; ferns and mushrooms on Endor's and Dagobah's floors; Endor under 3M triangles at high in `galaxy-check` and off `KNOWN_OVER`.
- **5**: `docs/superpowers/evidence/galaxy-asset-upgrade/gen3d-asks.md` holds ten issue bodies with the A-pose wording (filed, or ready for the owner to file); the status table below lists each kind's donor, transfer command and `CREW` row; `audit-after.md` beside `audit-before.md`.

## When something in the plan is wrong

Follow the spec over the plan, the code over both. Fix the plan's line in your PR and say so in the PR body in one sentence. If a loader has to change after all (the spec's one allowance is `placer.js` for foliage, and the plan found a way round it), say which lines and why in the PR body.

## Status

| Phase | Session | Branch | Merged |
|---|---|---|---|
| design | the architecting session | `claude/galaxy-asset-upgrade-design` | (carried by Phase 1's PR) |
| 1 | the implementation session | `claude/galaxy-asset-upgrade-p1` | no (pushed, no PR: the owner decides) |
| 2 | the implementation session | `claude/galaxy-asset-upgrade-p2` | no (pushed, no PR) |
| 3 | the implementation session | `claude/galaxy-asset-upgrade-p3` | no (pushed, no PR); the B1 rigs and walks but is not swapped in (below) |
| 4 | the implementation session | `claude/galaxy-asset-upgrade-p4` | no (pushed, no PR). **Blocked in part:** Endor stays over 3M and on `KNOWN_OVER` (below) |
| 5 | the implementation session | `claude/galaxy-asset-upgrade-p5` | no (pushed, no PR). The nine asks are **not filed**: `gh issue create` is refused in the cloud session (HTTP 403); the owner files them from `evidence/galaxy-asset-upgrade/gen3d-asks.md` |

Findings for the next phase go here, as the natural-worlds hand-off does: what the retarget needed on the Mixamo rigs, the B1's outcome, Endor's numbers before and after, which gen3d asks were filed.

### Phase 1 findings

- Audit before: crew 37, own-clips 7, legs 4, rig-noanim 3, still 38, built 8, crew-still 2, none 3, walker 1 (`atrt`). The spec's hand count missed the AT-RT and Mace (`evidence/galaxy-asset-upgrade/audit-before.md`).
- Audit after Phase 1: legs 15, still 27. The eleven given `legs`: anakin 0.32, armorer 0.38, baze 0.46, cassian 0.46, clonephase1 0.47, dindjarin 0.45, jyn 0.46, k2so 0.47, krennic 0.47, mace 0.3, sullustan 0.44 (crotch as a share of height, read off front and side sheets; Anakin's and Mace's at their tunic hems). Chirrut stays a statue: his robe reaches his ankles and `findLegs` finds no parted legs even when told the crotch, like the Jawa and Yoda. Mace takes his place in the eleven.
- `legRig.js` changed (not a loader on the hand-off's list): `findLegs` read only vertices, and a low-poly leg has none at 15% of its height, so the Gungan (already given `legs`), K-2SO and the Phase I clone found no legs and swayed. `surfacePoints` adds points spread over the triangles. A legged figure standing still now shifts its weight from knee to knee (`standPose`), so it is not frozen at its bind pose.
- `anim-check` (software Chromium, about 1.6 s of world time a run) on Scarif (teleported beside Baze and K-2SO), Kamino, Nevarro, Naboo and Geonosis: exit 0 everywhere, no figure in view over 0.15 m/s. Few figures are in view from the landing, and the check lists every out-of-view rigged figure as at its bind pose (the old Geonosians too), because actors far from view are not posed. JSON in `evidence/galaxy-asset-upgrade/anim-p1-*.json`.

### Phase 2 findings

- `rig.js`'s `plain` already dropped a trailing `_<digits>`; Task 3 was only the export (and a test on `mixamorig:Hips_52` names).
- `rig.js` cannot be imported by plain Node (its imports have no extensions), so the retarget takes `findBones` as an argument: `ual-bake.mjs --rig` loads it through Vite's `ssrLoadModule`, the tests import it directly.
- `targetMap` maps a Mixamo rig by role (Spine, Spine1, Spine2 onto Spine02, Spine01, Spine; Neck as `neck`; the shoulders); bones a rig lacks get no track, and the parent turn passes through any bone the map leaves out. A Mixamo copy of the Meshy fixture gets the Meshy rig's turns to 1e-5.
- Byte identity: the `pro` and `ual2` sets (81 of the 119 `ual-*.glb`) re-bake byte for byte, with `--report` at float noise (0.00022 rad). The `saber` and `life` sets (38 files) need the free Standard pack (`scripts/preview/.ual/ual.glb`): opengameart.org is refused through this session's proxy, and the assets repo and its releases do not have it, so those were not re-baked. Their path is the same Meshy-name branch the pro set takes. `scripts/ual-bake.test.mjs` re-bakes three pro files and compares bytes whenever `lab/assets/ual1` is there (it skips in CI).
- The core set is baked at 24 frames a second, not 30: at 30 it added 60.1 KB to the Ithorian (over the 60 KB line), at 24 it adds 55.9 KB (rebelpilot 56.8, rebeltech 56.6). The figure's file is written with meshopt's filter method, so the turns pack a third smaller; the meshes, already quantized, are unchanged.
- `ithorian`, `rebelpilot`, `rebeltech` carry idle, walk, run, talk, hit.chest, die and sit.idle (the Ithorian keeps its `walk-ip`). Their rows name `anim: { idle, walk, run }`. `catalog.test.js` now checks that every clip a row names is in its file.
- `anim-check`: Yavin exit 0, bind pose 0 (four figures play `idle`); Endor and Scarif exit 0 (their bind-pose lines are out-of-view legged figures). Clip sheets: `evidence/galaxy-asset-upgrade/clips-p2-*.png`. `surface-shot.mjs` timed out twice on Yavin waiting for the world (line 43), so there is no hangar picture.
- `node scripts/assets-fetch.mjs starwars b1` fetched the B1 in 4 parts (`part-aa`…`-ad`, 33.5 MB), SHA256 matched; `--repo naturemega` linked the MegaKit (270 files in `glTF/`).
- Audit after Phase 2: own-clips 10, rig-noanim 0.

### Phase 3 findings: the B1 rigs, and stays out

- `node scripts/assets-fetch.mjs starwars b1`, then `node scripts/b1-import.mjs --yaw 90`: the B1 baked at rest out of its unnamed skeleton (`unskinned`), lit for daylight (`relit`: its maps are metal-rough at full metal, black without an environment map), turned to face +z (it comes facing -x; `--yaw 90`), shrunk by `sketchfab-import.mjs` (1.91 m, 12,000 triangles asked, 15,105 kept, 1024 maps), and rigged from `troops/battledroid.glb` by `rigFrom`: 24 joints, bind spread 5.6e-7, arms turned down 58° and 54° to the donor's T-pose and shortened to 0.8.
- `rig-transfer.mjs` had a bug this found: a new mesh that came as many meshes in a nested node tree (the B1: 42) kept those meshes and nodes after the merge, off every scene, sharing their parts with the donor's mesh, and quantization then boxed each part on its own, so each one blew up to the figure's size. The merged copies are now disposed by name. A test pins one mesh out (it passes on the old code too: a flat two-mesh input does not trip it).
- With the core set baked onto a scratch copy, it idles and walks cleanly beside the Battlefront droid (`evidence/galaxy-asset-upgrade/b1-p3-compare.png`, left the Battlefront droid, right the B1): the legs hold, nothing tears. But it reads darker and greyer than the films' tan, where the Battlefront droid reads right, and its file is about 750 KB against 174 KB. The spec swaps it only if the sheet says it is better, so `troops/battledroid.glb`, its credit and `crewList.js` are unchanged. A pass at the B1's base colour (a tan gain on `relit`) is the next thing to try; the command above rebuilds it in a minute.
- The transfer path is proven for Phase 5: a mesh in many parts, facing turned, arms matched.

### Phase 4 findings: the ground cover is in; Endor's budget is not met

- `scripts/quaternius-import.mjs` and `catalog/quaternius.js`: `qfern` (Fern_1, 1.6 m across), `qclover`, `qmushroom` (0.25 m), `qpebble`, `qgrass`, `qpine` (1,877 triangles, with `qpine.lod1.glb` at 1,023 and half-size maps), `qdeadtree`; 8 to 88 KB each. `--foliage lift|crown` makes the normals at import (`lifted`, `liftArray`, `spherifyArray` in `scripts/lib/surface-model.mjs`, the arithmetic of `lib/three/foliage.js`), so no loader changed. Listed in `public/cc0/README.md`; `scripts/credits.mjs` names Quaternius; `CREDITS.md` regenerated (it was stale: three ship credits no longer in `modelCredits.json` dropped out with it). `catalog.test.js` allows `made: 'quaternius'`.
- Scattered (all `solid: false`): Endor `qfern` 120 and `qmushroom` 30 within 60 m; Dagobah `qfern` 100 and `qmushroom` 30 within 80 m; Kashyyyk `qfern` 100; Yavin `qfern` 80, `qclover` 120; Naboo `qclover` 150, `qgrass` 200; Sorgan `qgrass` 200, `qclover` 120; Lothal `qgrass` 200.
- Endor at high, `galaxy-check` on this tree: **4.21M triangles before** (not the spec's 3.35M: the world has grown since it was listed), **4.32M after** (the ferns and mushrooms, +0.11M with their shadow pass). Measured by object (a frame's every pass): the near full redwoods 60–280 m 1.1M, the skinned crew figures 0.73M, the ground 0.58M, the built ferns 0.52M, the Ewoks 0.28M; the far `lo` redwood ring past 600 m is only 0.1M. So the spec's premise (Endor's triangles are in the far ring, and Quaternius pines there bring it under) does not hold: `qpine` in that ring (120 of them, light copies past 60 m) measured 0.25M, more than the redwoods it replaced, so the far ring keeps its built redwoods and `qpine` and `qdeadtree` are catalogued but placed nowhere. The plan's fallback (the 280–640 m ring cut by tenths) can save at most 0.21M. Getting under 3M means trimming the near redwoods, the crew's triangles or the ground's tessellation, which this design does not cover. `KNOWN_OVER.endor` stays, its note updated with these numbers.
- The other forest and plains worlds at high, after: Dagobah 1.33M, Kashyyyk 1.41M, Yavin 1.81M, Naboo 1.38M, Sorgan 1.21M, Lothal 1.00M, all under 3M (`evidence/galaxy-asset-upgrade/galaxy-check-p4-high.json`, `surface-p4-*.png`).

### Phase 5 findings: the built people, asked for

- `pilot` needed no model: its life entries on Hoth, Naboo, Nevarro, Tatooine and Yavin now name `rebelpilot` (the Sketchfab Rebel pilot, which walks on the core set since Phase 2), so nine asks, not ten.
- The nine (`villager`, `farmer`, `kenobi`, `jocasta`, `zam`, `caretaker`, `ghostben`, and the props `wa7`, `shaak`) are written in `evidence/galaxy-asset-upgrade/gen3d-asks.md` with the A-pose wording for the people and a script that files them. Not filed here: `gh issue create` is refused (HTTP 403). Wookieepedia is refused too (proxy 403), so each carries a prompt and the page to take a picture from instead of an image URL. Before filing, attaching the picture is better (the desktop's README: a prompt alone only works for designs the image model knows).
- When a person lands, rig it by transfer and add its `CREW` row. `actors.js` then takes the crew figure over the built one, with no other change. Check each on `scripts/clip-shot.mjs` after `ual-bake.mjs --rig` on a scratch copy, as the B1 was (`b1-import.mjs` shows the facing and lighting fixes a download may need):

| kind | donor | when `public/models/gen3d/<kind>.glb` lands | `crewList.js` `CREW` row |
|---|---|---|---|
| `villager` | `officer` | `node scripts/rig-transfer.mjs public/models/galaxy/crew/officer.glb public/models/gen3d/villager.glb public/models/galaxy/crew/villager.glb --tex 1024` | `villager: { url: '/models/galaxy/crew/villager.glb', tall: 1.75 },` |
| `farmer` | `officer` | `node scripts/rig-transfer.mjs public/models/galaxy/crew/officer.glb public/models/gen3d/farmer.glb public/models/galaxy/crew/farmer.glb --tex 1024` | `farmer: { url: '/models/galaxy/crew/farmer.glb', tall: 1.75 },` |
| `kenobi` | `officer` | `node scripts/rig-transfer.mjs public/models/galaxy/crew/officer.glb public/models/gen3d/kenobi.glb public/models/galaxy/crew/kenobi.glb --tex 1024` | `kenobi: { url: '/models/galaxy/crew/kenobi.glb', tall: 1.82 },` |
| `caretaker` | `officer` | `node scripts/rig-transfer.mjs public/models/galaxy/crew/officer.glb public/models/gen3d/caretaker.glb public/models/galaxy/crew/caretaker.glb --tex 1024` | `caretaker: { url: '/models/galaxy/crew/caretaker.glb', tall: 1.75 },` |
| `zam` | `twilek` | `node scripts/rig-transfer.mjs public/models/galaxy/crew/twilek.glb public/models/gen3d/zam.glb public/models/galaxy/crew/zam.glb --tex 1024` | `zam: { url: '/models/galaxy/crew/zam.glb', tall: 1.68 },` |
| `jocasta` | `jedi3` | `node scripts/rig-transfer.mjs public/models/galaxy/crew/jedi3.glb public/models/gen3d/jocasta.glb public/models/galaxy/crew/jocasta.glb --tex 1024` | `jocasta: { url: '/models/galaxy/crew/jocasta.glb', tall: 1.7 },` |
| `ghostben` | `jedi3` | `node scripts/rig-transfer.mjs public/models/galaxy/crew/jedi3.glb public/models/gen3d/ghostben.glb public/models/galaxy/crew/ghostben.glb --tex 1024` | `ghostben: { url: '/models/galaxy/crew/ghostben.glb', tall: 1.78 },` |

- The props: copy the GLB to `public/models/galaxy/surface/<kind>.glb` and add a row to `catalog/made.js`: `wa7: { made: 'gen3d', as: 'the WA-7 waitress droid', metres: 1.6 }`, `shaak: { made: 'gen3d', as: 'the shaaks', metres: 1.4 }`, each listed in `public/cc0/README.md`'s made line (`madeKinds`). `catalog.test.js` already allows `made: 'gen3d'`.
- Audit after (`evidence/galaxy-asset-upgrade/audit-after.md`), against before: crew 37 (37), crew-still 2 (2), own-clips 10 (7), legs 15 (4), rig-noanim 0 (3), still 27 (38), built 7 (8), none 3 (3), walker 1 (1).

