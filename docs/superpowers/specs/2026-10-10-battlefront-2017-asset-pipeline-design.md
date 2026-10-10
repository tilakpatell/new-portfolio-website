# The Star Wars galaxy on Battlefront II (2017) assets. The design

Date: 2026-10-10. Status: **design, revised with the owner's answers of 2026-10-10, awaiting the nod to plan**, written by an architecting session from the owner's brief and a count of the Supabase buckets; implementation sessions follow, one phase each. The evidence is `docs/superpowers/evidence/bf2017-assets/` (`inventory.md` has every number this page cites). The plans: `docs/superpowers/plans/2026-10-10-bf2017-phase0-tools.md`, `-phase1-heroes.md` and `-phase2-everyone.md`; later phases get theirs as they start.

## What the owner asked

"We are uploading the Star Wars textures and assets to our Supabase, both raw and compressed. Check what is added. There should be a 2017 edition and a classic edition; classic is less quality. I want to use the 2017 textures and everything to improve the Star Wars world: check how we can improve it with all the models, animations and textures coming from Supabase to make it perfect. There is lightsaber combat and everything. We have all permissions; this is a small, localized, protected project (will be)." And, while the count ran: "animation is coming, don't worry, it takes time for everything to come; same with audio and meshes."

## What is on Supabase today

The short version; `inventory.md` has the long one.

