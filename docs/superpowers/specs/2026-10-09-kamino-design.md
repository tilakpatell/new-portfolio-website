# Kamino, made whole: every Kaminoan a model, Tipoca City inside and out, Jango on the platform and the Battle of Kamino. The design

Date: 2026-10-09. Status: design, written from a read of `origin/main` at `657d6757` and from shots of the live world, for the sessions that build it (phases in order, one pull request each, merged as each lands). The plan is `docs/superpowers/plans/2026-10-09-kamino.md`.

## What the owner asked

“Architect a way to make the planet Kamino better. Make sure ALL NPCs are models and not the weird custom blobs. Make it robust and make PR and merge to main regularly. Architect a spec first.”

Done looks like this. You come down on Tipoca City's landing pad in the storm and every soul there is a model that walks on clips: the clone troopers drilling on the parade ground, white in the rain, not black shapes; the cadets running laps in their grey kit; tall pale Kaminoans who move like Kaminoans, Taun We at the facility door, Lama Su at his tower, Nala Se among the tubes; Jango Fett by Slave I, and young Boba beside him, a boy and not a brown lump. Slave I is Slave I. You can go in: down the rows of growth tubes, through the cadets' barracks, into Lama Su's white office. You can fight Jango on the platform, rocket pack and all, and put a tracker on his ship before it lifts. You can hold Tipoca when the Separatists come up out of the sea. And no figure on Kamino can ever fall back to a built blob, because a test says so and the runtime refuses to.

## Assumptions (the owner said not to ask twice)

