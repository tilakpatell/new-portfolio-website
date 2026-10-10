# The cast’s cost, measured (phase 2)

Measured on 2026-10-10 with `scripts/galaxy-check.mjs surface <world>` under `BUDGET=1`, in headless Chromium (software GL, so the frame times mean nothing here; the counts do), at `QUALITY=high` and `QUALITY=low`. **Before** is the phase 1 branch this lane started from (`3070abfe`); **after** is this branch at `0efbcf37` and the two light cuts after it.

What the columns are:

- **calls**, **triangles** and **textures**: one frame's `renderer.info`.
- **models**: every `.glb` the world fetched.
- **the row**: `src/lib/budgets.js`'s ceiling for the level: 700 calls, 3M triangles and 60 MB at high; 350, 0.8M and 20 at low.

The script's own `pass` and `FAIL` lines also compare each world with `lab/baseline/surface-high.json` + 10%. That baseline is older than both runs: seven worlds already failed it before this lane, and ten fail it after (the new ones are Yavin, Kashyyyk and Coruscant, on calls). Those lines are in the PR, not here.

The texture contract's 60 textures a world was already broken everywhere before (Hoth 769). The counts rose with the cast's maps, mostly the light cuts' (a figure is three to twenty maps).

### high (the row: 700 calls, 3M triangles, 60 MB of models)

| world | calls before → after | triangles before → after | models MB before → after | textures before → after | the row before | the row after |
| --- | --- | --- | --- | --- | --- | --- |
| hoth | 166 → 190 | 0.88M → 0.95M | 21.3 → 51.6 | 769 → 859 | within | within |
| endor | 167 → 210 | 2.05M → 1.84M | 16 → 43.5 | 271 → 396 | within | within |
| tatooine | 97 → 102 | 0.71M → 0.71M | 29.7 → 31.9 | 335 → 350 | within | within |
| yavin | 75 → 154 | 1.69M → 1.54M | 13.7 → 40.6 | 341 → 410 | within | within |
| naboo | 597 → 536 | 2.01M → 1.81M | 31.3 → 52.5 | 472 → 510 | within | within |
| kamino | 156 → 181 | 1.49M → 1.25M | 12.2 → 35.8 | 189 → 228 | within | within |
| geonosis | 205 → 208 | 1.06M → 1.02M | 29.6 → 56.6 | 417 → 454 | within | within |
| coruscant | 208 → 289 | 1.20M → 1.31M | 23.4 → 27.7 | 180 → 436 | within | within |
| scarif | 147 → 138 | 1.74M → 1.46M | 16.1 → 30.5 | 425 → 525 | within | within |
| bespin | 196 → 261 | 1.09M → 1.05M | 20.8 → 44.8 | 285 → 456 | within | within |
| kashyyyk | 108 → 185 | 1.30M → 1.18M | 15.9 → 36.2 | 311 → 438 | within | within |
| mustafar | 127 → 131 | 0.89M → 0.90M | 29.4 → 33.8 | 289 → 299 | within | within |
| dagobah | 80 → 81 | 1.33M → 1.33M | 11.1 → 13.6 | 119 → 122 | within | within |
| lothal | 95 → 89 | 1.24M → 1.21M | 14.9 → 35.1 | 175 → 190 | within | within |
| nevarro | 145 → 151 | 1.30M → 1.30M | 27 → 54.5 | 324 → 329 | within | within |

### low (the row: 350 calls, 0.8M triangles, 20 MB of models)

| world | calls before → after | triangles before → after | models MB before → after | textures before → after | the row before | the row after |
| --- | --- | --- | --- | --- | --- | --- |
| hoth | 160 → 177 | 0.63M → 0.70M | 18.1 → 19.3 | 760 → 865 | within | within |
| endor | 167 → 188 | 1.36M → 1.15M | 14.6 → 16.8 | 267 → 386 | tris over | tris over |
| tatooine | 97 → 103 | 0.53M → 0.53M | 26.9 → 27.9 | 333 → 348 | MB over | MB over |
| yavin | 74 → 107 | 1.03M → 0.87M | 12.4 → 13.6 | 339 → 398 | tris over | tris over |
| naboo | 594 → 533 | 1.38M → 1.19M | 27.8 → 28.8 | 467 → 500 | calls, tris, MB over | calls, tris, MB over |
| kamino | 156 → 106 | 1.05M → 0.78M | 10.8 → 11.7 | 189 → 231 | tris over | within |
| geonosis | 205 → 200 | 0.78M → 0.73M | 26.7 → 28.9 | 415 → 444 | MB over | MB over |
| coruscant | 209 → 289 | 0.87M → 0.99M | 22.1 → 24.1 | 180 → 436 | tris, MB over | tris, MB over |
| scarif | 147 → 113 | 1.15M → 0.86M | 14.7 → 15.7 | 421 → 514 | tris over | tris over |
| bespin | 110 → 183 | 0.50M → 0.53M | 14.8 → 17.4 | 264 → 427 | within | within |
| kashyyyk | 108 → 213 | 0.93M → 0.86M | 14.5 → 14.8 | 307 → 433 | tris over | tris over |
| mustafar | 121 → 124 | 0.55M → 0.55M | 22.2 → 23.2 | 279 → 289 | MB over | MB over |
| dagobah | 80 → 81 | 0.81M → 0.81M | 9.8 → 10 | 117 → 120 | tris over | tris over |
| lothal | 95 → 89 | 0.80M → 0.78M | 13.6 → 14.6 | 167 → 182 | tris over | within |
| nevarro | 145 → 151 | 0.91M → 0.91M | 25.6 → 25.9 | 320 → 325 | tris, MB over | tris, MB over |

