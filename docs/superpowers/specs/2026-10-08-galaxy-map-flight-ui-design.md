# The galaxy's map, flight HUD, power-ups and upgrades

The owner asked, on 2026-10-08, to "make the galactic Map more clear in star wars galaxy. and make the vehicle powerups and upgrades and general UI much better to use for dog fights and space travel", using the site repo and the `tilakverse-assets` repo.

What they said: the map should be clearer; the ship's power-ups and upgrades and the flight UI should be much better for dogfights and for travel; the assets repo is a source. What this design assumes: "clearer" means readable at a glance (no overlapping names, fewer competing marks, a way to zoom in); "power-ups" means both the crews' G/X powers and new pickups in flight; "upgrades" means the hangar's parts, which today can't be reached from the galaxy. Per the owner's standing note (terse, no repeat asks), the picks below are taken without a checkpoint.

Success: on a 1440×900 and a 1280×720 window and a phone, (1) no system name on the map overlaps another name or dot at the default zoom, and nothing a player reads is under 0.7 rem; (2) the map zooms and pans, and M closes it; (3) while flying, deflectors, speed, the target and both powers are readable in one place at the bottom without looking round the screen, and a radar shows where the fight is; (4) kills sometimes drop pickups you fly through; (5) the hangar opens from the galaxy with H and its parts change the ship at once.

## What's there now (2026-10-08, main at 09ad7c29)

- **The map** (`galaxy/HoloMap.jsx`, `WarLayers.jsx`, `WarStrip.jsx`, `WarLegend.jsx`, `galaxy.css`, `warmap.css`): a canvas of stars under an SVG (grid, territory, regions, lanes, war lines, course) under HTML system buttons. 18 systems with up to ~9 marks each. No zoom or pan. Names placed by a hand list (`NAME_LEFT`, `badgeOf`); the Hoth / Bespin / Mustafar / Nevarro cluster collides. Region names are ~7 px and stacked on one vertical line above the core. Two filter rows (era, film) and a third war switch (Clone Wars / Civil War / Remnant War) in `WarStrip`. Axis labels 9 px; badges 10 px. M doesn't close the map (the scene's key handler returns when any `aria-modal` is open). On phones the films row is hidden outright.
- **The flight HUD** (`galaxy/GalaxyView.jsx`, the universe map's classes in `universe/universe.css`, written per frame by `galaxy/scene.js` `placeHud`/`placeShield`): reticle, lock bracket (name, distance, `--hp`), 3 threat arrows, 4 ally arrows, lead pip, nav marker. The deflector bar shows only while hunted or hurt. No speed, no radar, no kill count. Powers (`universe/PowerBar.jsx`, `powers.css`) are two 62×58 tiles at the left middle. A long one-line key hint until first flight. The galaxy flight HUD imports nothing from the HUD kit (`src/runtime/hud/`).
- **Powers**: G and X per crew (`universe/shipPowers.js`, `galaxy/powers.js`), fixed per crew. No pickups in flight.
- **Upgrades**: the hangar (`universe/Hangar.jsx`: parts, paint, shipyard, shop) mounts only on the universe map; the galaxy reads the saved loadout and build (`pages/Galaxy.jsx:154-157`) and can't change them. The loadout state and its `fit`/`setBuild` handlers live inline in `pages/Universe.jsx:105-157`.
- **Assets**: `tilakverse-assets/quaternius/ultimate-space-kit/Items/GLTF/` has CC0 pickups: `Pickup_Health`, `Pickup_Thunder`, `Pickup_Bullets`, `Pickup_Sphere`, `Pickup_Crate` (and Jar, KeyCard).

## Part A: the map (PR 1)

1. **Zoom and pan.** A pure `galaxy/mapView.js`: a view `{ k, x, y }` (scale 1–4, offset in map units), `zoomAt(view, factor, at, box)` about a point, `panBy`, `clamp` (the square always covers the box), `frame(points, box)` (the smallest view showing them, with margin, at most k 3). The canvas, SVG, territory, fleets and system list sit in one `.holomap-stage` transformed by it; names, badges and crests are counter-scaled (`scale: calc(1 / var(--k))`) so text keeps its size. Wheel and trackpad zoom about the cursor; drag pans (a press that moves under 5 px is still a click); two-finger pinch on touch; `+`, `−`, `0` (fit) keys and three buttons in the map's corner. Picking a system frames you and it when either is off screen. The canvas redraws at `min(k, 2.5)` × its CSS size × the device's pixel ratio once a zoom settles (200 ms).
2. **Names that don't collide.** A pure `galaxy/labelPlace.js`: for each system, eight places round its dot (right, left, above, below, and the four corners); greedy in priority order (where you are, the picked one, a battle on, the major order, the rest by name), each taking the place with the least overlap with the names already placed and with every dot, in screen pixels at the current zoom. Widths are measured from the DOM after layout (a layout effect), estimated from the name's length until then. It replaces `NAME_LEFT`. Ties keep the right-hand place, so the map looks as it does where nothing collides.
3. **Layers.** Toggle chips over the map's top right: Territory, Fronts (borders, offensives, fleets, rings), Lanes, Regions, Grid. Kept in `tp-galaxy-layers`. Default: everything on but Grid (its lines and letters; the panel still says the grid square).
4. **One era control.** The era chips choose the lit systems and the war shown together: Fall of the Republic shows the Clone Wars, Galactic Civil War the Civil War, the New Republic the Remnant War, Every era your oath's war. `WarStrip` keeps its standings and loses its own switch (it shows the war's name). The films move into a "Films" disclosure at the row's end (a popover of the nine), which phones get too.
5. **Readable.** Nothing under 0.7 rem: names 0.78 rem, badges and pilot counts 0.7 rem, axis letters 0.7 rem, region names set in pixels from the box's size (11.5 px on screen at any zoom). Region names spread round their rings at staggered angles (no longer stacked on one line), each tangent to its ring.
6. **You, the pick, the course.** A "YOU" tag on where you are; the picked system's ring brighter; the course drawn wider with a glow and a tag at its middle (light-years · seconds). Hovering a system shows a small card: holder, battle, distance.
7. **Find a system.** A search field in the map's toolbar ("Find a system", `/` focuses it): matches as you type, Enter picks the first and frames it.
8. **Keys.** The map handles its own: M and Esc close, Enter or J jumps to the pick, `/` find, `+ − 0` zoom. (The scene's handler stays out while a modal's open.)
9. **The panel.** With a pick: the system's name, then the jump button first ("Jump to lightspeed · J"), then distance, time and route, then the rest under "More about <name>" (a `<details>`, open on desktop). The key (`WarLegend`) grouped: Systems, The war, Routes.