1. “Kamino” is the surface at `/galaxy/kamino/surface` (site `kamino`, `src/components/galaxy/surface/`) and the system's mission (“Storm over Tipoca”, `systems.js`, status `soon`). The orbit view and the galaxy map are not changed beyond that mission.
2. “ALL NPCs are models”: every person or creature that can stand on Kamino, from any source (the site's `life`, the quests' `life` and `spawn`s, the ground war, the garrison swap, an assault's sides), is drawn from a GLB, and every person among them walks on clips. A built figure (`figures.js`) is never drawn on Kamino, not even while a model loads or after one fails.
3. Meshy is the owner's go-ahead here: the brief came with a Meshy key (the third account, already kept as `~/.tilakverse-meshy3.env`; 2,760 credits on 2026-10-09). The plan says each batch's total before it spends (`docs/superpowers/plans/…`, “Credits”). Nothing calls Meshy at run time; the output is committed.
4. The standing rules hold: files under 800 lines; rules in pure tested modules apart from the drawing; one art a world (Kamino is `scanned`); the budgets in `docs/health/budgets.json` and `src/lib/budgets.js`; the credits audit; British spelling and curly quotes; the films' and the shows' own short lines at most; no sequel trilogy.
5. The Naboo lane's split (tilakpatell/tilakpatell.com#768: `sites/naboo.js` out of `sites/core.js`, `props/core.js` into `props/core/{naboo,coruscant,kamino,geonosis,shared}.js`) lands before Kamino's own move (Phase 2). Phase 1 edits only lines that #768 does not touch, so it can land first.

## What is there today (the evidence)

Shots: the landing, the parade ground, Jango's platform, the quarters, the facility and the Prime Minister's tower, at `?quality=high` on Metal (the plan's “Shots” recipe). The figures audit (`node scripts/galaxy-figures-audit.mjs`) and a trace of `actors.js` agree:

| kind on Kamino | drawn as today | what's wrong |
|---|---|---|
| `villager` (Boba Fett, `sites/core.js:558`, `scale: 0.68`) | **built** (`figures.js:30`) | the blob: a shrunken brown settler. The only kind that is always procedural |
| `kaminoan` ×3, Lama Su, Taun We (`:555-556`, `quests.js:100`) | Sketchfab statue, legs cut by `legRig.js` | thin dark arms on a grey stalk, the upper body stiff, all three the same; Lama Su is the same model at 1.08 |
| `clonephase1` ×4 (`:553`) | Sketchfab statue, legs cut | stands stiff; can't aim, talk or turn |
| `clone` ×28 (`:550-552`) | crew (`troops/clone.glb`, Meshy rig, borrowed clips) | the model is right, but at 8–40 m on the parade ground the ranks read **black**; the trooper walking toward the camera is white. Materials are white, non-metal, textured (probed in the page): it's the light, not the file |
| `jango` | crew | right |
| `r5` | still, a machine's hum | right for a droid |
| `aiwha` ×4 | still Meshy model, given a **person's** sway and breath (`actors.js:407-415`) | a whale that bobs like a man |
| clones / battle droids of the ground war, the garrison's swap | crew | right; their built figures are the fallback if both GLBs fail |

And the place itself:

- **Slave I** (`kind: 'slave1'`, `props/core.js:1324`) is a built dark-green slab twice the height of the player; the site already has two Slave I GLBs (`public/models/universe/slave1.glb`, credited; the galaxy flies it).
- **The pads** (`kpad`) read as plain sci-fi discs; the buildings audit (`docs/research/2026-10-07-star-wars-buildings-audit.md`, Kamino) asks for dark wet steel, amber strip lights and a flared pylon with hanging pods. **The towers** (`tipoca`) are a coffee-table drum standing in for all fourteen; the audit asks for a Meshy remake. The domes (`tipocadome`, 7/8) stay.
- **Nothing to go into**: no zones. **One quest** (`jango`: reach the platform, shoot Jango, he falls over at 6 hp). **No assault** (`missions/assaults.js` has eight worlds, not Kamino). **The mission is `soon`.**
- **The checks don't cover it**: `sites.test.js:63-75` passes a kind that is crew, built or placeable, so `villager` passes; the figures audit reads only the site's and the zones' `life`, not the quests' spawns, the ground war or an assault, and fails only on the kinds its `EXPECTED` list names.

## Approaches considered

1. **Swap the one blob.** Make Boba a model, done. Cheapest; the Kaminoans stay stalks, the clones stay black, Slave I stays a slab, and the next quest that spawns a `villager` brings the blob back with no test to stop it.
2. **A Kamino world of its own** (`src/components/kamino/`): its own scene and rules. The most freedom and the most code: the ground war, the quests, the HUD, the party and the online peers would all be rebuilt or reached across the islands rule.
3. **Kamino as a surface world done properly** (chosen). Keep the site data model and the surface engine. Fix the cast first and make the fix hold (a models-only world in the runtime, and a cast check that covers every source of figures); then the look, the insides, the games, each a phase and a pull request that lands on `main` on its own. Every engine change is small, pure where it can be, tested, and usable by the next world that wants it (a models-only flag, a glide for flying creatures, a hop for a rocket pack, a departing ship).

## Goals

- Every figure on Kamino, from every source, is a GLB; every person walks, talks and turns on clips. Proved by a test and by the audit, not by eye.
- Nothing on Kamino can fall back to a built figure: a failed load retries, then falls to a lesser model, then to nothing, never to `figures.js`.
- The clones read white in the storm; Slave I, the pads and the towers read as the film's.
- Three places to go into; the duel with Jango and the aiwha ride, games only Kamino has; an assault; the mission live.
- Within budget on every tier (`galaxy-check.mjs BUDGET=1`), and a phone can play all of it.

## Non-goals

- Any other world's cast (the engine changes land for all; the content is Kamino's). The Naboo lane's builders and site.
- A face rig, fingers, a crouch: the rigging lane's (`docs/superpowers/specs/2026-10-08-npc-player-rigging-design.md`, #752). Kamino's new figures are on Meshy's 24 bones like the rest of the crew, so they inherit that lane's work when it lands.
- Recorded voices: new lines go into `voicelines.js` so the voices lane can record them; nothing plays an unrecorded voice.
- A time of day, reflections, chunked terrain, Rapier on the surface.

## 1. The cast: every Kaminoan a model

### 1.1 Who, and from where

Each new figure is made with Meshy on the third account (concept image, image-to-3D at 4K PBR, Meshy's humanoid rig), compressed into `public/models/galaxy/crew/<name>.glb` by `scripts/meshy-galaxy.mjs`, credited in `src/data/modelCredits.json`, and listed in `crewList.js`. A crew row wins over a catalogue row in `anyFigure`'s order (`actors.js:455-460`), so the old statue stays in the catalogue as the fallback beneath it.

| kind | who | height | from | used for |
|---|---|---|---|---|
| `youngboba` | Boba Fett, ten years old: grey-blue jumpsuit, dark padded jerkin, short black hair | 1.37 m | Meshy (new) | the quarters, the platform with his father, the duel |
| `kaminoan` | a Kaminoan in a pale grey robe (Taun We's look: the long neck, the small head, the dark almond eyes) | 2.6 m | Meshy (new) | Taun We, the facility's Kaminoans |
| `lamasu` | the Prime Minister: taller, the head-fin, a longer white-grey robe | 2.65 m | Meshy (new) | Lama Su |
| `nalase` | the chief medical scientist: a fitted dark-grey medical robe and the Kaminoan face | 2.5 m | Meshy (new) | the growth hall (Phase 3), the facility |
| `clonecadet` | a clone cadet: grey training fatigues with blue piping and pads, bare head, the clones' face | 1.83 m | Meshy (new) | the cadets drilling, the barracks, the training run |
| `clonephase1` | the Phase I trooper: the white armour, the helmet's crest and fin | 1.83 m | Meshy (new; the Sketchfab statue stays as its fallback) | the pad's guard, the assault |
| `shaakti` | Shaak Ti, who oversaw the clones' training | 1.88 m | crew already (`crew/shaakti.glb`) | the parade ground |

Prompts describe how a figure looks, never its name (the image step turns names down, `meshy-galaxy.mjs`'s header). The concept image is checked before the 30-credit model step and the model before the 5-credit rig (the plan's review gates), so a bad concept costs 9 credits, not 44.

The Kamino batch is its own lane file, `scripts/meshy-kamino.mjs`, exporting `ASSETS` rows in `meshy-galaxy.mjs`'s format; `meshy-galaxy.mjs` merges it as the buildings script merges its lanes, and keeps its tasks in `scripts/meshy-kamino-tasks.json` (`MESHY_TASKS`), so no earlier lane's lines are touched and a task id stays with the account that made it.

### 1.2 The site's life, recast

- Boba: `{ kind: 'youngboba', … }`, the `scale` gone (the model is a boy's height).
- Lama Su: `kind: 'lamasu'`, the `scale` gone. Taun We stays `kaminoan` (her row in `sites/quests.js`).
- The three facility Kaminoans become two `kaminoan` and one `nalase`.
- The six running cadets become `clonecadet`; the twenty in ranks stay `clone` (they are troopers on parade).
- Shaak Ti stands at the parade ground's head (`[200, 28]`, `still`, facing the ranks), named, with three lines.
- The aiwhas get `glide: true` (§1.4).

### 1.3 A models-only world, and a check that covers every source

Two halves, one at run time and one in the tests, so the rule holds without anyone looking.

**At run time.** A site may say `figures: 'models'` (Kamino does). `anyFigure(kind, spec, kit, i, models, { built })` takes a last option; `createActors`, the ground war's `groundFigures.js`, the quest spawns and the assault pass `built: site.figures !== 'models'`. With `built: false` the chain is: walker → crew GLB → catalogue GLB → nothing, and `buildFigure` is never called for a person (`propFigure` stays, for the humanoid props that are models already). A kind whose models all fail to load is tried once more after 2 s (in `anyFigure`, so the crew's loader and the catalogue's both get the second try). An actor with no figure is not drawn and can't be talked to (as today), and a quest giver with none is logged once with its kind, so a hole is loud in the console and in the check below, not a blob on screen.

**In the tests.** `scripts/galaxy-figures-audit.mjs` grows from the site's `life` to every source a figure can come from on a world: the site's and its zones' `life`, the quests' `life` and every step's `spawn` (`sites/quests.js`), the ground war's sides for that world (`siteWar.js` → `troops.js`), the garrison's swaps (`garrison.js`), and the assault's sides and `hideLife` (`missions/assaults.js`). Its pure `sources(world, tables)` returns `[{ kind, from }]`; `audit` counts them by how they are drawn as now. A new `MODELS_ONLY` list (`['kamino']`) fails the audit for any kind there drawn `built`, `none`, or, for a person (not a machine or creature listed in `STILL_OK`: `r5`, `aiwha`, `probe`), `still`. `src/components/galaxy/surface/sites/kamino.cast.test.js` runs the same `sources` and `drawnAs` over the real tables under `npm test`, so CI fails the moment a Kamino row names a kind with no model; and `crew.figure.test.js`'s pattern checks every new crew file exists, is skinned on Meshy's bones and stands at its height ±5%.

### 1.4 The aiwha glides

A `life` entry with `glide: true` gets no person's sway or breath: its body banks into its turns (roll from the path's curvature, at most 0.35 rad), pitches with its climb and dive (`floats.js`'s `diveAt` already moves it), and its wings beat slowly by a bend in the vertex shader about the body's long axis (`onBeforeCompile`, amplitude by |x| from the spine, 0.25 Hz, still while diving). Pure parts (`glidePose(path, t, dive) → { roll, pitch, beat }`) in `floats.js` with tests; the shader bend in `actors.js`'s model branch for `glide` rows.

### 1.5 The black clones

Diagnosed before it is fixed (`superpowers:systematic-debugging`). What is known: the trooper's materials are white, non-metal, textured, and `scene.environment` is set; the ranks go dark from about 8 m while one walking toward the camera at 6 m is white. The candidates, cheapest test first: the shadow map's cascade or bias on still figures (toggle `castShadow` on the ranks), the ranks being lit from behind under Kamino's hemisphere (`light.ground: '#3a4650'`; turn them), the far-figure step (`FAR`, `LIVELY`) leaving a frame-stale skinned bound or normal. The fix is whichever the test proves, at the narrowest layer, for every world if it is the engine's. Acceptance: a parade clone's armour reads within 15% of the walking clone's luminance at 20 m in the same shot (measured from the screenshot's pixels).

## 2. Tipoca City, outside

First the move (no pixel changes, the rules' recipe): Kamino's site out of `sites/core.js` into `sites/kamino.js`, as Naboo's, Coruscant's and Yavin's are; `sites/index.js` spreads it in the same place. Kamino's props are already `props/core/kamino.js` after #768.

- **Slave I** becomes a catalogue row on the site's own credited GLB (`public/models/universe/slave1.glb`, upright, 21.5 m along its length, `solid` its hull's footprint), placed on the platform where the built one stands; the built `slave1` stays as its fallback. Its departure is Phase 4's.
- **The pads** (`kpad`), rebuilt in code as the audit asks, because a deck walked on at radii 16–40 m can't be a scaled model: dark wet steel (`#2b3238`, roughness 0.35, the rain's sheen), a ring of amber strip lights round the rim (emissive, one draw: an instanced strip), radial seams, a flared underside and the pylon's hanging pods under the larger pads. The walk floor, solids and stilts (`water.legs`) are unchanged.
- **The towers** (`tipoca`, `style: 'tower'`) were remade by the audit lane already (`catalog/audit.js:28`, a Meshy model with a `.lod1`): they stay. The Prime Minister's tower is checked in the shots for its height over the pad, and only its placement moves if it reads short.
- **The storm**: puddles of rain rings on the decks (`decals.js`, a ripple sheet), and the clones' and Kaminoans' materials a touch wetter in the rain (roughness −0.15, applied by the site's `wet: 0.15` through the look, the same for every figure on a wet world).

## 3. Tipoca City, inside

Three zones (the zone pattern: `sites/desert.js:371`, built high over the world, `props/insideKamino.js` with `BOUNDS`, as `insideCore.js`):

- **The growth hall** (`growthinside`), through the facility dome's door: a long white hall, rows of tall glass tubes lit from within, clone foetuses and children at their stages in them (models: none needed; the tubes' contents are silhouettes on a lit card), a walkway down the middle, Nala Se and two Kaminoans at a console.
- **The cadets' barracks and the training room** (`barracksinside`): bunks in a white curve, the mess, cadets at the tables (`clonecadet`), and a training room behind a door with training droids on a track (the Coruscant temple's `remotes` door pattern).
- **Lama Su's office** (`lamasuinside`), through the tower's door: the white oval room, the low Kaminoan chairs, the window on the storm, Lama Su (`lamasu`) and Taun We.

New people inside: the clone called **99** (`ninetynine`, Meshy, 1.6 m, stooped, a maintenance worker's coverall) in the barracks, and **Domino Squad** (Hevy, Echo, Fives, Droidbait, Cutup) as named `clonecadet`s with lines.

## 4. Jango on the platform (and the mission goes live)

The `jango` quest grows into the film's scene, and the system's mission (“Storm over Tipoca”) goes `live` with its ground half (`to: '/galaxy/kamino/surface?mission=jango'`; the space half is §7):

1. Taun We sends you to the far platform (as today).
2. **Face Jango Fett.** Jango is a hostile with a rocket pack: `hostile.hop` (`{ every: [4, 7], high: 6, far: 10 }`: a hop up and across the platform, firing his pistols in the air; `activity.js`, pure `hopPath(from, to, high, t)` in `combatRules.js` with tests), and a wrist rocket thrown on the detonator's lob (`scene.js`'s lob, `hostile.lob: { every: 9, damage: 18 }`). Boba, at the ship, shouts his lines. At 0 hp Jango doesn't die: he breaks off (`hostile.flee: 'slave1'`) and runs for his ship.
3. **Put the tracker on Slave I** (a `use` step at the ship's hull, `time: 25`): fail it and Slave I goes anyway, without a tracker, and the quest ends “lost”.
4. **Slave I lifts off**: the ship's `depart` signal (a built thing's `signal`, `placer.js`'s): it rises 30 m, turns, and flies out over the sea into the storm in 8 s, with its engines' glow and the rain round it. The ending card says whether the tracker went on.

`missions/index.js`: `missionOf('kamino', 'jango')` is a `quest` kind, on foot, with `stars` (time) and an achievement (`tracker`: “The tracker on Slave I”).

## 5. The Battle of Kamino

An assault (`missions/assaults.js`, `kamino`), from *The Clone Wars* (“ARC Troopers”): the Separatists come up out of the sea onto Tipoca's platforms, and the Grand Army holds the city.

- **Sides**: defend `REPUBLIC` with `clonecadet` among its kinds (`[['clone', 3], ['clonecadet', 1]]`); attack `SEPARATISTS` with the aqua droid (`[['battledroid', 3], ['superdroid', 1], ['aquadroid', 1]]`).
- **`aquadroid`**: a new Meshy model (unrigged: the round-bodied amphibious droid on two long legs), a catalogue row with `machine: true` and `legs: { crotch }` (`legRig.js` walks it, as it walks the Kaminoan statue today), so it strides on its own legs.
- **Posts** on the decks (each `standable` on a pad's floor): the landing pad, the parade ground, the cloning facility's door (the DNA vault: the attackers' last objective), Jango's platform (`fixed: 'attack'`, where they climb out), the Prime Minister's tower (`fixed: 'defend'`). Phases: the outer pads, the parade ground, the facility.
- **Out of the water**: the attackers' soldiers spawn at the rim of their `fixed: 'attack'` pad and climb onto it (`sides.attack.rise: 3`: a soldier starts 3 m under the deck's rim and climbs up over 1.5 s, `assault.js`, pure and tested), so they come out of the sea, not out of the air.
- Rex and Shaak Ti fight with the defenders (named, crew); `hideLife` keeps the drilling ranks and the cadets out of the way.
- `systems.js`'s `kamino.game.also` gains it (`'/galaxy/kamino/surface?mission=assault'`, “Fight it now”).

## 6. Ride an aiwha

The storm platform's toy: a ride (`rides.js`, `aiwha`, flying: `walker.js`'s flying ride, the airspeeder's) on an aiwha's back (a seat in `riders.js`'s `SEATS`, measured off the model), gliding over the waves under the lightning, banking on §1.4's pose, diving to the water and out. Get on at the storm platform; get off on any pad.

## 7. Storm over Tipoca, in space

The mission's second half, a set piece of its own (`galaxy/warpieces/kamino.js`, on the warpieces' pattern): tail Slave I from Kamino's orbit; it drops seismic charges (a blue ring that expands with a delay and a sound gap, damage inside the ring), and you lose it or keep it to the jump. Its own short spec when it is reached; it depends on nothing above but §4.

## 8. What it costs

- **Downloads**: six crew figures at ~1–1.5 MB each (Meshy, 30 k triangles, 1024 maps, meshopt), the Slave I already in the page's cache from orbit, the aqua droid (~1 MB), 99. Kamino's models are held to `galaxy-check.mjs BUDGET=1`'s row for its tier, against `lab/baseline/surface-<tier>.json`.
- **Frame**: no more people than today on the surface but for Shaak Ti and the cadets' swap; the zones are drawn only when you are in them. The aiwha's bend is a few shader instructions on four models.
- **Credits** (third account, said before each batch): Phase 1 ≈ 6 × 44 = 264 (the Phase I trooper made from words, not rigged from the statue: an arms-down statue is the pose the rigger broke on before); Phase 3 ≈ 44; Phase 5 ≈ 39. About 350 in all, of 2,760.

## 9. Checks

Every phase's pull request is green on `npm run lint`, `npm test`, `npm run build` and `node scripts/health.mjs --check --skip build`, and carries:

- the figures audit for Kamino (`node scripts/galaxy-figures-audit.mjs`), with no `built`, `none` or person-`still` row;
- `scripts/anim-check.mjs` on `#/galaxy/kamino/surface`: every figure in view under 0.15 m/s foot drift;
- `galaxy-check.mjs BUDGET=1` for Kamino at `high` and `mid`;
- before and after shots of the views it changes, at `?quality=high` on Metal, in `docs/superpowers/evidence/kamino/<phase>/`.

## Decisions (for the owner to overturn)

- **Models-only is a world's flag, not the engine's default.** Other worlds still have built people (Coruscant's caretaker and Jocasta, Naboo's farmers) until their models land; turning the fallback off everywhere would make them vanish. Kamino turns it on first; the flag is how each world follows.
- **Nothing rather than a blob.** If a model can't load twice, the figure is not drawn. A missing quest giver is louder than a wrong one, and the check catches it before the owner does.
- **Crew rows over catalogue rows.** The Kaminoan and Phase I statues stay as the fallback under the new rigged figures, so a failed crew file shows the statue, not nothing.
- **The pads are built, the towers are modelled.** A deck walked on at many radii can't be one scaled model; a tower seen from afar can.
- **One lane file for the Meshy batch**, so the account's task ids stay together and no earlier lane's rows move.

## Phases and pull requests

| Phase | What | Depends on | Done when |
|---|---|---|---|
| 0 | this design and the plan | — | merged |
| 1 | the cast (§1): six figures, the recast life, models-only, the wider audit and its test, the glide, the black clones | — | the audit shows no built/none/person-still on Kamino; the shots show Boba a boy, the Kaminoans pale and walking, the ranks white |
| 2 | the move and the look (§2) | #768 merged | the move's shots byte-equal; Slave I, the pads, the towers in the shots |
| 3 | inside (§3) | 2 | three zones, 99 and Domino Squad, each zone's shot |
| 4 | Jango (§4), the mission live | 2 | the quest's scenario test; the ending card shot |
| 5 | the Battle of Kamino (§5) | 1, 2 | the assault's rules test; a run of it in the browser to a won card |
| 6 | the aiwha ride (§6) | 1 | a ride over the sea in the browser |
| 7 | Storm over Tipoca in space (§7) | 4 | its own spec |
