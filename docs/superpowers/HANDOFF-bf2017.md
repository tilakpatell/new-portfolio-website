# Hand-off: the Battlefront II (2017) pipeline

The design is `docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md`; the bucket’s numbers, `docs/superpowers/evidence/bf2017-assets/inventory.md`; the drop and its credit, `docs/assets/battlefront-2017.md`.

## Done

- **The design, the inventory and the plans** (PR #802, carried by the phase 0 PR).
- **Phase 0, the tools** (PR #805): the decision entry and the assets page; `scripts/bf2017-fetch.mjs` and `scripts/bf2017-import.mjs` over five tested modules under `scripts/lib/` (`bf2017-manifest`, `bf2017-paths`, `bf2017-textures`, `rig-parts`, `catalog-write`); the committed fixture (`scripts/fixtures/bf2017/`, 39.6 KB); the empty `catalog/bf2017.js`, last in `GROUPS`. Nothing on the site changed. Tried on two real models and nothing kept: Luke’s hilt (920 triangles, 212 KB, the shot in `docs/superpowers/evidence/bf2017-phase0/`) and Luke’s rotj body with `--rig` (the whole rig kept, 254 joints with fingers, face and physics; LOD2 706 KB, LOD4 236 KB; drawn in its bind pose).
- **Phase 1, the heroes on the game's skeleton, with their hilts** (this PR, `claude/bf2017-phase1`):
  - `public/models/galaxy/bf2017/walrus.glb`: `Walrus_HumanMale` whole, 254 nodes (`scripts/bf2017-skeleton.mjs`); `src/lib/three/walrusRig.js` names its body, fingers and sockets, `WEAPON_FRAME` (the identity: the game models weapons in the `Wep_Root` frame).
  - The game's clips as packs (`scripts/bf2017-clips.mjs`, names mapped by `src/lib/three/walrusClips.js`): `clips-humanoid.glb` 843 KB (27 clips), and one a hero: Luke 1,323 KB (45), Vader 1,269 (42), Obi-Wan 1,069 (39), Anakin 1,187 (38), Maul 1,179 (41), Dooku 1,153 (38), Palpatine 459 (15), Han, Leia, Lando, Chewbacca, Boba Fett, Bossk 92-141 KB (their defeat and abilities). 24 fps, root motion off `AITrajectory` into `extras.root`, `contact` timed on a blade a metre up `Wep_Root`, rest-holding channels left out and put back by the loader. Luke's blocks come from the cinematic skeleton (`Walrus_NIS_S0800_Skeleton`, the same rig at the same rest).
  - `src/lib/three/walrus.js` loads a 2017 body with its packs; footScene's `walrusFigure` wraps it in the same `rigged()` every figure gets, the animator told `library: false`. Both figure paths (`crew.js`, `loadPartyFigure`) take `rig: 'walrus'`.
  - Thirteen heroes, each in three cuts, at the game's native fidelity (the owner's ask, 2026-10-10: "the native mesh, max quality"). Each map is the game's own KTX2: UASTC, zstd-supercompressed, a full mip chain. It is never decoded and re-encoded; a smaller cut drops the top mip levels from the same file (`scripts/lib/ktx2-levels.mjs`). The mesh keeps the game's 16-bit precision (meshopt positions 16, normals 12, UVs 16).
    - Why not WebP or AVIF, measured against the unpacked UASTC:
      - Halving to 1024 gave 20 dB PSNR: the blur the owner saw.
      - WebP lost colour wherever the smoothness alpha sits in the colour map: 34 dB at any quality.
      - AVIF reached 45 dB on normals.
      - The native file loses nothing against the game, and costs a byte a texel on the GPU (BC7 or ASTC), against four for a decoded image.
    - The three cuts, made with `--native` (`--tex 1024 --maps 1024 --ultra --ultra-tex 2048 --ultra-maps 2048 --cuts plain=0,lod1=<n>,ultra=0`):
      - `<kind>.ultra.glb`: LOD0, every map at 2048, 18–53 MB, 28–96 MB of GPU textures. Loaded at ultra.
      - `<kind>.glb`: LOD0 at 1024, 7–16 MB, 10–24 MB of GPU textures. Loaded at high.
      - `<kind>.lod1.glb`: the light mesh at 512, 2.3–4.2 MB, 3–6 MB of GPU textures. Loaded at low and mid, and always first.
    - Before, with WebP, Luke's ultra cut was 384 MB of GPU textures; now it is 68.
    - The caps: `scripts/lib/bf2017-caps.mjs` (`NATIVE_CAPS`: 16, 5 and 64 MB). `crew.budget.test.js` holds each cut to them on disk, reading a published file's bytes from `galaxyAssets.json`, and holds an on-disk cut to the GPU caps too.
    - Light first, then swapped (`lib/three/walrus.js`'s `cutsToLoad` and `swapBody`; `footScene`'s `walrusFigure`, which both figure paths use): a 2017 figure stands in its `.lod1` the moment it lands. The level's cut follows and its skinned meshes are bound to the same bones, so the animator, the sockets and the saber never notice. On a saver connection it is the light cut only.
    - The files are `public/models/galaxy/bf2017/crew/<kind>.glb`, credited `bf2017-<kind>`; the skeleton and the clip packs by one pack credit, `bf2017/walrus` in `public/games/credits.json`. Of the Meshy and Sketchfab files at `galaxy/crew/`, Luke's, Han's, Leia's, Vader's and Palpatine's stay: the universe's foot party, the Death Star's people, `scripts/motion/bake.mjs`, `ual-bake.mjs` and `meshy-actions.mjs` load them as Meshy figures. Boba Fett's, Obi-Wan's, Maul's, Lando's and Dooku's, which only the galaxy used, are gone with their credits.
  - The heroes' outfits (`heroes.js`'s `SKINS`, an Outfit tab in the loadout): 25 of their kits' visual unlocks in the game (`Kit_Hero_*` → `VUR_*`), the sequel trilogy's left out (Chewbacca's EP7 look, Palpatine's EP9). Each is a native file of its own on the same skeleton, a `CREW` row with the hero's `pack`, credited `bf2017-<kind>`; each one's body, parts and head are in `modelCredits.json`'s title and `docs/superpowers/evidence/bf2017-phase1/skins.tsv`. The heads are matched by name and era, since the game's mesh-variation databases are not in the bucket; a render of each checked them. Obi-Wan's Jedi-robe outfit has red lower legs, which is how the game's own map for it is coloured.
  - Eight more heroes are playable: Obi-Wan, Anakin, Vader, Palpatine, Maul, Dooku, Lando and Bossk, joining Luke, Leia, Han, Chewbacca and Boba Fett.
  - The files are in the `site-assets` bucket: 143 of them, 1.91 GB, listed in `src/data/galaxyAssets.json`. `walrus.glb`, `clips-humanoid.glb` and `clips-luke.glb` stay committed as well (`asset-manifest.mjs`'s `KEPT`), because tests read them whole. A test that only asks whether the site has a file takes a published one as there (`onSite`).
  - `rig-parts` puts each vertex of a part where its own joints put it. A helmet's `PROC_*` bones share the body's names but are other bones, so they are bound to the nearest parent the two share.
  - A 2017 figure passes `boneCapsules.js`'s `isGameSkeleton`, so bolts hit it where the game's capsules say (`footScene.walrus.test.js`). `ragdoll2017.js` (lane P2's, #820) is ready for whoever wires the dead fall. The call is `rigRagdoll` at `src/components/galaxy/surface/ground/groundFigures.js:345`, with ragdoll2017's table for a figure with `rig: 'walrus'`. That wiring is not this phase's: the owner keeps the physics lanes.
  - The clip packs carry each clip's game name exactly in `extras.source`, which lane X asked for.
  - Ten hilts and three hero blasters, `--keep-origin`, at the game's own maps; `HILTS` wear them; the saber and gunplay put the weapon in `Wep_Root` on a 2017 figure, the clip's arms and fingers holding it, the aim on the chest.

## Left

In order:

1. **Phase 2, everyone the game has**: `docs/superpowers/plans/2026-10-10-bf2017-phase2-everyone.md` (troopers, droids, blasters on the same loader; the humanoid pack plus the `AI_Rifleman`, `AI_Officer`, `Cover` and `Awareness` sets).
2. **Yoda and Grievous**: their own rigs (`Yoda_01_Ske`, `GeneralGrievous_01_Ske`) and clips (101 and 161); not imported this phase, they stay as they were until their own-rig packs (phase 10's).
3. **Site clip names the game has nothing for**, which fall back (`CLIP_FALLBACK`, else the humanoid pack's): Vader `sword.dash`, `sword.pound`, `force.push`; Anakin's staggers (the humanoid flinches stand in); Dooku `sword.aerial.a`, `sword.uppercut`; Palpatine every stroke (he fights with lightning in the game); the blaster heroes' dodges.
4. **Textures not in the bucket yet**: Leia's braids (`t_lodcaps_braids_01_brown_cm`, `…_n`), and the game's generic eye map (`T_Eye_MP_DA`): the human heroes wear Luke's eye map, its white lifted. Re-import when the upload has them.
5. **A dual stance on a 2017 figure** holds one hilt: the game's heroes don't dual-wield; `Wep2_Root` is there for it if the site wants one.
6. **Repository weight**: the native heroes, outfits and blasters are published to the `site-assets` bucket (`scripts/assets-publish.mjs`, `src/data/galaxyAssets.json`) and out of git.
7. Phases 3 to 10 as the spec's table orders them.
8. `WEAPON_FRAME` re-measured if a weapon sits wrong; the hilt sheet and the duel shots say it doesn't.

## Checking it

The keys: `SUPABASE_URL` and `BF2017_KEY` (a key that can read the private `bf2017-assets` bucket) in `.env.local`, never committed; the owner holds them. In a cloud session they are already environment variables (the key as `SUPA_KEY`; the fetch takes either), so drop `--env-file`.

```
node --env-file=.env.local scripts/bf2017-fetch.mjs manifest
node --env-file=.env.local scripts/bf2017-fetch.mjs --list 'gameplay/equipment/heroes/*'
node --env-file=.env.local scripts/bf2017-fetch.mjs gameplay/equipment/heroes/lightsaberlukeskywalker/lightsaberlukeskywalker_meshp_mesh
node scripts/bf2017-import.mjs gameplay/equipment/heroes/lightsaberlukeskywalker/lightsaberlukeskywalker_meshp_mesh --kind hiltluke --as 'Luke’s lightsaber hilt' --asis --keep-origin --native --tex 2048 --maps 2048
npx vite --port 5188 --strictPort --host 127.0.0.1 &
node scripts/glb-shot.mjs public/models/galaxy/surface/hiltluke.glb /tmp/hiltluke.png three
```

Phase 1's, with the dev server up:

```
node scripts/bf2017-fetch.mjs anims
node scripts/bf2017-clips.mjs luke
node scripts/bf2017-import.mjs characters/hero/luke/luke_rotj_01/luke_rotj_01_mesh --kind luke --as 'Luke Skywalker' --rig --crew --hero --metres 1.72 --parts '<head>,<hair>' --native --tex 1024 --maps 1024 --ultra --ultra-tex 2048 --ultra-maps 2048 --quality 90 --cuts plain=0,lod1=2,ultra=0 --eyes characters/heads/_shared/eyes/t_eyes_luke_c.ktx2
node scripts/bf2017-skeleton.mjs public/models/galaxy/bf2017/crew/luke.glb
```

The duel: open `#/galaxy/hoth/surface` as Luke, then `__surfaceDo('duel', 'maul', { stance: 'double' })` in the console; F strikes, C blocks.

The tests need no keys and no network: `npx vitest run scripts/lib/bf2017-* scripts/lib/rig-parts.test.mjs scripts/lib/catalog-write.test.mjs scripts/bf2017-import.test.mjs scripts/bf2017-clips.test.mjs scripts/bf2017-skeleton.test.mjs src/lib/three/walrus src/lib/combat/hiltFit.test.js src/components/galaxy/surface/catalog`.

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
- **The progressive swap** for the galaxy's other figures (props and Meshy people): a 2017 figure has it now (phase 1: `walrus.js`'s `swapBody` rebinds the full cut's meshes to the figure's own bones, so nothing that holds the figure notices); the same move would serve any skinned figure whose cuts share a skeleton.
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

## Lane V: the vehicles, in depth

The plan is `docs/superpowers/plans/2026-10-10-bf2017-phaseV-vehicles.md`; the cast, kind by kind, `docs/superpowers/evidence/bf2017-vehicles/cast.md`; the sheets and the measures, the same folder.

### Done

- **PR #828** (`claude/bf2017-vehicles`).
- **The walkers on the game’s rigs.** `src/lib/three/ownRig.js` loads a figure on a skeleton of its own, in `crew.js`’s shape, and plays the game’s clips on its bones as they are. Nothing is retargeted, no bone is pruned or renamed, the walk is paced to the ground covered, and `react('down')` and `react('fire')` play the game’s death and shot. `src/lib/three/rigSets.js` names each rig’s clips under the site’s names: the AT-AT 8 (its tow-cable fall `die.cable`), the AT-ST 12, the AT-TE 10, the AT-RT 9, the droideka 17. `CLIP_FALLBACK` stays inside the rig, and `deathFor` picks the cable’s fall when the cable did it. `scripts/bf2017-rigclips.mjs` packs them at 24 fps, in place (the trajectory’s quarter turn folded into its children: `scripts/lib/rig-clips.mjs`), as `public/models/galaxy/bf2017/clips-<rig>.glb`: 259, 111, 323, 95 and 279 KB. `walkers.js` sends every kind whose model is the game’s through it. Nothing of the site’s rides a game rig (the owner, 2026-10-10): the AT-RT walks with its saddle empty until the game’s own clone trooper can sit it.
- **The AT-ST bound to its skeleton.** The drop has it only as one rigid composite, and its 69 clips are on the cinematics’ `ATST_Ske01`. `bf2017-import.mjs --bind` skins it there, each piece of the mesh to one bone (`scripts/lib/rig-bind.mjs`). The AT-AT is the game’s own skinned `old/atat_mesh`; the gameplay composite bound the same way came to 4.0 MB with a plate that tore.
- **Every vehicle the site places, the game’s.** Five walkers, eight ground vehicles and droids, six turrets, twenty fighters and fourteen cockpits are in `catalog/bf2017-vehicles.js`, a group of the lane’s own after `bf2017`. Each has a `.lod1` and a `.far` cut, and `scripts/bf2017-vehicles.mjs` lists the import of each. Each cockpit is stood in its hull’s frame (`--hull-frame`): 11 of 14 lie inside their hull’s bounds; the snowspeeder’s, A-wing’s and Slave I’s reach past by up to a metre where the canopy is.
- **Native, as the game has them** (the owner, 2026-10-10: trust the game’s textures; fix the caps for the native files). Every kind is imported with phase 1’s `--native` (merged in from `claude/bf2017-phase1`, so this PR lands after #815): the game’s own KTX2, untouched, its top mip levels dropped for the lighter cuts (plain 1024, light 512, far 256 and its colour maps alone, ultra the game’s own size). The plain cut is the game’s first LOD under 60,000 triangles (`NATIVE_VEHICLE`; the AT-AT takes its LOD1, 61,900), the ultra its LOD0. The full cuts are in `site-assets` (194 files, 849 MB; `assets-check`: 338 of 338), out of git; a native kind draws its light cut alone at low and mid, the phone’s levels (`catalog/index.js`’s `modelUrlFor`).
- **Why the game’s files had looked poor on the site, and the fix.** The pipeline did it, not the game:
  - **The wrong UV set.** The drop’s GLBs bind every map to `TEXCOORD_0`, but the game’s vehicle shader reads its colour, normal and smoothness atlas through the set that unwraps the hull once; on the X-wing that is `TEXCOORD_1`, and through the other the atlas smeared into the grey and brown patchwork of the first sheets. `scripts/lib/bf2017-uv.mjs` tells the set by its area in UV space (about the square’s once, against a tiling set’s many: the X-wing’s fuselage 0.66 against 2.22; the TIE Advanced is the other way round). `xwing-uv-sets.webp` shows both.
  - **Decals painted opaque.** A decal sheet blends in through the mask in its `_nam` map’s alpha; drawn opaque it painted patches over the hull. It now blends by that mask (lossless), and a normal-only decal, which glTF can’t express, is dropped (`scripts/lib/bf2017-dressing.mjs`).
  - **Our restyling.** The metal cap (`relit`) is gone, nothing is re-encoded or resized but by dropping the game’s own mips, and the only maps made from the game’s pixels are the two glTF needs: a decal’s colour with its mask, and a packed `_ncs` map’s colour from its blue, both lossless.
  - **What no file carries.** The game’s lighting, reflections and its tiling detail maps (`DetailNS`) are its renderer’s; lighting is the owner’s lane.
- **The import learns lane V’s flags:** `--vehicle`; `--far`; `--bind`; `--hull-frame` (named apart from phase 1’s `--keep-origin`: grounded by the hull’s manifest box so a cockpit sits in its hull); `--light-maps` (the AT-TE’s fifteen maps put its light cut at 5.1 MB, over the 5 MB cap, at 512). The game’s glass is made glass and the MTT’s weak-point covers are dropped.
- **The placer, for the bucket’s cuts.** A row that is `native` draws its `.lod1` first and swaps its level’s cut in under the same object when it lands (`cutsToLoad`, `swapIn`). An `.ultra` that can’t be had falls to the plain one (`fallbackFor`), as a walker’s does.
- **The rides on the game’s 74-Z and X-34.** Their seats are measured off the models and tested against them (`rides.seat.test.js`); the chase’s scouts sit the same saddle.
- **The fleets on the game’s fighters.** `scripts/bf2017-fleet.mjs` writes twelve ships over the space layer’s Sketchfab files, at the paths `galaxy/models.js` names: the TIE fighter, bomber and Advanced, the A-, Y- and U-wings, the N-1, ARC-170, vulture, tri-fighter, cloud car and the Nebulon-B, natively. They stay committed as well as published, as `galaxy/models.test.js` measures them. Their far-off copies are remade by `galaxy-lod.mjs`, which reads a native map’s colours from the game’s unpacked PNG.
- **Rigs.** Every kind the drop has a skeleton for is on it: the five walkers with their clips, and the homing and dwarf spider droids on `GEO_HomingSpiderDroid_Skeleton` and `DwarfSpiderDroid_Ske`, kept whole, standing (the drop has no clips for them). The fighters, speeders and turrets have no skeleton in the drop.
- **anim-check knows the walkers’ feet** (`LeftFrontFoot`). On Hoth every AT-AT in view, and on Endor the AT-ST, reads 0 m/s of planted drift and none is at bind pose.

### Where the code and the plan differed

- `universe/shipModels.js` has no galaxy rows, and there is no instanced far-fighter path. The space layer’s rows are `galaxy/models.js`, which open PR #793 is changing, so the fleet is written at the files those rows name rather than by editing them. The far copies are `galaxy-lod.mjs`’s one-piece vertex-coloured ones, which the space layer’s LOD asks for, not the import’s `.far`.
- `warpieces/hoth.js` is the space ion cannon, and nothing on the surface brings a walker down. The figure’s `react('down', { cable })` is ready, and a hostile walker or droideka shot down (`activity.js`) already plays its game death.
- The plan’s “imperial cruiser” is the Arquitens light cruiser, and the gameplay capitals are kits placed by level data. The fleet’s capitals were compared with the space battles’ whole backdrop ships: the close-up Star Destroyer and Nebulon-B (Daniel Andersson’s, about 100,000 triangles) and the MC80 stay, being the better on the sheet (`fleet.webp`). The Nebulon-B’s plain cut is the game’s.
- `bf2017-clips.mjs` was on phase 1’s branch, not main, so the `--skeleton` form is `scripts/bf2017-rigclips.mjs`, over its own pure module: **phase 1, fold it in** (or keep it beside yours).
- The AT-M6 is The Last Jedi’s: left out by the standing rule.
- The Falcon is the landmark mesh: the gameplay one names no maps in the drop.

### Left

- **The hooks the owner’s other lanes need**, in the files:
  - **The walkers’ feet:** `RIGS[rig].feet` by the game’s bone names; a walker figure’s `bones` and `feet`.
  - **A ride’s seat:** `rides.js`’s `seat` and `riders.js`’s `SEATS`, measured off the game’s models.
  - **The muzzles:** the game’s own gun bones (the AT-AT’s `GunRotation`, `LeftSecGun`, `RightSecGun`; the AT-TE’s `Turret_Barrel`; the droideka’s `LeftGunMuzzle1/2`, `RightGunMuzzle1/2`; the AT-RT’s `Gun`), kept whole on the rigs.
  - **Collision:** none was imported. The physics lanes (PR #817’s P0 to P4) take the vehicles from here; P3 does their physics.
  - **Lighting, camera, HUD:** none was added, by the owner’s rule of 04:40.
- **The cockpits on boarding**: the GLBs are in, each in its hull’s frame. Two places can wear them. The space layer’s cockpit view (`galaxy/scene.js`’s `buildCab`, the intro’s built cockpits) is PR #793’s file. A surface ride on a fighter does not exist yet: the snowspeeder on Hoth is the galactic-assault hand-off’s open row, and `sites/ice.js` is PR #795’s.
- **A rule that brings a walker down**, and the tow cable to trip it (`quests.js`’s `trip` step exists; nothing emits it). The rope is `gameplay/vehicles/air/airspeeder/old/towcablerope_skinned_mesh`, on its own skeleton, with no clips.
- **The AT-AT’s destruction skeletons** (`ATAT_Destruction_01_*`, one or three clips each): not wired, as nothing brings one down.
- **The chase rider on the game’s clips** (`A_HM_SpeederBike_*`, the humanoid’s): phase 1’s walrus loader, once it is on main. The chase still sits figures.js’s built scout on the game’s 74-Z.
- **The fallen AT-AT on Hoth** (`sites/ice.js`’s `walker` zone) is the game’s model rolled on its side in its bind pose. Its tow-cable death’s last frame would be the true pose, but the placer places statues.
- **Deaths and engines on lane F’s effects**: `gameFx.explode(class, at)` (PR #829, on phase 1’s branch until #815 lands) for a walker’s, speeder’s or fighter’s death, and its engine and thruster glow through `gameLook`: wire `react('down')` and the rides to it once it is on main, rather than a second effect path.
- **The AT-ST’s rig**: the drop has no skinned AT-ST, so its rigid mesh is skinned at import to the cinematics’ `ATST_Ske01` (one bone a piece). If the owner counts that binding as ours, it stands as a statue instead (drop `--bind`).
- **Sounds**: the vehicles’ engines and footfalls when the game’s audio lands.
- **The far fleet instanced**: the space layer draws each ship through its own `THREE.LOD`, a draw each. The game’s far copies keep that cost, and instancing is the fleet war’s own open item.
- **Textures**: no map these vehicles name was `missing` on 2026-10-10.

### Checking it

```
node scripts/bf2017-fetch.mjs manifest                 # and web/anims.jsonl, which bf2017-rigclips.mjs fetches itself
node scripts/bf2017-rigclips.mjs --pack atat           # atst, atte, atrt, droideka
node scripts/bf2017-vehicles.mjs --fetch               # every kind; or a kind, or --group walker|ground|turret|air|cockpit
node scripts/bf2017-fleet.mjs && node scripts/galaxy-lod.mjs tie tiebomber tieadvanced awing ywing uwing n1 arc170 vulture trifighter cloudcar nebulon
node scripts/assets-publish.mjs && node scripts/assets-check.mjs   # the native cuts to site-assets; commit the manifest and .gitignore
node scripts/ride-points.mjs                                            # after re-importing the 74-Z or the X-34
npx vite --port 5188 --strictPort --host 127.0.0.1 &
node scripts/rig-shot.mjs public/models/galaxy/surface/atst.glb atst /tmp/atst.png idle,walk,die
node scripts/anim-check.mjs --route '#/galaxy/hoth/surface' --do "__surfaceScene.put(261, 431)" --do "__surfaceScene.view([261, 14, 431], [283, 9, 510])" --range 150 --port 5188
```

The tests need no keys and no network: `npx vitest run src/lib/three/ownRig.test.js src/lib/three/rigSets.test.js scripts/lib/rig-clips.test.mjs scripts/lib/rig-bind.test.mjs scripts/lib/bf2017-dressing.test.mjs scripts/lib/bf2017-uv.test.mjs scripts/bf2017-import.vehicles.test.mjs scripts/bf2017-fleet.test.mjs src/components/galaxy/surface/walkers.test.js src/components/galaxy/surface/rides.seat.test.js src/components/galaxy/surface/catalog`.
