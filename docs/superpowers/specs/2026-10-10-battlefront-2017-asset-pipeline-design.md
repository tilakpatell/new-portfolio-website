# The Star Wars galaxy on Battlefront II (2017) assets. The design

Date: 2026-10-10. Status: **design, revised with the owner's answers of 2026-10-10, awaiting the nod to plan**, written by an architecting session from the owner's brief and a count of the Supabase buckets; implementation sessions follow, one phase each. The evidence is `docs/superpowers/evidence/bf2017-assets/` (`inventory.md` has every number this page cites). The plans: `docs/superpowers/plans/2026-10-10-bf2017-phase0-tools.md` and `-phase1-heroes.md`; later phases get theirs as they start.

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

Three facts shape everything below.

1. **The models are already cut for the web, at six levels.** The site's importers simplify a model to a budget; here the uploader's LOD chain already holds a cut for every quality level, from a 31,000-triangle Vader to a 337-triangle one. The importer's job is to *pick*, not to simplify.
2. **The people share one rig, with fingers.** 604 of the 930 skinned models are on `Walrus_HumanMale`, 250 joints whose bone names are Maya HumanIK's, which is Mixamo's naming without the prefix (`Hips`, `Spine`, `Spine1`, `LeftArm`, `LeftForeArm`, `LeftHand`, `LeftHandIndex1`…). The site's `rig.js` already finds bones by role on Mixamo-named rigs. So the 2017 people can take the site's clips by name, and, when the 2017 clips arrive, they are on this exact rig and need no retarget at all.
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
5. **The rig: the 2017 one, kept and pruned.** The owner's words: "use 2017's, it's way more in depth and can do cool lightsaber fights and animations." Transfer onto Meshy's 24 bones is not a fallback any more; a 2017 figure that fails a check is fixed on its own rig.
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
- **Rigs.** Without `--rig` the skin is dropped and the model is a statue (vehicles, props, beasts until their clips come). With `--rig` (every person, hero and trooper) the skin is kept and the rig is **pruned** to the bones that carry weights or sit on the chain between them and the root, plus the sockets the site uses (`Wep_Root`, `Wep_Muzzle`, `Wep_Aim`, `IK_Joint_*` kept by name): the 250-joint rig becomes roughly 70. Pruning is a new pure module, `scripts/lib/rig-prune.mjs`, tested on the Luke fixture (bones in, bones out, every weight still summing to one). `--crew` writes to `galaxy/crew/<kind>.glb` and prints the `CREW` row (`crewList.js`: a file and a height, nothing else); otherwise `galaxy/surface/<kind>.glb` and the catalogue row go into a new `catalog/bf2017.js`, which joins `GROUPS` after `battlefront` so it overrides.
- **Grip and muzzle** named inside the file (`--grip`, defaulting to the manifest's `Wep_Root` for a weapon, `IK_Joint_RightHand` for a person), the way colliders are named, so `held.js`'s `holdItem` and the saber's stroke have a real point to hold instead of an inferred axis (the combat handoff's open item).
- **The site's bone names.** The 2017 spine is `Spine → Spine1 → Spine2 → Neck`; the site's code looks for Meshy's `Spine02 → Spine01 → Spine → neck` (`rig.js`, `actors.js`'s Meshy check, `saber.js`'s arm list). The import renames those four on a rig so every loader, the animator and the stroke find them; the limbs and hips already share names.
- **Collision.** With `--collision`, the manifest's collision GLB is merged in as a `_physical` node with a `trimesh` child (`docs/assets/colliders.md`), so the durable world's structures and the Death Star interior's walls get walkable collision for free.
- **Credit and catalogue row** written as in section 1. The import refuses a sequel-era path (a list of folder names from `inventory.md`) with a one-line reason.

`bf2017-import.test.mjs` runs the hilt fixture end to end (a 13 KB GLB and three 64² PNGs committed under `scripts/fixtures/bf2017/`): cuts chosen as the table says, textures at the asked sizes, grip node present, credit row shaped as `catalog.test.js` wants. Under a second, no network.

### 4. Animation

Until the 2017 clips land:

