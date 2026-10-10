# Hand-off: the Battlefront II (2017) pipeline

The design is `docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md`; the bucket’s numbers, `docs/superpowers/evidence/bf2017-assets/inventory.md`; the drop and its credit, `docs/assets/battlefront-2017.md`.

## Done

- **The design, the inventory and the plans** (PR #802, carried by the phase 0 PR).
- **Phase 0, the tools** (PR #805): the decision entry and the assets page; `scripts/bf2017-fetch.mjs` and `scripts/bf2017-import.mjs` over five tested modules under `scripts/lib/` (`bf2017-manifest`, `bf2017-paths`, `bf2017-textures`, `rig-parts`, `catalog-write`); the committed fixture (`scripts/fixtures/bf2017/`, 39.6 KB); the empty `catalog/bf2017.js`, last in `GROUPS`. Nothing on the site changed. Tried on two real models and nothing kept: Luke’s hilt (920 triangles, 212 KB, the shot in `docs/superpowers/evidence/bf2017-phase0/`) and Luke’s rotj body with `--rig` (the whole rig kept, 254 joints with fingers, face and physics; LOD2 706 KB, LOD4 236 KB; drawn in its bind pose).
- **Phase 1, the heroes on the game's skeleton, with their hilts** (this PR, `claude/bf2017-phase1`):
  - `public/models/galaxy/bf2017/walrus.glb`: `Walrus_HumanMale` whole, 254 nodes (`scripts/bf2017-skeleton.mjs`); `src/lib/three/walrusRig.js` names its body, fingers and sockets, `WEAPON_FRAME` (the identity: the game models weapons in the `Wep_Root` frame).
  - The game's clips as packs (`scripts/bf2017-clips.mjs`, names mapped by `src/lib/three/walrusClips.js`): `clips-humanoid.glb` 843 KB (27 clips), and one a hero: Luke 1,323 KB (45), Vader 1,269 (42), Obi-Wan 1,069 (39), Anakin 1,187 (38), Maul 1,179 (41), Dooku 1,153 (38), Palpatine 459 (15), Han, Leia, Lando, Chewbacca, Boba Fett, Bossk 92-141 KB (their defeat and abilities). 24 fps, root motion off `AITrajectory` into `extras.root`, `contact` timed on a blade a metre up `Wep_Root`, rest-holding channels left out and put back by the loader. Luke's blocks come from the cinematic skeleton (`Walrus_NIS_S0800_Skeleton`, the same rig at the same rest).
  - `src/lib/three/walrus.js` loads a 2017 body with its packs; footScene's `walrusFigure` wraps it in the same `rigged()` every figure gets, the animator told `library: false`. Both figure paths (`crew.js`, `loadPartyFigure`) take `rig: 'walrus'`.
  - Thirteen heroes, each in three cuts (review fixes, 2026-10-10): `<kind>.ultra.glb` at the game's full fidelity, at the owner's ask ("highest fidelity": LOD0 meshes, 31,807-61,764 triangles, every map at 2048, WebP 90, 4.7-13.6 MB, 111-384 MB of GPU textures a hero), loaded only at ultra; `<kind>.glb`, the same mesh at 1024 colour and 512 maps (1.4-3.0 MB, 23-49 MB of GPU textures), at high; `<kind>.lod1.glb` (the cut under 8,000 body triangles at 512 and 256: 0.5-1.1 MB, 6-13 MB) at low and mid. The full-map files had been the plain cut: Luke alone was 272 MB of GPU textures against the 256 MB a world may have. `crew.budget.test.js` holds each cut to its cap on disk and on the GPU. Sheets in `docs/superpowers/evidence/bf2017-phase1/` (of the full-map files). They are `public/models/galaxy/bf2017/crew/<kind>.glb`, credited `bf2017-<kind>`; the skeleton and the clip packs by one pack credit, `bf2017/walrus` in `public/games/credits.json`. Of the Meshy and Sketchfab files at `galaxy/crew/`, Luke's, Han's, Leia's, Vader's and Palpatine's stay (the universe's foot party, the Death Star's people, `scripts/motion/bake.mjs`, `ual-bake.mjs` and `meshy-actions.mjs` load them as Meshy figures); Boba Fett's, Obi-Wan's, Maul's, Lando's and Dooku's, which only the galaxy used, are gone with their credits.
  - Ten hilts and three hero blasters, `--keep-origin`, at the game's own maps; `HILTS` wear them; the saber and gunplay put the weapon in `Wep_Root` on a 2017 figure, the clip's arms and fingers holding it, the aim on the chest.

## Left

In order:

1. **Phase 2, everyone the game has**: done in part; its own section below says what is left.
2. **Yoda and Grievous**: their own rigs (`Yoda_01_Ske`, `GeneralGrievous_01_Ske`) and clips (101 and 161); not imported this phase, they stay as they were until their own-rig packs (phase 10's).
3. **Site clip names the game has nothing for**, which fall back (`CLIP_FALLBACK`, else the humanoid pack's): Vader `sword.dash`, `sword.pound`, `force.push`; Anakin's staggers (the humanoid flinches stand in); Dooku `sword.aerial.a`, `sword.uppercut`; Palpatine every stroke (he fights with lightning in the game); the blaster heroes' dodges.
4. **Textures not in the bucket yet**: Leia's braids (`t_lodcaps_braids_01_brown_cm`, `…_n`), and the game's generic eye map (`T_Eye_MP_DA`): the human heroes wear Luke's eye map, its white lifted. Re-import when the upload has them.
5. **A dual stance on a 2017 figure** holds one hilt: the game's heroes don't dual-wield; `Wep2_Root` is there for it if the site wants one.
6. **Repository weight**: the full-fidelity heroes are 111 MB of GLBs (their light cuts 25 MB more). Lane S (`site-assets` bucket, `scripts/assets-publish.mjs`) is where they should move.
7. Phases 3 to 10 as the spec's table orders them.
8. `WEAPON_FRAME` re-measured if a weapon sits wrong; the hilt sheet and the duel shots say it doesn't.

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

Phase 1's, with the dev server up:

```
node scripts/bf2017-fetch.mjs anims
node scripts/bf2017-clips.mjs luke
node scripts/bf2017-import.mjs characters/hero/luke/luke_rotj_01/luke_rotj_01_mesh --kind luke --as 'Luke Skywalker' --rig --crew --hero --metres 1.72 --parts '<head>,<hair>' --tex 1024 --maps 512 --ultra --ultra-tex 2048 --ultra-maps 2048 --quality 90 --cuts plain=0,lod1=2,ultra=0 --eyes characters/heads/_shared/eyes/t_eyes_luke_c.ktx2
node scripts/bf2017-skeleton.mjs public/models/galaxy/bf2017/crew/luke.glb
```

The duel: open `#/galaxy/hoth/surface` as Luke, then `__surfaceDo('duel', 'maul', { stance: 'double' })` in the console; F strikes, C blocks.

The tests need no keys and no network: `npx vitest run scripts/lib/bf2017-* scripts/lib/rig-parts.test.mjs scripts/lib/catalog-write.test.mjs scripts/bf2017-import.test.mjs scripts/bf2017-clips.test.mjs scripts/bf2017-skeleton.test.mjs src/lib/three/walrus src/lib/combat/hiltFit.test.js src/components/galaxy/surface/catalog`.

## Phase 2: everyone the game has

The plan is `docs/superpowers/plans/2026-10-10-bf2017-phase2-everyone.md`. The cast, kind by kind, is `docs/superpowers/evidence/bf2017-phase2/cast.md` (and `cast.json`). The sheets are in `docs/superpowers/evidence/bf2017-phase2/sheets/`: the figure it replaces, then the full cut, the light cut and the far cut. The costs are in `costs.md` beside them.

### Done (PR #PHASE2PR, `claude/bf2017-phase2`)

- **25 kinds from the game, on the figure paths the worlds already use** (a 2017 row takes over a kind by name; no `sites/*.js` changed):
  - **On the game's humanoid skeleton (`rig: 'walrus'`)**: stormtrooper, sandtrooper, snowtrooper, scouttrooper, shoretrooper, deathtrooper, hothtrooper, rebel, clone (Phase II), clonephase1, wookiee, c3po, rebelpilot, rebeltech, officer, and the city's civilians civcity1 and civcity3.
  - **On rigs of their own (`rig: 'own'`)**, through `src/lib/three/ownRig.js`:
    - superdroid (B2)
    - droideka
    - ewok
    - astromech (R2-D2), r5 (R5-D4) and droid (R4-I9)
    - probe (the viper)
    - tauntaun
- **Three cuts for each kind**, all from the game's own LOD chain:
  - **Full cut**: the game's LOD0, never simplified, its maps the game's own KTX2, untouched, at up to 2048 (phase 1's native settings); 2 to 45 MB.
  - **Light cut (`.lod1`)**: LOD4, or LOD2 where the game's light LODs wear `lodcaps` maps the bucket hasn't yet (the Wookiee, the Ewok, the tauntaun, the city civilians); WebP at colour 1024 and the rest 512, or 512 and 256 for the ten kinds of five or more materials. 0.2 to 1.0 MB, committed.
  - **Far cut (`.far`)**: the chain's last LOD at 256 and 128, under 150 KB, for the kinds the assaults field; committed.
  - **Where the full cuts are**: published to `site-assets` (`node scripts/assets-publish.mjs --only <the 25 full cuts>`, now taking a comma-separated list) and not in git. `src/data/galaxyAssets.json` names them and `.gitignore`'s block keeps them out.
- **Drawn by distance** (`src/lib/three/walrusCuts.js`, footScene's `gameFigure`):
  - **The cut**: the light cut is drawn first; within the level's `near` the full cut is swapped onto the same bones (phase 1's `swapBody`), and past its `mid` the far one. The bands are `lib/net/progressive.js`'s.
  - **Who calls it**: `cutAt(d)` is called by `actors.js`, `assaultScene.js` and `groundFigures.js`.
  - **The ledger**: a page admits full cuts kind by kind into a share of the download and of the GPU (`FULL_SHARE`: high 30 MB and 128 MB, ultra 160 and 448, none on a phone's levels), told by each row's `fullDL` and `fullMB`. With a stormtrooper at 25 MB, high takes about one kind's full cut a world.
- **Rows and loaders**:
  - `crewList.js`'s rows carry `lod`, `far`, `full`, `fullMB` and `fullDL`.
  - The cast casts its body's shadow alone.
  - `figureLoaderFor` sends `rig: 'own'` to the own-rig loader.
  - The walrus loader still refuses a body without the game's sockets.
- **The own-rig contract, for lane V's walkers**: `loadOwnRigBody(url, { rig, packs?, bones?, loader? }) → { model, clips, bones, rig }` and `ownPackUrl(rig)`, in `src/lib/three/ownRig.js`.
  - Clips bind by bone name, with the walrus loader's filtering.
  - A row's `bones` ({ role: boneName }) are checked, and the loader refuses naming what is missing.
  - A rig's set goes in `walrusClips.js`'s `OWN_RIGS` (`skeleton`, `body`, `set`).
  - Its pack is `node scripts/bf2017-clips.mjs <rig>`, which reads the skeleton from the body's light cut and takes clips from that skeleton alone.
  - Lane V adds the walkers' rigs to `OWN_RIGS` and their rows with `rig: 'own', ownRig: '<rig>'`.
- **Packs**:
  - `clips-humanoid.glb`: 31 clips, 1.0 MB. Added: the troopers' patrol twitches, look-around, look at the ground, and the game's greeting as `wave`.
  - b2: 22 clips, 432 KB.
  - droideka: 12, 215 KB.
  - ewok: 24, 617 KB.
  - astromech: 6, 22 KB.
  - probe: 5, 30 KB.
  - tauntaun: 10, 226 KB.
  - Every pack clip keeps `userData.source` (the game's clip) for lane X.
  - Packs load with the figure, through the page's cache, once each: a world with no 2017 person fetches none.
- **The import**:
  - Its flags: `--full`, `--far`, `--join` (a figure's parts joined per material on its skin), `--cuts far=<n>`, `--lod1-tex` and `--lod1-maps`.
  - Each row's full-cut GPU textures and download are written in.
  - **Parts bound in a pose of their own** (the clone's gloves, from another body) keep their own inverse binds on the body's bones. Before, one move put a vertex 38,877 m off and the clone was refused.
  - **Procedural bones**: a part's `PROC_Bone*` stays its own. The clone's helmet is weighted wholly to its own `PROC_Bone0`, which the game places per mesh.
  - The sequel's `d_assault_newera` troopers are refused.
- **The villager pool** (`surface/pools.js`): Coruscant's and Bespin's villagers (and farmers, caretakers, Jocasta, Zam) are the city's civilians, one of two by the figure's number. A pooled kind that won't load gives way to the built one.
- **The audit**: `galaxy-figures-audit.mjs` names `walrus` and `own-rig`, and `EXPECTED` holds every moved kind (phase 1's heroes too). Phase 1 had left `anakin` expected as `legs`.

### Left

In order:

1. **Kinds waiting on textures the bucket hasn't yet** (re-import each with its line below once the upload has them):
   - **The B1** (`d_assault_preq_01`, `SS_CharactersPreset_RobotMarkings`): its colour is a markings map, so its own maps draw it grey. Its pack set is in `OWN_RIGS.b1`, but no pack is built.
   - **Mos Eisley's and Theed's crowds** (`civ_moseisley_0{1,2,3}`, `civ_theed_0{1,2}`, on `Civilian_Ske` with no sockets): palette-coloured. When they come, they take the own-rig loader with `packs: ['/models/galaxy/bf2017/clips-humanoid.glb']` (the bones are the humanoid's by name), and Tatooine's and Naboo's pools in `pools.js`.
   - **The `lodcaps` maps**: once the Wookiee's, the Ewok's and the tauntaun's are there, their light cuts can go back to LOD4 (`--cuts lod1=4`). City civilian 2 (`civ_vardos_female_robe2` with Linnea's bob) waits for `t_lodcap_bob_02`.
   - **The outfit variations** (cast.md lists them from `MeshVariationDatabase` and `ObjectVariation`): the Yavin, Endor, Scarif and Mos Eisley Rebels, the clone legions' markings, the sandtrooper's dirt. Their textures are not in the bucket.
   - **The Ewok's hood**: it draws grey where the game tints it.
2. **Draw calls**: the modular Rebels, the Hoth trooper, the Wookiee and the officer are five to nine draws a figure (one per material), against the Meshy figures' one. Under four needs an atlas per kind (or a texture array), which the import doesn't make; `costs.md` has where each world stands.
3. **The kinds no world places yet**, for the Death Star interior's own lane (`inside/pack.js`): shadowtrooper, navy crewman, admiral, personnel, gonk, interrogation droid. cast.md has their manifest names; none were shipped.
4. **The own rigs left**: dewback, bantha, eopie, ronto, jawa, aiwha, dwarf spider, mouse droid (phase 3's beasts); Yoda and Grievous (phase 10). The tauntaun's rider (`A_TauntaunRider_*` on the humanoid) is phase 3's.
5. **Hurtboxes**: lane P1's (PR #817). The own rigs need region maps there.
6. **The phase 1 heroes' full cuts** are still committed (phase 1's lane); the same `assets-publish --only` takes them out.

### Checking it

- **The import of one kind** (the stormtrooper here), then publish and check:

  ```
  node scripts/bf2017-fetch.mjs characters/imperial/imperial_stormtrooper/imperial_stormtrooper_male_01/imperial_stormtrooper_male_01_mesh --lod all --parts '*_helmet_mesh'
  node scripts/bf2017-import.mjs characters/imperial/imperial_stormtrooper/imperial_stormtrooper_male_01/imperial_stormtrooper_male_01_mesh --kind stormtrooper --as 'A stormtrooper' --rig --crew --metres 1.83 --parts 'characters/imperial/imperial_stormtrooper/imperial_stormtrooper_male_01/imperial_stormtrooper_male_01_helmet_mesh' --full --join --far
  node scripts/bf2017-clips.mjs humanoid
  node scripts/bf2017-clips.mjs b2
  node scripts/assets-publish.mjs --only 'models/galaxy/bf2017/crew/stormtrooper.glb'
  node scripts/assets-check.mjs
  node scripts/galaxy-figures-audit.mjs
  ```

- **The import flags, cut by cut**:

  | cut | how it is made |
  | --- | --- |
  | `--full`'s plain | LOD0, `native: true` at 2048 (the game's KTX2 with no levels dropped; a map the bucket has only as PNG goes to AVIF q90), positions 16 bits, normals 12, UVs 16, no simplification |
  | `--full`'s `.lod1` | the first LOD under 1,500 triangles, or `--cuts lod1=<n>`; WebP colour `--lod1-tex` (1024) at 82, the rest `--lod1-maps` (512) at 80; an opaque colour map's alpha taken off |
  | `--far` | the chain's last LOD, or `--cuts far=<n>`; WebP colour 256 and the rest 128, halved until under 150 KB |
  | `--join` | the skinned parts on one skin joined per material |

- **Each kind's extra flags**: every one is `--rig --crew --full --join`, with `--far` where cast.json says `far`. Its body, parts and height are in `cast.json`.
  - `--cuts lod1=2`: wookiee, ewok, tauntaun.
  - `--cuts lod1=2` and `--lod1-tex 512 --lod1-maps 256`: civcity1, civcity3.
  - `--lod1-tex 512 --lod1-maps 256`: hothtrooper, rebel, rebelpilot, officer, sandtrooper, snowtrooper, and the Wookiee as well.
- **The checks**: `galaxy-check.mjs surface <world>` with `BUDGET=1` at `QUALITY=high` and `low` (the before and after tables are in `costs.md` and the PR), and `anim-check.mjs --route '#/galaxy/hoth/surface' --limit 0.15 --strict --quality high` (34 figures, none at bind pose).
- **Gotchas**:
  - A checkout has no full cuts, so the tests read them through the manifest (`crew.budget.test.js`, `crewList.test.js`, `sites/ice.test.js`).
  - `git stash -u` takes the untracked imports with it.
  - Prettier is not the repo's formatter: don't run it on a file.

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
