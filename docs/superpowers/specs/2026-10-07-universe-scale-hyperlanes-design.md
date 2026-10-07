# From a galaxy to a universe: scale, hyperlanes and traffic. The design

Date: 2026-10-07. Written from the owner’s brief without a question round (the owner asks not to be stopped for approvals). Every decision below is the owner’s words, something the repo already settled, or an assumption marked as one.

## What the owner asked for

“Make the universe look and feel from a galaxy to an actual universe. Make things distant, and have traffic, hyperspeed and different lanes. That also helps with it not feeling all together: the players, the AI and the battles feel more natural when they’re far apart.”

## What that means here

Today the universe map reads as one galaxy seen whole. Every place sits within 9,000 units of the home sun, the camera sees 30,000, so from anywhere you see everything; the pulse drive crosses the map in half a minute and super speed in ten seconds; the hyperdrive is a cut. Traffic is spawned round the ship and nowhere else, so the universe is only ever alive where you are. Everyone online is one crowd in one room, drawn wherever they fly; the fleet war’s fronts and the director’s fights all happen within a hundred units of you.

Done means: places are far apart, with real distance between them (minutes of free flight), and the far ones are specks of light until you come near. Between them runs a web of hyperlanes with traffic in them, in tiers (local lanes, trunk routes and an express), visible from far off as threads of moving light. You ride a lane at hyperspeed with the traffic, pull out of it anywhere, and come off at the far end. Other pilots, the hunters, the convoys and the battles are spread over that web, seen from afar and travelled to, not spawned at your elbow. A pilot who comes back after this lands in a universe, not a galaxy.

## Where it is today

- `layout.js`: the fandom planets on a golden-angle spiral, 2,000 out and 330 more each; the main sector’s edge 9,000; the Rick and Morty sector at z −40,000 with its own edge 6,000. `deep.js`’s wonders between 2,200 and 6,600 out. `scale.js` already holds the map’s scale in one place (`HOME_SCALE`, `WORLD_SCALE`, `STAR_SCALE`).
- `ship.js`: cruise 3.3, boost 12, the pulse drive 300 out in the open, super speed (`OVERDRIVE` 3) 900. `nav.js`’s drives: the hyperdrive (a 2.45 s cut, 10 s to recharge) and super speed (the autopilot on the pulse drive). `tripTime` flies the autopilot in Node to say how long.
- `lanes.js`: traffic lanes as Bézier curves round the place you’re at (`laneLocal`, `laneDepart`, `laneDock`) and across the space round you in the open (`laneNear`, `flybyLane`, `convoyLane`). `laneBetween` runs place to place but nothing uses it “now that the places are far apart (a lane between two would run for minutes out of sight)”. Traffic (`traffic.js`) keeps 8 to 18 groups alive round the ship.
- `director.js`: an event every 45 to 85 s, from a table of nineteen kinds, picked by the crew’s side and the place (`withWhere`), with no sense of whether you’re at a place, in transit or in the void.
- Online (`online/`): one Nostr room for the whole map, a pose ten times a second, every pilot drawn wherever they are, tagged within 140 units. `where.js` keeps the universe map as one place for the roster.
- The galaxy (`galaxy/`): eighteen systems, each its own space 900 across, a jump between them is a cut through the tunnel; `systems.js`’s `LANES` (the Perlemian, the Corellian Run, the Hydian Way, the Rimma, the Spine, the Western Reaches) are drawn on the holomap and used for nothing else. `HANDOFF-galaxy-roam.md`’s Phase 6 already asks for open systems and “a route finder over `LANES`”.
- Rendering: the camera’s far plane at 30,000, no floating origin (positions are plain map units; the Rick and Morty sector at 40,000 proves float precision holds that far, as three.js composes the model-view matrix in doubles). Phones and weak devices come in on `lib/detail`’s `low`.

## Decisions

### 1. The spread: four times further apart

