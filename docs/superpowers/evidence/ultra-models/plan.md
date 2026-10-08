# Ultra models (Lane C): the picks, the requests and the evidence

Branch `claude/ultra-models`. Spec: `docs/superpowers/specs/2026-10-07-quality-modes-design.md` §2 (the ultra cut's numbers) and §4 Lane C. Plan: `docs/superpowers/plans/2026-10-07-ultra-models.md`.

The ultra quality level may load a `<kind>.ultra.glb` beside a surface model's plain file: up to four times the catalogue's triangles, maps up to 8192, never over 24 MB, and at ultra the whole model at every distance (no far copy). The plain file, and so every other level, stays exactly as it is. This page says which twenty kinds were picked, where each plain model came from, the command that makes its ultra cut, which fifteen ultra cuts were made and kept, which were made and turned down, which were not made and why, and what was checked.

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

A Meshy kind's high cut is its lane's `tris` and `tex` (the catalogue entry doesn't carry them); a Sketchfab kind's is its catalogue entry's. The ultra cut is four times the triangles with 8192 maps (`catalog/ultra.js`'s `ultraCut`), unless the kind's entry carries a smaller `ultra: { tris, tex }` because its source had fewer: the table's ultra column is the entry's where one shipped. The four remakes run through the ultra lane (`scripts/meshy-galaxy-ultra.mjs`), which keeps its tasks, lifts and raw models apart from the plain lanes', so the great wroshyr no longer borrows Kachirho's task.

| # | kind | role | placed | worlds | source | lane / group | high (tris, maps) | ultra cut (tris, maps) | command |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `tipocadome` | landmark | 48 | kamino | meshy | meshy-galaxy-ultra | 30000, 2048 | 120000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-ultra-tasks.json MESHY_REVIEW=lab/meshy/ultra node scripts/meshy-galaxy-buildings.mjs models --ultra tipocadome && MESHY_TASKS=scripts/meshy-galaxy-ultra-tasks.json MESHY_REVIEW=lab/meshy/ultra node scripts/meshy-galaxy-buildings.mjs fetch --ultra tipocadome` |
| 2 | `theed` | landmark | 13 | naboo | meshy | meshy-galaxy-buildings | 30000, 2048 | 120000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-buildings-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra theed && MESHY_TASKS=scripts/meshy-galaxy-buildings-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra theed` |
| 3 | `geohive` | landmark | 9 | geonosis | meshy | meshy-galaxy-buildings-back | 30000, 2048 | 120000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-buildings-back-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra geohive && MESHY_TASKS=scripts/meshy-galaxy-buildings-back-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra geohive` |
| 4 | `lothtemple` | landmark | 5 | lothal | meshy | meshy-galaxy-buildings-back | 16000, 2048 | 64000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-buildings-back-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra lothtemple && MESHY_TASKS=scripts/meshy-galaxy-buildings-back-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra lothtemple` |
| 5 | `wroshyrgreat` | landmark | 3 | kashyyyk | meshy | meshy-galaxy-ultra | 45000, 2048 | 180000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-ultra-tasks.json MESHY_REVIEW=lab/meshy/ultra node scripts/meshy-galaxy-buildings.mjs models --ultra wroshyrgreat && MESHY_TASKS=scripts/meshy-galaxy-ultra-tasks.json MESHY_REVIEW=lab/meshy/ultra node scripts/meshy-galaxy-buildings.mjs fetch --ultra wroshyrgreat` |
| 6 | `atat` | landmark | 1 | hoth | sketchfab | ice | 40000, 2048 | 74295, 1024 | `node scripts/sketchfab-surface.mjs ice --ultra atat` |
| 7 | `citadel` | landmark | 1 | scarif | meshy | meshy-galaxy-buildings-fill | 40000, 2048 | 160000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-buildings-fill-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra citadel && MESHY_TASKS=scripts/meshy-galaxy-buildings-fill-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra citadel` |
| 8 | `cloudplaza` | landmark | 1 | bespin | meshy | meshy-galaxy-ultra | 20000, 2048 | 80000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-ultra-tasks.json MESHY_REVIEW=lab/meshy/ultra node scripts/meshy-galaxy-buildings.mjs models --ultra cloudplaza && MESHY_TASKS=scripts/meshy-galaxy-ultra-tasks.json MESHY_REVIEW=lab/meshy/ultra node scripts/meshy-galaxy-buildings.mjs fetch --ultra cloudplaza` |
| 9 | `ds2sky` | landmark | 1 | endor | sketchfab | forest | 14000, 2048 | 56000, 8192 | `node scripts/sketchfab-surface.mjs forest --ultra ds2sky` |
| 10 | `massassi` | landmark | 1 | yavin | meshy | meshy-galaxy-buildings-fill | 40000, 2048 | 160000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-buildings-fill-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra massassi && MESHY_TASKS=scripts/meshy-galaxy-buildings-fill-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra massassi` |
| 11 | `mining` | landmark | 1 | mustafar | meshy | meshy-galaxy-buildings-fill | 45000, 2048 | 180000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-buildings-fill-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra mining && MESHY_TASKS=scripts/meshy-galaxy-buildings-fill-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra mining` |
| 12 | `senate` | landmark | 1 | coruscant | meshy | meshy-galaxy-buildings-fill | 40000, 2048 | 160000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-buildings-fill-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra senate && MESHY_TASKS=scripts/meshy-galaxy-buildings-fill-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra senate` |
| 13 | `sundaridome` | landmark | 1 | mandalore | meshy | meshy-galaxy-buildings-back | 40000, 2048 | 160000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-buildings-back-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra sundaridome && MESHY_TASKS=scripts/meshy-galaxy-buildings-back-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra sundaridome` |
| 14 | `cloudtower` | placed | 14 | bespin | meshy | meshy-galaxy-three | 12000, 1024 | 48000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-three-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra cloudtower && MESHY_TASKS=scripts/meshy-galaxy-three-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra cloudtower` |
| 15 | `tipoca` | placed | 14 | kamino | sketchfab | core | 35000, 1024 | 140000, 8192 | `node scripts/sketchfab-surface.mjs core --ultra tipoca` |
| 16 | `vaporator` | placed | 12 | tatooine | sketchfab | desert | 3000, 512 | 12000, 1024 | `node scripts/sketchfab-surface.mjs desert --ultra vaporator` |
| 17 | `adobe` | placed | 11 | tatooine | sketchfab | desert | 35000, 1024 | 140000, 8192 | `node scripts/sketchfab-surface.mjs desert --ultra adobe` |
| 18 | `bunker` | placed | 10 | endor, scarif, nevarro, lothal | sketchfab | forest | 35000, 1024 | 140000, 8192 | `node scripts/sketchfab-surface.mjs forest --ultra bunker` |
| 19 | `cloudtower2` | placed | 10 | bespin | meshy | meshy-galaxy-three | 12000, 1024 | 48000, 8192 | `MESHY_TASKS=scripts/meshy-galaxy-three-tasks.json node scripts/meshy-galaxy-buildings.mjs models --ultra cloudtower2 && MESHY_TASKS=scripts/meshy-galaxy-three-tasks.json node scripts/meshy-galaxy-buildings.mjs fetch --ultra cloudtower2` |
| 20 | `n1fighter` | placed | 9 | naboo | sketchfab | library | 12000, 1024 | 32101, 1024 | `node scripts/sketchfab-surface.mjs library --ultra n1fighter` |

## What was made: fifteen ultra cuts, four turned down or not made, one in a lane of its own

Every file is under 24 MB and the catalogue test (`catalog.test.js`) holds each to its entry: the ultra `tris` never over four times the entry's where the entry has one, never under it, `tex` at most 8192. The `ultra` line in each entry is what the fetch printed, which is what the file carries (`mapsOf` in `scripts/ultra/cut.mjs` reads the widest map back, so a Sketchfab kind whose source maps are 1024s says 1024 and not the 8192 asked for).

| kind | world | ultra (tris, maps) | MB | what it is | judged |
|---|---|---|---|---|---|
| `theed` | naboo | 125,793, 8192 | 13.6 | the same concept, remeshed at 120k with 8k maps | kept: the copper dome's seams, the cornices and the window pediments are modelled where the plain file smears them; a small lump sits at the dome's front-left foot |
| `geohive` | geonosis | 119,999, 8192 | 11.6 | the same lift, at 120k | kept: thinner, more upright spires and the mesa's strata read as the painting's |
| `citadel` | scarif | 160,000, 8192 | 10.8 | the same lift, at 160k | kept: the panel lines and the stepped base are crisp; its tone came out paler than the plain file's dark grey, which is nearer the film |
| `massassi` | yavin | 159,998, 8192 | 11.0 | the same lift, at 160k | kept: the block courses of every tier are modelled |
| `mining` | mustafar | 179,999, 8192 | 15.0 | the same lift, at 180k | kept: the lattice crane, the drums and the catwalks are all there, finer |
| `senate` | coruscant | 159,999, 8192 | 9.4 | the same lift, at 160k | kept: the rim's window bands and the spires have relief |
| `sundaridome` | mandalore | 159,995, 8192 | 8.0 | the same lift, at 160k | kept: the dome's panel relief and the rim's windows are crisp |
| `cloudtower` | bespin | 41,798, 8192 | 2.1 | the same lift, remeshed by Meshy at 48k | kept: the window slots and the ribbed base are sharper, the shape unchanged |
| `cloudtower2` | bespin | 44,200, 8192 | 2.8 | the same lift, at 48k | kept: the dome's panel lines and the doorways are sharper |
| `tipocadome` | kamino | 119,997, 8192 | 10.0 | **remade** from the rounded dome at the front right of the Clone Wars city shot (`File:TipocaCity-CC.png`, crop `[0.7, 0.43, 0.2, 0.31]`) | kept: a rounded two-step dome on eight lit pylons with three slim needles, where the plain file is a saucer with a tall flared spire; a faint fold crosses the dome's near side |
| `cloudplaza` | bespin | 79,998, 8192 | 3.8 | **remade** from the stepped terraces round the tower's foot in the game's street shot (`File:Cloud City Streets SWB.png`, crop `[0.46, 0.26, 0.4, 0.32]`), the court left open | kept: two ring tiers with flights of steps and planters round an open court on a square plinth, where the plain file is a bare half-ring |
| `wroshyrgreat` | kashyyyk | 179,999, 8192 | 13.6 | **remade** from the tall straight-trunked tree at the far right of the Kachirho panorama (`File:Kachirho BF2.jpg`, crop `[0.72, 0.03, 0.17, 0.72]`), remeshed by Meshy at 180k after its 300k model would not cut below 277k | kept: a straight trunk with the crown far above, cone pods hanging on it and spiral walkways round its foot, where the plain file is a spreading bonsai on a short leaning trunk |
| `atat` | hoth | 74,295, 1024 | 2.1 | the whole Sketchfab download (the plain cut keeps 40,000 of it) | kept: the same model less simplified, its knee joints and foot pads whole; the maps stay the source's 1024s, so the gain is geometry |
| `n1fighter` | naboo | 32,101, 1024 | 0.4 | the whole download (the plain keeps 12,000) | kept: rounder engine nacelles and canopy, no faceting |
| `vaporator` | tatooine | 12,000, 1024 | 0.4 | four times the cut, from a 34,981-triangle download | kept: round rings and fine vanes where the plain is faceted |

Turned down or not made:

- **`lothtemple`** (lothal): made at 64,000 with 8k maps (35 credits), judged against `File:Jedi Temple on Lothal.png`, and turned down: its colour drifted to brown-grey from the plain file's blue-grey, and its strata came out as cloth-like folds rather than the smooth banded stone. The file is not shipped; its task stays in the back lane's tasks file so it is not paid for again.
- **`ds2sky`** (endor): asked of Meshy twice through the ultra lane. From the film picture itself (`File:DeathStar2.jpg`) Meshy's mesh repair failed to close the half-built side (`RepairDidNotCloseError`, no charge). Lifted first with that side described as one solid mass (3 credits) it succeeded (35 credits) and came out a pale, crumpled sphere with the trench but no dish in any of the four views: not the Death Star. Not shipped; the Sketchfab download has no more triangles than the plain cut keeps (12,214 against 14,000), so nothing can be had from it either. The lane entry stays as the record of the attempt.
- **`bunker`** (endor, scarif, nevarro, lothal): the Sketchfab download has 23,886 triangles and 1024 maps, all of which the plain cut already keeps, so an ultra cut would be the plain file again.
- **`tipoca`** (kamino): the download has 1,520 triangles and a 512 map. The heavier Sketchfab models of Tipoca City under a licence the site can credit (`237ab55186c540b19ad25f164983e64a`, 134k faces, and `4cdaed56ac5a4843887419faed5f7161`, 87k) are whole cities of domes on pillars with 256-pixel maps and no separable landing platform, and the plain file is a flat landing pad; the audit lane's Meshy remake of `tipoca` is a 64 m tower, a different thing for a different lane. Left out.
- **`adobe`** (tatooine): the download has 3,812 triangles, all kept by the plain cut. The heavier Sketchfab sources are `7deab9277e134026b33a051b7a571422` (a 999,898-triangle diorama scan of a tapered house with a garage door on a slab of sand, one 1024 map) and `3e6cb7d8ba3c45909787dbfba47e067d` (a façade-only scan of the Mos Espa set with holes to the sky); neither is the domed house with wings that the eleven adobes are, and the scan's one 1024 map would be no sharper over 10 m than the plain file's. Left out.
- **gen3d (0 of the twenty, 2 desktop jobs)**: the galaxy's X-wing (#552) and TIE interceptor (#553) were asked of the owner's desktop earlier; not polled here.

## How the cuts were made, and two things the runs taught the scripts

- Meshy's image-to-3D takes `texture_resolution` of `2k`, `4k` or `8k`; the script's `'4k'` default was a guess and is now `'8k'` (`MESHY_ULTRA_TEXTURE` still overrides). An 8k model costs 35 credits, not 30.
- A 300k Meshy remesh cannot be simplified below about 90k triangles: its atlas is thousands of charts and the simplifier keeps every seam, whatever error it is allowed (tried on the tower's raw model: 288k to 92,786 at any bound from 0.01 to 1). So `models --ultra` now asks Meshy for the cut's own polygons where that is under 300k (`Math.min(MESHY_MAX_POLYCOUNT, ultraSpec(entry).tris)`), and Meshy's remesh lands at budget; the simplifier is only needed for a kind whose budget is near 300k. Cloud City's two towers and the great wroshyr were asked again this way after their 300k models would not cut (70 and 35 credits more). The simplify loop in `squeeze` also loosens its error bound in steps when a cut comes out over budget, which is what let Theed's 165k first pass land at 125,793.
- A prompted kind (Theed) is asked for from its downloaded concept picture as a data URI, so the model can be made on another account than the one that drew the picture: a Meshy task is readable only with the key that made it, and the three accounts' tasks are spread across all three.
- Nothing is paid twice: each kind's ultra task id is kept in its lane's tasks file, and a `models --ultra` for a kind that has one only waits for it.

### Credits

| account | before | after | spent here | on what |
|---|---|---|---|---|
| `MESHY_API_KEY` | 1 | 1 | 0 | reading back the plain lanes' lifts and Theed's picture (free) |
| `MESHY_API_KEY_ACC_2` | 21 | 21 | 0 | reading back the Bespin lane's lifts (free) |
| `MESHY_API_KEY_ACC_3` | 3,798 at the first request | 3,191 | 607 | 17 models at 35 (Theed, the Citadel, the temple, the mining facility, the Senate, the hive, the Lothal temple, Sundari, the two towers twice, Tipoca's dome, the plaza, the wroshyr twice and the Death Star; a failed task is not charged) and 4 lifts at 3 |

The third account read 3,960 when this session first looked and 3,798 when its first request went in; the 162 credits between were consumed by something outside this session.

## Accuracy: the judge sheets

`docs/gen3d/ultra/<kind>.webp`, one a kind: the plain model over its ultra cut, four views each (`scripts/gen3d/judge.mjs` through `scripts/glb-shot.mjs`: three-quarter, front, side, top; each row's caption has its triangles and size). The reference pictures stay out of the repository (`lab/refs/`, Lucasfilm's and the wiki's): the comparison against them was made on the Meshy lanes' gate sheets (`sheet --ultra`: the picture, the lift, the plain model and the ultra cut side by side, `lab/meshy/<lane>/<kind>-gate-ultra.jpg`) and, for the Sketchfab kinds, on the same four-view sheets with the picture put beside them. The pictures used:

| kind | reference |
|---|---|
| `theed` | `File:Theedroyalpalace.png` (the concept image is the lane's own) |
| `geohive` | `File:Geonosis.jpg` |
| `lothtemple` | `File:Jedi Temple on Lothal.png` |
| `citadel` | `File:CitadelTowerDestroyedStarWars.png` |
| `massassi` | `File:Great Temple RO.png` |
| `mining` | `File:KCMMiningFacility-TotR.png` |
| `senate` | `File:Galactic Senate RotS.png` |
| `sundaridome` | `File:Sundari HoM1.png` |
| `cloudtower`, `cloudtower2`, `cloudplaza` | `File:Cloud City Streets SWB.png` |
| `tipocadome` | `File:TipocaCity-CC.png` (and `File:Tipoca-City-concept.jpg` looked at) |
| `wroshyrgreat` | `File:Kachirho BF2.jpg` (and `File:Kachirho.png`, `File:House exterior rmq.jpg` looked at) |
| `ds2sky` | `File:DeathStar2.jpg` |
| `atat` | `File:AT-AT 2 Fathead.png` |
| `n1fighter` | `File:N-1 BF2.png` |
| `vaporator` | `File:GX-8 water vaporator.jpg` |
| `bunker` | `File:EndorBunker-ROTJ.png` |
| `adobe` | `File:Mos Eisley street.png` |
| `tipoca` | `File:TipocaCity-CC.png` |

## Loading at ultra: galaxy-check

`QUALITY=ultra` and `QUALITY=high` runs of `scripts/galaxy-check.mjs surface` on the worlds the kept kinds stand on, one world after another in one headless Chromium on software GL with `WAIT=20000` (an earlier attempt with three checks running at once, beside the judge sheets' browsers, gave frames of six to sixteen seconds and one world captured before it had drawn, and was thrown away). Frame times mean nothing here; the shots, the counts and the model megabytes do. At ultra each kept kind loads its `.ultra.glb` and nothing swaps to its far copy; at high every file is the one it was.

| world | kept kinds on it | level | draw calls | triangles drawn | errors | shot |
|---|---|---|---|---|---|---|
| Hoth | `atat` | ultra | 346 | 1,678,744 | none | [hoth-ultra](hoth-ultra.webp) |
|  |  | high | 345 | 1,678,743 | none | [hoth-high](hoth-high.webp) |
| Tatooine | `vaporator` | ultra | 76 | 852,996 | none | [tatooine-ultra](tatooine-ultra.webp) |
|  |  | high | 76 | 819,247 | none | [tatooine-high](tatooine-high.webp) |
| Naboo | `theed`, `n1fighter` | ultra | 393 | 2,522,116 | none | [naboo-ultra](naboo-ultra.webp) |
|  |  | high | 393 | 1,186,406 | none | [naboo-high](naboo-high.webp) |
| Scarif | `citadel` | ultra | 174 | 2,263,979 | none | [scarif-ultra](scarif-ultra.webp) |
|  |  | high | 177 | 1,661,939 | none | [scarif-high](scarif-high.webp) |
| Yavin | `massassi` | ultra | 77 | 1,727,484 | none | [yavin-ultra](yavin-ultra.webp) |
|  |  | high | 78 | 1,727,485 | none | [yavin-high](yavin-high.webp) |
| Mustafar | `mining` | ultra | 111 | 1,032,088 | none | [mustafar-ultra](mustafar-ultra.webp) |
|  |  | high | 110 | 1,032,087 | none | [mustafar-high](mustafar-high.webp) |
| Coruscant | `senate` | ultra | 221 | 1,433,415 | none | [coruscant-ultra](coruscant-ultra.webp) |
|  |  | high | 221 | 1,433,415 | none | [coruscant-high](coruscant-high.webp) |
| Geonosis | `geohive` | ultra | 202 | 1,260,214 | none | [geonosis-ultra](geonosis-ultra.webp) |
|  |  | high | 202 | 1,029,561 | none | [geonosis-high](geonosis-high.webp) |
| Mandalore | `sundaridome` | ultra | 87 | 918,773 | none | [mandalore-ultra](mandalore-ultra.webp) |
|  |  | high | 87 | 918,773 | none | [mandalore-high](mandalore-high.webp) |
| Bespin | `cloudplaza`, `cloudtower`, `cloudtower2` | ultra | 192 | 1,054,521 | none | [bespin-ultra](bespin-ultra.webp) |
|  |  | high | 194 | 1,054,665 | none | [bespin-high](bespin-high.webp) |
| Kamino | `tipocadome` | ultra | 164 | 4,909,225 | none | [kamino-ultra](kamino-ultra.webp) |
|  |  | high | 163 | 1,304,782 | none | [kamino-high](kamino-high.webp) |
| Kashyyyk | `wroshyrgreat` | ultra | 140 | 2,059,003 | none | [kashyyyk-ultra](kashyyyk-ultra.webp) |
|  |  | high | 140 | 1,770,567 | none | [kashyyyk-high](kashyyyk-high.webp) |

The counts are of one frame from the landing spot, so they move only where a kept kind is in that frame: Kamino's domes (48 of them, 120k each at ultra against 26k), Naboo's halls and parked N-1s, Scarif's Citadel, Kashyyyk's wroshyrs, Geonosis's hives and Tatooine's vaporators all show at ultra, and the Kamino shot shows the rounded ultra domes where high shows the flared ones. On Hoth, Yavin, Mustafar, Coruscant, Mandalore and Bespin the landmark is out of the first frame (Bespin's pad looks out into the cloud), so the frame draws the same at both levels; there the run shows only that the world loads at ultra with its entry in place and no error. Every one of the twenty-four runs loaded with no page or console error.

## What was verified, and how

- `npm run lint` (`eslint .`): clean on the final tree, with `origin/main` merged in three times (the second time with Lane A on it, the third with Lane B's ultra planets and the Kashyyyk battle).
- `npm test` (`vitest run`): 573 files, 7,007 passed, 1 skipped, on the tree with Lane A and Lane B merged in. Four of main's new suites failed once for a dependency (`fake-indexeddb`) this container's install predated; after `npm ci` all four pass.
- `npm run test:ai`: 37 files passed, 2 skipped; 188 tests passed, 7 skipped. Its one failure was the credit audit finding the nine Meshy-made ultra files uncredited: the Meshy-made plain files are on the audit's allow-list by name, so a listed model's cuts are now listed with it (by the stem the audit already credits a model's cuts with), and `public/cc0/README.md` names the ultra cuts beside their plain files.
- `catalog.test.js`: each of the fifteen entries has its file, under 24 MB, `ultra.tris` within four times the entry's `tris` and over it where the entry has one; every `.ultra.glb` in the folder has an entry; `modelUrlFor` gives the ultra file at ultra and the plain one elsewhere, and `wantsLod` never swaps at ultra.
- `scripts/ultra/cut.test.mjs` (the `--ultra` arithmetic, the refusal, and `mapsOf` reading the widest map back) and `scripts/ultra/kinds.test.mjs` (the picking rule, the ultra lane taking over an earlier lane's kind, the wroshyr under its own name there).
- Every ultra cut was judged on a sheet beside its reference picture before its catalogue line went in; the two that failed that (the Lothal temple, the Death Star) are not shipped, and the sheets of the fifteen that passed are in `docs/gen3d/ultra/`.
- The twenty-four galaxy-check runs above loaded with no page or console error; the Kamino shot shows the rounded ultra domes where high shows the flared ones.
- `npm run credits` leaves `CREDITS.md` unchanged (an ultra cut is credited with its model).

## Lane A

Lane A (`claude/quality-settings`, PR #573) merged to main while this lane was being finished, and main was merged in here on the spec's rule: Lane A's loading path stays (`catalog/index.js`'s `modelUrlFor` and `wantsLod` on `lib/budgets`, the placer reading them, `lib/three/gen3d.js` asking once whether a made model's ultra file is there), and this lane's ultra entries, scripts and files stay. `catalog/ultra.js` now reads `budget(level).lod1` for the far-copy rule and keeps the cut's numbers (`ULTRA`, `ultraCut`) for the importers and the tests; `scripts/gen3d/budget.mjs` is this lane's, with `cutsFor`'s ultra cut that `make.mjs` and the runner use; `catalog.test.js` keeps this lane's cap of four times the entry's triangles beside Lane A's checks. The placer no longer falls back to the plain file when an ultra cut fails to load, as Lane A's loader has no such fallback; the catalogue test holds every entry to a file that exists.
