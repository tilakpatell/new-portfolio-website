# The universe made vast: one sky, far stars, landmarks and the jump. The design

Date: 2026-10-08. Brainstormed with the owner; the design below was approved in chat ("Yes do both": the design, and keeping free flight beside the jump), then corrected: the sky keeps its look everywhere, fidelity only (decision 1). Anything not in the owner's words is something the repo already settled or an assumption marked as one.

## What the owner asked for

"I really like how in Star Wars galaxy it feels like a galaxy as you can't see the other worlds/planets/stars and they look like distant stars for the galaxy. Make all the universes have the same core base for like the background of the universe but then changes based on obviously the galaxy/universe itself (Rick and Morty having the curve etc). Make the main universe have that vastness feel and get rid of the hyperlanes they look bad and instead do it like star wars galaxy where u jump. The very big areas like maw and nebulas and supermassive stars should be more visible in the background. […] Also improve asset quality if you can."

## What that means here

Done means:

1. From anywhere on the universe map, every other world is a distant star. You don't see it as a planet until you're near it, as in the galaxy, where the other systems are stars in the sky.
2. Every universe keeps the one sky it already shares, as it is: natural space, the same base everywhere, with each universe's own touches on top (the Rick and Morty sector's Curve). Its look doesn't change; only its fidelity does (5).
3. The hyperlanes are gone, every trace of them: the ribbons, the streaks, the lane traffic, the rides, the lanes drive and the lane events. Getting about is the galaxy's way: put the nose on a star and jump, or pick a place on the nav map. Free flight (super speed, cruise, the pulse drive) stays beside it (the owner's call).
4. The big things (the Maw, the Veil and the Cradle, the big stars) are landmarks: they read from across the map, bigger than their true size when far off, and become the real thing as you come in.
5. The sky is sharper, looking the same: a bigger bake where the device can afford it, fine grain drawn at the screen's own resolution, and about three times the stars. No images fetched or added.

## Where it is today

