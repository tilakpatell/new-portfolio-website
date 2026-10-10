# Phase 0 of the 2017 pipeline: the one real model the tools were tried on

`hiltluke-three.png`: Luke’s lightsaber hilt (`gameplay/equipment/heroes/lightsaberlukeskywalker/lightsaberlukeskywalker_meshp_mesh`), fetched from the bucket on 2026-10-10 by `scripts/bf2017-fetch.mjs`, imported by `scripts/bf2017-import.mjs … --kind hiltluke --as 'Luke’s lightsaber hilt' --asis --tex 512 --maps 256`, and shot with `node scripts/glb-shot.mjs public/models/galaxy/surface/hiltluke.glb … three` through the dev server.

- The bucket held its three maps as KTX2 only (512², UASTC: colour, `__normal`, `__orm_451a9622`); no PNG yet, so each was unpacked with `basisu -unpack`.
- Out: LOD0 (the model has one), 920 triangles, one draw, three WebP maps, 212.3 KB, 0.06 × 0.29 × 0.06 m, standing on y = 0. No `Wep_Root` in the file, so the `grip` node sits at the model’s own origin.
- It reads as it should: upright, metal, textured, the grip’s ribs and the emitter’s shroud in place.

The file, its catalogue line and its credit were deleted after the shot: phase 0 ships tools, phase 1 ships the models (`docs/superpowers/plans/2026-10-10-bf2017-phase1-heroes.md`).
