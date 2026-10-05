# The universe, bigger and busier, and better joined to the site

Date: 2026-10-05. Branch: `claude/kind-ptolemy-a3pqak`. Three sub-projects, each its own PR to `main`, in this order: the events, the scale, the connections.

## Intent

The universe map (`src/components/universe/`) is the front door: the whole site as places in space, flown in a ship with a crew. It is good already (hunters, traffic, seven director events, eight wonders, a nav map with three drives, multiplayer). The owner asked for more of it: more things happening, a bigger map with more in it, and better connections between the map and the rest of the site. The owner is away; the design decisions below are made on their behalf and flagged as assumptions where they matter.

Success looks like: a visitor who flies for ten minutes meets something new every minute or two that they have not seen before; the map reads as a universe, not a neighbourhood; and from any page on the site there is one obvious step to its place on the map, and from the map one obvious step into any page, the galaxy's systems included.

## Constraints (from the code and the handoffs)

- Pure rules in tested modules (`director.js`, `deep.js`, `nav.js`, `layout.js`, `hunterRules.js`); three.js only in the drawing files. Vitest runs before every deploy.
- CI on `main` runs `eslint`, `vitest run` and `vite build`; every PR passes all three locally first.
- The ship-customisation files are not touched (`shipModels.js`, `hulls.js`, `livery.js`, `modules.js`, `outfit.js`, `paint.js`, `Hangar.jsx`).
- No sequel-trilogy Star Wars. After Episode VI, only The Mandalorian and Ahsoka (so the purrgil below are fair game: they are in Rebels and Ahsoka).
- Nothing new is downloaded at runtime: new things are built in code, or reuse models already in `public/`.
- The map's budget holds: a new wonder is a few draws; an event's set piece is made once and reused.
- The nav map's `tripTime` runs the real physics; the autopilot tests fly to every destination within 120 s of flight and must still pass after the map grows.

## Sub-project 1: more events (PR 1, then PR 2)

The director (`director.js`) picks what happens from `EVENTS` by family, weight and heat. Seven kinds today. Five more:

