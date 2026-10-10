# hoth: the game's level

From `levels/mp/hoth_01` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs levels/mp/hoth_01 --world hoth --spot 205 -1540`; do not edit by hand.

- 5814 instances in the arena (±1024 m), 236 beyond it (the horizon), 14536 left out under the ground (the base inside the glacier: the site's interior zone stands for it), 155 cells of 128 m
- 602 meshes (4 left out), 476 LOD files, 8.80 MB
- the far list 0.18 MB; terrain near 2.50 MB, far 5.75 MB; the spot's ground 362.30 m in the game
- textures missing from the bucket: 4

| | low | mid | high |
|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 35 (35 m, 700 m) | 137 (137 m, 2740 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 0 (0) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 716k, 141 | 1347k, 154 | 1573k, 169 |
| texture bytes (every map the level has) | 8.83 MB | 28.71 MB | 28.71 MB |

