# Ultra models (Lane C): the picks, the requests and the evidence

Branch `claude/ultra-models`. Spec: `docs/superpowers/specs/2026-10-07-quality-modes-design.md` §2 (the ultra cut's numbers) and §4 Lane C. Plan: `docs/superpowers/plans/2026-10-07-ultra-models.md`.

The ultra quality level may load a `<kind>.ultra.glb` beside a surface model's plain file: up to four times the catalogue's triangles, maps up to 8192, never over 24 MB, and at ultra the whole model at every distance (no far copy). The plain file, and so every other level, stays exactly as it is. This page says which twenty kinds get one, where each plain model came from, the command that makes its ultra cut, and what was checked.

## How often each world places each kind

`node scripts/ultra/counts.mjs` reads every site (`src/components/galaxy/surface/sites/`) the way `placer.js` does: each thing, place thing and zone thing with a model counts one (a cluster counts each member), each scatter its `n`. The whole table is what the script prints; the most placed of each world:

| world | things with a model | the most placed (crates, creatures and ground cover included) |
|---|---|---|
| tatooine | 82 | `vaporator` 12, `adobe` 11, `cooler` 6, `stall` 5, `impcrate` 5, `longcrate` 5 |
| hoth | 62 | `hothcrate` 9, `snowspeeder` 8, `turret` 7, `impcrate` 6, `longcrate` 6, `barrels` 6 |
| endor | 41 | `ewokhut` 7, `cooler` 6, `impcrate` 5, `longcrate` 5, `barrels` 5, `rustycrate` 5 |
| kashyyyk | 35 | `impcrate` 5, `longcrate` 5, `barrels` 5, `cooler` 5, `rustycrate` 5, `wroshyrgreat` 3 |
| dagobah | 98 | `dagoroots` 51, `dagocypress` 41, `yodahut` 1, `impcrate` 1, `longcrate` 1, `barrels` 1 |
| yavin | 35 | `ammocan` 5, `impcrate` 4, `longcrate` 4, `barrels` 4, `cooler` 4, `rustycrate` 4 |
| naboo | 55 | `theed` 13, `n1fighter` 9, `impcrate` 3, `longcrate` 3, `barrels` 3, `cooler` 3 |
| kamino | 67 | `tipocadome` 48, `tipoca` 14, `cratecube` 2, `barrel` 2, `empirecrate` 1 |
| geonosis | 37 | `geohive` 9, `droideka` 5, `laat` 4, `cratecube` 2, `atte` 2, `impcrate` 2 |
| coruscant | 22 | `corutower` 6, `senatepod` 3, `cratecube` 2, `airspeeder` 2, `dejarik` 2, `empirecrate` 1 |
| mustafar | 37 | `impcrate` 6, `longcrate` 6, `barrels` 6, `cooler` 6, `rustycrate` 6, `barrel` 3 |
| scarif | 985 | `palm` 600, `sorganfern` 340, `cooler` 7, `bunker` 7, `impcrate` 6, `longcrate` 6 |
| bespin | 42 | `cloudtower` 14, `cloudtower2` 10, `cloudcar` 3, `cooler` 3, `barrel` 2, `impcrate` 2 |
| nevarro | 218 | `lavarock` 188, `nevarrodome` 5, `impcrate` 3, `longcrate` 3, `barrels` 3, `cooler` 3 |
| mandalore | 199 | `glassshard` 198, `sundaridome` 1 |
| lothal | 34 | `lothtemple` 5, `lothdome` 4, `impcrate` 4, `longcrate` 4, `barrels` 4, `cooler` 4 |
| sorgan | 335 | `sorganfern` 177, `sorganfir` 90, `sorganbirch` 40, `stilthut` 5, `impcrate` 4, `longcrate` 4 |

## The twenty

`node scripts/ultra/kinds.mjs` (its rule is tested in `scripts/ultra/kinds.test.mjs`): every world's landmark first (the hero kind it places; where it places several, the most placed), then the most-placed buildings and vehicles across all the worlds until there are twenty. Crates, coolers, people, troopers, creatures and the scattered ground cover (palms, ferns, roots, glass, lava rock) are not buildings or vehicles, however many of them there are; the scattered ones are drawn instanced anyway. Four worlds have no hero kind and nothing placed often enough to make the twenty (Tatooine's landmark, Jabba's palace, stands once; Dagobah, Nevarro and Sorgan are mostly trees and rock): the next in line are `ewokhut` (7), `turret` (7), `corutower` (6), `nevarrodome` (5), `stilthut` (5) and `palace` (1).

A Meshy kind's high cut is its lane's `tris` and `tex` (the catalogue entry doesn't carry them); a Sketchfab kind's is its catalogue entry's. The ultra cut is four times the triangles with 8192 maps (`catalog/ultra.js`'s `ultraCut`), unless the fetch prints a smaller `ultra: { tris, tex }` line because the source had fewer.

| # | kind | role | placed | worlds | source | lane / group | high (tris, maps) | ultra cut (tris, maps) | command |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `tipocadome` | landmark | 48 | kamino | meshy | meshy-galaxy-buildings-fill | 30000, 2048 | 120000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-buildings-fill-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra tipocadome && MESHY_TASKS=scripts/meshy-galaxy-buildings-fill-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra tipocadome` |
| 2 | `theed` | landmark | 13 | naboo | meshy | meshy-galaxy-buildings | 30000, 2048 | 120000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-buildings-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra theed && MESHY_TASKS=scripts/meshy-galaxy-buildings-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra theed` |
| 3 | `geohive` | landmark | 9 | geonosis | meshy | meshy-galaxy-buildings-back | 30000, 2048 | 120000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-buildings-back-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra geohive && MESHY_TASKS=scripts/meshy-galaxy-buildings-back-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra geohive` |
| 4 | `lothtemple` | landmark | 5 | lothal | meshy | meshy-galaxy-buildings-back | 16000, 2048 | 64000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-buildings-back-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra lothtemple && MESHY_TASKS=scripts/meshy-galaxy-buildings-back-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra lothtemple` |
| 5 | `wroshyrgreat` | landmark | 3 | kashyyyk | meshy | meshy-galaxy-buildings-fill (as `kachirho`) | 45000, 2048 | 180000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-buildings-fill-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra kachirho && MESHY_TASKS=scripts/meshy-galaxy-buildings-fill-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra kachirho && mv public/models/galaxy/surface/kachirho.ultra.glb public/models/galaxy/surface/wroshyrgreat.ultra.glb` |
| 6 | `atat` | landmark | 1 | hoth | sketchfab | ice | 40000, 2048 | 160000, 8192 | `node scripts/sketchfab-surface.mjs ice --ultra atat` |
| 7 | `citadel` | landmark | 1 | scarif | meshy | meshy-galaxy-buildings-fill | 40000, 2048 | 160000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-buildings-fill-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra citadel && MESHY_TASKS=scripts/meshy-galaxy-buildings-fill-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra citadel` |
| 8 | `cloudplaza` | landmark | 1 | bespin | meshy | meshy-galaxy-three | 20000, 2048 | 80000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-three-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra cloudplaza && MESHY_TASKS=scripts/meshy-galaxy-three-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra cloudplaza` |
| 9 | `ds2sky` | landmark | 1 | endor | sketchfab | forest | 14000, 2048 | 56000, 8192 | `node scripts/sketchfab-surface.mjs forest --ultra ds2sky` |
| 10 | `massassi` | landmark | 1 | yavin | meshy | meshy-galaxy-buildings-fill | 40000, 2048 | 160000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-buildings-fill-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra massassi && MESHY_TASKS=scripts/meshy-galaxy-buildings-fill-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra massassi` |
| 11 | `mining` | landmark | 1 | mustafar | meshy | meshy-galaxy-buildings-fill | 45000, 2048 | 180000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-buildings-fill-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra mining && MESHY_TASKS=scripts/meshy-galaxy-buildings-fill-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra mining` |
| 12 | `senate` | landmark | 1 | coruscant | meshy | meshy-galaxy-buildings-fill | 40000, 2048 | 160000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-buildings-fill-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra senate && MESHY_TASKS=scripts/meshy-galaxy-buildings-fill-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra senate` |
| 13 | `sundaridome` | landmark | 1 | mandalore | meshy | meshy-galaxy-buildings-back | 40000, 2048 | 160000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-buildings-back-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra sundaridome && MESHY_TASKS=scripts/meshy-galaxy-buildings-back-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra sundaridome` |
| 14 | `cloudtower` | placed | 14 | bespin | meshy | meshy-galaxy-three | 12000, 1024 | 48000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-three-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra cloudtower && MESHY_TASKS=scripts/meshy-galaxy-three-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra cloudtower` |
| 15 | `tipoca` | placed | 14 | kamino | sketchfab | core | 35000, 1024 | 140000, 8192 | `node scripts/sketchfab-surface.mjs core --ultra tipoca` |
| 16 | `vaporator` | placed | 12 | tatooine | sketchfab | desert | 3000, 512 | 12000, 8192 | `node scripts/sketchfab-surface.mjs desert --ultra vaporator` |
| 17 | `adobe` | placed | 11 | tatooine | sketchfab | desert | 35000, 1024 | 140000, 8192 | `node scripts/sketchfab-surface.mjs desert --ultra adobe` |
| 18 | `bunker` | placed | 10 | endor, scarif, nevarro, lothal | sketchfab | forest | 35000, 1024 | 140000, 8192 | `node scripts/sketchfab-surface.mjs forest --ultra bunker` |
| 19 | `cloudtower2` | placed | 10 | bespin | meshy | meshy-galaxy-three | 12000, 1024 | 48000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-three-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra cloudtower2 && MESHY_TASKS=scripts/meshy-galaxy-three-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra cloudtower2` |
| 20 | `n1fighter` | placed | 9 | naboo | sketchfab | library | 12000, 1024 | 48000, 8192 | `node scripts/sketchfab-surface.mjs library --ultra n1fighter` |

The great wroshyr's Meshy task is kept as `kachirho` in the fill lane's tasks file (the model was lifted out of the picture of Kachirho; `catalog/made.js` says so), which is why its command runs as `kachirho` and renames the file. If the owner would rather the lane carried a `wroshyrgreat` entry, copy `kachirho`'s under that name first.

## Where the requests stand

- **Meshy (13 kinds):** `MESHY_API_KEY` is not set in this environment, and its network policy denies `api.meshy.ai`, so nothing was re-asked from here. Each `models --ultra` is one image-to-3D task at Meshy's most polygons (300k, `MESHY_MAX_POLYCOUNT`) and its finest texture (`MESHY_ULTRA_TEXTURE`, 4k unless set): 30 credits a kind, about 390 for the thirteen. The task is kept as the kind's `ultra` in its tasks file, apart from the plain one, so running a step twice never pays twice. `fetch --ultra` is free, writes the `.ultra.glb`, refuses one over its budget or 24 MB, and prints the catalogue's `ultra: { tris, tex }` line to paste into the kind's entry. Nothing was in the Meshy review cache either (`lab/meshy/` is git-ignored and empty here), so no import step could be run.
- **Sketchfab (7 kinds):** `SKETCHFAB_API_TOKEN` is not set here and `api.sketchfab.com` is denied, so nothing was downloaded. `sketchfab-surface.mjs <group> --ultra <kind>` downloads the same model again (or reuses `/tmp/sketchfab-surface/`), keeps up to four times the catalogue's triangles and its maps up to 8192, and prints the `ultra` line. A download with fewer triangles than the cut keeps them all, so the AT-AT and the adobe houses (both from models far denser than their cuts) will gain the most and the vaporators the least.
- **gen3d (0 of the twenty, 2 desktop jobs):** no surface kind was made by gen3d; the site's made models are the galaxy's ships. The two the Star Wars worlds show, through `lib/three/gen3d`, were asked of the owner's desktop for an ultra remake (`faces: 300000  tex: 8192  ultra: yes`, each a pull request when the desktop is awake; not polled):
  - X-wing: https://github.com/tilakpatell/new-portfolio-website/issues/552
  - TIE interceptor: https://github.com/tilakpatell/new-portfolio-website/issues/553

After any of these lands: add the `ultra` line to the kind's catalogue entry (`catalog.test.js` holds each `.ultra.glb` to an entry and each entry to a file), run `npm run credits` (the credit audit reads `<kind>.ultra.glb` as the kind's, `scripts/ai-e2e/assets/credits.mjs`), and `node scripts/galaxy-surface-lod.mjs` leaves the ultra files alone.

