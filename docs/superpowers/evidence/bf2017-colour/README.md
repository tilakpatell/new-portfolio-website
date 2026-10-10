# The colours, everywhere: what the audit found and what the worlds look like

The design: `docs/superpowers/specs/2026-10-10-bf2017-colours-everywhere-design.md`. The session had no bucket key, so every number here is from the files on `main` at `e128ec47` (#371) and the roles already committed.

## The audit (`node scripts/bf2017-colour-check.mjs`)

Before the fix, over `public/models/galaxy/bf2017` (the packs hoth, sb_endor, sb_kamino, and fx):

| files | colour maps sRGB | colour maps linear (wrong) | data maps linear | data maps sRGB (wrong) | unknown |
| --: | --: | --: | --: | --: | --: |
| 907 | 132 | **180** | 588 | 0 | 7 |

The 180 are every UASTC-encoded `_cs` and `_c` map in the packs; the 132 sRGB ones are the ETC1S encodes. The seven unknown are `t_swatch_*` maps with no suffix; `--formats web/textures.jsonl` decides them (the plan's task 5). After `--fix`: 312 colour maps sRGB, 0 wrong. The 29 roles: whole (three maps each where the index says, every one credited EA DICE's).

## The worlds on the game's roles

`QUALITY=high` in software GL through `scripts/galaxy-check.mjs surface tatooine,endor,naboo`, the page's clock held and its random numbers seeded, so the two runs see the same world. `before-*.png` is `main` (the photo scans, `scans cc0 n game 0`); `after-*.png` is this branch (`siteOf`'s default `look.scanned: 'bf2017'`, `scans cc0 0 game n`). The counts (draw calls, triangles, textures, models MB) do not move: the roles are the same roles under the same `wear`/`dress`, only their files differ.

| world | before | after | scans fetched before → after |
| --- | --- | --- | --- |
