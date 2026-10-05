# The Citadel of Ricks, inside — design

Crashing into the Citadel on the universe map used to land on the C-137 page. Now the Citadel has an inside: **the Citadel, the world**, a walkable 3D concourse in the show's look, where you play Rick C-137 through five scenes from the show. It is the third walkable world after Hobbiton and Bree, built on the same `towns/` kit.

## Brief

- **Player promise.** Portal into the Citadel of Ricks as Rick C-137 and do what the show did there: round up the loose Mortys at Morty Day Care, stack wafers at Simple Rick's, talk your way out of the Council of Ricks, vote in the Citadel's election, then get to your cruiser past Evil Morty's Cop Ricks.
- **Target feeling.** Bright, clean and absurd (a whole city of the same man), then red alarm light and a chase.
- **Primary verb.** Walk (third person, camera follows; drag to look round), as in Bree.
- **Secondary verbs.** Interact (E / tap), run (Shift), herd (walk at Mortys and they run from you), drop (Space / tap, the wafer line), answer (1–4, the Council and the ballot), hide and keep out of sight (the Cop Ricks).
- **5–30 s loop.** Walk to a marked place → its scene → a seal → the next place lights up.
- **1–5 min arc.** Arrival at the portal terminal. Three open scenes in any order (Day Care, Simple Rick's, the Council). Then election day (Vote Morty). Evil Morty wins, the lights go red, and the Cop Ricks come for C-137 (Get to the cruiser). Then the cruiser flies out, and the way leads back to the C-137 page.
- **Lose / learn / retry.** The Day Care Rick looks up before the Mortys are back: they scatter again. A wafer slides off the stack: that wafer's spoilt, and too many spoilt starts the shift again. A wrong answer to the Council: contempt, and the question comes round again. A Cop Rick catches you: back to Evil Morty's booth. Each restarts in a second.
- **Better player.** Herds from behind so the Mortys run the right way, and pens them two at a time; drops on the beat as the line speeds up; reads the Cop Ricks' sight cones and uses the core column and the kiosks to break line of sight.
- **Quality over quantity.** The site owner's word: fewer things, each made well. Every person is a real rigged model in the show's cel look (no blocky stand-ins); the concourse has one strong silhouette rather than many small rooms; five scenes, each polished, rather than more.
- **Non-goals.** No combat, no inventory, no physics engine (circles, boxes and wall segments on a flat floor), no new walking or talking systems (the `towns/` kit's), no multiplayer.

## Core loop

Player **walks** to **a scene on the list** while **loose Mortys, a speeding wafer line, the Council, or Cop Ricks** create risk; success gives **a seal and the next part of the story (election day, the red alert, the cruiser)**; failure puts them **back at the start of that scene**, at once.

## The place (metres; +x east, +z south; north is −z)

The Citadel's main concourse: a round atrium under a glass dome. A walkable disc of radius 40, with the outer wall of shopfront bays as its visible edge. The floor is flat (height 0), so `height()` is 0 everywhere and the walker needs no terrain.

| Place | Where | What |
| --- | --- | --- |
| The core | column at (0, 0), radius 5 | a column of portal fluid (dark green, churning, veined with lightning) in a teal frame behind a railing, under a saucer cap at 22 m with holo-ads round its rim (Simple Rick's; on election day, Vote Morty); its stem runs on up into the dome. Round it at 4.3 m turns a hologram of the Central Finite Curve: a walled band of universes, open at one end, with its name on it |
| Portal terminal | south, pad at (0, 35); customs desk at (5, 29) | the start, (0, 31) facing north; a Cop Rick at customs |
| Morty Day Care | west, pen centred (−25, 0), 14 × 12, low fence | gate in the east side at x = −18, z −2 … 2; the Day Care Rick's desk at (−17, −7) |
| Simple Rick's | east, shopfront door at (37, 0) facing west | the wafer factory, an inside scene |
| Council chamber | north, doors at (0, −37) facing south | two Cop Rick guards at (±3, −34); the chamber, an inside scene |
| Vote Morty booth | north-west, (−21, −21) | Evil Morty's campaign booth and the ballot box, from election day |
| Hangar | south-east, blast doors at (27, 27) facing the core | the cruiser, the finale's goal |
| Cover | benches, planters and two kiosks round the concourse | low ones (benches) block walking only; tall ones (kiosks, planters, the core) block sight too |

The concourse is a terrace over a city, as in the show's city scenes: a lit balustrade at its edge (open where the four buildings stand), and beyond it a ring of pale green and teal towers (round, stepped, bladed, crowned; their windows lit), a teal glass dome among them, a lower city floor far below, an arched viaduct at 47.5 m with a three-car monorail going round (no pier behind the edge buildings, so the hangar's bay opens clear), and a far ring of towers into the haze. Over everything: the great dome's lattice against a warm golden sky, and the Central Finite Curve as a luminous arc across it. Simple Rick's and the Council's hall are buildings at the edge (cream and wafer-brown; teal with gold bands).

Walking into the outer wall gets a line, not a silent stop ("The rest of the Citadel's four hundred levels can wait.").

## Scenes

1. **Morty Day Care** (`daycare`, open). The gate's open and six Mortys are loose on the concourse. They wander; walk within 4.5 m and they run away from you (a little slower than you run, a little faster than you walk). A Morty that goes through the gate into the pen stays in. Get all six back in within 75 s, or the Day Care Rick looks up from his magazine and they scatter again. Seal `daycare`.
2. **Simple Rick's** (`wafers`, open). Inside the factory, at the line, among Ricks in hairnets. A wafer is five layers: wafer, cream, wafer, cream, wafer. The dispenser slides back and forth over the belt; drop (Space / tap) to lay the next layer. Whatever overhangs the layer below is cut off, so the stack narrows (as in the arcade game Stacker); miss it entirely and the wafer's spoilt. The dispenser speeds up with each layer. Three good wafers (the top layer at least 70% of the full width) out of six. On the third, the jingle: "Come home to the impossible flavor of your own completion. Come home to Simple Rick's." Seal `wafers`.
3. **The Council of Ricks** (`council`, open). Through the north doors into the chamber: a dark half-round room, the Council on a high bench under spotlights. They accuse C-137; answer from the choices. Pure C-137 attitude gets you dismissed; grovelling or lying gets contempt and the question again. Seal `council`.
4. **Vote Morty** (`votemorty`, after the first three). Election day: Vote Morty posters on the holo-ring and Evil Morty's booth in the north-west. Talk to three voters round the concourse (Cowboy Rick, a Simple Rick's worker, Cop Morty), then cast your ballot at the booth. Whatever you vote, Candidate Morty wins. The lights go red. Seal `votemorty`.
5. **Get to the cruiser** (`citadelout`, after the vote). Evil Morty's Cop Ricks are hunting Rick C-137. From Evil Morty's booth, get across the concourse to the hangar unseen. They see in a cone, can't see through the core, kiosks or planters, and hear you running close by. Caught: back to the booth. Reach the hangar, and the cruiser lifts off through the opening doors as the Citadel shakes. Seal `citadelout`.

After all five, the hangar spot reads "Back to C-137" and goes to the C-137 page.

People about the concourse, each with a few of their own lines (in the show's voice; its own words where it has short famous ones): the customs Cop Rick, the Day Care Rick, Cowboy Rick, a Simple Rick's worker, Cop Morty, a Meeseeks janitor, Evil Morty at his booth (election day on), and an ambient crowd of Ricks and Mortys walking loops.

## Seals

`daycare`, `wafers`, `council`, `votemorty`, `citadelout` in `Achievements.jsx` (none of these ids is taken).

| id | name | desc |
| --- | --- | --- |
| daycare | Morty Day Care | Got six loose Mortys back into the Citadel's day care |
| wafers | Simple Rick's | Stacked three good wafers on Simple Rick's line |
| council | Rickest Rick | Talked your way out of the Council of Ricks |
| votemorty | Vote Morty | Voted in the Citadel's election (Candidate Morty won anyway) |
| citadelout | Get to the cruiser | Got past Evil Morty's Cop Ricks to the cruiser |

## The look

The show's cel look, as Portal panic already draws it: `MeshToonMaterial` with a three-step ramp (`portal/toon.js`), the `InkPass` outline, bloom for the light strips. The Citadel's palette, from the show's city scenes: mint and sage terrace, teal trim, pale green towers, a warm golden haze, cyan light, and the portal fluid's greens (`fluid.js`, shared by the core and the Council's tank). On red alert the light strips, holo-ring and Curve turn red and stutter, the haze reddens, the fluid churns faster and the key light dims. The Council's chamber is the show's green-core hall: dark teal, yellow light strips, the fluid tank behind three tall orange chairs. Outside, on the universe map, the Citadel is the show's: a ribbed glass dome with its city under it, arms out to smaller domes, hanging towers and a crystal, in an orange haze.

## Models (free first; Meshy where code can't be good enough)

- **Already on disk** (`public/games/meshy/`, rigged with idle, walk and run): `rick` (you, the Day Care Rick, the crowd), `cop` (Cop Ricks), `morty` (the Day Care Mortys, in different shirt colours, and the crowd), `evilmorty`, `meeseeks` (the janitor), `saucer` (your cruiser in the hangar).
- **New, with Meshy** (rigged, idle/walk/run, toon-textured like the rest; about 47 credits each, about 280 in all, balance 3001): `councilrick-a`, `councilrick-b`, `councilrick-c` (three distinct Council members), `cowboyrick`, `factoryrick` (a Simple Rick's worker in a jumpsuit and hairnet), `copmorty`. Added to `scripts/meshy.mjs` as a `citadel` set, written to `public/games/meshy/`, credited in `public/games/credits.json`. If one comes out badly, it's made again (only that one's step) before it's used.
- **CC0, Kenney Space Station Kit**: chairs, tables, consoles, containers, rails and pipes for the factory and the Council chamber, recoloured to the Citadel's palette; added to `scripts/kenney.mjs`, written to `public/games/kenney/`, credited in `public/games/credits.json`.
- **In code**: the terrace and its balustrade, the city round it (towers, viaduct and train, sky and dome lattice, the Curve), the core, its fluid, cap and holo-ring, the Curve's hologram, the edge buildings, the Day Care pen and its toys, the factory line and the wafers, the Council's hall, chairs and tank, the booth and ballot box, the hangar doors.
- **More variants, for the crowd**: `constructionrick`, `sweaterrick`, `suitrick`, `detectiverick` (rigged; they walk and clerk), and 18 still variants made cheaply for the crowd only (`scripts/meshy.mjs`'s `crowd` set: wizard, hazmat, sheriff, retro, visor, doofus, mullet, chef, pilot and punk Ricks; Hobbit, beanie, sheriff, overalls, mask, glasses, astronaut and punk Mortys).
- **How many people**: walking figures by device tier: 7 on `high`, 4 on `mid`, 2 on `low`, plus the named cast and the scenes' own (six Mortys, the Cop Ricks, the Council, the clerks, the line's workers). The standing crowds (at the terrace's edge, in the Council's queue, round the core, talking in groups; a 40-strong rally facing the booth on election day; nobody on red alert) are light still copies of every Rick and Morty kind (`scripts/crowd.mjs`: posed, de-skinned, simplified, 256 px textures), one instanced mesh a kind (`crowd.js`); `low` draws half of them from fewer kinds. Figures far from the camera update their animation less often.

## How it's built

New code under `src/components/rickmorty/citadel/`. The `towns/` kit (walker, story, talk, watchers, keys, map, TownHud) is used as it is.

Pure, tested:

- `layout.js` — `WORLD`, `START`, `COUNCIL_DOOR`, `SPOTS`, `COLLIDERS` (each measured from what draws it), `WALLS`, `PEN` (the Day Care pen and its gate), `ROUNDS` (the Cop Ricks' patrols), `CAST` and `castFor(mood)`, `CROWD_LOOPS`, `validAt`.
- `story.js` — `QUESTS`, `SEAL`, `citadelProgress(done)` (adds `objective` and `mood`: `day`, `election`, `red`), `CONVOS` (customs, the Council, the three voters, the ballot), `SPEAKERS`, `COPS` (the watchers' settings).
- `daycare.js` — the loose Mortys: wander, flee, the pen and its gate, the clock, scatter, win.
- `wafers.js` — the line: the dispenser's slide and speed, dropping a layer, the cut, spoilt and good wafers, the shift.

Drawing:

- `concourse.js` — the terrace, the edge buildings, the core and its holo-ring (a canvas texture, redrawn per mood), the pen, booth, kiosks and hangar.
- `city.js` — the city round the terrace, its viaduct and train, the sky and dome lattice, the Curve's arc; `fluid.js` — the portal fluid's shader; `curve.js` — the Curve's hologram.
- `crowd.js` — the standing crowds, by mood, as instanced still copies.
- `rooms.js` — the factory and the Council chamber, built under the world (as the inn is), with a camera per beat.
- `people.js` — the cast: loads the Meshy figures (`portal/meshyCast.js`'s `createMeshyCast`, with the new names in its table), makes the named cast, the crowd on its loops, the Mortys and the Cop Ricks, and poses them.
- `scene.js` — `createCitadelWorld(canvas, { onLost })` → `{ render, fx, screenOf, resize, dispose, lost, info, suggestYaw }`, the same shape as Bree's; `lib/stage3d`'s `createStage` with the `InkPass` added, as Portal3D does.

The page:

- `CitadelWorld.jsx` — the walking, HUD, scenes and talk, following `BreeWorld.jsx` and built from the `TownHud` parts; cards without 3D.
- `citadel.css`, `sounds.js` (the concourse's hum and PA chime, the portal, the line's clunk and jingle, the alarm), the show's clips from `lib/clips` where they fit (`portalGun`, `imIn`, `riggity`, `wubba`).
- `src/pages/Citadel.jsx` at `#/c-137/citadel`; its leave goes to `#/c-137`.

Small changes elsewhere:

- `App.jsx`: the route, lazy-loaded.
- `RickMorty.jsx`: an "Enter the Citadel" button in the hero.
- The universe map: crashing into the Citadel goes to `#/c-137/citadel` (the C-137 page stays the Rick and Morty planet's own).
- `Achievements.jsx`: the five seals.
- `CommandPalette.jsx`: "The Citadel of Ricks".
- `worlds.js`: `WORLD_MB['/c-137']` covers the Citadel too.
- `README.md`: a line for the Citadel under "Where things live".

State: localStorage `tp-citadel-done` and `tp-citadel-at`, as JSON. Dev hook `window.__CITADEL__ = { api, sim, complete }`.

Without WebGL, held 3D or 3D off: the five scenes as cards, with the same "Load the 3D" / "Turn 3D on" button as Bree.

## Testing

- Vitest: `layout.test.js` (spots, cast and start stand clear; every scene's spot is reachable from the start; the Cop Ricks' rounds are on open ground; the hangar is reachable from the Council doors; `validAt`), `story.test.js` (quest order and moods; every conversation link points at a real node and every conversation can be won), `daycare.test.js`, `wafers.test.js`.
- `npm test`, `npm run lint`, `npm run build` clean.
- In a browser (Playwright on the pre-installed Chromium, the dev hook to skip ahead): screenshots of the concourse, each scene and red alert; no console errors; frame time checked on the `high` and `low` tiers.
