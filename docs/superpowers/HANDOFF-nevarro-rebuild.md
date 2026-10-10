# Handoff: rebuilding Nevarro

The owner said: "Nevarro sucks, make it better as a world with buildings and mountains and stuff." This is where that stands, so another session can pick it up. Branch `claude/nevarro-rebuild`, from main after #558.

## What's wrong with Nevarro now (measured)
- **It's the flattest world in the galaxy.** The walkable area runs from -3 to 13 m. Tatooine spans -11 to 53 m, Hoth 2 to 90 m, Naboo -33 to 41 m, Mustafar -15 to 37 m.
- **Its mountains can't be seen.** The `mountains` layer (`sites/outer.js`, from 650 m) is about 18 m high at 900 m. At fog 0.0012, anything 1.5 km off is 96% fogged out.
- **No lava, though it promises "rivers of fire".** There's no `water: { kind: 'lava' }`, no `channels` layer and no ash or ember weather. "The lava flats" place is 41 rocks.
- **The town is tiny.** "Nevarro City" is the white Mos Eisley cantina model and five 3.5 m `nevarrodome` humps. The Imperial base is one Endor bunker in the open.
- **Load now:** 87 draw calls, 939k triangles, 10.3 MB of GLBs. The caps are 600 calls, 2.5M triangles and 40 MB, so there's lots of room.
- **Baseline shots** are in `lab/nevarro/before/` (git-ignored): a flat grey ash plain, with the town a scrap on the horizon.

## Canon (from Wookieepedia; sheets in `lab/refs/img/nevarro-*`, stills in `lab/nevarro/full/`)
- **The city is sunk into its rock.** In Image Engine's model of the S1 city (`File:NevarroModel.jpg`), the streets are trenches cut into a flat plain of black lava rock. Buildings line the trench walls, their roofs are level with the rock, and low ribbed domes poke out at the top. That's why, from outside, the town shows only as domes on black rock.
- **S1–S2 buildings:** thick-walled grey plaster and stone with sloped, stained walls, round-headed recessed doorways, porthole windows and wall lanterns, with cables strung across the streets.
- **S3:** the city grows out over the lava tongues, with cream fluted towers with domed caps, cobbles, trees and orange banners, in front of one big conical volcano. A darker hill with a building on top looms over the streets.
- **The gate arch,** with the ships' landing ground just outside it: black gravel in S1–S2, pale paving in S3.
- **The bazaar near the gate:** sagging tan, orange and red awnings against stained plaster walls.
- **The cantina** (the Crossroads Common House), later the Client's office, then the school in S2. There was no Imperial "outpost" in town; the Remnant had a safe house, shown only inside.
- **Underground:** the covert and the Armorer's forge are in the sewers. The Charon River, a lava river, runs from the sewers out to the lava flats through a ribbed, vaulted tunnel; IG-11 walked into it. The heroes went down it on a keelboat.
- **The Imperial base (S2 Ch12)** is built into a cliff over a lava canyon: a long, low, multi-level slab of cold blue-grey armour. It's modelled on Eadu.
- **The lava fields:** flat black ropy lava, split by glowing cracks and channels, with steam vents. In Ch8 Gideon's TIE crashed there.
- **Mountains:** in S2, a continuous wall of steep, eroded blue-grey mountains a few km behind the domes. In S3, one conical volcano 1.5–3 km behind the city.
- **Palette (S1–S2):** sky zenith about #7f91aa, horizon #a9b5c1; far mountains #586670; lava rock blue-black #1b1f21.
- **Out of era:** the IG-11 statue (S2–S3) and the Clan Mudhorn homestead (S3) come after the covert was abandoned. Don't put the Armorer in an active covert next to the statue.

## Designs and judging
Three independent proposals were judged by three judges (a canon stickler, a technical artist who checks the engine, a level designer). The proposals and the full judging are in `docs/superpowers/nevarro/research-and-designs.json`, and the draft site entries are beside it:
- `draft-landmarks.mjs`: the town bowl with rim domes, the cliff-top base, the Charon River. Judged best overall: canon 8–9, visual 9.
- `draft-terrain.mjs` and `draft-terrain-helpers.mjs`: a volcano at about 700 m, a close mountain ring, a 9 m tableland with trench streets, and the river.
- `draft-player.mjs`: you land facing the gate, then a five-minute loop past the districts, with about-texts and crew lines. Judged best for the player (9).
- `terrain-fast.mjs`: a faster terrain.js, with a bounding-box reject and `Math.sqrt` in `levelled()` and `dug()`. The heights come out identical. It's needed if there are many flats and pits: one draft takes 1.85 s at load on high.