## Part B: the flight HUD (PR 2)

All new parts take plain values and are written per frame through refs (the kit's rule: numbers in the frame loop, not state), use the kit's tokens (`--hud-pad*`, `--hud-min`), the house key cap (`kbd.hud-cap`), and glass at 0.78 or more.

1. **The flight cluster** (`galaxy/FlightCluster.jsx`, `galaxy/flight.css`), bottom centre, in three parts:
   - **Ship**: deflectors as a bar with its percentage, always shown while flying (red and pulsing under 35); speed as a number and a bar to the boost's top, lit while boosting; kills this flight.
   - **Target**: with a lock, its name, distance and hull bar (tough targets) or "fighter"; "T next · Q back" under it; without a lock, "No target · T".
   - **Powers**: `PowerBar` moved here (a `cluster` placement), its tiles 84×64 with the power's name, its key, and its state in words (Ready, 7 s, 64 %, On 3 s); a short glow when it comes ready; a refusal's reason on the tile for 2 s (from `powers.press`'s result).
   - Above it, the pickups' buff chips (Part C).
   On a window under 700 px tall or a phone: one row, smaller (the tiles 64×52); the touch buttons keep their places.
2. **Radar** (`galaxy/radar.js` pure, drawn by the scene on a 2D canvas in `FlightCluster`'s left, 132 px, 104 on phones): top-down in the ship's frame, nose up; hostiles red (threats bigger), allies green, the lock ringed white, objectives and the nav goal gold, pickups cyan; a contact above or below gets a tick toward its side; beyond range pinned to the rim. Range 60 units by default, 160 while nothing's near. `radarPoints(ship, contacts, range)` returns the plotted points (tested).
3. **Hits and kills.** A kill flashes the reticle's cross (`data-kill`, 0.35 s) and counts in the cluster.
4. **Travel.**
   - A course picked on the map stays when the map closes (`course` on the page, cleared on a jump or arrival): the nav marker shows "Course: Endor · 38,500 ly · J", and J with no star under the nose jumps to it (the scene's J asks the page first: `jumpKey` with the course set jumps instead of opening the map).
   - The star names near the nose stay as they are.
5. **The key help.** The one-line hint becomes a small card in three columns (Fly, Fight, Travel) with key caps, shown until first flight; after that a "Keys" chip next to the settings button opens it again.

## Part C: power-ups and upgrades (PR 3)

1. **Pickups** (`galaxy/pickups.js` pure, `galaxy/pickupFx.js` draws):
   | id | model | does |
   | --- | --- | --- |
   | `repair` | Pickup_Health | deflectors +40 at once |
   | `overcharge` | Pickup_Thunder | boost top speed and acceleration ×1.35, 12 s |
   | `rapid` | Pickup_Bullets | the guns' delay ×0.6 (never under `FASTEST`), 12 s |
   | `bubble` | Pickup_Sphere | absorbs the next 60 damage, 15 s |
   | `charge` | Pickup_Crate | the big one +25 % charge, and the G cooldown down 5 s |
   - Drops: a hostile fighter you down drops one with chance 0.35; an ace, a hunter boss or a capital ship always. At most 4 out at once; each lasts 25 s (blinking its last 5). Weighted by need: under 50 deflectors, `repair` ×3. Fly within 4 units to take one; within 14 it drifts toward you. Seeded random for the tests.
   - The same effect again extends its time (to at most twice).
   - Local only: nothing new goes on the wire. Gone on a jump, a landing or a crash. With motion reduced they're there, still (no spin or bob).
   - The model: the five glTFs packed into one `public/models/galaxy/pickups.glb` (one named node each, deduped, meshopt), by `scripts/galaxy-pickups.mjs` from the assets repo; listed in `galaxy/pack.js` and `CREDITS.md` (Quaternius, CC0).
   - Their effects reach the scene through `pickups.mods()` (`{ boost, accel, delay, absorb }`) read where `state.stats` is (the boost and guns) and in `hurt` (the bubble first); `charge` calls `powers.gain` with a new `pickup` source (not limited by `chargeFor`'s per-thing cap).
   - In the HUD: a chip per active effect above the cluster (icon, name, a ring for its time); a short line when one's taken ("Repair kit · +40 deflectors"); cyan on the radar.
2. **The hangar in the galaxy.** The loadout and build state and their handlers move out of `pages/Universe.jsx` into `universe/useShipOutfit.js` (the same behaviour, the same storage keys), used by both pages. `pages/Galaxy.jsx` mounts `Hangar` (H, and a "Hangar" button beside the flight settings; one or the other open, as on the universe map). The scene already restats on a new loadout (`scene.js:493-501`); the check confirms a fitted part changes `state.stats` in flight.

## Where the code differs

What was built in PR 3 where the text above says otherwise:

- **The hangar is the Shipyard.** #675 replaced the Hangar before this PR; Part C.2 is the Shipyard (`universe/shipyard/Shipyard.jsx`) in the galaxy. The state and handlers that were in `pages/Universe.jsx` are `shipyard/useShipyardPage.js`, over the pure `shipyard/yardPage.js` (reading and keeping the loadouts, hulls and garage under `tp-universe-loadout`, `-hull` and `-garage`, and applying a draft), used by both pages, so a fit in either is on the ship in the other (`yardPage.test.js` reads back what one keeps as the other opens). It's `useShipyardPage`, not `useShipOutfit`. H opens it (the Shipyard's own key, shut under the galaxy map and mid-jump by `enabled`), and the scene stays frozen while it's open.
- **Its door.** A desktop has the button beside the flight settings' (`Hangar.jsx`); a touch screen's corner is full, so there the door is "Open the shipyard" in the panel (`GalaxyPanel`), and the corner button is hidden. The flight settings and the yard are never open together. The secondary and ordnance lines fire on the universe map only, and the Shipyard says so over them in the galaxy (its `hint` prop).
- **Capital ships.** A battle's capital hull never goes down to the guns (`battle.js`), so only fighters drop pickups in practice; the `capital` rule is in `pickups.drop` and `scored` for when one does.
- **When they're cleared.** On a crash, being shot down, a dive and entering a system, and on a jump once it's committed (spooling), not when it's asked for: a jump the pilot takes back in the alignment keeps what they had. While a jump aligns, a pickup is neither taken nor drawn toward the ship.
- **The HUD.** The chips are `.fc-buff` (name and time, a bar along the foot for the time left; the bubble shows its points); on a phone they're short ("Rapid 12s") along the top, right of the Galaxy map button. What was taken is a note over the ship (`.galaxy-pickup-note`, the page's), with `lockSound` from the scene.
- **Credits and the pack.** The credit is `quaternius-space/pickups` in `public/games/credits.json` (where the other Quaternius galaxy models are; `modelCredits.json` is for Sketchfab), and `/models/galaxy/**` already covers the file in `pack.js`.

## Testing

- Unit (vitest): `mapView.test.js` (zoom about a point keeps it under the cursor, clamp covers the box, frame contains its points), `labelPlace.test.js` (the 18 systems at 600 px and 380 px: no name overlaps another name; ties keep the right), `radar.test.js` (nose up, left is left, out of range pinned, above/below), `pickups.test.js` (drop odds over a seeded run, the cap of 4, expiry, need-weighting, collect radius, stacking cap, mods), `useShipyardPage`'s pure half (`yardPage.test.js`) and the existing universe tests.
- Browser (headless Metal Chromium, the scratch harness and `scripts/galaxy-powers-check.mjs layout`): the map at 1440×900, 1280×720 and 390×844 (zoomed out and in, Hoth's cluster); flying with a forced battle (`__galaxyDebug.war.force`) for the cluster, radar and a pickup drop; H opens the hangar and a part changes `__galaxy()` stats. Shots before and after.
- `npm run lint`, the galaxy and universe test folders, `npm run build` (the pack check).

## Out of scope

Universe-map pickups and its flight cluster (the universe map keeps its own HUD); new powers; anything online; new sounds beyond reusing `sounds.js` blips.
