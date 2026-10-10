# Hoth on the game's level: before and after

Lane L (`docs/superpowers/plans/2026-10-10-bf2017-phaseL-levels.md`). Shots by `scripts/surface-shot.mjs` in software GL (SwiftShader), 1280 × 720, halved here; the clock held and the random numbers seeded.

| sheet | what |
|---|---|
| `landing.jpg` | the landing, before and after: the game's ground under the site's landing |
| `echo.jpg` | the site's built Echo Base (before) against the game's glacier and its west mouth (after). The mouth reads weakly: the site's ground grid (5 m on high) draws the glacier's face across the game's terrain hole, over the rock arches. Left for the next session: holes in the ground mesh, or a finer grid at a level's mouths |
| `trench.jpg` | the site's built trench (before) against the game's trench line, carved into its ground, an Atgar tower on its rim (after) |
| `field.jpg` | the battlefield after, on high and on low: the same layout, low drawing a 1 m thing to 35 m |

The budget, `BUDGET=1 node scripts/galaxy-check.mjs surface hoth` (the baselines in `lab/baseline/`; low and ultra have none, so the row alone):

| tier | calls | triangles | models MB | row |
|---|---|---|---|---|
| low | 165 | 657k | 15.6 | pass (350, 0.8M, 20) |
| mid | 162 | 655k | 16.1 | pass (274 baseline, 1.24M, 40) |
| high | 152 | 818k | 16.5 | pass (274 baseline, 1.66M, 60) |
| ultra | 153 | 1.69M | 19.3 | pass (1,500, none, 240) |

Each run also prints one page error, the `mvPosition` shader error in an unnamed `MeshBasicMaterial`: there before this lane, on every world (Tatooine too), and the reason the script exits 1.

GPU texture memory (every texture a material in the scene holds, compressed ones at their mip data, others as RGBA with mips), after walking the mouth, the trench line and the plain: the level's own maps 47.1 MB on high and 12.4 MB on low; the whole scene 321 MB on high and 135 MB on low by this estimate, against Tatooine's 531 MB on high by the same estimate (the site's own sky, ground and figure maps; the estimate counts uncompressed images at full RGBA).

`hoth-check`: everyone on Hoth a model, nothing built, in the walk and the Battle of Hoth. `anim-check --route '#/galaxy/hoth/surface'`: every figure in view under 0.15 m/s.