## Accuracy: the judge sheets

`docs/gen3d/ultra/<kind>.webp`, one a kind, is the plain model today from four views (`scripts/gen3d/judge.mjs` through `scripts/glb-shot.mjs`: three-quarter, front, side, top; the caption has its triangles and size). They are the "before" of each ultra cut, and what to hold the ultra fetch's `sheet --ultra` against. The reference pictures could not be put beside them from here: `lab/refs/` is git-ignored and empty in this container, and Wookieepedia's images (`static.wikia.nocookie.net`) are denied by the network policy. The Meshy lane's `sheet --ultra <kind>` makes that comparison on the owner's machine (the picture, the lift, the plain model and the ultra cut side by side, `lab/meshy/<lane>/<kind>-gate-ultra.jpg`). Looking at the plain sheets alone:

- **Shape right, worth the polygons** (an ultra cut from the same source is the whole job): `theed`, `massassi`, `atat`, `citadel`, `senate`, `sundaridome`, `mining`, `geohive`, `bunker`, `n1fighter`, `cloudtower`, `cloudtower2`, `vaporator`. These read as the thing from every view; what they lack at ultra is the fine relief a 120k to 180k cut keeps (Theed's balustrades and window reveals, the AT-AT's plating, the Senate's panel lines), and 8192 maps where the lane's lift was sharp enough.
- **Remake from a better three-quarter reference, not just more polygons:** `tipocadome` (a saucer with a tall spire; Tipoca City's domes are rounded on thin stilts with a slim needle, and this is the most-seen kind of all, 48 on Kamino), `wroshyrgreat` (a spreading, bonsai-shaped crown on a short trunk; a wroshyr is a straight trunk hundreds of metres tall with the crown far above), `cloudplaza` (a plain half-ring; the plaza terraces are stepped and read as part of the city), `ds2sky` (its surface is a noisy black shell with the trench and the dish barely legible, and at 640 m across the sky it is the one thing on Endor that must be right).
- **The source is lighter than its cut, so an ultra cut adds nothing:** `tipoca` (1,520 triangles; its catalogue cut is 35,000) and `adobe` (3,812; cut 35,000). Both are Sketchfab models that arrived light; `sketchfab-surface.mjs --ultra` will keep every triangle they have and print an `ultra` line no bigger than the plain file. For these two the gain has to come from a remake (Meshy from a still of Tipoca City's platform and of a Mos Espa house), or from a denser Sketchfab model under a licence the site can credit.
- `lothtemple` is a smooth banded cone and an ultra cut will stay one: its detail is in the strata texture, so 8192 maps matter more than triangles for it.

## Loading at ultra: galaxy-check

`QUALITY=ultra` and `QUALITY=high` runs of `scripts/galaxy-check.mjs surface` on the worlds the twenty stand on, in headless Chromium on software GL (so frame times mean nothing here; the shots and the counts do). No `.ultra.glb` is on disk yet, so at ultra every kind still loads its plain file (the fallback the placer test pins), and the one difference in what is drawn is that nothing swaps to its far copy at ultra.

SCREENSHOTS

## What was verified, and how

- `npm run lint` clean, `npm test` green (numbers in the pull request).
- `catalog/ultra.test.js`, `catalog.test.js`, `placer.test.js`: the rule, the file pairing and size cap, the URL the placer loads at each level and its fallback.
- `scripts/gen3d/gen3d.test.mjs`: the gen3d `ULTRA` tier, `cutsFor(…, { ultra })`, `fileFor`, `ultra: yes` on a desktop job becoming `--ultra`.
- `scripts/ultra/cut.test.mjs`, `scripts/ultra/kinds.test.mjs`: the importers' `--ultra` arithmetic and refusal, and the picking rule.
- `node scripts/ultra/counts.mjs` and `node scripts/ultra/kinds.mjs` run against the live catalogue and sites (the tables above).
- The judge sheets and screenshots above rendered without page errors.

## Lane A

Branch `claude/quality-settings` (not merged when this was written) carries its own version of the loading side: `lib/budgets.js`, `catalog/index.js`'s `modelUrlFor` and `wantsLod`, `budget.mjs`'s `ULTRA` and `fileFor`, and `lib/three/gen3d.js`'s `.ultra` with a HEAD check. The shapes agree (`ULTRA` is the same object; `fileFor` has the same signature); the names differ (`modelUrl` and `catalog/ultra.js` here, `modelUrlFor` and `wantsLod` there). Whichever merges second resolves `budget.mjs`, `catalog/index.js`, `catalog.test.js`, `placer.js` and `lib/three/gen3d.js` by keeping Lane A's loading and this lane's scripts; `catalog/ultra.js` can then read `budget(level).lod1` for `farCopies`, as the plan's Global Constraints say.
