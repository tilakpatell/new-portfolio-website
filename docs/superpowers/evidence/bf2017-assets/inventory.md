# Inventory: the `bf2017-assets` and `bf2-extract` buckets, 2026-10-10 01:02–01:27 UTC

## The two buckets

| bucket | made | objects | bytes | state |
| --- | --- | --- | --- | --- |
| `bf2017-assets` | 2026-10-09 23:54 | 103,835 (and rising) | 2.3 GB (and rising) | models and data uploading; textures not started |
| `bf2-extract` (the classic edition) | 2026-10-09 23:35 | 0 | 0 | empty |

Both are private (`public: false`); the anon key lists neither.

## `bf2017-assets` by top folder (at 01:22)

| folder | objects | MB | what |
| --- | --- | --- | --- |
| `web/models/` | 37,136 | 2,010 | one `.glb` per model per LOD (`<name>_mesh.glb`, `<name>_mesh_lod1.glb` … `_lod5.glb`) |
| `web/collision/` | 9,459 | 109 | one `.glb` per model that has one: a collision mesh cut from a render LOD |
| `web/models.jsonl` | 1 | 25 | the manifest: one JSON line per model (13,871) |
| `data/` | 45,224 | 135 | Frostbite EBX records as `.json.gz`: blueprints, kits, FX graphs, vehicles, teams. No numbers a game outside Frostbite can use; the "animation" records (`data/Animations/antanimations/*_antstate.json.gz`, 782 of them) are 250-byte state stubs, not clips |
| `test/` | 41 | 42 | 8 GLBs and 33 PNG textures, the uploader's test of its texture path |

File types: 46,362 `.glb` (2,108 MB), 45,224 `.gz` (135 MB), 32 `.png` (31 MB), 2 `.jsonl` (25 MB). No `.ktx2`, `.webp`, `.dds`, `.fbx`, `.wav` or `.ogg` yet.

## What a model is