`scale.js` gains `SPREAD = 4`. `layout.js` multiplies the fandom spiral by it (`FIRST` 2,000 → 8,000, `STEP` 330 → 1,320, `HEIGHT` 560 → 1,120: half the spread, so the disc stays a disc), the main sector’s `edge` (9,000 → 36,000) and `RIM` (8,000 to 8,600 → 32,000 to 34,400). `deep.js` multiplies each wonder’s `at` by it; a wonder’s own radius and reach stay. The home system stays as it is (it is a place, and `HOME_SCALE` already sized it). `DEEP.open` and `DEEP.ramp` stay (they are about leaving a place, not the gaps between). `universes.js` writes `SPREAD` out as a number too, as it does `HOME_SCALE`, so the prerender loads it in Node; `scale.test.js` keeps them equal.

The Rick and Morty sector moves out to `origin: [0, 0, −48000]` (past the main edge with room), its own layout unchanged: it is a pocket universe reached by portal, and its places are already a sector’s worth apart. `sectorOf`’s split moves with it (the midpoint of the two edges, as now). Nothing else about sectors changes.

Why four: at the pulse drive’s 300 units a second the nearest fandom is 27 s of free flight from home and the far ones over a minute; at the trunk lanes’ speed (below) the same trips are 6 to 15 s. That is the gap the owner asked for: a long way without a lane, a short way with one. Eight would make free flight a chore and six push the far rim past what the impostors (below) handle well; four keeps the Rick and Morty sector within the precision the map already runs at.

### 2. Far places as light: impostors past the far plane

The camera’s far plane stays at 30,000. Anything whose middle is further than `FAR_REAL = 24,000` from the camera is drawn by `farPlaces.js` as an impostor: a sprite at `SKY_FAR`’s distance along its true direction, sized to keep its true angular size (so a planet of radius 100 at 30,000 is a speck 0.4° across with a halo), coloured by the place’s own colour (`universes.js`’s `color`, a wonder’s `color`), brightening a little when it’s your destination. The real mesh is hidden past that distance and its lights off; when the ship comes within `FAR_REAL` the mesh is shown and the sprite fades over two seconds (`farPlaces.js`’s `blend(dist) -> 0…1` is pure and tested). Every place and wonder has one; the home sun too. Sprites live in one `Points` with a per-point size and colour (one draw call for the whole universe), drawn before the stars with depth off. The chart (`NavMap.jsx`) already shows every place; this is the sky doing the same.

### 3. Regions: neighbourhoods and the void

`regions.js` (pure, tested) groups the main sector’s places into regions: single-linkage clustering of every planet and wonder (not the home system, which is its own region, `home`) with link distance `LINK = 2,600` after the spread; a region’s `hub` is the reach-weighted centroid of its members, moved up or down off the disc by `HUB_LIFT = 90` and out of any member’s reach × 1.5; its `name` is “Near <its biggest member’s name>” (`home`: “The home system”). `regionAt(x, y, z) -> region | null` says which region a point is in (within `LINK` of a member) and null in the void. The test pins the count between 6 and 10 regions and every place in exactly one. The roster and the chart say the region (“Universe · Near Middle-earth”, “Universe · the void”).

### 4. Hyperlanes: the web, in three tiers

`hyperlanes.js` (pure, tested; the Bézier helpers come from `lanes.js`) builds the lane graph from `regions.js` and `layout.js`:

