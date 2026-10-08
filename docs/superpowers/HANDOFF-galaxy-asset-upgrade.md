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
| 4 | | | |
| 5 | | | |

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

