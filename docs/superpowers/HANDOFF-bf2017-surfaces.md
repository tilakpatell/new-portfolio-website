# Hand-off: the surfaces at the game's fidelity

The design: `docs/superpowers/specs/2026-10-10-bf2017-surfaces-design.md`. It answers "how does Frostbite make the picture from these assets, and how much of it can the web take": six layers (the surface shader, the ground's layers, the baked light, weathering and decals, the texture quality, the picture), each a lane. It sits beside the fidelity design (`2026-10-10-battlefront-fidelity-design.md`, PR #836: shadows, volumetrics, particles, cameras, scatter, headroom) and does not repeat it.

## What was found (2026-10-10, night)

- **The material parameters are not opaque.** The `ShaderGraph` records are names, but `agents/textures/matdump/materials.jsonl` on the desktop holds every material's shader, texture slots, vectors, bools and conditionals for all 15,324 meshes (30,517 materials). Uploaded to the bucket as `web/materials.jsonl` (14.1 MB) for the cloud lanes.
- **The lightmaps exist.** `StaticEnlightenData` per level names an HDR irradiance atlas, three direction maps and a sky-visibility map (Hoth: `EN_Hoth_01_Static_Sunset_*`, 3,128 × 3,680 BC6U); 200 atlases across the levels. The per-instance charts are in an Enlighten database resource the exporter never read; lane Q3's Task 3 probes it.
- **1,788 maps the materials name were never encoded** (detail normals, overlays, height maps, masks, emissive maps; 173 terrain layer maps): `web_opt/_surfaces_list.tsv`, encoding since 2026-10-10 14:00 UTC on the desktop (`logs/surfaces_textures.log`, pid 7604; terrain first, then detail, height, overlay, emissive, mask). **They still need uploading**: when the log says `ktx2: ok=…`, queue the KTX2 paths and run `tool/upload_supabase.py --root web_opt --list <list> --project jzabcqboyemokwifmjmp --bucket bf2017-assets --prefix web/` with `SUPABASE_SERVICE_KEY` from `.secrets/supabase_service_key.txt`, and read its "to upload now" line. The lanes print `missing:` for a map not there yet and re-import when it lands.

**The atlases are not in the bucket (checked 2026-10-10 15:10 UTC by the fifth design's session, on the desktop export and lane Z's ledger).** `textures.jsonl` lists the 200 `*_staticIrradianceTexture` PNG sources (2,000 to 3,000 pixels a side) beside the 201 `StaticEnlightenData` records, but `upload_state.tsv` has 0 rows for them: they were never queued (the same cause as #839's §1.1), and the bucket's 118 `enlighten` objects are proxy meshes, shapes and records. Lane Q3's spike therefore needs a desktop pass first: `tool/ktx2_encode.py --list` on those 200 (UASTC: irradiance, not colour) plus the direction and sky-visibility maps the records name, queued and uploaded as the planet skins were; until then Q3 reads the export on the desktop, not the bucket.

## The lanes

| Lane | Plan | What | Starts from | Blocked by |
|---|---|---|---|---|
| **Q1** | `2026-10-10-bf2017-surfaces-laneQ1-materials.md` | the recipes from `materials.jsonl`; `createGameMaterial` (detail normals, overlays, colours, emissive, parallax, reflectance, vegetation, hair) with the `overlays` hook; `levelGltf.js` builds it on a node world; Hoth's `recipes.json` | `main` | the detail maps as they land |
| **Q2** | `…-laneQ2-ground.md` | the terrain's layer stacks and derived masks → `ground.json`; the layered TSL ground on lane L's `image` layer | `main` | the terrain maps as they land |
| **Q4** | `…-laneQ4-weathering.md` | snow/sand/wet overlays to Q1's hook from the weathering records; placed decals (`decals.json`, projected and volume) | `main` | nothing (the hook contract is in Q1's plan; wired when both merge) |
| Q3 | `…-laneQ3-bounce.md` | the record's bounce in the light stack; the Enlighten atlas spike on the desktop | `main` after S | S (#836) merged |
| Q5 | `…-laneQ5-ultra-textures.md` | measure ETC1S vs UASTC on Hoth's colour maps; an ultra colour row if it pays; anisotropy | the desktop; Task 4 on `main` now | the owner's machine |
| Q6 | `…-laneQ6-picture.md` | the LUT after a linear tonemap, five-Gaussian bloom, HBAO numbers, the painted sky panorama and fog gradient, the cloud-shadow texture | `main` after S and V | S and V (#841) merged |

One lane per session. Q1 owns `src/lib/three/surface/` and `levelGltf.js`'s options; Q2 `src/lib/three/ground/` and one call in `levelScene.js`; Q4 `surface/weather.js`, `src/lib/three/decals/` and the fixture's crate and wall. #836's running lanes (S: `light/calibrate.js`, `sun.js`, `clouds.js`; V: `fog.js`, `post.js`, `passes.js`; X: `particles/`; C: `camera/`) own different files; `scene.js` is touched by nobody here.

### What the other work must know

- **Lane T** (#826, the surfaces on the node renderer): Q1's material is what a `'nodes'` level draws its game meshes with; T's twins are the site's own materials and are untouched. When T flips `galaxy-surface` to `'nodes'`, `levelScene.js`'s one condition (`rt.gfx.kind !== 'webgl'`) turns Q1 and Q2 on for Hoth.
- **The Battlefront world** (lane 5): takes `createGameMaterial` through its `assets.js` adapter and `createLayeredGround` for its ground; nothing to write of its own.
- **Lane N** (#836, scatter): imports `src/lib/three/ground/masks.js` for where each layer is, so grass and rock agree with the ground's own layers.
- **Lane D** (#839, the desktop's texture gap): the 1,788 maps above are the same gap seen from the materials' side; `_surfaces_list.tsv` is the list, `wanted_textures.py` (D's Task 1) should subtract it.

## Status

| Lane | Session | Branch | PR |
|---|---|---|---|
| design | the architecting session | `claude/bf2017-render-beauty` | #844 |
| Q1 | `session_01Ej9xiBYcqg7uoRPqsbKTtN` (Opus 5.5, env Website, started 2026-10-10 14:13 UTC) | `claude/surfaces-q1-materials` | |
| Q2 | `session_01RyTcJLkhXuFkEEnUifdzLL` (the same) | `claude/surfaces-q2-ground` | #851 |
| Q4 | `session_01UZN9iy457biyvcFRr7X39w` (the same) | `claude/surfaces-q4-weathering` | #852 (WebGL 2 leg shot; the WebGPU leg and the z-fighting proof on the owner's laptop) |
| Q3 | | | after S |
| Q5 | | | the desktop |
| Q6 | | | after S and V |

**Q4 (weathering and decals), 2026-10-10:**

- **The hook contract is honoured, not yet wired.** `src/lib/three/surface/weather.js`'s `snowOverlay`, `sandOverlay`, `wetOverlay` (and `overlaysFor(weather, kind, { tsl })`) return `(ctx) → { color, roughness, metalness?, normal? }`, each mixed from the running value, `{}` for a material whose `params.weather` allows none (`use`/`top`/`snow` for snow, `use`/`top`/`sand` for sand, `use`/`rain` for wet; an explicit `use: false` does not veto `top`, pinned by a test for the owner to rule on; `weather.mask` names the WeatheringMask channel). Q1 had not pushed when this lane finished; whichever lane merges second wires it: `const overlays = overlaysFor(weatherJson, undefined, { tsl })` into `createGameMaterial`'s `overlays`, and a `weatherClock(overlays)` whose `update(dt)` runs each frame (`change(next)` on a weather change keeps the value under KeepValueWhenMaterialChanged). Two assumptions about Q1's ctx to check then: the running channels arrive as `ctx.color`, `ctx.roughness`, `ctx.metalness`, `ctx.normal`, and `ctx.normal` is in the material's normalNode space (view). **Q1's recipe has no `snow` flag**: `SS_VehiclePreset_Snow` (Hoth's vehicles) must set `weather.top` (or `snow`) in Q1's `families.js`, or they take no snow.
- **The records**: `GlobalWeatheringParamsEntityData` is an entity of the VE data file, not a component of the map extras' environments, so lane R's `entry.record` does not carry it. `node scripts/bf2017-weather.mjs <world> --ve Levels/Lighting/<…>/VE_<…>` writes it beside the pack as `weather.json` (Hoth's is written: sky visibility 0.1 to 0.9, exponent 1, indoor threshold 0.5, 0 to 1 over 25 s, kept across a weather change). `RainFlipNormal` is not drawn (its meaning is not in the records). The fixture: `node scripts/light-fixture.mjs --weather --legs webgl` (crates at 0, 12.5, 30 s; the accumulation moves a uniform, no pipeline rebuilt: 35 → 35).
- **Decals per world**: Hoth 0 (nothing written); Endor_01 23 (all volume: 12 drawn, the 11 normal-only `DV_BumpedMetal_01` left out as having no colour map), Kamino_01 51, Naboo_01 48, Geonosis_02 582, Naboo_03 563, Kamino_03 536, Kashyyyk_02 512. Only Hoth is packed, so no `decals.json` ships; `node scripts/bf2017-decals.mjs <world>` writes it the day lane L packs one (`--fetch` takes the textures into `tex/decals/`).
- **What the records turned out to say** (read from Naboo_01 and Endor_01, not documented): projected decals project along their box's local X, volume decals along Y; `atlasTile.TileIndex` counts from 1; the decal maps named `_RGB` are channel masks, not colour (blaster hole: red the scorch, green the ember rim, blue a breakup; streak: a 2 × 2 sheet of three-streak bursts; burnt: red/green a normal, blue the burn). The site draws them as a near-black scorch by the mask; the rims' glow (`T_BlackBodyRamps_01_M`) and the burnt normal wait.
- **Drawing**: projected decals are cut, kept only on faces across their axis and turned toward them, and merged one draw per texture per cell; volume decals are one InstancedMesh per texture per cell (Review Focus 4). Decals are node materials: the classic renderer draws none.
- **Volume decals over WebGL 2** (Review Focus 3): the box's `viewportDepthTexture` read draws on the node renderer over WebGL 2 on SwiftShader (the fixture's burnt patch, fallback 0); a real driver's is the owner's laptop's to see; `createDecals({ volumes: false })` projects them over their boxes where it fails. **Volume decals also land on anything dynamic inside their box** (players, vehicles): the fix is a stencil bit written by dynamic and skinned meshes and tested by the volume material, other lanes' render code; not done.
- **Z-fighting** (Review Focus 5) is not proved on the cloud: the fixture's grazing pair (camera 3 mm apart) measures what the decals add between the frames, 0.08, but a control with no push and no polygon offset measures 0.045: SwiftShader shows no fighting either way. The owner's laptop run of `--decals` is the proof.
- The fixture: `node scripts/light-fixture.mjs --decals --legs webgl` (11 decals in 5 draws).
- **Lane E0** (PR #848, `claude/bf2017-e0-factory`) packs every map and calls `decalsOf(extras, pack, { subworlds })` from `scripts/bf2017-level-parts.mjs` once this lane is on `main` (until then it writes an empty format-1 `decals.json` with `waiting: 'lane Q4'`). Nothing draws a level's decals yet: whichever of E0 and Q4 merges second adds `createDecals({ scene, pack: decalsJson, loader, tier, backend })` to `src/components/galaxy/surface/level/index.js` and its `cell(cx, cz, targets)` / `drop(cx, cz)` to that file's `onCell` / `onDrop`, the targets being the cell's static instances as `{ geometry, matrix }`.

### Lane Q2: the ground's layers

**Done** (the WebGL 2 leg; the WebGPU leg waits for the owner's laptop). `node scripts/bf2017-ground.mjs hoth --fetch` writes `levels/hoth/ground.json` and `ground/masks.png` and brings the layer maps into the pack's `tex/` (256 / 512 / 1,024 px; 1,024 is 4 mm a texel at the tile, so ultra takes 1,024 too). `src/lib/three/ground/layeredGround.js` is the TSL material; `levelScene.js` takes it on a node renderer when `createLevelScene` is handed `ground: { mesh, renderer, fetchBytes, urlOf, entry }` (lane T passes the ground's mesh when it flips the surface; nothing on the classic renderer changes). Shots, frame table and budgets: `docs/superpowers/evidence/bf2017-surfaces/Q2/`.

- **The layers.** Hoth's terrain names 105 layer combinations over 11 normal maps; four carry the ground (by how many combinations name them: packed 71, rough 70, rocky 47, chunky 42): `T_ArcticBase_SnowPacked_04_N`, `SnowRoughPacked_03_N`, `SnowRockyPacked_04_N`, `SnowChunkyWind_01_N`, over `SnowSparkle_03_RGBM`. All five landed in the bucket during the lane (the desktop's encode, terrain first).
- **The maps' channels**, decoded: R and G the normal, **B a height** (the combinations' `displacement2d`: blurred relief, spread 0.03 to 0.16), A a smoothness in the rocky, rough and packed maps (rock rougher) and a constant 255 in the chunky. So the blend is by height (`(mask × height)^4`, normalised), and the alpha moves each layer's named roughness by `SMOOTH_GAIN`.
- **The masks' rules** (derived; `mask: 'derived'`): rocky where the slope is over 30°; chunky where the slope is under 15° and the ground 2 m or more under the field (the mean within 64 m); rough where the level places its meshes thickly (the hangar's apron); packed the rest. In order, the first that holds claims the pixel with a soft edge; the shares over the near map are rocky 8.5%, chunky 11.1%, rough 0.4%, packed 80%. The PNG is RGB at 2 m a texel: rocky, chunky, rough in the channels, packed what they leave (alpha is not used: a browser's decoder premultiplies it into the colour and lost the rock where packed was 0).
- **The tile**, judged on the shot: 4 m for a 2,048 px map (`TILE_M.hoth`), the wind ripples of the packed snow at a believable scale at 2 m. The layer shader's own tiling would replace it.
- **What a real mask would change**: `ground.json` says `mask: 'game'`, the PNG comes from the export's section 1, the rules stay as documentation; the material and lane N's import do not change.
- **Lane N** imports `maskOf(layer, { heights, slope, field, density, frame, rules })` (or `masksOf(rules, ctx)` for all at once) from `src/lib/three/ground/masks.js`, with `rules` from `ground.json`; or reads `ground/masks.png`'s channels as above. Its rocks then grow on the same ridges the ground draws rocky.
- **Left**: the WebGPU leg and the real frame cost on the laptop; the colour map (the far ground is `TerrainColor` × a tint per layer until then); the layer shader's tiling and smoothness; the other nine terrains (`RULES` per world).

Findings for the next lane go here: families by count on Hoth and which fell to `glb`, the detail maps still missing at PR time, the ground's tile size as judged, what the Enlighten probe found, the PSNR table.

## Checking it

- `npx vitest run src/lib/three/surface src/lib/three/ground src/lib/three/decals scripts/lib/bf2017-materials.test.mjs scripts/lib/bf2017-ground.test.mjs scripts/lib/bf2017-decals.test.mjs`.
- `node scripts/light-fixture.mjs --materials | --weather | --decals | --bounce | --picture` (the WebGL 2 leg on the cloud; the WebGPU leg on the owner's laptop).
- `node scripts/galaxy-check.mjs surface hoth` under `BUDGET=1` per tier with `?gpu=webgl`; `node scripts/surface-shot.mjs` at the hangar wall, a crate, the field and the ridge, before and after, in `docs/superpowers/evidence/bf2017-surfaces/<lane>/`.
