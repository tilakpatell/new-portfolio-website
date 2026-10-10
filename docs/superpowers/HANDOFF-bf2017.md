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

## Lane X, the sabers

**Done (tasks 1–2, #816).** `scripts/bf2017-strokes.mjs <hero>` measures a hero’s clips into `src/data/bf2017/strokes/<hero>.json` over `scripts/lib/bf2017-strokes.mjs` (tested against a 10 KB fixture, Luke’s first strike on the socket’s chain only, `scripts/fixtures/bf2017/web/anims/`). Each strike: duration, contact window, the way it cuts (`DIRS`), sweep plane, root rows, its return and the return’s length; blocks by side, blocked reactions, staggers, dodges, dash, jump attack, defeat, the generic humanoid (`A_HM_*`) where a set lacks one. `stanceFromTable.js` makes the table a stance; `gameStance.js`’s `stanceFor(id, hero)` gives it for `{ rig: 'walrus', pack }` with a table (kept out of `combatRules.js`, which the universe’s online protocol imports for `STANCE_IDS`: with the tables behind it the flight pages carried them and fly-check’s turret took 3.2 s against main’s 2.7); `strokeFor` reads a stance’s own `heavies` and `dirs`; `duel.js` takes `cadence` (held a strike’s length, open its return’s length after); `duelFor` finds the hero by the spawn’s kind in `CREW`. Nothing changes for a figure without `rig: 'walrus'`, and no figure on `main` has it until lane 1 merges.

**How the tables were made.** From the bucket (`node scripts/bf2017-strokes.mjs <hero>`, keys in the shell’s environment and the Supabase host allowed in the environment’s network settings; Node’s fetch needs `NODE_USE_ENV_PROXY=1` behind the session’s proxy): every `A_<Hero>_*` clip on the humanoid skeleton, the cinematics skeleton (Luke’s seven swing blocks a side and his six blocked reactions are there) and a hero’s own (Yoda’s, Grievous’s), nine tables in all. `--pack` measures one of lane 1’s packs instead, for a session without the bucket; its windows agree with the bucket’s to a frame. Grievous spells a strike with a take (`Strike3_01`) and a blocked reaction with a side (`Blocked_Right_02`); Yoda has no `_BackToIdle`, so his duel recovers on the site’s own timing; Palpatine’s set has no saber strikes, so his table makes no stance.

**Findings for lane 1.** The socket frame holds: `Wep_Root` (under `Spine2`) carries the blade along +y. But `bf2017-clips.mjs`’s windows, timed with ual-bake’s 0.15 m before the hips along +z, land on the snap out of the guard: a strike’s first key is the guard and its second already the wind-up, as fast as the cut (Luke’s Strike1 `[0.05, 0.10]`, the cut is 0.1–0.23 s). The tables skip the first key, count a frame only when it and the one before have the tip before the hips along +z (the root’s way; the hips’ own facing is worse, the game’s guard holds them 50° to 170° round), and add the root’s travel to the tip (Luke’s Strike4 and Obi-Wan’s are lunges). Two fixtures are pinned by hand: Luke’s Strike1 `[0.107, 0.293]`, Obi-Wan’s Strike4 `[0.274, 0.426]`. A pack’s turns are meshopt-normalised shorts: read them with `valuesOf`. The blade rests 0.33–0.9 s into a strike (`settle`) though the clips run 1.3–4.8 s (the game holds the pose for the chain); the duel holds a strike till `settle`, then its return’s length.

**Left.** Task 3 (after lane 1), and this lane must not reach `main` after lane 1 without it: `duelFor` hands a 2017 duellist the game’s names, which lane 1’s `saber.js` can’t find among a pack’s site names, so its strokes would swing nothing. So `saber.js` indexes a walrus figure’s clips by the game name in `userData.source` (the stance’s `clip` is the game’s, `site` the pack’s), and a stroke’s own `contact` wins over the pack’s `extras.contact` (lane 1’s, timed by the old rule) or the packs are re-made with this measure; the hold (lane 1 already skips `pose`/`poseLeft` and adds `Spine1`, `Spine2`, `Neck` to `ARMS`); wire `BLADE_OF` (`saberRules.js`, measured by `--blade` into `src/data/bf2017/blades.json`: each hilt’s emitter on its axis, a staff’s two, the rod’s 10 mm width; the rod is a 13 mm stub the game stretches, so the length stays 1 m) and `saberLight.js` (made with the saber on high and ultra, dark till lit, within 12 m of the eye) into `saber.js`. Task 4: the evidence, the frame time. Then the forms lane reads the tables (saber-forms B), the clash sheet (lane F), the sounds (an exporter).

**Checking it.** `npx vitest run scripts/lib/bf2017-strokes.test.mjs src/components/galaxy/surface/stanceFromTable.test.js src/lib/combat/duel.test.js`; `node scripts/bf2017-strokes.mjs luke --pack <pack> --skeleton <walrus.glb>` prints the table’s strikes.

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
| K | | | |
| X | lane X’s session | `claude/bf2017-x-sabers` | #816 (draft: tasks 1–2; 3–4 wait on lane 1) |
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

## Lane W: closed; lane L owns the worlds

Lane W (`docs/superpowers/plans/2026-10-10-bf2017-phaseW-worlds.md`) is superseded by lane L (PR #810's `-phaseL-levels.md`: each world drawn from the game's own level layout, heightmap and shapes, Hoth first). Lane W ends with the tools lane L can reuse (PR #823); it places nothing on any world.

### Done (PR #823)

- **Kits** (`scripts/bf2017-kit.mjs` over `scripts/lib/bf2017-kit.mjs`, tested on a two-piece fixture, no network): a level system's pieces in one GLB, a node a piece by its name at the game's own origin, each piece's parts joined by material, the materials shared and kept apart by name (the test caught `dedup` merging Hoth's `M_Wall` and `M_Floor`, alike in all but the name). `bf2017-import.mjs` exports its LOD reader for it. The kit row goes to a world's `catalog/bf2017-<world>.js`'s `KITS` (none in this PR) and its credit to `modelCredits.json`.
- **The surfaces' roles on the game's maps** (the owner's rule of 04:40, plan 003d83b19): `scripts/lib/bf2017-roles.mjs`'s `ROLE_SOURCES` (tested: every role, only the drop's textures, no sequel era) and `scripts/bf2017-textures.mjs` make all 29 roles under `public/textures/galaxy/bf2017/` (16 MB; the scans' set is 13 MB). Chosen from a census of what the bucket holds and checked on a contact sheet: the game's tiling detail arrays where it has them (Hoth's rock, the desert's sand, Mos Eisley's walls), terrain and trim sets otherwise (Naboo's gravel and tiles, Endor's mud and bark, Sullust's sand and concrete, Kamino's dome metal, the MC80's painted metal, Kashyyyk's planks, the Imperial bunker's tread plate cut from its trim sheet, Yavin's temple stone and floor). Six first picks were rejected on the sheet (atlases or a blend mask). `lib/three/scans.js` now wears one set for the page (`wearScanSet`, tested), taken by `surface/scene.js` from a site's `look.scanned`; no site sets it yet, so nothing on the site changes until a world does.
- **Hoth's skies, for lane G**: `docs/superpowers/evidence/bf2017-hoth/skies.md` and the main-arena probe (`cloudy_vfx/78e8837b`) at 128 and 64 under `public/textures/galaxy/sky/` (`scripts/bf2017-sky.mjs`, its pure parts tested). The level's panoramas are in the manifest but not in the bucket.

### What was measured on Hoth (a trial, not shipped)

Echo Base was rebuilt on the game's kits by hand and by grid before lane L's plan arrived: the main hangar from the large hangar set (two 30.72 m bays and the end piece, mirrored: 41 × 31 × 72 m), the base's inside panelled with the wall system (81 panels, windows, beds, the bacta tank, the game's floor), the hangar shells' missing maps from the snow and concrete roles. It is kept off this PR on the unpushed local branch `claude/bf2017-worlds-hoth-placement-unpushed` (with the sky-loader trial on `claude/bf2017-levelsky-unpushed`); both go with this session's container. The pictures are `docs/superpowers/evidence/bf2017-hoth/echo-base-trial.jpg`. What it cost, one whole frame in software GL (`renderer.info`), main against the trial:

| view | level | calls | triangles | textures |
| --- | --- | --- | --- | --- |
| the hangar's mouth | high | 226 → 247 | 923k → 941k | 745 → 756 |
| the hangar's mouth | low | 227 → 248 | 729k → 747k | 741 → 755 |
| inside the hangar | high | 131 → 152 | 816k → 834k | 745 → 757 |
| the base's entry corridor | high | 52 → 126 | 158k → 311k | 742 → 754 |
| from the landing (`galaxy-check BUDGET=1`) | high | 156 → 156 (row 274) | 865k → 865k (row 1.66M) | 742 → 754; models 14.7 → 16.8 MB of 60 |
| from the landing (`galaxy-check BUDGET=1`) | low | 156 → 156 (row 350) | 671k → 671k (row 800k) | 740 → 754; models 14.7 → 16.8 MB of 20 |

`hoth-check.mjs` passed on the trial (no built people, both kits laid, none of the site's scans fetched). Things lane L may want from it: the hangar kit at LOD1 was 4,620 triangles, 3 maps, 119 KB; the wall kit 25,246 triangles, 9 maps, 1.87 MB; the panels as clones cost one call a piece (74 calls for the base's inside, worth instancing); the large hangar shells come without maps, so they need a role. Hoth's texture count was already 742 against the contract's 60 on main, before any of this. Main also logs one shader error on Hoth (a fog chunk reading `mvPosition` where there is none), not this lane's.

### Left

- To lane L: the worlds. To turn the game's roles on for a world, set its site's `look: { scanned: 'bf2017' }` and look at the sheet; the flight world's ground and the planet bodies read the same scans module (the site's set, outside a surface world). Roles to look at again in their own worlds: grass and leaves are Endor's forest floor (the game's grass is cards), the beach is the desert's second detail layer, and the detail arrays' normals were taken as they come.
- To lane G: Hoth's probe and `skies.md`; the panoramas when the upload reaches them.
- The planet-flight world's Echo Base landmark (`src/lib/land/flight/`) could wear the game's hangar once lane L has it.

### Checking it

```
node scripts/bf2017-textures.mjs                    # every role, or name some
node scripts/bf2017-sky.mjs web/textures/levels/mp/hoth_01/reflectionvolumetexture/cloudy_vfx 78e8837b-bc19-4917-80c7-fd21b3119ea6 --name hoth
npx vitest run src/lib/three/scans.test.js scripts/lib/bf2017-kit.test.mjs scripts/lib/bf2017-sky.test.mjs scripts/lib/bf2017-roles.test.mjs
```