- **Nodes**: every place and wonder’s **ramp**, a point `RAMP_OUT = 1.6` reaches out from it on the side facing the lane (so a lane never ends inside a planet’s traffic); each region’s hub (a **beacon**, drawn as a ring, kind `beacon`); the Star Wars gate, the Rick and Morty portal and the Maw by their own ramps.
- **Local lanes** (`tier: 'local'`, speed `600` units a second): each member of a region to its hub, hub and spoke.
- **Trunk routes** (`tier: 'trunk'`, `1500`): hub to hub round the spiral in angular order (a ring road), and each hub to the home system’s beacon (a spoke). 
- **The express** (`tier: 'express'`, `4000`): the home beacon to the Star Wars gate’s ramp, to the Rick and Morty portal’s ramp and to the Maw’s ramp.
- **Geometry**: a lane is a quadratic Bézier from ramp to ramp, its middle control point lifted `LIFT = [60, 110]` above or below the disc (alternating by the lane’s index, so lanes crossing the same stretch don’t meet), checked with `lanes.js`’s `clearance` against `SOLIDS` (over 2.0; a lane that can’t clear lifts higher, then gives up and is dropped, and the test says the graph stays connected). Each lane has two **carriageways**, outbound and inbound, offset `GAP = 24` to the right of travel; a carriageway is a tube of radius `R = 6`. Traffic keeps to the right as roads do.
- **Routing**: `routeTo(ship, toId) -> { legs, time } | null`: Dijkstra over the nodes, a lane’s cost its length over its speed plus `RAMP_S = 3` a node; the way to the first ramp and from the last one flown free at the pulse drive’s speed; null when free flight is faster (short hops at a place). `legs` are `{ kind: 'fly' | 'ride', from: [x, y, z], to, lane?, way?: 'out' | 'in' }`. `laneAt(x, y, z) -> { lane, way, s, off } | null` says which carriageway a point is in (`off` the distance from its centre, `s` 0…1 along it), for the ship, the traffic and the HUD.

### 5. Riding a lane: hyperspeed you can leave

`ride.js` (pure, tested) is the ship on a lane. `enter(ship, lanes) -> ride | null`: the ship goes into a lane at a node’s **ramp ring** (radius `RING = 12`, flown through within 40° of the lane’s way) or by **merging** (inside the carriageway, heading within 25° of its tangent, at the boost or faster). `step(ride, ship, input, dt) -> { ride, ship, out: null | 'end' | 'dropped' }`: the speed spools from the entry speed to the lane’s over `SPOOL = 2.5` s (smoothstep) and holds there; the stick moves the ship across the tube (`turn` and `climb` at `DRIFT = 4` units a second, held within `R`); the throttle back (`throttle < −0.5` for half a second) or the stick past `R × 1.3` drops the ship out: `out: 'dropped'`, the speed falling back through `ship.js`’s `drop` to the pulse drive’s, on the lane’s heading; at `s = 1` the ride ends on the node’s off-ramp (`out: 'end'`, at the boost, nose on the node) unless the next leg’s lane starts at the same beacon and the throttle is forward, when it carries straight on. While riding, `ship.js`’s `step` is not run: `ride.step` owns the pose and `scene.js` applies it. The hunters cannot follow onto a lane (they break off, `escaped` with `why: 'lane'`), and a lane is no refuge for long: the lane events below.

The look of it: the galaxy’s `speedLines.js` comes to the universe map while riding (stars drawn out by speed, the lane’s ribbon streaming past), the FOV wider by the ride’s speed over the pulse drive’s (the existing boost widening, scaled), and the HUD’s gun line gives way to the lane line: the lane’s name and tier, the next node, the time to it, and “S to drop out”. The jump to lightspeed (`Hyperspace.jsx`) stays for the hyperdrive alone.

### 6. The drives: lanes by default

`nav.js`’s `DRIVES` gains `lanes` (“Hyperlanes: the autopilot takes the lanes, riding with the traffic. You fly the whole way and can pull out any time.”), the default for a new pilot (`parseDrive` falls back to it). `tripTime(ship, id, 'lanes')` is `routeTo`’s time (or the free flight’s where that wins). The autopilot on `lanes` flies `routeTo`’s legs: free to the first ramp, through its ring (so entering is the same for the autopilot and a hand), rides, comes off, and the last leg is the autopilot of today. The hyperdrive stays as the cut, but recharges in `HYPER.recharge = 30` s (was 10), so the lanes are the everyday way and the jump the rare one; super speed stays as it is. The chart draws the lanes by tier (the express brightest) and the plotted route, and the trip line says the drive’s time.