- **The sky.** `galaxy/sky.js` is already shared: `createSky({ small, renderer, beacons })` bakes the galaxy's disc, core, three nebulae and dust into a cube (1024 a face, 512 on a small screen), then draws 4,200 stars (1,700 small), the system's suns and the other systems' stars (beacons) live. The galaxy (`galaxy/scene.js`) sets it per system. The universe map (`universe/scene.js`) and the Rick and Morty page (`rickmorty/GalaxyBackdrop.jsx`) borrow Kashyyyk's view of the Star Wars galaxy, with no suns and no beacons. So every universe already shares one natural-looking sky; the owner likes it and wants it kept. Under the map's 34° lens the 1024 bake is magnified about three times, so the band reads soft.
- **Far places.** `universe/farPlaces.js` draws every place past `FAR_REAL` (24,000) from the camera as a coloured speck on the sky, and the real mesh nearer. The fandoms' worlds sit 8,000 to 22,500 from home and a few thousand apart, so from most spots several are drawn as real little planets. `beacons.js` puts a glowing dot over every world, the same size from anywhere. The DOM names (`scene.js`'s `placeLabels`) show for every place in the sector that's on screen, and `deepspace.js`'s wonder names whenever you're out of the home system. Together they are the clutter in the shots (`lab/universe/before` on this branch's working copy).
- **The hyperlanes.** `hyperlanes.js` (the web: `NODES`, `LANES`, `routeTo`), `laneFlow.js`, `laneLook.js`, `laneRibbons.js`, `laneStreaks.js`, `laneTraffic.js`, `lanePilot.js`, `laneEvents.js`, `ride.js` and `expanse/gen/lanes.js`, about 3,050 lines with their tests. They are used by `scene.js` (rides, the lanes autopilot, the look, lane hits), `nav.js` (the `lanes` drive, the default), `NavMap.jsx` (the lanes drawn, the route), `UniverseMap.jsx` (the ride line), `director.js` (the `lane` zone: interdiction, lane jam, ambush), `mines.js` (`R`), `online/pilots.js` (other pilots as streaks along a lane), `poses.js` (`lane-ride`), `front.js` and `farFights.js` (`NODES` as where the fronts and far fights are), the Expanse (`expanse/scene/expanse.js` and `sectors.js`: generated lanes as ribbons) and `universe.css` / `navmap.css`.
- **The jump.** `nav.js`'s `hyper` drive: `travel(id, 'hyper')` sets `state.jump = { id, park, at: now + 1.2 }`, the page plays the crew's jump (`jumpEvent`), and at the flash the ship is parked at the place (`arriveAt`). It goes the instant it's asked, from whatever way the ship faces, and recharges for 30 s ("the jump the rare one" since the lanes came). `J` jumps to the place picked, or opens the nav map. The galaxy's jump (`galaxy/scene.js`'s `startJump` and `jumpFrame`) aims first: point the nose at a star (`systems.js`'s `starAhead`) and its name shows, `J` turns the ship onto it (align, `space.js`'s `steerToward` and `aligned`), spools, and only then jumps.
- **The big things.** `deepspace.js` draws the Maw (disk 500 across in radius), the nebulae (puffs, 700 and 600 in radius), the stars (Ember 180, Halcyon 150, the Twins, the Lantern, the home sun 75) as real geometry, and past 24,000 they're `farPlaces` specks like any planet. The Maw is 22,000 from home, so from home it's a speck.

## Decisions

### 1. One sky, as it is, sharper

The owner's correction after the first draft: "I like how the sky already is and is like natural space: keep it like that, improve only fidelity. Don't grab images or anything and change the background." So no new looks: every universe keeps the one sky it already shares (`galaxy/sky.js`: the galaxy's own per system; Kashyyyk's view, with no suns or beacons, for the universe map, its Rick and Morty sector and the Expanse, and the Rick and Morty page's backdrop). The Rick and Morty sector's own touch is the Curve (`curve.js`), which stays as it is. The sky's colours, band, core, nebulae and dust don't change anywhere, and nothing is fetched or added as a picture.

What changes is fidelity, inside `galaxy/sky.js`, for every caller:

- **The bake's resolution by the detail level**: 2048 a face on `ultra`, 1536 on `high`, 1024 on `mid` (and when no level is given), 512 on `low` or a small screen (`bakeSize({ small, level })`; today's `small` true/false answers stay 512/1024). Callers pass `level: device().detail`. No mipmaps (the sky is always magnified: the map's lens is 34°, a face 90°), so 2048 costs 96 MB, not 128.
- **Fine grain at the screen's resolution** in the look-up shader: a 256 tiling noise made in code (`lib/texture`'s `tileFbm`, nothing fetched) read on three sides at two fine scales, brightening and darkening the baked light by up to a fifth only where it's bright (the band, the core, the nebulae), so under the narrow lens the band breaks into star clouds instead of going soft. Where the sky is dark it's untouched.
- **More stars**: 12,000 on `high` and up, 7,000 on `mid`, 3,000 on `low` or small (today 4,200 and 1,700), the faint ones a single pixel. They're drawn from the same seeded stream after today's, so today's 4,200 stay exactly where they are and the new ones are fainter on average (the extra ones' brightness scaled by 0.7), adding depth, not a new pattern.

Every bake uniform keeps today's value for every system and for Kashyyyk's borrowed view (pinned by a fixture captured before the change).


### 2. Far stars: the vastness

`farPlaces.js` and `beacons.js` are replaced by `farStars.js`. The rules are pure and tested; the drawing is one `Points`, one draw call, as `farPlaces` was.

