# Handoff: the universe, bigger and busier, and better joined to the site

Branch `claude/kind-ptolemy-a3pqak`, merged to `main` as it went (PRs #161, #176, #199 and the connections PR after them). The spec is `docs/superpowers/specs/2026-10-05-universe-expansion-design.md`; the plans are `docs/superpowers/plans/2026-10-05-universe-events.md`, `…-universe-scale.md` and `…-universe-connections.md`.

## What's there

### Events (the director, `universe/director.js`)

Twelve kinds now. The five new ones:

- `flare`: the nearest star (`deep.js`'s `STARS`, `nearestStar`) swells and blazes, then a shell of light runs out from it; when it reaches the ship the shields take fifteen and the HUD scrambles (`state.static`, `.universe-hud[data-static]`). `setpieces.js`'s `flare(star, ship)`.
- `rift`: a tear opens ahead and to one side (`nav.js`'s `riftSpot`, tested from every parking spot and every start), holds twenty seconds; fly into it and `scene.js`'s `riftThrough` parks you at `riftExit` (any place or wonder but where you are and the Maw). Achievement `rifted`.
- `leviathan`: `leviathans.js`, a pod of purrgil (Star Wars crews) on a convoy's lane, or a Cromulon (Rick's) that drifts in, talks and drifts off. A shot into one is a crew line, nothing more.
- `meteors`: `meteors.js` plus `lanes.js`'s `meteorLane`: a stream of rocks across your path, each a target, popped by a bolt, eight off the shields if one reaches you (swept against the ship's way, so no tunnelling). The rocks give way to hunters for the guns' lock and hold the director off while they fly.
- `bounty` (carries heat, so never while your shields are low): one hunter, `hunterRules.js`'s `fett` (Slave I) or `phoenix` (Phoenixperson: Birdperson's model in chrome and red). Their arrival is their `hunted` line. Achievement `wanted`, only for a hunter's kill (`e.hunter`), not Slave I going by as traffic.

Crews have lines for all of it (`crews.js`; an event's lines may be keyed by what came, `linesFor(crew, 'event', id, sub)`).

### Scale (`layout.js`, `deep.js`)

`FIRST` 2000, `STEP` 330, `HEIGHT` 560, `DEEP.edge` 9000, `DEEP.ceiling` 1400. `RIM` (8000 to 8600) is a second `createBelt` with pale big rocks, 700 of them, hidden from deep inside the map. Four new wonders: the Lantern (`pulsar`, solid to ten radii, reach fourteen), the Twins (`binary`: solid `twins` and part `twins-2`), the Wanderer (`rogue`, `color` for the chart and its crash, `colors` for its rock, accent and auroras), the Graveyard (`graveyard`, a dwarf and instanced hulls out to `field`). Drawn in `deepspace.js` beside the others; the nav map, the crews, the crash kinds (`startCrash`) and the guide know them. Seven supernova sites. `laneBetween` (unused by traffic now) tries chords and returns null rather than run through a giant.

### Connections (`nav.js`, `Universe.jsx`, `NavMap.jsx`)

- The galaxy's eighteen systems are destinations (`kind: 'system'`, `via: 'starwars'`, `to: '/galaxy/<id>'`); `goalOf` sends their trips, times and parking to the gate; the page's `onward` goes on through when the scene reports `arrived` at the gate (`done: true`); "Jump straight to Hoth" is the gate's jump plus the system. They're in the list (a Star systems chip), not on the chart.
- `/universe/<wonder id>` starts the ship parked beside the wonder (`startAt` prop through `UniverseMap` to the scene) with the wonder's card in the panel (Fly here). The nav map's card has Copy a link here.
- The grand tour: `tourFrom(ship)` (nearest-first over `TOUR_IDS`), the page's `tour` ref, six seconds at each place, a pill over the map, Escape or any other trip stops it. Achievement `grandtour`.
- The footer links every page to its place on the map (`byPath`); the terminal has `universe`, `map` and `fly <place>` (`findDestination`: an id, then the first match); ⌘K has a Fly to entry for every destination.

## Checks

- `scripts/events-check.mjs [crew]`: the director's rift, flare, meteors (and a bolt popping a rock), bounty and leviathans in headless Chrome.
- `scripts/wonders-check.mjs [id …]`: jumps to each wonder from the nav map and photographs it.
- `scripts/links-check.mjs`: a wonder link, a system through the gate, the tour and Escape.
- Headless Chrome here draws in software at a frame or two a second; the scene's own clock (`state.clock`) runs far slower than the wall, so every wait is on a condition, not a time.
- The suite: `npx eslint . && npx vitest run && npx vite build`. The Nostr relay test (`online/nostr.test.js`) can fail under load (a headless browser and a build running beside it); alone it passes.

## Steps left

1. The chart could place the systems inside the gate's dot (a fan of eighteen small marks) instead of leaving them to the list.
2. The galaxy's own map could offer super speed and the tour too (`ship.js`'s overdrive is generic).
3. More events, if wanted: a minefield across a lane (shoot the mines or weave), an escort (a freighter asks you to see it to the next place), an eclipse (a planet crossing the sun). `director.js` and `happen()` take a new kind in an afternoon each.
4. A rift's exit could prefer places you haven't been (`state.saw`, `state.at` history).
5. The leviathans' pass holds the director busy for the whole pass (a purrgil pod's lane is long); if that reads as a quiet spell, let `busy` drop once the pod is past the ship.