### 7. Traffic on the lanes

`laneFlow.js` (pure, tested) is the traffic in every lane at once, as numbers: a carriageway carries ships at a density by tier (`local` one per 400 units, `trunk` one per 900, `express` one per 2,500), each with a slot across the tube (`off` within `R × 0.7`, by a hash of its index), a speed `0.9 to 1.1` of the lane’s, and a phase, so the flow is in a steady state the moment the map loads (nothing spawns in front of you: a ship at `s` now was at `s − v·t` then). `flowAt(t) -> [{ lane, way, s, off, kind }]` for a lane is deterministic in `t`, so every pilot online sees the same traffic in the same places without a message. `kind` is from the side that holds the region (`sides.js`’s everyday traffic for the crew you fly; convoys on the trunks, the big ships on the express).

Drawn in two ways: far, `laneStreaks.js`, one instanced mesh of stretched quads (length by speed, additive, clamped to at least 1.5 px on screen so a lane reads from 20,000 units as moving light; `low` draws half the flow, a phone a quarter); near, `laneTraffic.js` gives the `RESOLVE = 12` flow ships nearest the ship (within `NEAR = 400`) real models from the traffic kit (`trafficModels.js`, `glbFleet.js`), which ride the lane and can be shot (a kill ends that flow ship until it wraps, and counts for `standing.js` as a freighter down). `laneRibbons.js` draws the lanes themselves: one additive line strip per carriageway, brightness by tier, a flow pattern moving with the lane’s speed in the shader, visible to 20,000. Together they are the universe’s highways at night. `traffic.js`’s local traffic round places stays, and its `laneDepart` runs now head for the place’s ramp.

### 8. The director knows where you are

`director.js`’s `update` takes `zone: 'place' | 'lane' | 'void'` (`regionAt` and `laneAt` decide) and each event says where it can happen (`zones`). At a place: hunt, distress, remover, eclipse, escort, meteors, the convoy launching. On a lane: `interdiction` (the side’s capital ship drops across the lane ahead and its gravity well drops you out: the destroyer, the Council’s cruisers and the DEA’s roadblock become this when `zone` is `lane`, by the same rules; `capitalRules.js`’s jump smear stays), `lanejam` (a wreck and mines across the carriageway: `minefield.js` placed on the lane; weave or drop out), `convoy` (a convoy you overtake, its escort warning you off), and `ambush` (`hunt` with `at: the next node`: the pack waits at your off-ramp, so a ride ends in a fight now and then). In the void: leviathan, comet, rift, flare, supernova, bounty. The weights and the pace stay. A fight is where you come off a lane or where you’ve stopped, never in a lane itself.

### 9. Battles and other pilots, spread out

- **Far fights** (`farFights.js`, pure rules + drawing): a skirmish (`skirmish.js`) or the fleet war’s front (`front.js`) further than `2,000` from the ship draws as an impostor: a cluster of flickering points and bolt flashes at its place, its region named on the chart (“Fighting near The Veil”). `scene.js`’s `farFight` sets skirmishes going at nodes of the web (a ramp, a beacon) in the region you’re headed for, not 70 to 110 units ahead, so you see a fight from afar and take a lane to it; the one that still comes to you is the ambush above.
- **The fronts**: `front.js` places each war’s front at a trunk junction (the beacon nearest the front’s own places), so a war is somewhere, seen as a far fight from the lanes, not met by accident.
- **Other pilots**: `pilots.js` draws a pilot as a ship within `DRAW = 3,000` and as a lane streak (its own colour) beyond that while their pose says they’re riding (a new `lane` bit in the pose’s `flags`; `protocol.js`, tested); beyond that and off a lane, a blip on the chart alone. The roster (`Online.jsx`) says the region after the place (“Universe · Near Middle-earth”), from `regionAt` on the last pose; nothing new goes over the wire but the bit. `ship.js`’s `startAt` spreads new pilots over the regions’ hubs and the home edge, so the universe is peopled, not crowded.
- **The hunters**: a pack comes in at the node you’re coming off at or where you’ve stopped (`hunterRules.js`’s entry, with the node as the place), never into a lane.

