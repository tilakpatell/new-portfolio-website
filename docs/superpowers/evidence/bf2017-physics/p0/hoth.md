# Lane P0 on Hoth: the shapes, measured (2026-10-10)

Lane L’s Hoth pack wasn’t on `main` when lane P0 finished, so these are from the map itself (the export on the desktop, `levels/mp/hoth_01`), not a pack.

## The pack’s physics, over the whole map

`node scripts/bf2017-physics.mjs --map levels/mp/hoth_01 --from <web_opt>` (every placed static and object, 128 m cells, the lobby and the other modes’ subs included, so the cell counts are over what a pack holds):

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 432 of 602 | 3,539 | 236,905 | 3 | 23 | 0 | 5,249,252 |

So the pack’s `physics/*.bin` for Hoth is 5.2 MB, under the design’s 6 MB. The 170 meshes without shapes are droids, FX planes, lighting proxies, the AT-AT’s destruction pieces and the front end’s cards.

## A dense cell in the engine

Echo Base’s cells, the arena’s subs only (`Hoth_01` and `Content`), every placed piece’s shapes as fixed bodies in `world.js` in Node (Rapier 0.21), by budget (`havok.js`’s `budgetCell`: an instance’s detail trimesh first, then the lightest hulls). “Hull volume kept” is the share of the cell’s hulls’ box volume left; “step” an idle step with everything fixed.

| cell | pieces | shapes | trimesh triangles | budget (colliders / triangles) | hull volume kept | add | step |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1,-14 | 6,492 | 12,796 | 478,446 | none | 100% | 923 ms | 2.1 ms |
| 1,-14 | | | | 400 / 30k (mid) | 93.0% | 19 ms | 0.06 ms |
| 1,-14 | | | | 1,000 / 60k (high) | 96.9% | 21 ms | 0.15 ms |
| 1,-14 | | | | 2,000 / 100k (ultra) | 98.1% | 36 ms | 0.29 ms |
| 1,-13 | 3,630 | 10,438 | 355,952 | 400 / 1,000 / 2,000 | 66.0 / 88.2 / 95.4% | 10 / 14 / 36 ms | 0.06 / 0.13 / 0.22 ms |
| 0,-14 | 1,532 | 5,736 | 348,748 | 400 / 1,000 / 2,000 | 92.9 / 97.8 / 99.7% | 10 / 30 / 24 ms | 0.09 / 0.10 / 0.18 ms |
| 0,-10 | 840 | 2,367 | 106,931 | 400 / 1,000 / 2,000 | 77.0 / 96.9 / 100% | 28 / 43 / 63 ms | 0.08 / 0.15 / 0.31 ms |

Unbudgeted, one cell is nearly a second to add and 2 ms a step, almost all of it the mesh roots’ trimeshes (the detail over the hulls). The design’s 400 colliders a cell keeps 66 to 93% of the hulls; 1,000 keeps 88 to 98% for a fifth of a millisecond, so high is 1,000 and ultra 2,000 (`levelPhysics.js`’s `BUDGETS`). The bodies go in a slice a frame (`update(4)`), so the 20 to 60 ms of a dense cell is spread over its frames.

A ray down through a budgeted cell: 0.5 to 2 µs.