- **`bf2017-assets`** (private): 103,835 objects, 2.3 GB, still uploading. Three parts:
  - `web/models/` and `web/collision/`: 46,000 GLBs. Each is `gltfpack` output (meshopt + quantization: the site's own decoder reads it), metal-rough materials, **textures referenced by relative path into `web/textures/`, not embedded**, so a model is small (Luke 265 KB at LOD0, a hilt 13 KB, the AT-AT 1.4 MB) and draws nothing until its textures arrive. Skinned models keep their skin; no GLB sampled carries a clip.
  - `web/models.jsonl`: the manifest, 13,871 models, each with its **LOD chain** (up to six cuts, LOD0 to LOD5, with triangles and bytes per cut), bounds in metres, skeleton and joint count, source textures, the **derived maps** the uploader makes (`__normal`, `__orm_<hash>`) and from which channels, and its collision GLB.
  - `data/`: 45,000 Frostbite EBX records as JSON. Reference only; nothing the site runs.
- **`bf2-extract`** (the classic edition): empty.
- **Still to come**, per the owner: `web/textures/` (10,455 unique maps referenced), animation, audio, more meshes.

**The owner's standing direction (2026-10-10, 02:45):** shift everything that can be shifted onto the game's assets, which are far better than what the site has. So the rule for every phase is **the game first**: wherever the game has a model, a texture, a clip or a shape, the site uses the game's, and Meshy, Sketchfab, Quaternius, the built kits and the UAL clips remain only for what the game lacks (the Mandalorian-era worlds, the wampa, the rancor, Jabba, the sarlacc, a few props). By 02:45 the bucket held 183,260 objects and 11.6 GB: every model and collision mesh, 10,106 of the 10,270 clips, 16,617 textures, every Havok physics shape, the UI's fonts and icons, and 628 MB of movies (`inventory.md`, "Update, 02:45").

Three facts shape everything below.

1. **The models are already cut for the web, at six levels.** The site's importers simplify a model to a budget; here the uploader's LOD chain already holds a cut for every quality level, from a 31,000-triangle Vader to a 337-triangle one. The importer's job is to *pick*, not to simplify.
2. **The people share one rig, with fingers, and the game's clips are on it.** 604 of the 930 skinned models are on `Walrus_HumanMale`, 250 joints whose bone names are Maya HumanIK's (`Hips`, `Spine`, `Spine1`, `LeftArm`, `LeftForeArm`, `LeftHand`, `LeftHandIndex1`…). 4,498 of the game's clips are on that same rig, one glTF per clip with the bones named: a hero's whole combat set (six strikes and their returns, blocks, staggers, dodges, the dash, the jump attack, the Force powers, the defeat) and locomotion in eight directions, plus the generic humanoid's deaths, hits, cover, awareness and weapon stances. No retarget, no bake: the clip plays on the body as it is.
3. **The set is the whole game.** Every original- and prequel-trilogy hero, every trooper, every vehicle, the hilts, the blasters, and whole kits for Hoth, Endor, Tatooine, Yavin, the Death Star interior, Naboo, Kashyyyk, Kamino, Bespin and Scarif: most of the galaxy's seventeen worlds: not the three Mandalorian ones (nevarro, mandalore, sorgan), not Lothal or Coruscant, and Dagobah and Mustafar only through the forest and volcanic nature sets. The sequel era is there too (2,324 models) and stays out by the standing rule.

## Where the site is today

Read from the code (the map is in the session's notes; file references below are the ones a reader needs).

- The seventeen landable worlds are `galaxy/surface/sites/*.js`; each world's people are `life` entries by kind. A kind is drawn, in order, as a `CREW` figure on Meshy's 24-bone skeleton (`crewList.js`, rigged people with the shared baked clips), else a catalogue model (`catalog/*.js`: a statue, or a rig with its own clips, or legs found at run time), else a built figure.
- The catalogue is 25 groups of kinds; `battlefront.js` (ten troopers from the 2005 game's remaster, with Harrisonfog's permission) comes last and overrides. Models are `public/models/galaxy/surface/<kind>.glb` with optional `.lod1.glb` and `.ultra.glb`; crew are `galaxy/crew/<kind>.glb`; rigged troopers `galaxy/troops/`.
- Budgets per quality level (`src/lib/budgets.js`): low 0.8M triangles, 350 calls, 20 MB of models; mid 1.5M / 500 / 40; high 3M / 700 / 60; ultra unlimited / 1,500 / 240. Texture caps (`lib/detail.js`): 512, 1024, 4096, 8192. File caps (`catalog.test.js`): 2.5 MB per surface GLB, 4 MB for a `hero`, `.lod1` under 0.7× the plain file, `.ultra` under 24 MB.
- Every GLB is meshopt; textures are WebP, with KTX2 only where it pays (normals, and the ultra planet maps). `lib/three/gltf.js` loads the KTX2 decoder lazily when a model needs it.
- **Lightsaber combat** (`surface/saber.js`, `combatRules.js`, `lib/combat/*`): the hilt is procedural (`gunplay.js`'s `GUNS.saber` dressed by `heroes.js`'s `HILTS`), the blade is an unlit core and sleeve under bloom, the strokes are 31 UAL2 `Sword_*` clips baked onto the Meshy rig, with `contact` and `root` extras. The saber-forms lane (`HANDOFF-saber-forms.md`) has not run: no forms, no Force, no dismemberment; its lane 0 was five gen3d hilt requests, and the handoff says the hilt stays procedural "until gen3d hilts land".
- What the earlier lanes left wanting (`HANDOFF-galaxy-asset-upgrade.md`, `HANDOFF-combat.md`, `HANDOFF-galactic-assault.md`, the Hoth spec): twenty-four humanoid kinds still statues or boxes; the seventeen beasts sway; the 2005 troopers stand at bind pose in the assault; the B1 reads grey; Endor is over its triangle budget; no finger bones anywhere (`docs/decisions/2026-10-08-fingers-on-the-meshy-skeleton.md` says revisit "if a free rigger gives fingers"); hilts and blasters are boxes.

The 2017 drop answers most of that list directly: real hilts and blasters, rigged people with fingers, every beast with its own rig, modular kits for the worlds that are built from boxes, and six-level LOD chains for the budget.

## The owner's answers, and what stays open

Asked on 2026-10-10 and answered the same day. Where the answer was "I don't know", the design keeps its reading and says how the tools find out instead of asking again.

1. **Licence and the gate: deploy as today.** The permission is recorded as a decision entry; every imported model is credited as EA DICE's, "used with permission on this non-commercial fan project", the way Harrisonfog's are. No gate in this design.
2. **The clips' shape: not known yet.** The design's animation path assumes files on the `Walrus_HumanMale` rig (GLBs with `animations`, or one file per clip), which is what an extraction from the same game gives. Until they land, the site's own clips drive the 2017 people by bone name (section "Animation"); the clip importer is the last phase and is written against what actually arrives.
3. **Raw PNG beside the KTX2: probably.** The fetch script asks the bucket per texture and takes PNG when it is there, KTX2 unpacked with `basisu -unpack` when it is not; the import never needs to know which.
4. **The classic edition: not known.** Its bucket is empty. If it fills with `.msh` and `.tga` from the 2005 game, `battlefront-import.mjs` is its importer and nothing here changes; if with something else, it gets its own short design then. Nothing in this design depends on it.
5. **The rig: the 2017 one, whole.** The owner's words: "use 2017's, it's way more in depth and can do cool lightsaber fights and animations", and then: "use the 2017 rig in full, it's more robust; ignore Meshy, this is full game files." So: no pruning, no renaming of bones to Meshy's, no transfer. Every 2017 person keeps all of `Walrus_HumanMale` (the 250 joints: body, fingers, rolls, physics helpers, weapon sockets, procedural bones), and the site learns the game's skeleton (section 4). Meshy's library and skeleton stay for the figures that are not from the game.
6. **Phase order: people and characters first, then vehicles, then worlds.** The hilts and blasters go with the people, since they are what the people hold. Section 5 is in that order.

## The approaches weighed

**A. Fetch at run time from Supabase.** Serve the bucket's GLBs and KTX2 straight to the browser through signed URLs. Rejected: the standing rule is no run-time asset service and no key in the client (`.claude/skills/autopilot/SKILL.md`, the Supabase decision entry); the bucket's cuts are not the site's budgets; and 10,455 KTX2 files at the uploader's sizes are far past the per-world download the site allows.

**B. Import by hand, model by model, through `battlefront-import.mjs`.** The 2005 path, extended to read these GLBs. Rejected as the main path: it re-simplifies what is already cut, re-encodes textures the uploader already packed, and knows nothing of the manifest's LOD chain, collision or derived maps. It is kept as the classic edition's importer.

**C. A manifest-driven importer, fetched ahead, committed, credited (recommended).** A fetch script pulls a model and everything the manifest says it needs into the git-ignored `lab/assets/bf2017/`; an import script turns the manifest's LOD chain into the site's cuts (`.lod1`, plain, `.ultra`), re-encodes textures to the site's formats and caps, grounds and orients the model the way every surface model is, writes the catalogue row and the credit; the worlds then wear the kinds. One recipe, run per kind, so each phase is a list of kinds and a check, and nothing is downloaded by a visitor that is not committed.

The rest of this page is C.

## The design

### 1. Licence and credit (phase 0)

- A decision entry `docs/decisions/2026-10-10-battlefront-2017-assets.md`: the source (EA DICE's Star Wars Battlefront II, 2017, extracted by the owner), the permission the owner holds, the non-commercial and gated nature of the project, what is excluded (the sequel era, by the existing rule), and that every model is credited.
- Credits: a new `made: 'bf2017'` value in the catalogue (the test's allowed list gains it) and one `modelCredits.json` row per kind, `license: 'permission'` with the permission text, `author` "EA DICE", `source` the game, `where` the bucket path of the LOD0 file. `scripts/credits.mjs` already lists "used with permission" models in their own section; `CREDITS.md` is regenerated.
- `docs/assets/battlefront-2017.md`: where the drop lives, how to fetch, how to credit, the texture packing (from `inventory.md`), the rig's bone names. It joins `quaternius.md` and `colliders.md`.

### 2. The fetch (`scripts/bf2017-fetch.mjs`)

```
node scripts/bf2017-fetch.mjs manifest                       # web/models.jsonl → lab/assets/bf2017/models.jsonl
node scripts/bf2017-fetch.mjs <name> [--lod all|0|2…] [--textures] [--collision]
node scripts/bf2017-fetch.mjs --list 'characters/hero/luke/*'   # what the manifest holds under a glob
```

- Reads `SUPABASE_URL` and `BF2017_KEY` from `.env.local` (never committed; `.env.example` gains the names). The key is a service key or a bucket-scoped one the owner makes; the bucket stays private. No key is printed.
- Resolves a model through the manifest: its LOD files, the textures its GLBs reference (parsed from each GLB's `images[].uri`, since the manifest lists source maps and the GLB lists the derived ones), its collision GLB. Writes them under `lab/assets/bf2017/` in the bucket's own layout so the GLBs' relative URIs resolve on disk.
- Raw PNGs first when the bucket holds them (assumption 3), else the KTX2.
- Uses Node's `fetch`; no new dependency, so no stack page. `bf2017-fetch.test.mjs` tests the manifest lookup and the URI parsing against a fixture (the 13 KB hilt from `test/`), no network.

### 3. The import (`scripts/bf2017-import.mjs`)

```
node scripts/bf2017-import.mjs <manifest name> --kind <kind> --as '<what it is>'
    [--metres 1.83 | --asis] [--yaw 0] [--rig] [--crew] [--hero] [--ultra]
    [--cuts lod1=<n>,plain=<n>,ultra=0] [--tex 1024] [--maps 512] [--parts <glob>…] [--grip <node>]
```

One kind in, the site's files out, the way `battlefront-import.mjs` does, but from the manifest:

- **Cuts from the chain, not from simplification.** Default picks, by the LOD whose triangles fit: `.lod1.glb` ≤ 2,500 (LOD3 or LOD4), plain ≤ 12,000 for a prop or 8,000 for a person (LOD1 or LOD2), `.ultra.glb` LOD0 (only with `--ultra`, and under the 24 MB cap). `--cuts` overrides. A model whose chain has no fit is simplified by `surface-model.mjs`'s `simplified` as today, and the import says so.
- **Parts.** A composite (vehicles, a hero's cape and hands as separate GLBs) is assembled from the manifest's siblings named by `--parts` (globs over the folder) into one file, each part at the same LOD. Frostbite's "donotuse", "frontend", "wreck" and "cutscene" variants are skipped unless named.
- **Textures to the site's formats.** From PNG (or unpacked KTX2): colour to WebP at `--tex` (1024 default; 2048 for `--ultra`), the orm map rebuilt from the manifest's `derived` recipe (roughness = 1 − smoothness alpha; occlusion and metal from the channels it names) to WebP at `--maps`, normals to KTX2 UASTC at `--tex` where the research rule holds (GPU memory down, bytes within 1.25×, 34 dB kept: `scripts/ktx2.mjs` already measures that) and WebP otherwise. Materials keep the GLB's own metal-rough setup; `extras.shader` and `extras.textures` are dropped before writing.
- **Grounded and oriented** by `surface-model.mjs` (upright, facing +z, standing on y = 0, `--metres` along y; `--asis` keeps the manifest's metres, which are right for everything sampled).
- **Rigs.** Without `--rig` the skin is dropped and the model is a statue (vehicles, props, beasts until their clips come). With `--rig` (every person, hero and trooper) the skin and every joint are kept exactly as they come: the game's skeleton is the contract its clips, sockets and physics bones are written against, and anything removed would have to be put back when the game's clips land. `--crew` writes to `galaxy/crew/<kind>.glb` and prints the `CREW` row (`crewList.js`: a file and a height, plus `rig: 'walrus'` so the loader knows); otherwise `galaxy/surface/<kind>.glb` and the catalogue row go into a new `catalog/bf2017.js`, which joins `GROUPS` after `battlefront` so it overrides.
- **Grip and muzzle** named inside the file (`--grip`, defaulting to the manifest's `Wep_Root` for a weapon, `IK_Joint_RightHand` for a person), the way colliders are named, so `held.js`'s `holdItem` and the saber's stroke have a real point to hold instead of an inferred axis (the combat handoff's open item).
- **Sockets, not guesses.** The game's rig carries named sockets: `Wep_Root` (the weapon's root in the right hand), `Wep_Muzzle`, `Wep_Aim`, `IK_Joint_LeftHand` and `IK_Joint_RightHand`. The import leaves them in place; the site's hold, bolt origin and second hand use them (section 4), so a hilt or blaster sits where the game put it and no `GRIP_FIX` row is guessed.
- **Collision.** With `--collision`, the manifest's collision GLB is merged in as a `_physical` node with a `trimesh` child (`docs/assets/colliders.md`), so the durable world's structures and the Death Star interior's walls get walkable collision for free.
- **Credit and catalogue row** written as in section 1. The import refuses a sequel-era path (a list of folder names from `inventory.md`) with a one-line reason.

`bf2017-import.test.mjs` runs the hilt fixture end to end (a 13 KB GLB and three 64² PNGs committed under `scripts/fixtures/bf2017/`): cuts chosen as the table says, textures at the asked sizes, grip node present, credit row shaped as `catalog.test.js` wants. Under a second, no network.

### 4. Animation

The game's clips drive the game's people. Nothing is baked from the site's libraries onto a 2017 figure.

- **One skeleton, many bodies, the game's clips.** All 604 humanoids share `Walrus_HumanMale` with one bind pose, and the game's 4,498 humanoid clips are glTF animations on that skeleton's node names (`inventory.md`, "The clips"). A clip plays on any 2017 body by name; a body with a few extra bones (a cape's physics) rests on the ones no clip names.
- **Clip packs, not per-figure bakes.** `scripts/bf2017-clips.mjs` reads `web/anims.jsonl`, takes the clips a pack names, resamples to 24 fps where the site's animator wants it, measures `contact`, `root` and `rootHips` the way `ual-bake` does (its `contactWindow` and `rootTravel` are exported), meshopt-compresses, and writes one GLB per pack under `public/models/galaxy/bf2017/`: `clips-humanoid.glb` (the generic set every 2017 person shares: idle, walk, run, sprint, turns, crouch, the deaths and hits, the rifle and pistol stances, cover) and `clips-<hero>.glb` per hero (its `A_<Hero>_*` combat set and `C_<Hero>_*` locomotion). A pack is a skeleton with animations and no mesh; a hero pack lands near 1 MB compressed (Luke's 69 combat clips are 7.5 MB raw).
- **The names the site asks for.** A pure, tested map (`src/lib/three/walrusClips.js`) turns each name the combat rules and the AI already use into the game's clip for a role: `sword.light.a` → `A_<Hero>_AttackLoop_Strike1`, `sword.block` → `A_<Hero>_Stand_Block_SwingRight_01` (or the hero's `Block_Stagger` when it has no block), `sword.dash` → `A_<Hero>_Stand_SaberDash_01`, `sword.aerial.a` → `A_<Hero>_Jump_SaberAttack_Light_FH_01`, `die` → `A_<Hero>_Defeated_01`, `hit.chest` → `A_<Hero>_Stagger_Front_01`, `walk` → `C_<Hero>_Stand_Walk_Fwd_01`, and for the generic humanoid `die.fwd` → `A_HM_Death_Stand_Front_*`, `aim.pistol` → the pistol stance, and so on. `combatRules.js`, `react.js` and `activity.js` do not change: they ask for `sword.block` and get Vader's. The `_V2` strikes and the `_BackToIdle` returns give the forms lane its variants without mirroring.
- **A loader that knows the rig** (`src/lib/three/walrus.js`, over a pure `walrusRig.js`): the bones the game's skeleton must have, the sockets by name (`Wep_Root`, `Wep_Muzzle`, `Wep_Aim`, `IK_Joint_{Left,Right}Hand`), a check that says what is missing, tracks filtered to the bones a body has, the fallback for a name a pack lacks (`CLIP_FALLBACK`). `crew.js` sends a `rig: 'walrus'` row through it and gets back the same figure object every other loader returns, so `actors.js`, `activity.js`, the duellists and the saber keep their calls.
- **The site's bone lists** that name Meshy's spine (`saber.js`'s `ARMS`) gain the game's names (`Spine1`, `Spine2`, `Neck`); `actors.js`'s Meshy check stays false for a 2017 figure, which is right.
- **Fingers** move with the game's clips; the hilt parents to `Wep_Root`; no `GRIP_FIX` row is guessed.
- **Other rigs** (Yoda 101 clips, Grievous 161, B1 532, B2 337, droideka 52, tauntaun 44, AT-ST 69, AT-TE 41, Ewok 77, BB-8 88): the same loader with the rig's own bone list, one pack each, in the phase that ships the body. Until then the body ships as a statue.
- **The UAL and Meshy libraries** stay for the figures that are not from the game. A 2017 figure never uses them; `CLIP_FALLBACK` maps a missing name to the nearest game clip, never to a UAL one.

### 5. What each phase brings, and where it goes

Each phase is one branch and one PR, gated on `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `galaxy-check.mjs surface <world>` at high under its budget row, `anim-check.mjs` for any rigged kind, and a model-sheet comparison (`scripts/preview/surface.html`, `glb-shot.mjs`) under `docs/superpowers/evidence/bf2017-<phase>/`. "Compare, never assume" stays: a 2017 model replaces a kind only when the sheet shows it better. The order is the owner's: people and characters, then vehicles, then worlds.

| phase | what | kinds (from the manifest) | replaces |
| --- | --- | --- | --- |
| 0 | the tools and the rules: decision entry, assets page, fetch, import, tests, `made:'bf2017'`, `catalog/bf2017.js` | the fixture hilt | nothing visible |
| 1 | **the heroes, with what they hold**: the game's clip packs (generic humanoid and one per hero), the loader that knows the rig, `CREW` rows on it; the hilts in the `Wep_Root` socket and the hero blasters | luke (rotj, farmboy, hoth), vader, obiwan, anakin, maul, dooku, yoda, grievous, palpatine, han, leia, lando, chewbacca, bobafett, bossk; hilts: luke, lukehoth, vader, obiwan, anakin, maul, maulcrimson, dooku, yoda, grievous; dl44, ee3, bowcaster, the hero rifles | the Meshy crew heroes; `GUNS.saber`'s procedural hilt and `HILTS`; closes saber-forms lane 0 without gen3d |
| 2 | **everyone the game has** (`-phase2-everyone.md`): the 102 audited kinds mapped to the game's bodies, troopers, civilians (the villager becomes a pool of the game's Mos Eisley, Theed and Vardos people), officers, droids, the Ewok, the jawa, the kaminoan, on the generic humanoid pack and the own-rig packs; the far cut; the packs lazy; the cost measured on every world | stormtrooper, shadowtrooper, deathtrooper, shoretrooper, scout, sandtrooper, snowtrooper, clone legions, rebel and Hoth troopers, officers, pilots; B1, B2, droideka (own rig), astromechs, protocol, gonk, mouse, viper probe; the civilians; e11, a280, dlt19, dc15, t21, rt97c, se14c | the 2005 troopers and `troops/`, the Sketchfab droids, the box blasters; the assault's bind-pose soldiers |
| 3 | **the beasts and riders**: tauntaun (44 clips, with its rider set), dewback, bantha, the Ewok (77), each on its own pack where the game has one, a statue where it does not | tauntaun, dewback, bantha, eopie, ronto, jawa, ewok, wookiee, gamorrean, bith, aiwha, kaminoan | the Meshy and Sketchfab statues of the same |
| 4 | **ground vehicles and turrets** | atat, atst, atte, atrt, aat, mtt, hailfire, homing and dwarf spider, stap, barc, speeder bike, x34, turbo tank; e-web, df9, atgar, mark ii, turbolaser | the Sketchfab atat/atst/atte/atrt/aat and the rest |
| 5 | **air vehicles** | xwing t65, ywing, awing, uwing, tie fighter, bomber, interceptor, advanced, falcon, slave i, snowspeeder, laat, arc170, n1, vwing, vulture, tri-fighter, hyena, cloud car | the Sketchfab and gen3d fighters on the ground and the `lod/` cuts in space |
| 6 | **Hoth** (the `cast: 'models'` world, so every kind must resolve) and its Echo Base | hangar system (110 pieces), corridor, wall, fuel silo, DF.9 stack; arctic rocks and backdrops | `echoLayout.js`'s built hangar, the Sketchfab gr75 and generator |
| 7 | **the other original-trilogy worlds**: Endor, Tatooine, Yavin, the Death Star interior | Endor: landing platform, power core room, bunker system, forest base; Tatooine: Mos Eisley (96), Jabba's palace (133), desert nature; Yavin: temple grounds, 551 nature pieces; Death Star: 216 interior pieces, tractor beam generator, debris | the built bunker and platform, the Meshy Mos Eisley and palace, the Quaternius ground cover, the code-built Death Star rooms' walls (the room layout stays; `kit.js` wears the pieces) |
| 8 | **the prequel worlds**: Naboo, Kamino, Kashyyyk, Geonosis (from `a3/`), plus Bespin and Scarif | palace, hangar, Theed facades, canal; cloning facility, domes, platforms; village, walkways, Venator wreck; upper levels, plaza; barracks, train station | the Meshy buildings (theed, tipoca, cloudcity…) |
| 9 | **ultra and the space layer**: `.ultra.glb` at LOD0 with 2048 KTX2 for heroes and vehicles; the far LODs (LOD4, LOD5) for instanced far crowds and wrecks; capital ships for the fleet war | imperial cruiser, venator, mc80, cr90; the LOD5 cuts | the `hq/` destroyer and nebulon, the `lod/` cuts |
| 10 | **the rest of the game**: the levels' HDR lightmaps and probes as the worlds' lighting and skies (9,648 files under `textures/levels/`), the Havok shapes as colliders for the durable world (`web/physics/`), the UI's fonts and icons (`web/fonts/`, `web/svg/`), the sound when it lands (ignite, hum, clash), the saber-forms lane on the game's `_V2` and blocked strikes | the procedural sky dome where a world has a probe; the synthesised saber sound; the mirrored-clip forms |

Phase 0 needs nothing from the bucket but the fixture; phase 1's inputs were all present by 02:45 (`inventory.md`). Phases 4 to 8 can run in parallel lanes once phase 2 has merged, one set per lane, the way the Hoth and Death Star lanes ran. Phase 10's sound waits on the bucket; its lighting and physics do not.

### 6. Budgets, download and performance

Measured, not guessed (`inventory.md`, "Costs measured"; phase 2's plan, task 6, re-measures on every world).

- **Per-world triangle and call rows do not move.** A world that swaps a built kit or a crowd for 2017 figures is measured before and after with `galaxy-check.mjs` under `BUDGET=1` and must stay within its row; where it would not, the world places fewer, the import takes the next LOD down, and the PR says which. Endor stays held to its own baseline.
- **Textures, per level, from the measurement**: low colour 512 WebP and the rest 256; mid colour 1024, ORM 512, normal 512, all WebP; high colour 1024, ORM 512, normal 1024, all WebP; ultra colour 2048 WebP and normal 2048 KTX2 UASTC on the `.ultra` cut only. A KTX2 normal costs ten times the WebP's bytes at the same size (Luke's: 1.9 MB against 0.48 MB for two), so below ultra the research rule keeps WebP; at ultra the GPU memory saving is what the level is for. The texture memory contract stands: at most 60 textures a world, 256 MB desktop, 128 MB phone, read from `renderer.info` and put in the evidence.
- **A person costs about 1.3 MB at high** (a LOD2 body of 0.4 to 0.5 MB and four to six maps near 1 MB), 0.6 MB at mid, 0.3 MB at low. Ten trooper kinds on Hoth are 13 MB at high: the world loads them as it does now, when near, by kind, and `WORLD_MB['/galaxy']` (10 today) is raised per phase by what was measured.
- **Cuts from the game's chain**: plain at the LOD under 8,000 triangles, `.lod1` at the LOD under 1,500 (the game's fourth cut, for a figure past the level's `near`), and a `.far` cut at the last LOD (under 700 triangles, 256 maps, under 150 KB) for the assault's squads past `mid`. A world draws the cut its distance asks for; nothing above `near` is ever the plain.
- **Draw calls**: a figure's parts are joined per material at import, so a trooper is two or three calls and a hero with a cape and hair four to six; thirty soldiers on Hoth at high are under a hundred calls of the 700.
- **Clips are packs, loaded when needed**: the generic humanoid pack (under 3 MB: constant channels dropped, camera and trajectory channels dropped, combat at 30 fps, locomotion 24, idles 15, meshopt) loads once per world when the first 2017 person is near; a hero's pack (under 2.5 MB, about 50 clips at 46 KB) loads with the hero when picked or when a duellist spawns, never with the world; an own-rig pack (B1, B2, droideka, Ewok, astromech, tauntaun) with its kind. Nothing is baked per figure.
- **Compression beyond this is not needed**: meshopt on meshes and clips, WebP on colour, KTX2 only where the level is ultra. The import refuses a file over its cap rather than squeezing it: a kind over the cap takes the next LOD or a smaller map, said in the PR.

### 7. Lightsaber combat, specifically

What the drop changes for the duel, in the order it can land:

1. **Hilts** (phase 1, with the heroes): the real models, 920 triangles, with a grip node; the blade's root sits on the hilt's emitter instead of the procedural cylinder's top. `heroes.js`'s `HILTS` rows name a kind; `saber.js`'s `createSaber` wears the kind's GLB in place of the drum `gunplay.js`'s `GUNS.saber` builds, and keeps that drum, recoloured by `dress()`, for a hero without one.
2. **Hands that hold** (phase 1): the hilt sits in the game's `Wep_Root` socket with the game's orientation, the second hand's target is `IK_Joint_LeftHand`, and the fingers are the clip's; the combat handoff's "sword axis inferred" item closes.
3. **Duellists that look right** (phase 1): Vader, Luke, Obi-Wan, Maul, Dooku, Yoda, Grievous at the game's quality, facing the player.
4. **The game's strokes** (phase 1, they are here): each hero's own six strikes and their `_V2` variants, blocks that swing left and right, blocked-strike reactions, staggers, dodges, the dash, the jump attack, the Force push and repulse, the catch and the defeat, with `contact` measured so the blade-to-blade contact rule keeps working. The duel reads like the game's because it is the game's.
5. **Sound**, when the audio lands: ignite, hum, clash by kind, the Force sounds the saber-forms design listed, through `sounds.js` in place of the synthesised `saber()`. That is a small lane of its own when the files are there, and this design only reserves the names.

The saber FX (`saberFx.js`, bloom, trail, sparks) and the rules (`lib/combat/*`) are not touched by this design; they are the saber-forms lane's.

### 8. Rules this design keeps

- No run-time fetch; every asset is fetched ahead, imported, committed and credited (autopilot rules; the Supabase decision). The bucket key lives in `.env.local` only.
- A dependency has a page before its import (`RULES.md`). This design adds none: fetch is Node's, textures go through `sharp` and `basisu` the site already holds, GLBs through `@gltf-transform`.
- Scripts under `scripts/`, pure logic in tested files beside them, files under 800 lines; `catalog/bf2017.js` splits by world when it nears the limit, behind a barrel, like the others.
- One art style per world: a world that takes 2017 pieces declares `scanned` in its `look.js`, and takes them for its people, buildings and vehicles together, not one of three, so `art-mix` does not count it.
- No sequel-era model, place or name (the import refuses the paths).
- Compare on the model sheet before replacing; put the sheets in evidence.

### 9. What this design does not do

- Does not touch nevarro, mandalore, sorgan, lothal or coruscant: nothing of theirs is in the 2017 game.
- Does not extract textures, clips or audio from the game itself; it takes what the uploader puts in the bucket, in the shape the manifest describes.
- Does not change the figure resolution order, `actors.js`, `placer.js`, `animator.js`, `clipLibrary.js` or the combat rules; `crew.js` gains one branch (a `rig: 'walrus'` row goes through the new loader) and the rest get better files under the same names.
- Does not build the classic edition's path: `battlefront-import.mjs` is that, when `bf2-extract` fills.
- Does not add a gate: the owner chose to deploy as today (answer 1).

## What the owner decides next

The questions this design had are answered above. What is left is the nod to write the plan: `docs/superpowers/plans/2026-10-10-battlefront-2017-asset-pipeline.md`, phase 0 first (the tools, which need no textures), then phase 1 as soon as `web/textures/` holds the heroes' maps.