- **Who's a far star**: every world, moon, station and wonder that isn't a landmark (decision 3), in the camera's own sector only. Rick and Morty's worlds don't show from the main map, nor the main map's from inside the Curve. The Expanse's systems (`expanse/scene/starfield.js`) are drawn by the same far stars, so they look the same.
- **Where it's real**: a place is drawn as itself within `realAt(place) = max(1500, reach × 20)` of the camera (a world, reach about 100: 2,000; Aurelia, 322: 6,440; the Star Wars gate, 218: 4,350) and as a star past it, crossfading over the last fifth (`blend`). A station counts as part of the home system: within 2,500 of the sun it's real, and past that it's nothing, and the home sun is the home system's star.
- **How it looks**: as the galaxy's other systems do (`BEACON_FRAG`): a white-hot core in a glare in its own colour (its swatch, a quarter of the way to white), four faint spikes on the brighter ones. Its brightness by distance, `k = clamp(realAt × 4 / dist, 0.12, 1)`: 7 + 13·k px across, the colour × (1.1 + 2·k). The place you're aimed at, or going to, pulses (`focus`).
- **Names**: while flying, a place's DOM name shows only when it's real, within 8° of the nose, picked, or where you're going. In the nav map's whole-map view, or without a ship, every name shows as today. The wonders' names in `deepspace.js` go by the same rule (`update`'s `names` becomes a test per wonder).

`FAR_REAL`, `SKY_FAR` and `deep.groupOf` keep their meaning for what stays.

### 3. Landmarks: the big things in the background

`landmarks.js` (rules pure and tested; one mesh of instanced quads, one draw, additive, depth-tested so a near planet hides it) draws the big things on the sky in their true direction:

| Landmark | What | Least size across | Real within |
|---|---|---|---|
| The Maw | a black shadow, the accretion disk tipped as `maw.js`'s `TILT` has it, white-blue inside to red out, the near side brighter, the far side bent over the top, a thin photon ring | 4° | where its true disk is 4° (about 14,300) |
| The Veil, the Cradle | a cloud painted once into a texture (warped noise, 1024 on `high` and up, 512 below) in its own colours, dark dust lanes across it, young stars in it | 14° | where it's 14° (the Veil about 5,700, the Cradle 4,900) |
| Ember, Halcyon, the curve's sun, the home sun | the galaxy's sun: a white-hot disc, a wide glare in its colour and faint rays | 4° glare (1.5° in the first draft: a dot from across the map, raised after the shots) | 40 of its radii |
| The Twins | two of those, each where `binaryAt` has it now | 4° each | 40 of its radii |
| The Lantern | a blue-white point in a glare, two beams sweeping round | 2.5° | 20 of its reach |

A landmark is drawn at `max(true size, least size)`. Past where it's real it is all landmark and the real thing is hidden (its group, as `farPlaces` hid them); inside, the real thing; over a fifth either side of the line they crossfade. The least sizes are where the true size meets them, so nothing pops. In the Rick and Morty sector the curve's sun is the only landmark.

### 4. The hyperlanes go

Deleted: `hyperlanes.js`, `laneFlow.js`, `laneLook.js`, `laneRibbons.js`, `laneStreaks.js`, `laneTraffic.js`, `lanePilot.js`, `laneEvents.js`, `ride.js`, `expanse/gen/lanes.js` and their tests. Their callers:

- **The nodes.** The fleet war's fronts (`front.js`'s `BEACONS`) and the far fights (`farFights.js`'s `pickFightNode`) sit at the lane nodes, and online the fronts are shared by their ids. The nodes' code (the home beacons, the region beacons, each place's ramp, and `KEEP_OUT` they keep clear of) moves to `waypoints.js` unchanged, ids and all (`beacon:<region>`, `ramp:<place>`), so the war is where it was for everyone.
- **`scene.js`**: no ride, no lanes autopilot (`state.auto` is the plain autopilot), no lane look, no lane hits, no lane events; `zoneOf` is `place` or `void`.
- **`nav.js`**: the drives are `hyper` (Jump), `super` and `cruise`, in that order; a stored `lanes` reads as `hyper`, and so does nothing stored. `legOf` and the trip times lose their lane branches.
- **`director.js`**: no `lane` zone and no `lanejam`; the convoy, the interdiction and the rest play where they did off the lanes (`place` or `void`).
- **`NavMap.jsx`**: no lanes drawn and no route along them; the course is the straight line it was for the other drives. **`UniverseMap.jsx`**: no ride line. **`mines.js`**: its own width, not the lane's `R`. **`online/pilots.js`**: a far pilot is a blip, never a streak. **`poses.js`** and `scripts/universe-check.mjs`: no `lane-ride`. **The Expanse**: no generated lanes and no ribbons. The CSS for all of it goes.
- **Docs**: the README's universe section and the architecture notes say what's there now (decisions 1 to 5), not the lanes. Older specs and hand-offs stay as the record they are.

### 5. The jump, the galaxy's way

- **Aim**: while flying, the place nearest the reticle within 0.06 rad (galaxy `starAhead` with `dirs`: far stars and landmarks of this sector, not the place you're at) is the aim. Its name shows with "J · Jump", it pulses, and the crew say what it means the first time (as the galaxy's `course` line).
- **J**: the aim, else the place picked, else the nav map, as today's fallback. A Jump button shows on the HUD while there's an aim (for touch, which has no J) and does the same; so does picking a place by clicking it (or its name) with the Jump drive, and the nav map's Go.
- **The jump itself**: `state.jump` gains phases. `align`: the ship comes round onto the place (the galaxy's `steerToward`, easing to cruise) until `aligned > 0.996` or 4.5 s; any stick input cancels it, as in the galaxy. `spool`: the page plays the crew's jump (`jumpEvent`: the site's hyperspace, Rick's portal or Blue Sky) and the ship goes straight and flat out (today's). At the flash (`HYPER.flash`, 1.2 s after the spool starts), it's out parked at the place (today's `arriveAt`). Reduced motion keeps today's straight-there trip with no align.
- **Recharge**: 5 s (`HYPER.recharge`, 30 today). Interdiction still holds it.
- **Free flight stays**: super speed and cruise on the nav map, and the pulse drive by hand, as today.

## Testing

- Pure and tested: `galaxy/sky.js` (bake size and star count by level; for Hoth, Tatooine and Kashyyyk's borrowed view the bake uniforms and the first 4,200 stars equal today's, from a fixture captured before the change; no mipmaps; the bake still six faces, the renderer left as it was), `farStars.js` (`realAt`, `blend`, brightness and size by distance, sector filtering, stations folded into home), `landmarks.js` (least size, the handover distances equal where the true size meets the least, the crossfade), `nav.js` (the drives, `parseDrive('lanes') === 'hyper'`), the aim (nearest within the cone, sticky, never the place you're at), `waypoints.js` (the same node ids and positions as `hyperlanes.js`'s `NODES` had: pinned from today's values before it's deleted).
- Updated: every test that imports a deleted module (`crews.test`, `director.test`, `farFights.test`, `front.test`, `poses.test`, `skirmish.test`, `pilotsRules.test`, `minefield.test`, `sectors.test`, the Expanse's), and `galaxy/sky.test.js` keeps passing unchanged.
- The whole suite, `npm run lint`, `npm run build`.
- Pictures: the same poses before and after on `high` (`overview`, `maw`, `far-rim`, `middleearth-limb`, and a Rick and Morty sector pose), with the HUD up, from the dev server in headless Chromium (software GL: minutes a shot). Before shots are taken on this branch before any change. Plus a jump played through in the browser (aim, J, align, spool, out) and the galaxy at Hoth to see it's unchanged.

## Non-goals

- No new 3D models, photos or textures fetched, and no change to how the sky looks: its fidelity only (the owner's word). Asset quality here is the sky's resolution, grain and stars, and the landmarks.
- The unused Milky Way photo sky (`skyShader.js`, `starField.js`, `starCatalog.js`, `stars.bin`) is left alone.
- The galaxy's own jump, systems and holomap don't change; nor the planets up close, the landings, the battles, the hunters or the economy.
- Everyday traffic round places (`traffic.js` on `lanes.js`'s local lanes) stays: it's ships coming and going at a place, not hyperlanes.
- No jump-only mode: free flight stays (the owner's call).
