# Avengers compound: character models from Sketchfab

> **Update:** in the world, Cap didn't hold up (Tilak: "horrible"), so the player is now the HD Spider-Man from *Thwip!* and `cap.glb` has been taken out of the site. A wider search for a much better Cap is in `cap-hd/` once it's done. Thor, Hulk, Widow and the armour stay.

These are the real character models for the walkable Avengers compound (`src/components/avengers/world/`), to replace the procedural figures from `hq/kit/humanoid.js`. Every pick is **CC BY 4.0**, and nothing here is NC or ND. I found them through the Sketchfab Data API v3 (`/v3/search?type=models&downloadable=true`, `/v3/models/{uid}/download`). I downloaded about 45 candidates and judged each one from renders made with three.js in headless Chromium, not from Sketchfab's thumbnails.

The output is in `public/models/sketchfab/avengers/`. `scripts/sketchfab-avengers.mjs` builds all of it from the downloads, and `src/components/avengers/people/models.js` exports the paths.

| name | model | author | tris | size | clips | rig |
| --- | --- | --- | --- | --- | --- | --- |
| `cap` | [Captain America](https://sketchfab.com/3d-models/captain-america-5bf43af9198f46318d96e23587338913) | alexseagle2004 | 12,929 | 757 KB | idle, walk, run, jump (retargeted) | Mixamo, A-pose rest |
| `thor` | [Thor](https://sketchfab.com/3d-models/thor-7cc5f55499cc4d67b7a1c92a6845c8a0) | Bhavlin | 19,580 | 571 KB | idle, walk, run (retargeted) | Mixamo (no fingers), A-pose rest |
| `hulk` | [Hulk \| Marvel Rivals](https://sketchfab.com/3d-models/hulk-marvel-rivals-1379a9de81b7426ea4ee71ff4c126e80) | King_45 | 32,527 | 2.6 MB | idle, walk, run (his own) | Unreal mannequin, 279 bones |
| `widow` | [Black Widow – Animated 3D Character](https://sketchfab.com/3d-models/black-widow-animated-3d-character-da36a24d113f49908459bf33e00a1f1e) | Kmirp99 | 28,072 | 1.9 MB | idle, walk, run (retargeted) | Auto-Rig Pro, T-pose rest |
| `ironman` | [Iron Man MK7](https://sketchfab.com/3d-models/iron-man-mk7-ad4776eea8184283a3e49cf5487df754) | CHANG747 | 7,734 | 442 KB | none | none (a static armour) |

Each model stands on y = 0, centred on x and z, faces +z, and is in metres at real height: Cap 1.9, Thor 1.98, Hulk 2.55, Widow 1.7, the armour 1.98. Bone names are cleaned so three.js keeps them as they are: no `mixamorig:` prefix, none of Sketchfab's `_12` suffixes, no `.`. `manifest.json` has the bone map for each rigged model. Its `shoulderL` and `shoulderR` are the upper-arm bones (the joints at the shoulder), and `chest` is the top spine bone.

## How the animations were made

None of the good MCU-looking Caps on Sketchfab come with idle, walk and run. Cap and Thor both use Mixamo's skeleton, as do many free animated uploads, so I took the clips from two CC BY Mixamo-rigged uploads:

- [Basic Human Male](https://sketchfab.com/3d-models/basic-human-male-f1775be7b1b94e4ea40d25287585ee69) by enzinogenie gives `male_Idle`, `male_Walk` and `male_Run`, which become idle, walk and run for Cap, Thor and Widow.
- [Puppet (rigged with Mixamo)](https://sketchfab.com/3d-models/puppet-rigged-with-mixamo-4956fe98240d4644b9e2598a7f506f0e) by SlagPerch 3D gives `Jump_place2`, which becomes Cap's `jump`. It is 2.2 s long: a short wind-up, a squat, the hop and the landing. Play it once and blend back to idle. I picked its gentler hop over `Jump_place`, a big 3.2 s leap. The source's walk and run looked hunched next to Basic Human Male's, so I didn't use them.

`scripts/sketchfab-avengers.mjs` retargets in world space, which handles any pair of rigs:

1. For each mapped bone, it first swings the target's rest bone so it points where the source's rest bone points. This lets an A-posed Cap take clips from a T-posed source.
2. It then carries over each frame's rotation of the source bone away from its rest.
3. It scales the hips' travel by the ratio of hip heights.
4. Walk, run and jump get their drift over the clip removed, so they play in place and the world moves the character.

The rig families it recognises are Mixamo, Unreal, 3ds Max Biped and Auto-Rig Pro. Mixamo-to-Mixamo also maps the fingers. The clips are resampled at 30 fps. Both credits are in `src/data/modelCredits.json` (they point at `cap.glb`) and in `public/cc0/README.md`.

To rebuild, put the downloads in one folder as `cap.glb`, `thor.glb`, `hulk.glb`, `widow.glb`, `ironman.glb`, `anim-basic-male.glb` and `anim-puppet.glb`, then run `node scripts/sketchfab-avengers.mjs <folder>`. After the steps above, it runs `scripts/sketchfab-import.mjs --keep` (1024 px WebP textures, simplified to about 30k triangles, Meshopt) and writes `manifest.json` and the credits.

I checked all five in Chromium with three.js `GLTFLoader` + `MeshoptDecoder`: every manifest bone resolves by name, every clip plays without NaNs, and each bounding box is at its height with min y = 0, centred on x and z. The `final-*.jpg` renders show these checks.

## What was picked, and why

### Captain America (`cap-candidates.jpg`, `final-cap.jpg`)

**Picked: alexseagle2004's Captain America.** It is the MCU *Age of Ultron* suit: navy with the star and stripes, the helmet with the A, harness and belt, and no shield. It has a clean Mixamo rig with full fingers, one 1024 texture and 12.9k triangles. Its only clip was a dance (dropped). Retargeted walk and run look natural on it (`final-cap.jpg`, rows 2–5: walk, run, idle, jump).

Rejected:
- **2nd-dhruv's Captain America**: also Mixamo, but a classic or Fortnite-style suit with red gloves and boots, so less MCU, and 34k triangles.
- **YEEZY_YE's Infinity War Cap**: realistic and good-looking, but 149k triangles, 615 bones, 30 textures, a beard, and the dark *Infinity War* suit. It would need far more reduction than the others for less recognisability.
- **3dworldz / CAPTAAINR (Future Fight)**: a comic variant with shields floating off the model.
- **mikomagallona's Winter Soldier and Infinity War Caps (Zeztz777)**: the downloads have no textures.
- **Veysel Gök's Civil War**: a diorama of Cap and Iron Man on a plinth, not a character.
- **shreyhaldkar0's Captain America** (49 clips including walk and idle, but no run): a 3k-triangle mobile-game model that doesn't render properly at our scale.
- **MAXDESIGN's** and **MakeEz's**: no skeleton.

### Thor (`thor-candidates.jpg`, `final-thor.jpg`)

**Picked: Bhavlin's Thor.** It is MCU Thor (*Dark World* / *Avengers*): armour, red cape and long hair. It has a Mixamo rig without fingers and 19.6k triangles. The cape is skinned to the spine, not simulated, so it hangs stiffly. That's fine for standing about, but the legs can clip it in a full run.

Rejected:
- **King_45's Marvel Rivals Thor**: has its own idle, walk and run, but it's the comic look (winged helmet, grey) at 150k triangles.
- **miteshpatel911's Thor**: MCU look, but a 70 m scale on its armature and a single 11 s mixed clip.
- **CAPTAAINR's comic Thor**: less recognisable.
- **Kishan's** and **LoxiMoxiToxi's (Fortnite)**: no textures.
- **TaurWing's**: Thor on a throne.

### Hulk (`hulk-candidates.jpg`, `final-hulk.jpg`)

**Picked: King_45's Marvel Rivals Hulk.** It is the best-made Hulk available: realistic muscle shading and a full set of his own game animations, so his weight and gait are really Hulk's and not a retargeted human walk. I kept `Like_Idle` (a calm 11.7 s standing idle, chosen over the punchy `Idle_C` combat idle), `Walk_Fwd_C` and `Run_Fwd_C`. It was simplified from 88k to 32.5k triangles. He has the Rivals belt and torn dark shorts rather than the MCU's purple trousers.

Runner-up: **CAPTAAINR's "Incredible HULK"**, a Future Fight MCU Hulk with a Biped rig and 11k triangles. It's closer to the MCU but flatter-looking, and it has no clips, so the script would have to retarget the human ones. To swap it in, put that download in as `hulk.glb` and give the `hulk` entry `anims: ['basic']`.

Rejected:
- **Kabiidev's Future Fight Hulk**: good, but mobile-game textures.
- **SomayehB's Hulk 2008**: rest pose is a crouch, and the face is distorted.
- **Iqbal's** and **Decentralized's**: cartoon.
- **Sirengame's**: scaled to 1.5 cm, low detail.

### Black Widow (`widow-candidates.jpg`, `final-widow.jpg`)

**Picked: Kmirp99's Black Widow.** It is the MCU black catsuit with red accents, holsters and her red bob, rigged with Auto-Rig Pro. The Sketchfab page calls it animated, but the download has no clips, so the script retargets the human ones. It was simplified from 34k to 28k triangles.

Rejected:
- **anataciacaparat's Natasha**: 76k triangles, and the bones are named `Bone.005` and so on, so there are no names to map.
- **hishamhamid's**: a chibi figure on a Marvel stand.
- **CAPTAAINR's two "Black Widow (Rigged)"**: the downloads are a helicopter scene.
- **andrey.'s "Black widow"**: a spider.

### Iron Man (`ironman-candidates.jpg`, `final-ironman.jpg`)

**Picked: CHANG747's Iron Man MK7.** It is the *Avengers* (2012) armour: clean, 7.7k triangles, four textures, and no skeleton. That suits an armour standing at the workshop door, so the manifest says `"rig": false` and it has no bone map.

Rejected:
- **dr.hadi.s.n5's Mark V**: Mixamo rig, but its rest pose is a landing crouch.
- **CAPTAAINR's Infinity armour**: its parts are scattered apart.
- **ZeTime's Mark 11**: no textures.
- The Mark 85 uploads: 600k–2.2M triangles.

### Not added

- **Hawkeye**: Hero Craft's (Mixamo, 20 clips) is a game skin that renders broken at our scale. The rest are 150k+ Marvel Rivals rips or a 66k untextured-looking one.
- **Bruce Banner**: either 3k-triangle game rips or 100k+ Rivals models.

Neither was good enough to be worth adding.

## Notes for the world session

- Load with `GLTFLoader().setMeshoptDecoder(MeshoptDecoder)`. Clip names are `idle`, `walk`, `run`, and for Cap also `jump`. Walk and run are in place.
- The rest poses differ. Cap and Thor are in an A-pose, Widow in a T-pose, and Hulk in his game's bind pose. If you pose one by hand with the bone map, work relative to each bone's rest quaternion.
- Hulk and Widow are seen a few metres off in the world, so their textures were brought down to 512 px (`tex: 512` in the script): Hulk 2.6 → 2.0 MB (most of the rest is his 279-bone, 11.7 s idle), Widow 1.9 → 0.9 MB.
- `cap.glb` has no shield. The HQ's own shield can be parented to the `RightHand` or `LeftHand` bone.
