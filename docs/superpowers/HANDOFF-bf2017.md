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
| G | lane G session | `claude/bf2017-g-light` | (the PR) |
| K | | | |
| X | | | |
| S | | | |

### Lane G, the worlds under the game's light

**Done** (`claude/bf2017-g-light`):

- `scripts/bf2017-light.mjs <world> --map <level> [--indoor <probe id>] [--main <VE>] [--also <VE>,…]` reads the map's `sky[]`, the raw VisualEnvironment records under `data/` (a superset of the map's `extras.json` copy: it has the wind and Enlighten's bounce), the level's reflection probes and its grading LUTs, and writes `src/data/bf2017/light/<world>.json` plus a pack under `public/textures/galaxy/bf2017/light/<world>/` (64² probe faces with the sun clipped out, 17³ LUT strips; every world under 400 KB, 2.1 MB for the ten). The pure reading is `scripts/lib/bf2017-light.mjs`, tested on a trimmed real record (`scripts/fixtures/bf2017/data/ve_sky_fixture.json`).
- `src/lib/three/gameLight.js`: `siteLightFrom(entry)` and `gameSite(site, light, state)`, the record to the site's `sky`, `light` and `fog`. Three constants set once on Hoth's sunny weather and held for every world: `GAME_TO_SITE` 0.0713 (the sun's lux, exposed by the game's own metering), `SKY_TO_SITE` 0.2006 (the record's `LuminanceScale`, exposed, to the dome's horizon and the fill), `PROBE_TO_SITE` 52.4 (the fallback for a record with no sky level). The ice field's mean luminance: 0.3529 under the site's own light, 0.3531 under the game's. The camera's exposure is the game's: a grey card lit by the sun and the record's sky, clamped to the record's EV range. Every world's before and after, with its change, is in `docs/superpowers/evidence/bf2017-light/README.md`.
- `src/components/galaxy/surface/gameLit.js`: the probe as `scene.environment` (the room's indoors; one alive at a time, `probeEnv.js`), the LUT in `universe/post.js`'s final pass on high and ultra (`grading()`, the house's contrast and saturation stepping aside), the weathers faded over 20 s (`__surfaceDo('weather', 'dusk', seconds)` in dev). `?gamelight=off` (dev) shows a world under the site's own light for a before shot; `surface-shot.mjs` takes `QUERY=` and `WEATHER=`.
- Wired (`gameLight` on the site): hoth, tatooine, yavin, kashyyyk, kamino, geonosis, scarif, bespin, endor. Worlds without a record (nevarro, mandalore, sorgan, lothal, coruscant, dagobah, mustafar) are unchanged, tested.

**Findings**:

- The sun's direction is in the record (`SunRotationX` the azimuth, `SunRotationY` the elevation, degrees): every world took that path; `sunFromProbe` is the fallback no world needed (the probes' brightest texels are lamps and glints).
- Hoth's weathers are sunny, sunset and interior (the only VE records the bucket has: Blizzard has a LUT only, Cloudy nothing). The probes of a level's weathers are not baked to one scale (Hoth's Sunset_VFX probe is a day's, and not orange), so a probe gives colours, never a level.
- Under the one calibration: Geonosis, Scarif, Bespin and Yavin within 8 % of the site's own; Kamino +14 % (a teal storm); Tatooine +25 % and Kashyyyk +39 % (higher suns and skies); Hoth's hangar mouth −36 % (in shade only the fill lights, and the game's is the lower).
- Probes per world: hoth 661f4d0f (Cloudy_VFX) and 36a2b5e2 (Sunset_VFX), indoor 9c323d00 (the hangar); yavin, kashyyyk, naboo, kamino, geonosis, scarif, bespin one or two each (in the JSON); tatooine none out of doors (only its buildings'), endor none by day (Foggy_Lighting and Night_Lighting2 only): those keep the dome as their environment.
- The LUTs are 33³ volumes as 33 png16 slices (blue the slice, green the row from the top, red the column), display-space S-curves.
- The interior's exposure is not applied in a room (the game's opens 4.5 stops over the day; the site's rooms are lit by its own lamps at exposure 1).
- Endor's surface does not finish loading under the software renderer, before or after (the shots are left); a `mvPosition` shader error on a MeshBasicMaterial predates the lane.

**Left**:

- **The far shadow** (task 3), with lane L: the distant shadow cache is a 16-bit depth map seen from the sun, not a top-down mask, and it is the game's terrain's. Fit the sun's orthographic frame (the record's direction, the heightmap's 8,192 m square) to the cache, then sample it beyond `SHADOW.extent` in `groundLook.js` and the far draws.
- **The placed lights**: exported now (`maps/<level>.extras.json`, `lights[]`, 1,234 on Hoth) and not yet used; the site's lamps stay.
- **Naboo**: its JSON is written and not wired. Its level is Theed at dusk (350 lux, 5° up); under the one calibration the field is 62 % darker, its people in silhouette, the game's dusk being carried by Enlighten's bounce and its lamps. Wire it with the placed lights, or with a bounce term.
- **Hoth's sunset** (dev only): its probe is a day's, so the dome reads pale rather than orange, and its fill is twice noon's.
- The Death Star (no surface site; its map names no sky). Nothing drives the weather states yet (the dev hook only); a weather fade moves the sun but not the ground's baked shadows.

Findings for the next lane go here: which sub-levels each map needed, what `fitTo` dropped per tier, the calibration factor and which path each world’s sun direction took, which skins were still missing, which clips’ windows were pinned by hand.