- A `--crew` person keeps the 2017 rig and gets the site's clips the way the Ithorian and the Death Star's Mixamo figures do: **retargeted by bone name** at bake time. `ual-bake --rig --into` already bakes UAL clips onto "any humanoid's rig found by role through `rig.js`"; the pruned Walrus rig is such a rig (Mixamo names), so the `core`, `life` and `sword` sets bake onto Luke, Vader, the troopers. The bake's 60 KB-per-figure cap was set on 24 bones; on ~70 bones at 24 fps the same sets land near 150 KB, so the cap moves to 160 KB for a `bf2017` figure, said in the commit. `anim-check.mjs` holds the toes (planted under 0.15 m/s) as it does for every figure.
- Fingers: the rig has them, so a `GRIP_FIX` row for the 2017 hand (`gunplay.js`) closes the fingers round the grip for real. This is the "revisit" the fingers decision asked for, and it gets its own line in the decision entry.
- Beasts (tauntaun, dewback, bantha, eopie, ronto) come in as statues first (the current `legRig` sway) and switch to their own rigs when their clips arrive; nothing in the world code changes between the two.

When the 2017 clips land (assumption 2):

- `scripts/bf2017-clips.mjs` reads them, maps the game's clip names to the site's (`sword.light.a`, `sword.block`, `die.fwd`, `aim.pistol`… the names `combatRules.js`, `react.js` and `activity.js` use), measures `contact`, `root` and `rootHips` the way `ual-bake` does, and bakes them into the figure's GLB under the same names. The combat code does not change: it asks for `sword.block` and gets Battlefront's. The site's clips stay as the fallback for any name the drop lacks.
- The saber-forms design's forms (Ataru, Djem So, the staff, the pair) then come from the game's own hero sets (Maul's staff, Grievous' four, Dooku's Makashi), which the mirrored-clips decision wished for "when the licence fits". That lane's design stands; only its source of motion changes, and the handoff's "no staff, pair, spear" line is retired.

### 5. What each phase brings, and where it goes

Each phase is one branch and one PR, gated on `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `galaxy-check.mjs surface <world>` at high under its budget row, `anim-check.mjs` for any rigged kind, and a model-sheet comparison (`scripts/preview/surface.html`, `glb-shot.mjs`) under `docs/superpowers/evidence/bf2017-<phase>/`. "Compare, never assume" stays: a 2017 model replaces a kind only when the sheet shows it better. The order is the owner's: people and characters, then vehicles, then worlds.

| phase | what | kinds (from the manifest) | replaces |
| --- | --- | --- | --- |
| 0 | the tools and the rules: decision entry, assets page, fetch, import, rig-prune, tests, `made:'bf2017'`, `catalog/bf2017.js` | the fixture hilt | nothing visible |
| 1 | **the heroes, with what they hold**: `CREW` on the 2017 rig, the site's clips baked on by bone name, fingers that grip; the hilts and the hero blasters | luke (rotj, farmboy, hoth), vader, obiwan, anakin, maul, dooku, yoda, grievous, palpatine, han, leia, lando, chewbacca, bobafett, bossk; hilts: luke, lukehoth, vader, obiwan, anakin, maul, maulcrimson, dooku, yoda, grievous; dl44, ee3, bowcaster, the hero rifles | the Meshy crew heroes; `GUNS.saber`'s procedural hilt and `HILTS`; closes saber-forms lane 0 without gen3d |
| 2 | **the troopers, droids and the rest of the cast**, same path; the standard blasters | stormtrooper, shadowtrooper, deathtrooper, shoretrooper, scout, sandtrooper, snowtrooper, clone legions, rebel and Hoth troopers, officers, pilots; B1, B2, droideka (own rig), astromechs, protocol, gonk, mouse, viper probe; the civilians; e11, a280, dlt19, dc15, t21, rt97c, se14c | the 2005 troopers and `troops/`, the Sketchfab droids, the box blasters; the assault's bind-pose soldiers |
| 3 | **the beasts**, as statues first, their rigs kept for the clips | tauntaun, dewback, bantha, eopie, ronto, jawa, ewok, wookiee, gamorrean, bith, aiwha, kaminoan | the Meshy and Sketchfab statues of the same |
| 4 | **ground vehicles and turrets** | atat, atst, atte, atrt, aat, mtt, hailfire, homing and dwarf spider, stap, barc, speeder bike, x34, turbo tank; e-web, df9, atgar, mark ii, turbolaser | the Sketchfab atat/atst/atte/atrt/aat and the rest |
| 5 | **air vehicles** | xwing t65, ywing, awing, uwing, tie fighter, bomber, interceptor, advanced, falcon, slave i, snowspeeder, laat, arc170, n1, vwing, vulture, tri-fighter, hyena, cloud car | the Sketchfab and gen3d fighters on the ground and the `lod/` cuts in space |
| 6 | **Hoth** (the `cast: 'models'` world, so every kind must resolve) and its Echo Base | hangar system (110 pieces), corridor, wall, fuel silo, DF.9 stack; arctic rocks and backdrops | `echoLayout.js`'s built hangar, the Sketchfab gr75 and generator |
| 7 | **the other original-trilogy worlds**: Endor, Tatooine, Yavin, the Death Star interior | Endor: landing platform, power core room, bunker system, forest base; Tatooine: Mos Eisley (96), Jabba's palace (133), desert nature; Yavin: temple grounds, 551 nature pieces; Death Star: 216 interior pieces, tractor beam generator, debris | the built bunker and platform, the Meshy Mos Eisley and palace, the Quaternius ground cover, the code-built Death Star rooms' walls (the room layout stays; `kit.js` wears the pieces) |
| 8 | **the prequel worlds**: Naboo, Kamino, Kashyyyk, Geonosis (from `a3/`), plus Bespin and Scarif | palace, hangar, Theed facades, canal; cloning facility, domes, platforms; village, walkways, Venator wreck; upper levels, plaza; barracks, train station | the Meshy buildings (theed, tipoca, cloudcity…) |
| 9 | **ultra and the space layer**: `.ultra.glb` at LOD0 with 2048 KTX2 for heroes and vehicles; the far LODs (LOD4, LOD5) for instanced far crowds and wrecks; capital ships for the fleet war | imperial cruiser, venator, mc80, cr90; the LOD5 cuts | the `hq/` destroyer and nebulon, the `lod/` cuts |
| 10 | **the clips and the sound, when they land** (`bf2017-clips.mjs`, section 4), and the saber-forms lane on them | the sword and hero sets, deaths, hits, aims; the beasts' walks; ignite, hum, clash | the UAL bakes on 2017 figures; the mirrored-clip forms; the synthesised saber sound |

Phases 1 to 9 need the textures to have arrived; phase 0 does not. Phases 4 to 8 can run in parallel lanes once phase 2 has merged, one set per lane, the way the Hoth and Death Star lanes ran. Phase 10 waits on the bucket.

### 6. Budgets and download

- Per-world triangle and call rows do not move. A world that swaps a built kit for 2017 pieces is measured before and after with `galaxy-check.mjs` and must stay within its row; where a kit would push it over (Yavin's 551 nature pieces, Naboo's 625), the import takes the next LOD down for the far instances and the world places fewer, and the PR says which.
- Download: a 2017 person at the plain cut with 1024 WebP colour, 512 orm and a 1024 KTX2 normal lands near 0.6–1.2 MB (Luke's LOD2 is 359 KB of mesh; the 2005 troopers are 0.12–0.92 MB today). `WORLD_MB['/galaxy']` (10 today) is raised per phase by what the phase measured, in the commit. Phones take the `.lod1` cut and 512 textures as they do now.
- Texture memory holds to the research contract: at most 60 textures a world, 256 MB desktop and 128 MB phone. The import's `--tex` default and the atlas rule ("atlas and merge below hero size") keep a kit of 110 hangar pieces from being 330 textures: pieces that share a material in the manifest are merged into one GLB with one material set, which the Death Star HD import already does.
- Sizes on disk: the caps stand (2.5 MB, 4 MB `hero`, 24 MB ultra). Nothing in `public/` comes from the bucket unchanged; everything passes the import.

### 7. Lightsaber combat, specifically

What the drop changes for the duel, in the order it can land:

1. **Hilts** (phase 1, with the heroes): the real models, 920 triangles, with a grip node; the blade's root sits on the hilt's emitter instead of the procedural cylinder's top. `heroes.js`'s `HILTS` rows name a kind; `saber.js`'s `createSaber` wears the kind's GLB in place of the drum `gunplay.js`'s `GUNS.saber` builds, and keeps that drum, recoloured by `dress()`, for a hero without one.
2. **Hands that hold** (phase 1): finger bones on every hero, so the hold is a pose, not an offset; the combat handoff's "sword axis inferred" item closes.
3. **Duellists that look right** (phase 1): Vader, Luke, Obi-Wan, Maul, Dooku, Yoda, Grievous at the game's quality, facing the player.
4. **The game's strokes** (phase 10): blocks, clashes, the forms, deaths and the hero sets on the rig they were made for, with `contact` measured so the blade-to-blade contact rule keeps working.
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
- Does not change the figure resolution order, the loaders (`actors.js`, `crew.js`, `placer.js`, `animator.js`, `clipLibrary.js`) or the combat rules; it feeds them better files under the same names.
- Does not build the classic edition's path: `battlefront-import.mjs` is that, when `bf2-extract` fills.
- Does not add a gate: the owner chose to deploy as today (answer 1).

## What the owner decides next

The questions this design had are answered above. What is left is the nod to write the plan: `docs/superpowers/plans/2026-10-10-battlefront-2017-asset-pipeline.md`, phase 0 first (the tools, which need no textures), then phase 1 as soon as `web/textures/` holds the heroes' maps.

## Departures

Where phase 0’s code went another way than this page or its plan, one line each:

- The manifest’s `file` paths are relative to the bucket’s `web/` (`models/…glb`), not under it: `inBucket` in `scripts/lib/bf2017-paths.mjs` adds the prefix.
- The fetch’s and the URI parser’s tests are `bf2017-manifest.test.mjs` and `bf2017-paths.test.mjs`, not a `bf2017-fetch.test.mjs`; the fetch itself is the thin CLI over them.
- The fixture holds two 64² PNGs, not three: the colour map and the raw `_NAM` map, rebuilt from the unpacked `__normal` and `__orm` maps by the manifest’s own recipe, so the import test runs the recipe path (`ormPng`, `normalPng`); the import still writes three maps.
- `normalPng` rebuilds a normal’s z from x and y rather than setting B to 255, so a tilted normal keeps its length.
- `basisu -unpack` (1.16) writes no uncompressed level for a UASTC file; `unpackKtx2` keeps the BC7 level 0, near lossless from UASTC, always as RGBA, and the import reuses an unpack across cuts (about 9 s a 2048² map otherwise).
- A derived map is also taken from a PNG of itself (`<map>__normal.png`) when the uploader puts one there, before the recipe and the KTX2.
- Normals are WebP like the other maps, not KTX2 UASTC: the import test pins WebP; the KTX2 call is phase 9’s (ultra), where `scripts/ktx2.mjs report` can judge it per map.
- `--metres` defaults to the manifest’s own height (`--asis`); `--cuts` takes LOD numbers (`plain=2`); `--catalog`, `--credits` and `--unpacked` exist for the test’s sake.
- A short sequel-era name (`rey`, `finn`, `ep7`, `ep9`) is matched only between separators, so `grey` and `osprey` pass; the longer ones anywhere in a segment.
- The rig is kept in full with `--rig`: no prune, no rename (the owner, 2026-10-10: keep the physics and the rest so the game is accurate). The prune of section 3 was written and tried: Luke’s body lost its fingers and all 79 face bones, which its LOD2 mesh does not weight, and it was taken out. A part’s duplicate skeleton is still joined to the body’s (`scripts/lib/rig-parts.mjs`). The `grip` node goes under `Wep_Root`, else `IK_Joint_RightHand`, else at the origin, so every DICE name stays.
- The import does not take parts by full manifest name yet: phase 1 adds it.
