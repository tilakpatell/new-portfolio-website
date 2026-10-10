# Hand-off: the Battlefront II (2017) pipeline

The designs: `docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md` (the pipeline: fetch, import, the rig, the phases; PR #802) and `docs/superpowers/specs/2026-10-10-bf2017-levels-lighting-sabers-design.md` (the levels, the light, the planet skins, the sabers, and the review of the first design). The bucket’s numbers, `docs/superpowers/evidence/bf2017-assets/inventory.md`; the drop and its credit, `docs/assets/battlefront-2017.md`.

## Done

- **The design, the inventory and the plans** (PR #802, carried by the phase 0 PR).
- **Phase 0, the tools** (PR #805): the decision entry and the assets page; `scripts/bf2017-fetch.mjs` and `scripts/bf2017-import.mjs` over five tested modules under `scripts/lib/` (`bf2017-manifest`, `bf2017-paths`, `bf2017-textures`, `rig-parts`, `catalog-write`); the committed fixture (`scripts/fixtures/bf2017/`, 39.6 KB); the empty `catalog/bf2017.js`, last in `GROUPS`. Nothing on the site changed. Tried on two real models and nothing kept: Luke’s hilt (920 triangles, 212 KB, the shot in `docs/superpowers/evidence/bf2017-phase0/`) and Luke’s rotj body with `--rig` (the whole rig kept, 254 joints with fingers, face and physics; LOD2 706 KB, LOD4 236 KB; drawn in its bind pose).
- **The second design and four more plans** (this PR): lanes L, G, K and X below, and the corrections to the first design (its section "The review of #802").
- **On the desktop, 2026-10-10 00:20**: the 102 planet skins encoded (KTX2 at up to 4096, hybrid) and linked raw, both queued; 164 clips with `~` in their names (refused by Supabase as `InvalidKey`) renamed `-`, `web/anims.jsonl` rewritten and re-uploaded; 119 physics files queued. The pipeline’s upload passes pick them up (`logs\pipeline_status.txt`).

## The lanes

| Lane | Plan | What | Starts from | Blocked by |
|---|---|---|---|---|
| 1 | `2026-10-10-bf2017-phase1-heroes.md` | the heroes on the game’s skeleton, the game’s clip packs, the hilts in `Wep_Root` | `main` | nothing |
| 2 | `2026-10-10-bf2017-phase2-everyone.md` (on #802’s branch) | everyone else the game has | `main` after 1 | 1 |
| S | `2026-10-10-bf2017-phaseS-streaming.md` (on #802’s branch), **amended below** | the fetch pool, aborts, the small cut first, the stream check | `main` | nothing |
| **L** | `2026-10-10-bf2017-phaseL-levels.md` | the worlds on the game’s levels: the map’s layout, the heightmap, the shapes, cell-streamed; Hoth first | `main` | nothing (lane S’s pool when merged; `fetch` until then) |
| **G** | `2026-10-10-bf2017-phaseG-lighting.md` | the worlds under the game’s light: VisualEnvironment records, probes, the baked far shadow, grading, weather | `main` | nothing (its far-shadow hook into lane L’s far draws when L is merged) |
| **K** | `2026-10-10-bf2017-phaseK-planet-skins.md` | the planets wearing the game’s skins from orbit | `main` | the skins landing in the bucket (queued; check) |
| **X** | `2026-10-10-bf2017-phaseX-sabers.md` | the sabers from the game’s clips: stroke tables, the stance, the hold, the blade’s light | `main`; tasks 3–4 after 1 | 1 for tasks 3–4 |
| V | `2026-10-10-bf2017-phaseV-vehicles.md` (on #802’s branch) | vehicles | `main` after 2 | 2 |
| F | `2026-10-10-bf2017-phaseF-effects-lighting-lines.md` (on #802’s branch) | effects; its task 3 (lighting) is lane G’s now; its task 4 (sound) waits on an exporter, see below | `main` after L, G | L, G |
| W | `2026-10-10-bf2017-phaseW-worlds.md` (on #802’s branch) | **superseded by lane L**; do not run | | |

One lane per session; L, G, K and lane 1 may run at once (they own different files; `sites/ice.js` is touched by L and G, each on its own keys; merge `origin/main` before the PR and keep both sides). X after 1.

### Lane S, amended

`main` already has the asset host (planet flight lane I): `src/lib/assetBase.js`, `src/lib/assetPath.js`, `scripts/assets-upload.mjs` (bucket `assets`, `<hash12>/<path>`, a year’s cache, `--prune`), `src/data/assets-manifest.json`, the packs and the service worker carrying bucket URLs, `VITE_ASSET_BASE`. Lane S therefore does **not** create `assetUrl.js`, `galaxyAssets.json`, `assets-publish.mjs`, `assets-ignore.mjs` or a `site-assets` bucket. It keeps: task 1 (`scripts/lib/pool.mjs`), task 2 (the fetch made robust), task 4’s `assetFetch.js` and `progressive.js` with `assetBase.js`’s `withFallback` calling the pool (one in-flight per URL, priority, the short-body check, abort per world, progress), task 6’s `stream-check.mjs`. Task 3 becomes: `REMOTE` in `assets-upload.mjs` gains `models/galaxy/bf2017` and `textures/galaxy/bf2017`; `catalog.test.js`’s size checks read `assets-manifest.json`’s `bytes` when a file is absent. Task 5 (the service worker) is already done by lane I; check `sw-check.mjs --bucket` and drop the task if green.

### Lane K: the planet skins

**Done** (`claude/bf2017-k-planets`). The bucket listed 103 planet textures on 2026-10-10 (`web/textures.jsonl`); every non-sequel one was fetched (69, all as PNG) and looked at. The space levels' colour (`_CS`, smoothness in alpha), normal (`_N`, `_NI`) and cloud maps (coverage in alpha) are whole-planet maps stored square and seamless round the planet: the game's planet meshes (`levels/space/*/planet/planet_*_mesh`, `objects/planets/_planetmeshes/planet_01_mesh`) bind no texture (a shader asset, `SS_Planet_*`, does) and carry UVs once round and pole to pole once, so the site lays them on the same way. The front end's `_CA` globes, Endor's gas giant and Yavin's are pictures of a lit disc.

- Skinned: **Endor** (colour, relief, clouds, its air's colour), **Naboo** (colour, relief, clouds), **Kamino** (colour, its sea), **Bespin** (colour), **Geonosis** (rings only).
- Stay procedural, their only maps being pictures (`PICTURES`): Endor's gas giant, Geonosis's globe, Hoth, Kashyyyk, Scarif, Tatooine, Yavin, Yavin 4.
- In the drop with no body on the site (`UNPLACED`): Ryloth and its moon, Fondor and its moon, Athulla, Sullust, Pillio, Vardos (whole-planet maps like Naboo's), Kessel, Felucia, the Death Star II (globes), Naboo's moon.
- The code: `scripts/bf2017-planets.mjs` over `scripts/lib/bf2017-planets.mjs` (`SKINS`, `PICTURES`, `planFor`, `convertSkin`; fixture `scripts/fixtures/bf2017/web/textures/levels/space/sb_endor_01/planet/`), `src/data/planetSkins.json`, `public/textures/galaxy/planets/<id>/<kind>-<tier>.webp|ktx2` (mid 1024, high 2048, ultra the colour and normal UASTC; never larger than the game drew it), `bodySkin.js` (the chunk, spliced in only for a skinned body: an unskinned one compiles byte for byte what it did, `bodySkin.test.js` holds each family's hash), `bodies.js` (loads a skin on mid and up, not low or a small body; eases it out between 1.5 × and 1 × the air's top, the air's colour with it; frees every map with the body), `REMOTE` gains `textures/galaxy/planets`. Scarif's shield shaders moved to `bodyShield.js` (re-exported) to keep `bodyShaders.js` under 800 lines.
- The shots: `docs/superpowers/evidence/bf2017-planets/`.

**Left**: `assets-upload.mjs` for the new files (the owner's key). Asked of the desktop export: the `SS_Planet_*` shader assets (how the game tints and mixes the maps) and whole-planet maps for the worlds that have only a globe picture. Not checked: the relief's sign at a grazing sun (`greenDown`; the shots are lit from the default angle); a skinned planet flown down to in a real browser (the mix is unit-tested; the shots are from orbit). The game shows only a planet's facing half (its planets are backdrop domes, `planet_endor_02_mesh` 81 m wide and 20 m deep, UVs u 0.23–0.73 over 180°): the site wraps the same map once round, the same scale, and the back is the map's own seamless remainder. For the space layer, not this lane: the 2:1 sky panoramas the desktop is encoding (`textures/levels/space/sb_endor_01/planet/t_space_endor01_c`, `textures/lighting/textures/space/t_space_01_c`, `t_space_no_large_stars_01_c`, Athulla's, the sky cube `textures/levels/sp/a1/m1end/lighting/textures/t_sky_space_01_c`) and the generic prop planet (`objects/planets/_planetmeshes/planet_01_mesh`, `t_planet_01_rgba`, `t_planet_01_n`). The front end's globes could tint the galaxy map's discs (the plan's optional task; not done). A world placed later (Ryloth, Fondor…) takes its maps by a line in `SKINS`.

**Checking it**: `NODE_USE_ENV_PROXY=1 node scripts/bf2017-planets.mjs --dry` (keys in the environment), then without `--dry`; `QUALITY=high OUT=/tmp/s node scripts/galaxy-check.mjs space naboo,endor,bespin`.

## Left

In order:

1. **Lane 1**: the owner chose, on 2026-10-10, to keep the 2017 rig in full: no pruning, no renaming to Meshy’s names; the site learns the game’s skeleton. Phase 0’s rig prune (plan task 4) was written, tried on Luke (254 joints to 63, and his fingers and face went with it) and then taken out; the import keeps all 254 and puts `grip` under `Wep_Root`. Its first rigged import should check `skins.length === 1` and that a figure’s joint count equals its body’s (the parts’ duplicate skeletons joined by `rig-parts.mjs`). Its task 2 adds parts by full manifest name (Luke’s head and hair are under `characters/heads/`, not his body’s folder: the body alone is 1.596 m and headless) and the spine rename; both go into `partsOf`, so the fetch’s `--parts` takes names too. The clips are glTF on the game’s skeletons (`web/anims.jsonl`; 164 renamed today: a name with `-<8 hex>` was `~<8 hex>` in an older manifest).
2. **Lanes L, G, K, X** as the table says.
3. **Textures**: every map the hilt and Luke’s body name was in the bucket as KTX2 on 2026-10-10, none as PNG. A map not there yet prints `missing:` in the import and the material goes without it; re-fetch and re-import when the upload has it.
4. **Normals as KTX2** (UASTC) where `scripts/ktx2.mjs report` says it pays: phase 9’s, with the ultra cuts. Level packs (lane L) take the bucket’s KTX2 as it is, for GPU memory.

## Asked of the desktop exporter (not the site’s work)

The export in `C:\Users\tilak\Downloads\BF2_Extract` (`tool\bf2export.csproj`, Frosty’s libraries) does not write these; each is a `bf2export` pass and a queue, the way `run_terrain.py` and `tool\build_maps.py` were added:

- **Lights**: the map builder counts them (Hoth: 1,234) and writes none. `maps/<level>.lights.json` with type, position, direction, colour, intensity, radius, cone, per sub-level, would give lane G the hangar’s lamps and Theed’s lanterns.
- **Effects**: counted (Hoth: 648), not written. The spawn points with the effect’s name would tell lane F which effect plays where.
- **Audio**: `GUIDE.md` says 17,509 sound assets, not exported. Frosty can write a `SoundWaveAsset` as `.wav`; without a `bf2export sound` pass, lane F’s sound map stays `null` for good.
- **Decals**: painted into the terrain resource, no transform; not needed.

## Checking it

The keys: `SUPABASE_URL` and `BF2017_KEY` (a key that can read the private `bf2017-assets` bucket) in `.env.local`, never committed; the owner holds them. In a cloud session they are already environment variables (the key as `SUPA_KEY`; the fetch takes either), so drop `--env-file`.

```
node --env-file=.env.local scripts/bf2017-fetch.mjs manifest
node --env-file=.env.local scripts/bf2017-fetch.mjs --list 'gameplay/equipment/heroes/*'
node --env-file=.env.local scripts/bf2017-fetch.mjs gameplay/equipment/heroes/lightsaberlukeskywalker/lightsaberlukeskywalker_meshp_mesh
node scripts/bf2017-import.mjs gameplay/equipment/heroes/lightsaberlukeskywalker/lightsaberlukeskywalker_meshp_mesh --kind hiltluke --as 'Luke’s lightsaber hilt' --asis --tex 512 --maps 256
npx vite --port 5188 --strictPort --host 127.0.0.1 &
node scripts/glb-shot.mjs public/models/galaxy/surface/hiltluke.glb /tmp/hiltluke.png three
```

The bucket’s other parts, by path under `web/` (fetch one with the fetch’s `--raw <path>`, which lane L adds; until then `curl -H "Authorization: Bearer $SUPA_KEY" -H "apikey: $SUPA_KEY" "$SUPABASE_URL/storage/v1/object/authenticated/bf2017-assets/web/<path>"`):

| part | path | manifest |
|---|---|---|
| maps (74) | `maps/<level>/<level>.json` + `.bin`, `maps/index.json`, `maps/README.md` | `maps/index.json` |
| terrain (39 levels) | `terrain/<level>/*_height.png`, `*_detail.png`, `.json` | `terrain.jsonl` |
| physics (10,530) | `physics/<model>.json` | `physics.jsonl` |
| clips (10,270) | `anims/<skeleton>/<clip>.glb`, `anims_additive/` | `anims.jsonl` |
| light records | `data/Levels/Lighting/<World>/<Weather>/VE_*.json.gz`, `T_CC_*.json.gz` | `data.tsv` |
| probes, shadow caches | `textures/levels/<level>/reflectionvolumetexture/<variant>/<id>-tex_{px,nx,py,ny,pz,nz}.hdr`, `distantshadowcachetexture/<variant>/<id>-tex.png` | `textures.jsonl` |
| planet skins (102) | `textures/**/planet*/…`, `textures/levels/space/*/planet/`, `textures/objects/planets/` as `.png` and `.ktx2` | `textures.jsonl` |
| movies, fonts, svg, strings | `movies/`, `fonts/`, `svg/`, `strings/` | `misc.jsonl` |

The tests need no keys and no network: `npx vitest run scripts/lib/bf2017-* scripts/lib/rig-parts.test.mjs scripts/lib/catalog-write.test.mjs scripts/bf2017-import.test.mjs src/components/galaxy/surface/catalog`.

## Status

| Lane | Session | Branch | Merged |
|---|---|---|---|
| design | the architecting session | `claude/nice-mayer-jqow5k` | #802 (open), carried by #805 |
| 0 | | | #805 |
| second design | this session | `claude/bf2017-levels-lighting-sabers` | (this PR) |
| 1 | | | |
| L | | | |
| G | | | |
| K | the lane K session | `claude/bf2017-k-planets` | (its PR) |
| X | | | |
| S | | | |

Findings for the next lane go here: which sub-levels each map needed, what `fitTo` dropped per tier, the calibration factor and which path each world’s sun direction took, which skins were still missing, which clips’ windows were pinned by hand.

## Lane S: streaming, both ways

### Done

- **PR (this one, from `claude/bf2017-streaming`)**, built on lane I's mirror (PR #798), not beside it:
  - **The bucket to the pipeline**: `scripts/lib/pool.mjs` (six at once, 30 s plus a second a megabyte, three retries at 1, 2, 4 s, `Retry-After` honoured, a short body retried, a `.part` renamed when whole); `bf2017-fetch.mjs --all '<glob>' [--verify] [--pool n]` with one summary line and `lab/assets/bf2017/.index.json`. Luke’s eleven models: fetched 79 · kept 10 · missing 24 · failed 0 · 63.6 MB · 4.5 s, then kept 89 in 1.3 s.
  - **The site to the bucket**: the public bucket `site-assets` (made; `supabase/README.md`); `scripts/assets-publish.mjs` finds the game-derived files by their credit to the game, sends each new hash once to `<hash12>/<path>`, writes `src/data/galaxyAssets.json` last, then `.gitignore`’s block (`scripts/assets-ignore.mjs`). The build merges those entries into the one bundled manifest; lane I’s upload goes to the same bucket and its prune spares them; packs list them (`remoteOnly`) and the installer keeps asking the bucket for them.
  - **The site’s loader**: `src/lib/net/assetFetch.js` through `src/lib/assetLoad.js` at the shared `GLTFLoader`’s `load` and `textures.js`: 2 at once on a saver connection, 4 on a weak device or a phone, 6 on a desktop, 8 at ultra (the connection sets it, not the chip), the nearest first, one request per URL, a stall timeout, short bodies retried, a 404 sending that file alone to the site; every surface world’s loads aborted at its dispose. `src/lib/net/progressive.js` (which cut first, and when the plain is worth it); a figure on a saver connection fetches its `.lod1` only, and a plain that won’t come falls to the `.lod1`.
  - **Fidelity at ultra** (the owner’s direction mid-lane: a laptop on wifi, the best first): a walker and a figure now load the level’s own cut (the AT-AT came as plain and ultra both on main, 1.9 MB wasted, drawn from the plain); the dust shader compiles at ultra (`lib/three/dust.js`, outside the lane: one console error on every Hoth visit at ultra on main).
  - **The 404 rule**: a 404 on one hashed URL sends that file alone to the site’s path; only a real failure (network, timeout, retries spent) marks the bucket down for the visit.
  - **The abort rule**: an abort (the world left) rejects with an `AbortError`, is never a fallback and never marks the bucket down, and a late answer is dropped.
  - **Checks**: `scripts/assets-check.mjs` (walks both `galaxyAssets.json` and `assets-manifest.json`) (in `deploy.yml` when `ASSET_BASE` is set) and `scripts/stream-check.mjs`. The numbers: `docs/superpowers/evidence/bf2017-streaming/README.md`.

### Left

- **Lane W's folders**: `textures/galaxy/bf2017/<role>/` and `textures/galaxy/sky/` are in the mirror's `REMOTE` list (`scripts/assets-upload.mjs`, with `.hdr` and `.exr` as kinds), so a committed map or sky there is mirrored once it lands. If lane W keeps them out of git (they are game-derived), add those two folders to `assets-publish.mjs`'s list beside `models/galaxy/bf2017` instead.
- **Nothing is published yet**: `galaxyAssets.json` is `{}` until phase 1’s heroes are imported. Then: `node scripts/assets-publish.mjs --dry`, without, `node scripts/assets-check.mjs`, commit the manifest and `.gitignore`.
- **The progressive swap** (a figure drawn from its `.lod1`, the plain swapped in when it lands): `progressive.js` holds the rule, but a figure hands its animator and bones to sabers and combat, so swapping its mesh needs a figure-level facade in `actors.js`, which phase 1 is rewriting for the walrus loader. Until then the small cut first applies on a saver connection only, and at ultra (the laptop’s level) the full cut is always fetched first, as fidelity wants.
- **The HUD’s bytes line** (“Loading Hoth, 12 of 27 MB”): the world’s scope counts bytes (`debug().net`), but the loading veil reads the runtime’s prepare steps; wiring it is a runtime change.
- **A published hero with clips**: `catalog.test.js`’s clip check reads the file; a row with `anim` whose file is only published will fail it in CI. Phase 1 decides: its clips in a pack, or the check reading the published manifest of clip names.
- **Egress**: the free tier’s 5 GB a month is a few hundred visits. Pro (250 GB) before `ASSET_BASE` is set for everyone; if egress bills, the same `<hash12>/<path>` files on Cloudflare R2 and `ASSET_BASE` pointed there is the whole change.
- **The bucket’s name**: the parent session asked (after the lane was built) for lane I’s `assets` bucket and one JSON file; the owner’s brief named `site-assets` and `galaxyAssets.json`, so that stands until the owner says otherwise. Folding is mechanical: `BUCKET` in two scripts, and the merge in `scripts/assets-manifest.mjs`.

### Checking it

- The variable: the repository variable `ASSET_BASE` = `https://jzabcqboyemokwifmjmp.supabase.co/storage/v1/object/public/site-assets` (Settings, Secrets and variables, Actions, Variables). Unset, the site is exactly as before.
- The bucket: `node scripts/assets-check.mjs` (no key: the bucket is public).
- The stream: `NODE_ENV=development npx vite build --mode development --outDir /tmp/stream-dist && npx vite preview --outDir /tmp/stream-dist --port 4173 --strictPort --host 127.0.0.1`, then `node scripts/stream-check.mjs` (a laptop on wifi at ultra) or `--phone` (3G at mid). With `VITE_ASSET_BASE` in the build’s environment, the bucket is in the path.
- The fetch: `node scripts/bf2017-fetch.mjs --all 'characters/hero/luke/*'` twice; the second is all `kept`.
- The tests need no network: `npx vitest run scripts/lib/pool.test.mjs scripts/lib/asset-manifest.test.mjs scripts/assets-*.test.mjs scripts/stream-check.test.mjs src/lib/net src/lib/assetLoad.test.js src/lib/assetBase.test.js`.

