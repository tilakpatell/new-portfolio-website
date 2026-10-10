# Hand-off: the Battlefront II (2017) pipeline

The design is `docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md`; the bucket’s numbers, `docs/superpowers/evidence/bf2017-assets/inventory.md`; the drop and its credit, `docs/assets/battlefront-2017.md`.

## Done

- **The design, the inventory and the plans** (PR #802, carried by the phase 0 PR).
- **Phase 0, the tools** (PR #805): the decision entry and the assets page; `scripts/bf2017-fetch.mjs` and `scripts/bf2017-import.mjs` over five tested modules under `scripts/lib/` (`bf2017-manifest`, `bf2017-paths`, `bf2017-textures`, `rig-parts`, `catalog-write`); the committed fixture (`scripts/fixtures/bf2017/`, 39.6 KB); the empty `catalog/bf2017.js`, last in `GROUPS`. Nothing on the site changed. Tried on two real models and nothing kept: Luke’s hilt (920 triangles, 212 KB, the shot in `docs/superpowers/evidence/bf2017-phase0/`) and Luke’s rotj body with `--rig` (the whole rig kept, 254 joints with fingers, face and physics; LOD2 706 KB, LOD4 236 KB; drawn in its bind pose).

## Left

In order:

1. **Phase 1, the heroes with their hilts**: the owner chose, on 2026-10-10, to keep the 2017 rig in full: no pruning, no renaming to Meshy’s names; the site learns the game’s skeleton. Phase 0’s rig prune (plan task 4) was written, tried on Luke (254 joints to 63, and his fingers and face went with it) and then taken out; the import keeps all 254 and puts `grip` under `Wep_Root`. The phase 1 plan is the revised one (merged in from `claude/nice-mayer-jqow5k`): one shared clip library on the game’s skeleton, a loader that knows its sockets, the hilts in `Wep_Root`. Its first rigged import should check `skins.length === 1` and that a figure’s joint count equals its body’s (the parts’ duplicate skeletons joined by `rig-parts.mjs`). Then: `docs/superpowers/plans/2026-10-10-bf2017-phase1-heroes.md`. Its task 2 adds parts by full manifest name (Luke’s head and hair are under `characters/heads/`, not his body’s folder: the body alone is 1.596 m and headless) and the spine rename; both go into `partsOf`, so the fetch’s `--parts` takes names too.
2. Phases 2 to 10 as the spec’s table orders them, each with its own plan when it starts.
3. Textures: every map the hilt and Luke’s body name was in the bucket as KTX2 on 2026-10-10, none as PNG. A map not there yet prints `missing:` in the import and the material goes without it; re-fetch and re-import when the upload has it.
4. Normals as KTX2 (UASTC) where `scripts/ktx2.mjs report` says it pays: phase 9’s, with the ultra cuts.

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

The tests need no keys and no network: `npx vitest run scripts/lib/bf2017-* scripts/lib/rig-parts.test.mjs scripts/lib/catalog-write.test.mjs scripts/bf2017-import.test.mjs src/components/galaxy/surface/catalog`.

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

## Lane V: the vehicles, in depth

The plan is `docs/superpowers/plans/2026-10-10-bf2017-phaseV-vehicles.md`; the cast, kind by kind, `docs/superpowers/evidence/bf2017-vehicles/cast.md`; the sheets and the measures, the same folder.

### Done

- **PR (this one, from `claude/bf2017-vehicles`).**
- **The walkers on the game’s rigs.** `src/lib/three/ownRig.js` loads a figure on a skeleton of its own, in `crew.js`’s shape, and plays the game’s clips on its bones as they are. Nothing is retargeted, no bone is pruned or renamed, the walk is paced to the ground covered, and `react('down')` and `react('fire')` play the game’s death and shot. `src/lib/three/rigSets.js` names each rig’s clips under the site’s names: the AT-AT 8 (its tow-cable fall `die.cable`), the AT-ST 12, the AT-TE 10, the AT-RT 9, the droideka 17. `CLIP_FALLBACK` stays inside the rig, and `deathFor` picks the cable’s fall when the cable did it. `scripts/bf2017-rigclips.mjs` packs them at 24 fps, in place (the trajectory’s quarter turn folded into its children: `scripts/lib/rig-clips.mjs`), as `public/models/galaxy/bf2017/clips-<rig>.glb`: 259, 111, 323, 95 and 279 KB. `walkers.js` sends every kind whose model is the game’s through it; the AT-RT’s clone sits its saddle, carried by its Hips.
- **The AT-ST bound to its skeleton.** The drop has it only as one rigid composite, and its 69 clips are on the cinematics’ `ATST_Ske01`. `bf2017-import.mjs --bind` skins it there, each piece of the mesh to one bone (`scripts/lib/rig-bind.mjs`). The AT-AT is the game’s own skinned `old/atat_mesh`; the gameplay composite bound the same way came to 4.0 MB with a plate that tore.
- **Every vehicle the site places, the game’s.** Five walkers, eight ground vehicles and droids, six turrets, twenty fighters and fourteen cockpits are in `catalog/bf2017-vehicles.js`, a group of the lane’s own after `bf2017`. Each has a `.lod1` and a `.far` cut, and `scripts/bf2017-vehicles.mjs` lists the import of each. Each cockpit is stood in its hull’s frame (`--hull-frame`): 11 of 14 lie inside their hull’s bounds; the snowspeeder’s, A-wing’s and Slave I’s reach past by up to a metre where the canopy is.
- **The import learns lane V’s flags:**
  - `--vehicle`: plain under 25,000 triangles, light under 7,000
  - `--far`
  - `--bind`
  - `--hull-frame`, named apart from phase 1’s `--keep-origin` (which doesn’t ground at all): grounded by the hull’s manifest box so a cockpit sits in its hull
  - the game’s glass made glass
  - the MTT’s weak-point covers dropped
  - a packed `_ncs` map’s colour taken from its blue
  - the smoothness alpha stripped from every opaque colour map before WebP, the trap the spec’s section 6 measured; the AT-ST’s plain cut went from 2.1 MB to 0.8 MB with it
- **The placer, for the bucket’s cuts.** A row that is `native` draws its `.lod1` first and swaps its level’s cut in under the same object when it lands (`cutsToLoad`, `swapIn`). An `.ultra` that can’t be had falls to the plain one (`fallbackFor`), as a walker’s does.
- **The rides on the game’s 74-Z and X-34.** Their seats are measured off the models and tested against them (`rides.seat.test.js`); the chase’s scouts sit the same saddle.
- **The fleets on the game’s fighters.** `scripts/bf2017-fleet.mjs` writes twelve ships over the space layer’s Sketchfab files, at the paths `galaxy/models.js` names: the TIE fighter, bomber and Advanced, the A-, Y- and U-wings, the N-1, ARC-170, vulture, tri-fighter, cloud car and the Nebulon-B. Their far-off copies are remade by `galaxy-lod.mjs`.
- **anim-check knows the walkers’ feet** (`LeftFrontFoot`). On Hoth every AT-AT in view, and on Endor the AT-ST, reads 0 m/s of planted drift and none is at bind pose.

### Where the code and the plan differed

- `universe/shipModels.js` has no galaxy rows, and there is no instanced far-fighter path. The space layer’s rows are `galaxy/models.js`, which open PR #793 is changing, so the fleet is written at the files those rows name rather than by editing them. The far copies are `galaxy-lod.mjs`’s one-piece vertex-coloured ones, which the space layer’s LOD asks for, not the import’s `.far`.
- `warpieces/hoth.js` is the space ion cannon, and nothing on the surface brings a walker down. The figure’s `react('down', { cable })` is ready, and a hostile walker or droideka shot down (`activity.js`) already plays its game death.
- The plan’s “imperial cruiser” is the Arquitens light cruiser, and the gameplay capitals are kits placed by level data. The fleet’s capitals were compared with the space battles’ whole backdrop ships: the close-up Star Destroyer and Nebulon-B (Daniel Andersson’s, about 100,000 triangles) and the MC80 stay, being the better on the sheet (`fleet.webp`). The Nebulon-B’s plain cut is the game’s.
- `bf2017-clips.mjs` was on phase 1’s branch, not main, so the `--skeleton` form is `scripts/bf2017-rigclips.mjs`, over its own pure module: **phase 1, fold it in** (or keep it beside yours).
- The AT-M6 is The Last Jedi’s: left out by the standing rule.
- The Falcon is the landmark mesh: the gameplay one names no maps in the drop.

### Left

- **Native files, then the bucket** (the spec’s section 6 as revised at 06:30, after this lane’s imports). Every vehicle should be imported with phase 1’s `--native`:
  - the game’s LOD0 at its precision, every map the game’s own KTX2;
  - the light cut by dropping mip levels (`scripts/lib/ktx2-levels.mjs`);
  - caps from `scripts/lib/bf2017-caps.mjs`;
  - rows `native: true`.

  Then publish the plain and ultra cuts with `node scripts/assets-publish.mjs`, run `node scripts/assets-check.mjs`, and commit the manifest and `.gitignore`. None of `--native`, `ktx2-levels.mjs` or the caps was on phase 1’s branch or main when this lane closed, so these files are still the WebP cuts, committed. Once #815 is on main the re-import is one line: add `'--native'` in `scripts/bf2017-vehicles.mjs`’s `importArgs`, then `node scripts/bf2017-vehicles.mjs`, `node scripts/bf2017-fleet.mjs` and the `galaxy-lod.mjs` line below. The placer’s light-first swap is already keyed on `native`.
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
- **Sounds**: the vehicles’ engines and footfalls when the game’s audio lands.
- **The far fleet instanced**: the space layer draws each ship through its own `THREE.LOD`, a draw each. The game’s far copies keep that cost, and instancing is the fleet war’s own open item.
- **Textures**: no map these vehicles name was `missing` on 2026-10-10.

### Checking it

```
node scripts/bf2017-fetch.mjs manifest                 # and web/anims.jsonl, which bf2017-rigclips.mjs fetches itself
node scripts/bf2017-rigclips.mjs --pack atat           # atst, atte, atrt, droideka
node scripts/bf2017-vehicles.mjs --fetch               # every kind; or a kind, or --group walker|ground|turret|air|cockpit
node scripts/bf2017-fleet.mjs && node scripts/galaxy-lod.mjs tie tiebomber tieadvanced awing ywing uwing n1 arc170 vulture trifighter cloudcar nebulon
npx vite --port 5188 --strictPort --host 127.0.0.1 &
node scripts/rig-shot.mjs public/models/galaxy/surface/atst.glb atst /tmp/atst.png idle,walk,die
node scripts/anim-check.mjs --route '#/galaxy/hoth/surface' --do "__surfaceScene.put(261, 431)" --do "__surfaceScene.view([261, 14, 431], [283, 9, 510])" --range 150 --port 5188
```

The tests need no keys and no network: `npx vitest run src/lib/three/ownRig.test.js src/lib/three/rigSets.test.js scripts/lib/rig-clips.test.mjs scripts/lib/rig-bind.test.mjs scripts/lib/bf2017-dressing.test.mjs scripts/bf2017-import.vehicles.test.mjs scripts/bf2017-fleet.test.mjs src/components/galaxy/surface/walkers.test.js src/components/galaxy/surface/rides.seat.test.js src/components/galaxy/surface/catalog`.
