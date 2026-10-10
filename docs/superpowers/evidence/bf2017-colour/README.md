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
| tatooine | `before/tatooine-high.jpg`: calls 94, tris 689,584, tex 303, models 26.1 MB | `after/tatooine-high.jpg`: calls 86, tris 689,352, tex 303, models 26.1 MB | cc0 47 → 0, game 3 → 39 |
| endor | `before/endor-high.jpg`: calls 216, tris 1,842,216, tex 330, models 14.5 MB | `after/endor-high.jpg`: calls 216, tris 1,842,216, tex 330, models 14.5 MB | cc0 49 → 0, game 2 → 42 |
| naboo | `before/naboo-high.jpg`: calls 507, tris 1,642,903, tex 456, models 26.3 MB | `after/naboo-high.jpg`: calls 506, tris 1,642,789, tex 455, models 26.3 MB | cc0 49 → 0, game 1 → 42 |

The after-run on `main`'s photo scans counted `game 1` to `3` already: the levels' probes and skies under `public/textures/galaxy/bf2017/light/`, which are not roles. The first after-run of Naboo counted one cc0 fetch: `/public/cc0/galaxy/index.json`, the set's index served by the dev server as a module import, not a map; the census now counts the maps themselves (`.webp`, `.ktx2`, `.png`, `.jpg`, `.avif`).

At this distance the grain is the same size on both sets (the roles' `metres` are the game's own, 2 to 6 m a tile), so the shots differ in the grain's character rather than its scale: look at the Tatooine homestead's walls and the ground by the ship, and Endor's trunks.

## The buckets, through the Supabase connector (2026-10-10, 22:55 UTC)

The owner attached a Supabase connector; the storage host itself stays refused by the environment's network policy, but the connector's SQL reads the storage catalogue (`storage.objects`: names and sizes, never bytes). Measured from it:

| bucket | objects | GB |
| --- | --: | --: |
| `bf2017-assets` `web/` (textures 28,277 at 21.85 GB; models 49,903; collision 12,941; physics 10,649; anims 8,074 + 2,196 additive; movies 161 at 5.73 GB; maps 264; terrain 111; svg 702; fonts 23) | 113,436 | 32.05 |
| `bf2017-assets` `data/` (the records) | 83,983 | 0.24 |
| `site-assets` (the published files, by hash) | 8,834 | 7.42 |

**Every published file answers.** All 1,246 entries of `src/data/galaxyAssets.json` are in `site-assets` at `<hash>/<path>` with exactly the manifest's bytes and `max-age=31536000`; the 492 published KTX2 maps among them. The mirror manifest (`assets-manifest.json`) is empty on this branch, so nothing of the site's own is served from the bucket. What SQL cannot tell is a published map's colour-space tag (the bytes are not in the database): `node scripts/bf2017-colour-check.mjs --published` does that once the host is reachable.

**The maps the packs wanted.** Hoth's `recipes.json` names 11 maps and the pack holds 10; the one it lacked at build, `T_StarCruiserMC80Panels_01_NS`, is still not in the bucket (no object under `web/textures/` matches `starcruisermc80panels_01` at 22:57 UTC): it is one of the 1,788 maps the desktop never encoded (lane D's list, `web_opt/_surfaces_list.tsv`). The space packs carry no `recipes.json` on `main`.
