# Lane F: the galaxy's effects in the 2017 game's look

Shot at `high` in headless Chromium (software GL) by `scripts/bf2017-fx-shots.mjs`, each effect fired through the dev hook `window.__surface.fx(name, { look })` at a spot 4.5 m before a held view, 0.15 s of scene time after: on the left the site's own look alone (`look: 'site'`, the before), on the right the game's (the after). Each sheet is a world, two columns a row:

- `hoth.jpg`: a grenade, the snow impact, the Force push, an AT-ST going up (alphabetical rows: `blast.grenade`, `blast.walker`, `impact.snow`, `push`).
- `tatooine.jpg`: a fighter (it goes up above the held view; its scorch is what shows), a speeder, the sand impact, the push.
- `endor.jpg`: a grenade, the metal impact (forced), the stone impact.
- `bloom-dogfight.jpg`: the space battle at Endor with the game's burst and ramp on the flashes (`scripts/galaxy-bloom-check.mjs`).
- `galaxy-check-high.json`: `galaxy-check.mjs surface hoth,endor,tatooine` with `BUDGET=1`.

## The numbers

| | |
|---|---|
| the drop's effect textures in the bucket (06:00) | 55 of 323 |
| sheets shipped (the game's KTX2, top levels dropped) | 6 sheets, 8 files, 551 KB; the largest 147 KB (`scorch.metal.512`) |
| meshes shipped | 8 sets, 100 KB; the largest 28 KB (`debris.walker`) |
| the set | 651 KB of the 6 MB cap; a visit at high loads about 534 KB, once |
| published to `site-assets` (over 64 KB) | 4 files, 426 KB, `assets-check` 4 of 4 right |
| draw calls an effect kind adds while it plays | 1 (one `InstancedMesh` a sheet and mode, one a chunk's shape); 0 at rest |
| a bolt's flashes | 1 draw (12 meshes before) |
| chunks at low, mid, high | a quarter, a half, all (snow 6 → 2, capped at 48 a shape at high) |

`galaxy-check` at high (BUDGET=1), with the effects in the scene:

| world | calls | triangles | models | result |
|---|---|---|---|---|
| Hoth | 166 of 274 | 0.88M | 22.7 of 60 MB | pass |
| Endor | 167 of 257 | 2.05M | 16.6 of 60 MB | pass, against its own baseline (known over the row) |
| Tatooine | 95 over its 84 | 0.71M | 31 of 60 MB | fail, as main and #815 measure it (97 there): it predates this lane |

The calls are #815's own (166, 167; Tatooine 95 against its 97): the effects add none at rest.

The bloom (`galaxy-bloom-check.mjs high`, threshold 1.4, knee 0.5, strength 0.5), with the game's burst and ramp on the space flashes: panorama 0.09% of pixels over 0.9 luma, flagship 0.05%, dogfight 0.25% (at most 0.5%); the dogfight's darkest half at 0.0089 (at most 0.03). All good. The additive peaks were set once against it: a blast's burst core 1.7 (over the threshold for its first tenth of a second, then under), a ring 1.1, an ember 1.3, the push's rim 1.2 at its brightest and fading as k², the bolts' flash 3.2 × 0.6 at its first frame, as before.

Frame p95 with twenty bolts and two blasts on screen needs a graphics chip; software GL's frame times here (Hoth p95 4 s) mean nothing for that.