Every GLB is `gltfpack 1.3` output: `KHR_mesh_quantization` + `EXT_meshopt_compression` (the site's own decoder reads it), with `KHR_texture_basisu` images whose `uri` points *outside* the file: `../../../../../textures/<path>/<name>_cs.ktx2`, `<name>_nam__normal.ktx2`, `<name>_nam__orm_<hash>.ktx2`. So a model is small (Luke at LOD0 is 265 KB, a hilt 13 KB, the AT-AT 1.4 MB) and draws nothing until `web/textures/` exists. Materials are already metal-rough with baseColor, normal and a packed occlusion+roughness+metal map; each carries `extras.shader` (the Frostbite preset) and `extras.textures` (the source maps by role).

A skinned model keeps its skin and joints but no animation (`animations: 0` in every sample; the manifest has no clip field). Units are metres, y up, standing on y = 0 (Luke's box is 1.82 m tall, the AT-AT's 22 m).

## The manifest (`web/models.jsonl`, 13,871 models)

| field | what |
| --- | --- |
| `name`, `file` | the model and its LOD0 path under `web/` |
| `assetType` / `meshType` | Rigid 11,704 · Composite 1,237 (vehicles, props with parts) · Skinned 930 |
| `vertices`, `triangles`, `bytes`, `min`, `max` | of LOD0 |
| `lods[]` | the chain: 1 LOD 3,202 models · 2: 1,171 · 3: 2,396 · 4: 2,426 · 5: 2,244 · 6: 2,432 |
| `textures[]` | the source maps (10,455 unique across the set; 2,530 models reference none) |
| `derived[]` | per material, which `.ktx2` variants the uploader makes and from which channels (`normal:<map>`, `orm:<map>:ao=<map>|b;rough=<map>_CS|a;metal=<map>|b`) |
| `collision` | the collision GLB, its source LOD and triangles (12,941 models have one) |
| `skeleton`, `joints`, `skeletonRule` | for the 930 skinned models |
| `tier` | 1–9, the uploader's own ranking (meaning not stated) |

### Skeletons

| skeleton | models | joints |
| --- | --- | --- |
| `Characters/Rigs/Humanoids/Walrus_HumanMale` | 604 | 248–254 |
| `Characters/Rigs/Weapon/WeaponSke01` | 163 | — |
| Ewok, Civilian, Bith, Grievous, Yoda, Bossk, B2, Droideka, AT-RT, AT-AT, AT-TE, Tauntaun (114), Dewback, Bantha, Jawa, astromech, Gonk, Viper probe … | 1–21 each | own rigs |

The humanoid rig's bone names are Maya HumanIK's, which are Mixamo's without the `mixamorig:` prefix: `Hips Spine Spine1 Spine2 Neck Neck1 Head LeftShoulder LeftArm LeftForeArm LeftHand LeftHandThumb1–4 LeftHandIndex0–4 … LeftUpLeg LeftLeg LeftFoot LeftToeBase …`. Of 254 joints about 70 are the body and fingers; the rest are rolls, twists, physics helpers, `Wep_*` weapon sockets (`Wep_Root`, `Wep_Muzzle`, `Wep_Trigger`, `Wep_Mag`…), `IK_Joint_*`, camera and trajectory helpers, `PROC_Bone0–5`. Humanoid LOD0 triangles: median 8,308, max 122,467; 582 of 604 have an LOD2.

### LOD chains of models the galaxy would use (triangles, KB)

| model | LOD0 | LOD1 | LOD2 | LOD3 | LOD4 | LOD5 |
| --- | --- | --- | --- | --- | --- | --- |
| luke_rotj_01 (skinned) | 21,139 · 957 | 10,369 · 580 | 5,333 · 359 | 2,542 · 229 | 1,218 · 159 | 603 · 120 |
| darthvader_01 (skinned) | 31,042 · 1,554 | 18,642 · 1,047 | 7,520 · 512 | 3,575 · 279 | 1,061 · 141 | 337 · 104 |
| imperial_stormtrooper_male_01_fullbody | 34,814 · 1,571 | 16,890 · 908 | 7,890 · 529 | 3,589 · 310 | | |
| l_assault_orig_ds_01 (rebel trooper) | 22,826 · 1,087 | 11,535 · 633 | 5,364 · 359 | 2,768 · 231 | 1,440 · 164 | 634 · 125 |
| tauntaun_01 (skinned, own rig) | 55,195 · 3,082 | 27,537 · 1,772 | 13,676 · 1,039 | 6,625 · 384 | 3,359 · 235 | 1,080 · 121 |
| vehicle_ground_at-at_sp (composite) | 108,400 · 6,960 | 50,954 · 3,770 | 25,158 · 1,961 | 12,866 · 1,019 | 6,840 · 607 | 4,588 · 422 |
| vehicle_air_xwing_t65 | 82,340 · 5,943 | 36,843 · 3,092 | 17,601 · 1,559 | 6,918 · 615 | 3,498 · 324 | 568 · 65 |
| yavinbase_tree_large_01_a | 17,057 · 1,877 | 3,772 · 442 | 1,878 · 233 | 919 · 117 | 463 · 61 | 215 · 30 |
| lightsaberlukeskywalker_meshp | 920 · 50 | | | | | |

The KB are the GLB alone; textures are on top.

## What is in it, by what the galaxy could use

Counted from the manifest at LOD0 (the ceiling: what the upload will hold when done).

| set | models | LOD0 MB | LOD0 Mtri |
| --- | --- | --- | --- |
| heroes, originals and prequels only (anakin, bobafett, bossk, chewbacca, countdooku, darthmaul, darthvader, generalgrievous, hansolo, lando, leia, luke, obiwan, palpatine, yoda, ewok, wookiewarrior; each in several outfits plus hands and capes) | 131 | 100 | 1.8 |
| troopers (`characters/light`, `dark`, `imperial`, `rebel`: stormtrooper, shadowtrooper, death trooper, shoretrooper, snowtrooper, scout, clones by legion, B1/B2, rebel and Hoth troopers, officers) | 105 | 87 | 1.5 |
| creatures (tauntaun, dewback, bantha, eopie, ronto, jawa, ewok, wookiee, gamorrean, bith, aiwha, kaminoan…; no wampa, no rancor) | 40 | 53 | 1.2 |
| droids (astromech ×3, BB-8, gonk, mouse, protocol, viper probe, interrogation, treadwell, messenger) | 27 | 27 | 0.4 |
| lightsaber hilts (anakin, vader, dooku, grievous ×5, luke, luke hoth, maul, maul crimson, obiwan, yoda; kylo and rey excluded by rule) + two saber-throw projectiles | 26 | 3 | 0.06 |
| blasters (146 across pistols, rifles, heavy, long range, hero: DL-44, EE-3, bowcaster, E-11, A280, DLT-19, DC-15, T-21, RT-97C…) | 146 | 31 | 0.4 |
| ground vehicles (AT-AT, AT-ST, AT-TE, AT-RT, AAT, MTT, droideka, hailfire, homing and dwarf spider droids, STAP, BARC, 74-Z speeder bike, X-34, turbo tank) | 86 | 149 | 2.0 |
| air vehicles, OT/PT (X-wing T-65, Y-wing, A-wing, U-wing, TIE fighter/bomber/interceptor/Advanced, Falcon, Slave I, snowspeeder, LAAT, ARC-170, N-1, V-wing, vulture, tri-fighter, hyena, cloud car) | 93 | 229 | 3.2 |
| capital ships (Imperial cruiser, Venator, MC80, CR90, Lucrehulk, Providence, Fondor dry dock) | 566 | 370 | 5.1 |
| stationary turrets (E-web, DF.9, Atgar tower, Mark II, turbolaser, AA) | 31 | 24 | 0.3 |
| Hoth architecture (Echo Base hangar system 110, corridor 16, wall 24, fuel silo, DF.9 stack) | 152 | 24 | 0.7 |
| arctic nature (snow, ice, rock, backdrops) | 130 | 32 | 0.6 |
| Endor (landing platform, power core room, bunker system, forest base) | 364 | 104 | 1.5 |
| Tatooine (Mos Eisley 96, Jabba's palace 133, desert nature, level objects 76) | 371 | 61 | 1.1 |
| Yavin (temple grounds, 551 nature pieces) | 551 | 181 | 2.7 |
| Death Star interior (216 panel, corridor and room pieces; debris; tractor beam generator; DS2 clusters) | 262 | 65 | 1.2 |
| Naboo (palace 187, hangar, canal, Theed facades, nature) | 625 | 187 | 2.6 |
| Kashyyyk (village, walkways, Venator wreck, nature) | 231 | 62 | 1.2 |
| Kamino (cloning facility, domes, corridors, platforms) | 888 | 90 | 1.8 |
| Bespin (upper levels, buildings, platforms, plaza) | 188 | 62 | 0.8 |
| props, object sets (crates, consoles, pipes, lights, barriers, cables, furniture) | 1,855 | 392 | 6.1 |
| props, landmarks | 339 | 299 | 3.9 |
| sequel era, excluded by the site's rule (kylo, rey, finn, phasma, First Order, Starkiller, Takodana, Jakku, Resurgent, T-70) | 2,324 | 878 | 12.4 |
| **everything** | **13,871** | **5,160** | **80.9** |
| everything at LOD2 | | 1,673 | 22.2 |
| everything at its last LOD | | 713 | 9.4 |

Also there: Scarif (barracks, train station), Sullust, Vardos, Pillio, Geonosis (`a3/` and `s*/` are the campaign's own sets), Jabba's palace, the Venator interior, the CR90 interior, cloud backdrops, planets for the space layer, 96 cloud meshes.

## What a texture is

Not uploaded yet. From the manifest and the 33 test PNGs:

| suffix | count referenced | channels (read from the test PNGs' statistics) |
| --- | --- | --- |
| `_CS` | 12,519 | RGB colour, A smoothness (roughness = 1 − A) |
| `_NAM`, `_NOM`, `_NOS`, `_NAOS`, `_NMA`, `_NW`, `_NA` … | 6,857 + 1,000s | RG normal x,y (z rebuilt), B occlusion (mean 244–254), A metal or smoothness (mean 2–3 where unmetal) |
| `_N`, `_NM` | 5,417 | plain normal |
| `_C` | 2,742 | plain colour |
| `_RGBA`, `_RGB`, `_M`, `_ID`, `_E`, `_H`, `_AOSL` | 1,953 … 261 | masks, ID, emissive, height, AO slices: the shader presets' extras |

The test PNGs are 1024² with alpha. The uploader's `derived` field already names, per material, which channel becomes AO, roughness and metal, and the GLBs already point at the `__normal` and `__orm_<hash>` KTX2 files it will make from them: nothing in the site has to decode DICE's packing if the derived files arrive. If only the raw PNGs arrive, `derived` is the recipe.

## What is not there yet

The owner says the upload goes on for some time and animation, audio and more meshes are still to come, so these are gaps at the time of the count, not in the drop:

- **Animation**: `data/Animations/` holds state stubs; no GLB sampled carries a clip. The clips are expected later (in whatever shape the uploader gives them: GLBs with `animations` on the `Walrus_HumanMale` rig, or one file per clip). Until they land, every clip stays the site's own (UAL 1 and 2, the sword sets, Meshy's).
- **Sound**: no `.wav`, `.ogg` or `.mp3` yet.
- **Textures**: `web/textures/` has not started; the GLBs point at it.
- **The classic edition** (`bf2-extract`): empty.
- **Not in the 2017 game's set at all** (so never coming from it): the wampa, the rancor, Jabba himself, the sarlacc.

## Update, 02:45 UTC: the upload a day on

| part | objects | bytes | against its manifest |
| --- | --- | --- | --- |
| `web/models/` | 48,248 | 2.5 GB | complete: every LOD file of the 13,871 models |
| `web/collision/` | 12,941 | 151 MB | complete |
| `web/anims/` + `web/anims_additive/` | 7,947 + 2,159 | 955 + 144 MB | 10,106 of the 10,270 clips in `web/anims.jsonl` |
| `web/textures/` | 16,617 | 6.7 GB | 2,441 KTX2 (4.9 GB, the derived maps the GLBs point at), 4,528 PNG, 9,648 HDR (sky, probe and far-shadow caches under `levels/`; PR #810's desktop count: there are no lightmaps, Enlighten runs at run time); `web/textures.jsonl` lists 17,511 PNG sources (43.6 GB), 1,851 of them up |
| `web/physics/` | 10,530 | 123 MB | complete: Havok shapes (`hknpConvexPolytopeShape` and friends) per model, `web/physics.jsonl` |
| `web/movies/` | 61 | 628 MB | WebM |
| `web/fonts/`, `web/svg/`, `web/strings/` | 23, 702, 2 | 36 MB, 4 MB, 1 MB | the UI's fonts, icons and strings (`web/misc.jsonl`) |
| `data/` | 83,983 | 243 MB | the EBX records, complete; `data/Sound/` is 3,918 records, no audio files yet |
| **bucket** | **183,260** | **11.6 GB** | still rising |

### The clips (`web/anims.jsonl`, 10,270)

One glTF per clip: the skeleton's 248 nodes, no mesh, one animation with rotation and translation channels on the bones by name, 30 fps, raw (uncompressed: Luke's jump attack is 109 KB for 44 frames), with extras `{ codec, fps, endFrame, additive, loop, skeleton, key }`. The manifest adds `channels`, `check`, `duplicates`, `distance` (root travel, 3,409 clips) and `timeScale`.

| skeleton | clips |
| --- | --- |
| `Walrus_HumanMale` (the shared humanoid) | 4,498 (1,651 additive); 520 MB; 4,446 up |
| `Walrus_NIS_S0800_Skeleton` (cinematics) | 2,638 |
| `Walrus_HumanMale_1p` (first person) | 949 |
| B1 battle droid (`D_Assault_Preq_01_Ske`) 532 · B2 337 · Grievous 161 · Yoda 101 · BB-8 88 · Ewok 77 · AT-ST 69 · droideka 52 · tauntaun 44 · AT-TE 41 · the creatures | the rest |

The humanoid set by prefix: `A_<Hero>_*` the heroes' combat (Vader 104, Maul 89, Luke 69, Obi-Wan 69, Anakin 62, Dooku 56, Palpatine 37, Chewbacca 11; Kylo and Rey excluded), `C_<Hero>_*` the heroes' locomotion (walk, run, sprint, turn, in eight directions), `A_HM_*` the generic humanoid (deaths standing, running, by weapon; dodges; deploys; speeder bike; throws), `AI_Rifleman_*`, `AI_Officer_*`, `Cover_*`, `Awareness_*`, `Spawn_*`, `Hit_*`, `Loco_*`, `P`/`T`/`L` (pistol, two-hand, long weapon stances), `Add_*`/`PAdd_*` additive layers, `CIN_*` cinematics, `UI_FrontEnd_*` menu poses.

A hero's own set (Luke's, 138 with locomotion): `AttackLoop_Strike1..6` and `_V2` each with a `_BackToIdle`, `AttackPose` closers, `Block_Stagger`, `Stagger_{Back,Front}_01..03`, `Dodge_{Back,Front,Left,Right}`, `Defeated`, `Jump_SaberAttack_Light`, `Stand_SaberDash`, `Stand_ForceAttack_Push`, `Stand_ForceRepulse`, `InAir_ForceAttack_Push`, `Blinded`, `Electrocuted`, `Gas`, `Stunned_Pain` (enter, loop, exit), `Stand_Walk_*`, `Stand_Run_*`, `Stand_Sprint_*`, `StandTurn_*`. Vader adds `Stand_Block_SwingLeft/Right_01..04`, `Stand_Block_Choke_*`, `Stand_CatchSaber`, `LightAttack_Blocked_01..06`, `ForceChoke`, `RagePowerUp`. Obi-Wan adds `MindTrick_*`, `ForcePush`, `Dash_Exit`, a second attack loop.

### Phase 1's inputs, present

Every hilt's three maps (`lightsaber{anakin,darthvader,dooku,grievous,lukehoth,lukeskywalker,maul,maulcrimson,obiwan,yoda}`, and `bowcaster`, `dl44`, `ee3`); the heroes' body maps (luke 12 KTX2, darthvader 15, obiwan 6, anakin 17, darthmaul 18, countdooku 18, yoda 11, generalgrievous 12, palpatine 8, hansolo 5, leia 6, lando 7, chewbacca 25, bobafett 13, bossk 7) and 264 head maps; the heroes' clips.

## Costs measured (03:10 UTC)

Luke's six maps (`luke_rotj_01`: body and vest, each colour, normal, ORM), as the bucket holds them and after the site's pipeline (`basisu -unpack`, then `sharp` WebP at quality 82 for colour and 80 for the rest, `scripts/ktx2.mjs`'s `encodeImage` for a UASTC normal):

| mix | bytes |
| --- | --- |
| the game's six KTX2 at 2048 | 19.1 MB |
| all six as WebP at 1024 | 0.97 MB |
| all six as WebP at 512 | 0.25 MB |
| the spec's "high" (colour 1024 WebP, ORM 512 WebP, normal 1024 **KTX2**) | 2.4 MB, of which the two KTX2 normals are 1.9 MB |
| colour 1024 WebP, ORM 512 WebP, normal 1024 **WebP** | 0.97 MB |
| "mid" (colour 1024, ORM 512, normal 512, all WebP) | 0.52 MB |
| "low" (colour 512, the rest 256, all WebP) | 0.15 MB |

So a KTX2 normal is ten times the WebP's bytes at the same size, and `scripts/ktx2.mjs`'s `verdict` (bytes within 1.25×) will keep normals as WebP below ultra. A hero's textures at high are about 1 MB; with his LOD2 mesh (0.36 MB) a hero is about 1.4 MB, a trooper (LOD2 0.5 MB, four maps) about 1.3 MB.

The clips (four of Luke's, 106 to 118 KB raw each, 109 channels, 28 to 45 of them constant):

| treatment | bytes per clip |
| --- | --- |
| raw, as uploaded | 110 KB |
| meshopt only | 64 KB |
| constant channels dropped, resampled, meshopt | 46 KB |

So a hero's useful set (about 50 clips: twelve strikes and their returns, blocks, staggers, dodges, dash, jump attack, Force, defeat, eight-way locomotion) is about 2.3 MB and must load with the hero, not the world; the generic humanoid set is held under 3 MB by the same treatment plus 15 fps on idles. Dropping the camera, trajectory and reference channels nothing in the site reads is still to be measured (phase 2, task 6).

## Update, 2026-10-10 00:20 (the desktop's clock): the export's other parts, and two faults fixed

Counted on the desktop export itself (`C:\Users\tilak\Downloads\BF2_Extract\web_opt`, what the uploader sends), not the bucket; the uploader's third pass was at 3,100 of 4,446 files when this was written and re-reads its queues each pass.

| part | files | bytes | what |
| --- | --- | --- | --- |
| `maps/` | 150 (74 maps) | 7 MB json, 29 MB bin | every level's placed instances (873,000 in all; Hoth 24,532 over 602 meshes), grouped by mesh and sub-level, with the terrain record, the VisualEnvironment names, vehicle spawns; `index.json`, `README.md` (the format and a three.js reader) |
| `terrain/` | 111 (39 levels) | 297 MB | 16-bit PNG heightmaps: `world` 4097 squared at 2 m a pixel (8,192 m), `detail` at 0.5 m over the arena; `terrain.jsonl` with scale, offset, bounds |
| `physics/` | 10,530 | 123 MB | Havok shape sets per model (`hknpConvexPolytopeShape` and friends); `physics.jsonl` |
| `textures/levels/` | per level | Hoth 200 files, 15 MB | reflection-volume probes (128 squared, six HDR faces, 61 kinds) and distant shadow caches (2048 squared, 16-bit PNG, 33); **no lightmaps exist** (Enlighten runs at run time; kit meshes carry `TEXCOORD_1` for it) |
| `data/Levels/Lighting/` | 192 records | | VisualEnvironment blueprints per world and weather: outdoor light (sun colour, illuminance, sky and ground colours, cloud shadow), sky (Rayleigh, Mie, cloud layers), fog curves, tonemap (EV, bloom), colour correction (brightness, contrast, saturation, the `T_CC_*` LUT), wind, Enlighten bounce, AO |
| planet skins | 102 | 405 MB PNG, 240 MB KTX2 | colour, normal, clouds, atmosphere, moons, rings, a debris field, and the front end's 1024 squared globes; never encoded by the optimiser (no model binds them), encoded today at up to 4096, linked raw, both queued |
| `movies/`, `fonts/`, `svg/`, `strings/` | 161, 23, 702, 2 | 628 MB, 36 MB, 4 MB, 1 MB | the cinematics (WebM), the UI's fonts, icons and strings |

Not exported, and not coming without an exporter change: **audio** (17,509 sound assets), **placed lights** (Hoth: 1,234 counted), **effect spawns** (648), decals.

Two faults: 164 clips named `<clip>~<8 hex>.glb` were refused by Supabase (`InvalidKey`: `~` is not allowed in an object key); renamed `-<8 hex>` on disk, in `web/anims.jsonl` (re-uploaded, 15.2 MB) and in the queues. 119 physics files the physics pass had not queued were queued.