| id | families | weight | heat | what |
|---|---|---|---|---|
| `flare` | all | 0.9 | 0 | The nearest star flares: a swelling glare and a shell of light that reaches you a few seconds later. While it passes your shields drop by 15 and the HUD scrambles for 4 s. A sight, and a nudge. |
| `rift` | all | 1.1 | 0 | A rift tears open ahead of you and to one side: a swirling tunnel of blue-white light, 20 s long. Fly into it and it takes you, with the site's own jump flash, to the parking spot of a place picked at random (never the one you're at, never the Maw). A free jump, and a way to be somewhere new. |
| `leviathan` | all | 1.0 | 0 | Something enormous passes. Star Wars: a pod of purrgil, three to five, swimming by at their own pace with their tentacles streaming. Rick and Morty: a Cromulon head drifts into view and says what it always says. Shooting at them gets you words from the crew and nothing else. |
| `meteors` | all | 1.2 | 0 | A stream of rocks crosses your path ahead at your height: a couple of dozen over 25 s. Each is a target you can shoot (a pop, like traffic); hit one and your shields take 8. |
| `bounty` | all | 1.0 | 0.8 | A single bounty hunter comes for you, tough and quick: Boba Fett in Slave I (Star Wars; the model is already in `public/models/universe/slave1.glb`) or Phoenixperson (Rick and Morty; Birdperson's model, rebuilt). Beating one earns the Wanted achievement. |

PR 1 carries `flare`, `rift` and `leviathan` (set pieces, no new targets). PR 2 carries `meteors` and `bounty` (new targets and a new hunter faction).

### Rules

- `director.js`: the five entries. Tests: every new id belongs to the families it says; `calm` still blocks every event with heat (`bounty` included); `soon(id)` brings each on.
- The scene's `happen()` plays each out. A rift's exit is chosen in `nav.js` (`riftExit(fromId, rand)`: any goal that is a place or a wonder but the Maw and the place you're at; pure, tested).
- `hunterRules.js`: a `fett` faction (`starwars`, kinds `[['slave1', 1]]`, size `[1, 1]`) and a `phoenix` faction (`rickmorty`, `[['phoenixperson', 1]]`), with `HUNTER_KINDS` for both (hp 6 and 5, quicker than you, tail often, good lead) and `NAMES`. `hunters.js` makes their models through the fleet; `phoenixperson` is `birdperson` built with a red and chrome tint.
- Meteors: a new `meteors.js` (`createMeteors(parent, { small })` → `{ storm(ship), update(dt, ship) → events, hit(from, to) → hit | null, targets, clear(), dispose() }`): one instanced mesh of the belt's rock shapes, a straight stream with scatter, each rock `{ at, vel, size, hp: 1 }`. A `{ type: 'meteor' }` event when one hits the ship.
- Crews (`crews.js`): `events.flare`, `events.rift`, `events.rifted`, `events.leviathan`, `events.meteors`, `events.bounty` and `hunted.fett` / `hunted.phoenix` for all four crews; `kill.slave1`, `kill.phoenixperson`.
- Achievements: `wanted` ("Wanted": shot down a bounty hunter) and `rifted` ("Through the rift": took a rift somewhere).
- Sounds: the flare's rumble and the rift's hum come from `sounds.js`'s existing tone and whoosh helpers; nothing recorded.

### Set pieces (`setpieces.js`, or a file each where big)

- `flare(star)`: a sprite at the star swelling over 3 s, then a shell (the supernova's shell shader at a tenth of its size and a tenth of its life) running out to twice the star's reach. `update` reports when the shell passes the ship (for the shields and the HUD).
- `rift(at, heading)`: the portal shader (`SWIRL_GLSL`) in blue-white at radius 4, facing the ship, with a tunnel of streaming stars behind it (the gateway's tunnel, reused). Reports `inside(ship)`.
- `leviathans.js`: purrgil built from a capsule, a tapered tail with flukes and four tentacles (tubes), swimming on a convoy lane with a slow body wave; the Cromulon a box head with a jaw that opens on its line. One group at a time.

## Sub-project 2: scale and new wonders (PR 3)

### The numbers

| constant | now | new |
|---|---|---|
| `layout.js` `FIRST` | 1750 | 2000 |
| `layout.js` `STEP` | 275 | 330 |
| `layout.js` `HEIGHT` | 475 | 560 |
| `deep.js` `DEEP.edge` | 7000 | 9000 |
| `deep.js` `DEEP.ceiling` | 1150 | 1400 |

The furthest fandom goes from about 5050 out to about 5960; cruise from home to it rises from about 27 s to about 32 s, super speed from about 13 s to about 15 s. The jump is unchanged. The nav chart's square-root scale absorbs the growth.

### Five new wonders (`deep.js` `WONDERS`)

| id | name | kind | about |
|---|---|---|---|
| `lantern` | The Lantern | `pulsar` | A neutron star: tiny, blinding, with two beams sweeping round it (the supernova's pulsar, grown up). Solid at ten times its radius: nobody flies into a pulsar. |
| `twins` | The Twins | `binary` | Two suns, one gold and one white, close enough to share a bridge of gas. Two solids. Their light lights nothing else (they have no planets). |
| `wanderer` | The Wanderer | `rogue` | A rogue planet with no sun: a dark world, ice-crusted, lit by its own aurora and a thin ring of ice. Far out and below the disc. |
| `graveyard` | The Graveyard | `graveyard` | A white dwarf with a field of dead hulls round it, drifting: ships from both fandoms and neither, dark and broken, built in code and instanced. The dwarf is solid; the hulls are a sight. |
| `rim` | The Rim | `rim` | Not a wonder to fly to but the edge made visible: a wide, thin ring of ice rocks between 8000 and 8600 out, all the way round (the belt's rocks, paler, a second instance of `createBelt`). It has no entry in `WONDERS`; it is `layout.js`'s `RIM`. |

The existing eight are moved as little as possible; `deep.test.js` keeps everything clear of everything. `SUPERNOVA_SITES` grows to seven, spread for the new edge. Each new wonder gets its crash kind (`pulsar` and `binary` burn you back like a star, `rogue` takes you down like a giant, the Graveyard's dwarf burns), its nav-map line (`nav.js`), its name in the sky (`deepspace.js` labels) and its lines from all four crews (`crews.js` `wonders`).

### Drawing (`deepspace.js`)

Each kind is a function beside `giant`, `sun`, `blackHole`, `nebula` and `citadel`. The pulsar reuses the supernova's pulsar shaders. The binary reuses `sun` twice with a stretched additive sprite between. The rogue is `world('ROCK')` with a dark base, an aurora ring (an additive band shader round the poles) and a faint ring. The graveyard is one instanced mesh of six hull shapes (boxes and cylinders broken by noise) in a disc, each tumbling slowly, with the dwarf as a small hot `sun`.

## Sub-project 3: connections (PR 4)

1. **The galaxy's systems on the nav map.** `nav.js`'s `DESTINATIONS` gains the galaxy's eighteen systems (`galaxy/names.js`), kind `system`, each at the gate, with `via: 'starwars'` and `to: '/galaxy/<id>'`. The nav map lists them under the gate (a Systems filter chip). Going to one flies to the gate by the drive picked; when the ship parks there (the scene's `arrive` at `starwars`) the page goes on through to the system. "Straight in" jumps at once.
2. **Deep links to wonders.** `/universe/aurelia` (any wonder id) opens with the ship parked beside it (or the camera on it, with no ship) and the panel showing the wonder: its name, what it is, the nav map's line and a Fly here button. `parseId` stays for universes; `parseWonder` is new in `layout.js`. The nav map's place card gets a Copy link.
3. **The grand tour.** A Tour button on the nav map: the autopilot visits every destination (stations, worlds, wonders) from where you are in nearest-neighbour order on the drive picked, holding six seconds at each while the crew say their lines, Escape ends it. `nav.js`'s `tourFrom(ship, ids)` is pure and tested. The Seen it all achievement for finishing one.
4. **Every page to its place.** The footer's link row gains "This page on the universe map" linking `/universe/<its station or world>` (through `byPath`), on every page that has one.
5. **The terminal.** `fly <place>` (a station, a world, a wonder or a galaxy system, by id or name) goes to `/universe/<id>` or `/galaxy/<id>`; `map` opens the universe; `places` already lists Travel's; `universe` lists everywhere on the map with its kind.
6. **⌘K.** One entry per destination ("Fly to Aurelia", "Fly to Hoth"), generated from `DESTINATIONS`.
7. **The guide.** The `/universe` tips mention the new events, the new wonders, the tour and the systems.

## Not built

- A server, or any change to the multiplayer protocol (the new hunters go over the wire as the hunters already do: `pack` carries a kind).
- Meshy or Sketchfab downloads for the leviathans or the hulls.
- Changes to the galaxy's own map, systems or surfaces.
- Changes to the hangar's parts and paints.

## Testing

- `director.test.js`: the new kinds, families, calm, soon.
- `nav.test.js`: `riftExit`, the systems in `DESTINATIONS` (each with `via` and a real route), `tourFrom` (every id once, nearest first, from several starts).
- `deep.test.js`, `layout.test.js`, `supernova.test.js`, `lanes.test.js`: unchanged assertions over the bigger map and the new wonders.
- `hunterRules.test.js`: the two new factions and kinds.
- `meteors.test.js`: a storm crosses ahead, never through a place; a hit pops one.
- `crews.test.js`: every crew has lines for every event and wonder.
- `npm run lint`, `npm test`, `npx vite build` before every PR.
- A headless-browser pass with `window.__universeDebug.director.soon(id)` for each new event (recorded in the handoff).