### 10. The galaxy’s routes (its own lane of work)

`HANDOFF-galaxy-roam.md`’s Phase 6, scoped: `galaxy/routes.js` (pure, tested) is a route finder over `systems.js`’s `LANES` (the systems snapped to the nearest lane point within 1.2 grid squares; a jump between two systems follows the lanes where they join, else goes direct). The jump’s time is `2.5 s + 1.2 s a grid square along the route, at most 12 s` (`holdJump` keeps the tunnel up that long), `× 1.6` off the lanes, where the interdiction odds double (`interdiction.js`: the cycle’s window comes sooner). The holomap draws the plotted route along the lanes. Each system’s space grows (`space.js`’s `EDGE` 900 → 2,400, `PULSE` 62 → 120) and gets the universe’s streaks for ships leaving and arriving along the courses to the systems the lanes join it to (`courseTo`): hyperspace traffic in the sky. No flight between systems; the tunnel stays the way.

### 11. Tiers and budgets

Nothing new on `low` but the spread, the impostors and the ribbons (they are the cheap part); half the streaks, no near traffic in lanes, no speed lines. Budget on `high` at the overview pose: at most +60 draw calls and +0.3 M triangles; at a lane ride, frame time within 1.5 ms of the pulse drive’s today. Textures: none new. Every new module has its `.test.js`; drawing files read the rules and keep no rules of their own; `scene.js` gains only the calls (`lanes.update(…)`, `ride`’s branch in `fly`, `farPlaces.update(…)`), under its hard cap.

## Non-goals

- Seamless flight into the galaxy or between its systems (the tunnel stays), the galaxy flown as part of the universe map, or the Rick and Morty sector’s layout.
- A floating origin or a logarithmic depth buffer: the spread stays within the precision the map runs at today.
- New ship or station models, sound, or any change to the ways of walking.
- Rooms per region online: one room, drawn by distance; a sharded room is a later design if the crowd grows.
- WebGPU.

## The lanes of work (one worktree, branch and session each)

- **Lane A, the foundation** (first; the others wait on it): decisions 1 to 6. `scale.js`, `layout.js`, `deep.js`, `nav.js`, `ship.js` (the ride branch and `startAt`), `NavMap.jsx`, `scene.js`’s hook lines, `poses.js`, `scripts/universe-check.mjs`; new `regions.js`, `hyperlanes.js`, `ride.js`, `farPlaces.js` with their tests; the tests of `layout`, `nav`, `ship`, `scale`, `sector`, `lanes` updated for the spread.
- **Lane B, the traffic and the look** (after A merges): decision 7 and the ride’s look in 5. New `laneFlow.js`, `laneStreaks.js`, `laneRibbons.js`, `laneTraffic.js`; `speedLines.js` shared with the galaxy (moved to `lib/three/speedLines.js`, re-exported); `UniverseMap.jsx`’s lane line; `guide/pages.js`’s rows.
- **Lane C, spread out** (after A merges, beside B): decisions 8 and 9. `director.js`, `scene.js`’s `happen` for the new kinds, `minefield.js`, `skirmish.js`, `front.js`, `hunterRules.js`’s entry, `online/protocol.js`, `online/pilots.js`, `Online.jsx`; new `farFights.js`.
- **Lane D, the galaxy’s routes** (independent; now): decision 10. `galaxy/routes.js`, `galaxy/travel.js`, `galaxy/scene.js`, `galaxy/HoloMap.jsx`, `galaxy/space.js`, `galaxy/interdiction.js`.

Each lane: `npx eslint .`, `npx vitest run` on the touched suites, `node scripts/health.mjs --check --skip build`, the check script for its area in headless Chromium with screenshots in the PR, then the PR and the merge on green. The architecture notes and the README’s universe section get a paragraph each from Lane A and Lane B.