## What moved, and why

- **High**:
  - Every world stays within its row.
  - **Calls** rose where the crowds are the game's modular people: Yavin 75 → 154 (28 Rebel pilots and 23 Rebels, five draws each), Kashyyyk 108 → 185 (17 Wookiees at seven), Coruscant 208 → 289 and Bespin 196 → 261 (the clones, the stormtroopers and the city civilians at seven to ten). The Meshy figures they replace were one draw each.
  - **Triangles** fell on most worlds: the light cuts are the game's LOD4.
  - **Models** rose with the full cuts the ledger admitted (about 30 MB a world at high, `FULL_SHARE`).
- **Low**:
  - **Within the row** where they were over before: Kamino (1.05M → 0.78M triangles) and Lothal.
  - **Within, needing smaller light-cut maps**: Hoth. It reached 20.5 MB of models against 20 until the light cuts of the ten kinds of five or more materials, C-3PO and the tauntaun took 512 and 256 maps (the design's "a smaller map, said in the PR"); then 19.3 MB.
  - **Over before and still over**: every other world over before is over still, on the same measures.
  - **Calls**: none is over its row.
- **No world's `life` counts were lowered.**
- **Draws a figure** (one a material; the import joins parts per material, `--join`; the cast casts its body's shadow alone):
  - stormtrooper, scout and C-3PO: 2 or 3
  - Rebels, pilots, officers and sandtroopers: 5
  - Hoth trooper and Wookiee: 7
  - city civilians: 8 to 10

  Fewer needs an atlas per kind, which the import doesn't make (the hand-off's Left).

## Each kind’s files

The full cut is in `site-assets` (the download, then its maps on the GPU at a byte a texel, the game's KTX2); the light cut is committed, WebP decoded to RGBA8 on the GPU; the far cut is committed.

| kind | full cut: download · GPU | light cut: file · GPU | far cut |
| --- | --- | --- | --- |
| c3po | 24.8 MB · 44 MB | 358 KB · 6 MB | — |
| clone | 19.6 MB · 33 MB | 531 KB · 20 MB | 114 KB |
| clonephase1 | 22.3 MB · 39 MB | 501 KB · 20 MB | 123 KB |
| deathtrooper | 12.8 MB · 21 MB | 496 KB · 20 MB | 108 KB |
| hothtrooper | 27.0 MB · 50 MB | 537 KB · 12 MB | 110 KB |
| rebel | 15.3 MB · 38 MB | 274 KB · 10 MB | 138 KB |
| rebelpilot | 23.8 MB · 37 MB | 299 KB · 10 MB | — |
| rebeltech | 12.8 MB · 19 MB | 379 KB · 23 MB | — |
| sandtrooper | 16.9 MB · 29 MB | 369 KB · 10 MB | 113 KB |
| scouttrooper | 25.4 MB · 48 MB | 476 KB · 16 MB | 70 KB |
| shoretrooper | 12.3 MB · 21 MB | 614 KB · 20 MB | 126 KB |
| snowtrooper | 17.4 MB · 26 MB | 314 KB · 10 MB | 144 KB |
| stormtrooper | 24.7 MB · 48 MB | 529 KB · 16 MB | 110 KB |
| wookiee | 18.6 MB · 34 MB | 635 KB · 9 MB | — |
| officer | 26.2 MB · 56 MB | 233 KB · 10 MB | — |
| civcity1 | 41.8 MB · 81 MB | 568 KB · 14 MB | — |
| civcity3 | 44.3 MB · 80 MB | 436 KB · 13 MB | — |
| astromech | 17.8 MB · 32 MB | 525 KB · 16 MB | — |
| droid | 1.6 MB · 2 MB | 122 KB · 4 MB | — |
| ewok | 8.3 MB · 11 MB | 944 KB · 15 MB | — |
| probe | 3.4 MB · 4 MB | 234 KB · 8 MB | 35 KB |
| r5 | 1.6 MB · 2 MB | 152 KB · 4 MB | — |
| superdroid | 18.8 MB · 36 MB | 566 KB · 24 MB | 71 KB |
| tauntaun | 11.4 MB · 27 MB | 448 KB · 4 MB | — |
| droideka | 8.8 MB · 16 MB | 239 KB · 8 MB | 55 KB |

The packs:

| pack | clips | size |
| --- | --- | --- |
| `clips-humanoid.glb` | 31 | 1,002 KB |
| `clips-b2.glb` | 22 | 432 KB |
| `clips-droideka.glb` | 12 | 215 KB |
| `clips-ewok.glb` | 24 | 617 KB |
| `clips-astromech.glb` | 6 | 22 KB |
| `clips-probe.glb` | 5 | 30 KB |
| `clips-tauntaun.glb` | 10 | 226 KB |

## The animation check

`node scripts/anim-check.mjs --route '#/galaxy/hoth/surface' --limit 0.15 --strict --quality high` exits 0.

- **What it saw**: 34 figures (Hoth troopers, Rebel pilots, R4, the tauntauns, Luke), none at the bind pose and none in step, every one playing the game's idle.
- **The limit**: headless, they stand out of the camera's view, so it proves that they load and play and little more.