## The plan the judges converged on
1. **Terrain** (keep layers 0–2 where they are, so their noise seeds don't move; append the new ones):
   - **Town shelf:** the town sits on a black lava-rock shelf (an `island`, core about 0.75–0.95), and the streets are cut down into it.
   - **Volcano:** about 700 m out (an `island`, around 400 m high), with fog lowered to about 0.0007, so it stands about 25° up and only about 21% fogged. Put a smoke plume at its summit.
   - **Mountains:** bring the `mountains` ring in to start near 560 m.
   - **Base cliff:** an escarpment or plateau about 30–35 m high, for the Imperial base over a lava canyon.
2. **Lava:**
   - **Lava water:** `water: { kind: 'lava' }`, with river beds made from flats eased down to the bed (a `river()` helper; edge 9–12). Keep each bed only 0.3–0.5 m under the lava level, so stepping in is ankle-deep, never under.
   - **Lava as a hazard:** set `fall` about 1 m below the lava level, so falling in puts you back at the landing (as Kamino's `fall: 12` does).
   - **Mind the light:** lava water adds an orange hemisphere light, so check that the town still reads steel-blue.
   - **Charon flow:** a lavafall laid flat out of the Charon portal shows the flow.
3. **Town:**
   - **Keep the cantina zone door:** choose the town place's `at` and `yaw` so the cantina still lands at world [140,-90] with yaw 0.3. The cantina zone's door is at [143,-80.4]. The landmarks draft's frame trick does this.
   - **The town:** cut streets with three ways through the rim, rim domes and towers, house fronts along the trench walls, the bazaar by the gate, and lamps.
   - **Arches:** the `nevarroarch` default box blocks its own opening. Either use `solid: false`, or give it pillar solids (catalog `solids: 'built'` plus a small PROPS stand-in returning two circles).
4. **Places:**
   - **Landing yard:** you land facing the gate.
   - **Covert:** a flat-floored pit (r 13, floor 3) joined to a back street by a walkable slope, with a fire and the forge kit.
   - **Charon River:** the tunnel mouth and the keelboat.
   - **Lava fields:** Gideon's crashed TIE with wreck smoke (`parked` tie, pitched and rolled). Built kinds only honour `solid: false`.
   - **The base:** the base slab on the cliff, four TIEs and Imperial kit.
   - **Lookout:** a hill with a lookout over the town.
   - **Keep the quests working:** the puck goes to the base (now [-260,160], collect at [-252,166]); death troopers spawn at [90,-210] near Mando at [48,-160]. Move their coordinates with any place that moves.
5. **Don'ts the judges caught:**
   - No Punishing One (Dengar isn't on Nevarro) and no intact TIE in the square.
   - No covert you can't walk out of.
   - No lava you can walk under.
   - No `solid: { r }` on built kinds.
   - Don't count `tie.glb` as free: it's a 108 KB Sketchfab download with its own credit.
   - Watch draw calls at the base overlook. One draft measured 514 there with stand-ins.

## New Meshy buildings (the lane to add: `scripts/meshy-galaxy-buildings-nevarro.mjs` + `-tasks.json`, wired into `scripts/meshy-galaxy-buildings.mjs`)
Each costs about 33 credits as a lift or 36 from a prompt. Look at each lift before paying for its model, and each render before wiring it in.

| Kind | Source | Size |
|---|---|---|
| `nevarrohouse` | `File:FlameOn-TMCh8.png` crop [0.575,0,0.425,0.72], or `File:Troopers-Guarding-City-The-Mandalorian.png` crop [0,0.1,0.22,0.75]: the squat grey plaster house | 11–12 m |
| `nevarrodomehouse` | `File:NevarroCitySpaceport.png` crop [0.265,0.42,0.135,0.22]: the round stone house with a big ribbed dome | 9 m |
| `nevarrorow` | `File:The Mandalorian First Look.jpg` crop [0,0,0.42,1], or a prompt: three attached houses as one street front | 18–22 m |
| `nevarrotower` | `File:Showdown on Nevarro.png` crop [0.52,0.36,0.11,0.44]: the S3 fluted white tower, for the hill | 15–18 m |
| `nevarrobase` | `File:NevarroImperialBase.png` crop [0.06,0.12,0.88,0.6]: the long, low armoured slab | 52 m (hero, lod) |
| `charonportal` | `File:IG-11Sacrifice-TMS01E08.jpg` turned round, or a prompt: the ribbed rock tunnel mouth | 14–18 m |
| `keelboat` | `File:Keelboat-TMCh8.png` crop [0.05,0.5,0.94,0.45] | 9 m |
| `nevarrocantina` (optional) | a prompt for a grey stained-plaster cantina, to replace the white Mos Eisley one | 18.5 m |
| `nevarrostall` (optional) | `File:NevarroBazaar-Databank.jpg` | 5 m |

Budget: about 300–340 credits, including two retries.

## Credits
The third Meshy account (`MESHY_API_KEY_ACC_3`) had 2,786 credits after #558. Pass it inline: `MESHY_API_KEY=$MESHY_API_KEY_ACC_3 node scripts/...`.

## Status (branch `claude/nevarro-build`)
- [x] Research, three designs and the judging (above, and in `docs/superpowers/nevarro/`).
- [ ] The synthesis agent hit a session limit; the plan above (what the judges converged on) was built from directly.
- [x] **Nine Meshy buildings** (297 credits, `scripts/meshy-galaxy-buildings-nevarro.mjs`, task ids in `-tasks.json`):
  - lifted from stills: `nevarrohouse`, `nevarrodomehouse`, `nevarrogate`, `nevarrotower`, `nevarrobase`;
  - from words: `nevarrocantina`, `nevarrorow`, `charonportal`, `keelboat`.
  All rendered and judged before use; catalogued in `catalog/outer.js` and credited (`meshy/<kind>` in `public/games/credits.json`, `public/cc0/README.md`).
  (A lesson: never run two `meshy-galaxy-buildings.mjs` steps at once on the same tasks file. Each saves its own copy and the second overwrote the first's model ids; they were recovered from Meshy's task list, `GET /openapi/v1/image-to-3d`.)
- [x] **The world** is in `src/components/galaxy/surface/sites/nevarro.js` (outer.js imports it; their shared helpers are in `sites/outerKit.js`). It's built from `draft-landmarks.mjs`, with the judges' fixes:
  - a walkable stepped passage down to the covert;
  - lava beds 0.6 m under the lava, with `fall` 0.3 m under it;
  - the volcano at [660,-380], fog 0.0007;
  - built TIEs; Gideon's wreck on the lava flats;
  - the Theed deck dropped from the square;
  - no rim domes over the river's tunnel.
- [x] **Probe** (`lab/nevarro/build/probe.mjs`, git-ignored):
  - the grid builds in 475–510 ms (Tatooine 360–410);
  - the disc spans -3.7 to 229 m;
  - every quest spot is on level ground, and the cantina is at [140,-90] yaw 0.3, so its zone door holds;
  - the routes from the landing to the town, the Crest, the base and the hill (by the North Lane) are walkable;
  - no footprints overlap.
- [x] **Browser:** checked the gate from the landing, the square, the cantina's door, the town from the rim, the covert, the river (the keelboat on the lava below the tunnel mouth), the wreck, the base from its plateau, and the hill.
- [x] **Budget** (`galaxy-check surface nevarro`, high): 218 calls, 1.20M triangles, 20.8 MB of models, 4.8 s load, no errors.
- [x] **Tests and build:** eslint, vitest (5,641), `test:ai` (187), `vite build`. PR #580.
- [x] **An adversarial review** (four lenses, each finding put to two skeptics) found these, all fixed:
  - the first tunnel mouth and the keelboat were turned 40° off the river (the boat was buried in the bank): both now follow the river's own first leg;
  - the base patrol walked inside the base model: it now walks at s 20;
  - roof vaporators floated over the dome houses: each kind has its own roof height;
  - rim domes overhung their slope: sunk 2 m;
  - villagers spawned in and walked through houses (actors only avoid round solids): they're kept to the square and the ring lane, and the happabore to the lane;
  - on the coarse 8 m grid (phones) the river was mostly dry and `fall` rarely caught you: the beds are now 5 m under the lava;
  - a hover bike could be left stranded over lava (rides skip `fall`): the speeder bike is gone;
  - performance: `terrain.js` rejects far flats, pits and islands before the square root and the noise (every world's heights identical, checked across all 17; Nevarro's ground 94 → 35 ms on the sample); light copies for the four repeated house kinds; the base's maps 2048 → 1024 (2.4 → 1.1 MB); one fire light, not two; the wreck's smoke as one instanced column.
- [ ] **Follow-ups found but not done here** (engine-wide):
  - the cantina's shader warm-up runs with the outdoor fires and the lava glow still lit, so the first trip through Greef's door compiles shaders (fix in `scene.js`: warm the zone with `lighting(zone)`);
  - the lamps (23, 2 draws each) could be instanced through a fixed-items scatter path in `scene.js`;
  - the actors' avoider only tests round solids (`actors.js:534`), so NPCs walk through box-solid buildings on every world.

## Checking it
- **Dev server:** `npx vite --port 5188 --strictPort --host 127.0.0.1`.
- **Shots:** `OUT=lab/nevarro/after node scripts/surface-shot.mjs nevarro "140,-90,70,200,town" "0,0,40,300,landing" "-260,160,50,120,base"`.
- **The dev teleport** (`__surfaceDo('teleport', x, z, yaw, y)`) stands you on the highest floor there unless you pass `y`. Inside Geonosis's arena the player is pulled away within a second, so measure things there from `__surfaceScene.scene` instead.
