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

1. **Phase 2, everyone the game has**: `docs/superpowers/plans/2026-10-10-bf2017-phase2-everyone.md` (troopers, droids, blasters on the same loader; the humanoid pack plus the `AI_Rifleman`, `AI_Officer`, `Cover` and `Awareness` sets).
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

## Lane F: the effects and the sound map

The plan is `docs/superpowers/plans/2026-10-10-bf2017-phaseF-effects-lighting-lines.md` (on `claude/nice-mayer-jqow5k`; its task 3, lighting, is withdrawn). Frostbite's effect graphs do not export, so the site's effects keep their rules and take the game's *look*.

### Done

(PR number in the PR body.)

- **The game's look, by name**: `src/lib/three/fx/gameLook.js` reads `src/data/bf2017Fx.js` (written by `scripts/bf2017-fx.mjs`) and loads a sheet or a mesh by the site's name; a name the table lacks is `null`, and the effect keeps its own look, never a missing texture. `flipbook.js` reads a sheet's grid from the game's name (`_5x1_`, `_8x64_` as 8 across and 64 frames, `Anim8x4o32`); the table's own `grid` wins where the name is wrong (the metal scorch's `2x4` is a 2 by 2).
- **What the bucket had** (55 of the drop's 323 effect textures at 06:00, `node scripts/bf2017-fx.mjs --count`): seven sheets (`impact`, the game's packed impact: red the scorch, green the burst's rays, blue the ring; `scorch.metal`; `blast`; `glow`; `ramp.blackbody`; the metal and wood chunks' maps) and eight mesh sets (`debris.metal`, `.rock`, `.snow`, `.sand`, `.wood`, `.walker` (an AT-ST's wreck), `.fighter` (a Y-wing's shards), and `force.push`, Luke's half-sphere). 282 KB together against the 6 MB cap, the largest 47 KB, so all committed under `public/models/galaxy/bf2017/fx/`; credited `bf2017-fx-*`.
- **Drawn** (`src/lib/three/fx/`: `marks.js` one instanced draw a sheet and mode, `debris.js` one a chunk's shape, `push.js`, `fxPlan.js` the pure rules, `gameFx.js` the one call a scene makes):
  - a bolt's flash (`lib/three/combat/bolts.js`): the game's burst cooling along its black-body ramp, and every flash one draw (it was twelve meshes);
  - an impact by surface (`fxPlan.surfaceOf`: the world's footsteps, else its terrain's detail): the game's scorch tinted (soot on stone and sand, a grey melt on snow) or its metal marks, an ember in the bolt's colour, and the surface's own chunks thrown (snow 6, sand 5, rock and metal 3 at high; half at mid, a quarter at low);
  - a blast by vehicle class (`grenade`, `speeder`, `fighter`, `walker`): the game's rays, its ring over the ground, its scorch and the class's own wreck flung, 8 to 12 pieces, capped at 32; wired to the surface's grenades; a vehicle's death calls `gameFx.explode(at, cls)` when lane V wires one;
  - the Force push and pull on Luke's half-sphere, a rim of light under the bloom's threshold;
  - the space layer's flashes (`galaxy/fx.js`) take the same burst and ramp.
  Each part answers whether it drew; `universe/gunfx.js`'s scorch stands in where not. No light is added: the muzzle flare and the saber's light are the site's, as they were.
- **The sound map**: `src/lib/sound/gameSounds.js`, 61 names (the saber, the duel, footfalls on six grounds, blasters by weapon, engines, impacts, fourteen voices' lines by situation), each tested against the name `sounds.js`, `universe/sounds.js`, `sfx.js`, `clips.js` or the voices already use; every game file `null`, because `data/Sound` holds 3,918 records and no audio (`node scripts/bf2017-audio.mjs`).

### Left

1. **The sheets still to land** (`WANTED` in `scripts/lib/bf2017-fx.mjs`, each named, fetched the day it is up, given a recipe in `SHEETS`): the bolt (`T_BlasterProjectileSide_02_D`, `…Top_01_D`), the muzzle flash, smoke and billowing smoke, fire, the smoke trail, the Force cone, the X-wing, A-wing and shuttle exhausts, a crater, concrete scorch, a shield's impact, and snow and sand kicked by feet. Until the bolt's sheet lands, a bolt stays the site's streak; until the exhausts land, engine glow stays the models' own emissive (lane V's ships).
2. **The audio**: when `data/Sound` has files, `node scripts/bf2017-audio.mjs <bucket path> --as <file>` makes each the site's MP3 and its name in `GAME_SOUNDS` takes the file; the surface's `sounds.js` then asks `soundFor(name, has)` before its own synthesised sound (a few lines in the owner's audio lane, not here).
3. **Lane X takes the saber's look** (ignition, clash, trail, the blade's light; #816): the bucket has no saber sheet at all, so what it can use today is through `gameLook`: `loadLook('glow')`, `loadLook('impact')` (its green, the burst, for a clash) and `loadLook('ramp.blackbody')`; `saberFx.js` was not written here.
4. **Vehicle deaths** on the surface and in space call nothing yet: lane V wires `gameFx.explode(at, 'walker' | 'speeder' | 'fighter')` where a vehicle goes up (the space layer's `world.js` flashes take the game's look already, without debris).
5. **Metal surfaces**: no world says its floor is metal except by `sound.ground: 'metal'`; a station or a ship's deck that sets it gets the game's metal marks and chunks.
6. **The 1024 impact sheet** is 189 KB: over the 64 KB line for git, so it ships at 512 on every tier; once this branch has lane S's `assets-publish.mjs` (main has it), add 1024 to its `sizes` and publish it.

### Checking it

```
node scripts/bf2017-fx.mjs --count            # how many effect textures are up
node scripts/bf2017-fx.mjs                    # make the sheets, meshes, table and credits again
node scripts/bf2017-audio.mjs                 # how much audio the bucket holds
npx vite --port 5188 --strictPort --host 127.0.0.1 &
OUT=/tmp/fx node scripts/bf2017-fx-shots.mjs hoth impact.snow,blast.grenade,push
```

In the console on a surface: `__surface.fx('impact.snow')`, `__surface.fx('blast.walker')`, `__surface.fx('push')`, each with `{ look: 'site' }` for the site's own look alone. The tests need no keys: `npx vitest run src/lib/three/fx src/lib/sound scripts/lib/bf2017-fx.test.mjs src/lib/three/combat/bolts.test.js src/components/galaxy/fx.test.js`. Shots and numbers: `docs/superpowers/evidence/bf2017-effects/`.
